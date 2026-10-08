/**
 * Local: the diagram as a draw.io (diagrams.net) file, `.drawio`.
 *
 * draw.io keeps a Mermaid diagram as one image cell whose `mermaidData`
 * attribute holds the source: `{"data": <code>, "config": <mermaid config>}`
 * (`EditorUi.createMermaidImageXml` in draw.io's EditorUi.js; style
 * `shape=image;noLabel=1;verticalAlign=top;imageAspect=1;editIcon=1;image=…`).
 * We write exactly that cell, with the image being our own rendered SVG, so:
 * - every draw.io (desktop, web, the VS Code extension, a viewer) shows the
 *   diagram as this editor drew it, whether or not it supports Mermaid;
 * - in a draw.io with Mermaid enabled, a double-click (or the pen handle) opens
 *   its Mermaid dialog with the source, and the edit re-renders the image with
 *   draw.io's own Mermaid. See docs-dev/EXPORTS.md for what that changes.
 * A data URI in a draw.io style drops `;base64` (`;` separates style keys),
 * which is what draw.io's `convertDataUri` does too.
 */
import { escapeXml } from './xmlText';

export interface DrawioInput {
  code: string;
  /** The mermaid config the diagram is drawn with; undefined stores none. */
  config?: Record<string, unknown>;
  height: number;
  /** The page (tab) name in draw.io. */
  name: string;
  /** The rendered SVG, base64-encoded. */
  svgBase64: string;
  width: number;
}

const round = (value: number) => Math.max(1, Math.round(value * 100) / 100);

/** The `mermaidData` JSON, as draw.io writes it (two-space indent). */
export const mermaidData = (code: string, config?: Record<string, unknown>): string =>
  JSON.stringify({ data: code, config: config ?? null }, null, 2);

/** The whole `.drawio` file. */
export const buildDrawio = ({
  code,
  config,
  height,
  name,
  svgBase64,
  width
}: DrawioInput): string => {
  const w = round(width);
  const h = round(height);
  const style = [
    'shape=image',
    'noLabel=1',
    'verticalAlign=top',
    'imageAspect=1',
    'aspect=fixed',
    'editIcon=1',
    `image=data:image/svg+xml,${svgBase64}`,
    ''
  ].join(';');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="mermaid-editor" type="device">',
    `  <diagram id="mermaid-diagram" name="${escapeXml(name)}">`,
    `    <mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${Math.ceil(w)}" pageHeight="${Math.ceil(h)}" math="0" shadow="0">`,
    '      <root>',
    '        <mxCell id="0" />',
    '        <mxCell id="1" parent="0" />',
    `        <UserObject label="" mermaidData="${escapeXml(mermaidData(code, config))}" id="2">`,
    `          <mxCell style="${escapeXml(style)}" vertex="1" parent="1">`,
    `            <mxGeometry x="0" y="0" width="${w}" height="${h}" as="geometry" />`,
    '          </mxCell>',
    '        </UserObject>',
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>',
    ''
  ].join('\n');
};
