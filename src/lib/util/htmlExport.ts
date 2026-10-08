import type { State } from '$/types';
import { toBase64 } from 'js-base64';
import type { MermaidConfig } from 'mermaid';
import { serializeState } from './serde';
import { parseConfigObject } from './stateGuard';

/**
 * Local: HTML export (HtmlExport.svelte). The diagram is already rendered SVG
 * with its icons inlined, so both forms work anywhere, offline, without this
 * editor or mermaid: a standalone page, or a single <img> tag to paste into a
 * wiki, a private page or an e-mail.
 */

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// A plain CSS colour only, so it cannot break out of the style element.
const safeColour = (value: string): string =>
  /^[#\w\s(),.%-]+$/.test(value.trim()) ? value.trim() : '#fff';

export const toStandaloneHtml = ({
  background = '#fff',
  code,
  svg,
  title
}: {
  background?: string;
  code: string;
  svg: string;
  title: string;
}): string => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 24px; font-family: sans-serif; background: ${safeColour(background)}; }
  .diagram > svg { max-width: 100%; height: auto; }
  details { margin-top: 24px; color: #888; }
  pre { padding: 12px; background: rgba(127, 127, 127, 0.12); overflow: auto; }
</style>
</head>
<body>
<div class="diagram">
${svg}
</div>
<details>
<summary>Mermaid</summary>
<pre>${escapeHtml(code)}</pre>
</details>
</body>
</html>
`;

/**
 * Rendered SVG as well-formed XML. mermaid's output is HTML (`&nbsp;`, `<br>`,
 * `xlink:href` with no prefix declared), which an SVG file or an image refuses:
 * re-read it as HTML and write it back as XML.
 */
export const toXmlSvg = (svg: string): string => {
  const element = new DOMParser().parseFromString(svg, 'text/html').querySelector('svg');
  if (!element) return svg;
  // The serializer declares the namespaces it needs; copied declarations can clash with them.
  for (const node of [element, ...element.querySelectorAll('*')]) {
    for (const { name } of [...node.attributes]) {
      if (name === 'xmlns' || name.startsWith('xmlns:')) node.removeAttribute(name);
    }
  }
  return new XMLSerializer().serializeToString(element);
};

export const toImgTag = (svg: string, alt: string): string =>
  `<img alt="${escapeHtml(alt)}" src="data:image/svg+xml;base64,${toBase64(toXmlSvg(svg))}">`;

/** An SVG file from rendered SVG: XML declaration and an opaque background. */
export const svgFile = (svg: string, background: string): string => {
  const colour = safeColour(background);
  const withBackground = toXmlSvg(svg).replace(/<svg\b[^>]*>/, (open) =>
    /\sstyle="/.test(open)
      ? open.replace(/\sstyle="([^"]*)"/, (_, style: string) => {
          const base = style.trim().replace(/;?$/, ';');
          return ` style="${base} background-color: ${colour}"`;
        })
      : open.replace(/^<svg/, `<svg style="background-color: ${colour}"`)
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n${withBackground}`;
};

const escapeMarkdownText = (value: string): string => value.replaceAll(/[[\]\\]/g, '\\$&');

/**
 * Markdown for a GitLab (or GitHub) page: the exported SVG, which shows the
 * diagram with every icon wherever GitLab's own mermaid cannot, a link back to
 * the editor, and the source in a collapsed plain-text block (not a mermaid
 * block, which GitLab would try to render without the icons).
 */
export const gitlabMarkdown = ({
  alt,
  code,
  editUrl,
  fileName,
  labels
}: {
  alt: string;
  code: string;
  editUrl: string;
  fileName: string;
  labels: { edit: string; source: string };
}): string => {
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(4, longestRun + 1));
  return `![${escapeMarkdownText(alt)}](${encodeURI(fileName)})

[${escapeMarkdownText(labels.edit)}](${editUrl})

<details>
<summary>${escapeHtml(labels.source)}</summary>

${fence}text
${code}
${fence}

</details>
`;
};

/**
 * The diagram at the moment an export starts. The image, the source and the
 * edit link of one export are all made from it, so typing (or a validation
 * landing) while the image renders cannot make them disagree.
 */
export interface ExportSnapshot {
  code: string;
  /** The config to render with; one that is not a JSON object renders with the defaults. */
  config: MermaidConfig;
  /** The snapshot's state, serialised for the edit link. */
  serialized: string;
  title: string;
}

/** Take the snapshot. `diagramType` is the validated type, if it is that of this code. */
export const takeExportSnapshot = (
  state: State,
  diagramType: string | undefined
): ExportSnapshot => {
  let config: MermaidConfig = {};
  try {
    config = parseConfigObject(state.mermaid) as MermaidConfig;
  } catch {
    // An unparsable config renders with the defaults, like the view's last good render.
  }
  return {
    code: state.code,
    config,
    serialized: serializeState(state),
    title: `${diagramType ?? 'mermaid'} diagram`
  };
};

type RenderSvg = (config: MermaidConfig, code: string) => Promise<string>;

/** The SVG file and the Markdown of a GitLab export, from one snapshot. */
export const buildGitLabExport = async (
  snapshot: ExportSnapshot,
  {
    background,
    editBase,
    fileName,
    labels,
    render
  }: {
    background: string;
    /** The editor's absolute URL, without the hash. */
    editBase: string;
    fileName: string;
    labels: { edit: string; source: string };
    render: RenderSvg;
  }
): Promise<{ markdown: string; svg: string }> => {
  const svg = svgFile(await render(snapshot.config, snapshot.code), background);
  const markdown = gitlabMarkdown({
    alt: snapshot.title,
    code: snapshot.code,
    editUrl: `${editBase}#${snapshot.serialized}`,
    fileName,
    labels
  });
  return { markdown, svg };
};

/** The standalone HTML page, from one snapshot. */
export const buildStandaloneHtml = async (
  snapshot: ExportSnapshot,
  { background, render }: { background: string; render: RenderSvg }
): Promise<string> =>
  toStandaloneHtml({
    background,
    code: snapshot.code,
    svg: await render(snapshot.config, snapshot.code),
    title: snapshot.title
  });
