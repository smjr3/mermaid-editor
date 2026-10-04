import { toBase64 } from 'js-base64';

/**
 * Local: HTML export (HtmlExport.svelte). The diagram is already rendered SVG
 * with its icons inlined, so both forms work anywhere, offline, without this
 * editor or mermaid: a standalone page, or a single <img> tag to paste into a
 * wiki, an intranet page or an e-mail.
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

export const toImgTag = (svg: string, alt: string): string =>
  `<img alt="${escapeHtml(alt)}" src="data:image/svg+xml;base64,${toBase64(svg)}">`;

/** An SVG file from rendered SVG: XML declaration and an opaque background. */
export const svgFile = (svg: string, background: string): string => {
  const colour = safeColour(background);
  const withBackground = svg.replace(/<svg\b[^>]*>/, (open) =>
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
