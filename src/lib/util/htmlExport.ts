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
