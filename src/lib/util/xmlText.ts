/**
 * Local: text for XML attributes and elements in the .drawio and .vsdx files
 * (drawioExport.ts, vsdxExport.ts). Line breaks and tabs are written as
 * character references, because a parser turns a literal one inside an
 * attribute into a space and the diagram source would lose its lines.
 */

// Characters XML 1.0 does not allow at all, even as references.
// eslint-disable-next-line no-control-regex
const invalid = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** `text` escaped for an attribute value in double quotes or for element content. */
export const escapeXml = (text: string): string =>
  text
    .replaceAll(invalid, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('\r', '&#13;')
    .replaceAll('\n', '&#10;')
    .replaceAll('\t', '&#9;');

/** The size of an SVG from its root element's viewBox, else its width/height attributes. */
export const svgSize = (svg: string): { height: number; width: number } | undefined => {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!root) return undefined;
  const attribute = (name: string) =>
    new RegExp(String.raw`\s${name}\s*=\s*["']([^"']*)["']`, 'i').exec(root)?.[1];
  const box = attribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box?.length === 4 && box[2] > 0 && box[3] > 0) return { height: box[3], width: box[2] };
  // `100%` (mermaid's own width) says nothing about the size.
  const length = (name: string) => {
    const value = attribute(name)?.trim() ?? '';
    return /^[\d.]+(?:px)?$/.test(value) ? Number.parseFloat(value) : Number.NaN;
  };
  const width = length('width');
  const height = length('height');
  return width > 0 && height > 0 ? { height, width } : undefined;
};
