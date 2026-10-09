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
