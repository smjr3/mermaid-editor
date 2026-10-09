/**
 * Local: the diagram as a draw.io (diagrams.net) file, `.drawio`.
 *
 * Every element of the rendered diagram is its own draw.io cell (svgToDrawio.ts
 * turns the SVG into cells): shapes are vertices with the label as their value,
 * subgraphs are containers holding their nodes, links are edges connected to
 * the shapes they join, and the rest (titles, notes, axes, slices…) are text,
 * shape and line cells — so each can be selected, moved, restyled and edited in
 * draw.io. This file writes the cells as an uncompressed draw.io document.
 *
 * The Mermaid source stays in the file as the diagram's own data: the root cell
 * is a `UserObject` with a `mermaidData` attribute, `{"data": <code>, "config":
 * <mermaid config>}` (the JSON draw.io itself keeps for Mermaid,
 * `EditorUi.createMermaidData`), shown by draw.io's Edit Data with nothing
 * selected. See docs-dev/EXPORTS.md.
 */
import { deflateRaw } from 'pako';
import type { Point } from './svgPath';
import { escapeXml } from './xmlText';

export type DrawioStyle = Record<string, number | string>;

export interface DrawioVertex {
  height: number;
  id: string;
  kind: 'vertex';
  parent: string;
  style: DrawioStyle;
  /** The label, as HTML (`html=1`). */
  value: string;
  width: number;
  /** Relative to the parent cell, as draw.io stores it. */
  x: number;
  y: number;
}

export interface DrawioEdge {
  id: string;
  kind: 'edge';
  /** The label's offset from the middle of the edge. */
  labelOffset?: Point;
  parent: string;
  /** Waypoints, relative to the parent cell. */
  points: Point[];
  source?: string;
  sourcePoint: Point;
  style: DrawioStyle;
  target?: string;
  targetPoint: Point;
  value: string;
}

export type DrawioCell = DrawioEdge | DrawioVertex;

export interface DrawioInput {
  /** The page colour, or undefined for none. */
  background?: string;
  cells: DrawioCell[];
  code: string;
  /** The mermaid config the diagram is drawn with; undefined stores none. */
  config?: Record<string, unknown>;
  height: number;
  /** The page (tab) name in draw.io. */
  name: string;
  width: number;
}

/** The id of the layer every top-level cell belongs to. */
export const LAYER = '1';

const round = (value: number) => Math.round(value * 100) / 100;

/** The `mermaidData` JSON, as draw.io writes it (two-space indent). */
export const mermaidData = (code: string, config?: Record<string, unknown>): string =>
  JSON.stringify({ data: code, config: config ?? null }, null, 2);

/** Text as a draw.io HTML label: escaped, line breaks as `<br>`. */
export const htmlLabel = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll(/\r?\n/g, '<br>');

/**
 * A draw.io style string. Values cannot hold `;` (the separator) or `=` in keys;
 * numbers are rounded to two decimals.
 */
export const styleString = (style: DrawioStyle): string =>
  Object.entries(style)
    .map(([key, value]) => {
      const text = typeof value === 'number' ? String(round(value)) : value.replaceAll(';', ',');
      return key === '' ? text : `${key}=${text}`;
    })
    .join(';') + ';';

/**
 * `shape=stencil(…)`: a custom draw.io shape from its stencil XML, compressed
 * the way draw.io's `Graph.compress` does (URI-encoded, raw deflate, base64)
 * and read back by `Graph.decompress` when the cell is drawn.
 */
export const stencilShape = (xml: string): string => {
  const bytes = deflateRaw(new TextEncoder().encode(encodeURIComponent(xml)));
  let binary = '';
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return `stencil(${btoa(binary)})`;
};

const point = (p: Point, as?: string) =>
  `<mxPoint x="${round(p.x)}" y="${round(p.y)}"${as ? ` as="${as}"` : ''} />`;

const cellXml = (cell: DrawioCell, indent: string): string => {
  const head = `${indent}<mxCell id="${escapeXml(cell.id)}" value="${escapeXml(cell.value)}" style="${escapeXml(styleString(cell.style))}"`;
  if (cell.kind === 'vertex') {
    return [
      `${head} vertex="1" parent="${escapeXml(cell.parent)}">`,
      `${indent}  <mxGeometry x="${round(cell.x)}" y="${round(cell.y)}" width="${Math.max(1, round(cell.width))}" height="${Math.max(1, round(cell.height))}" as="geometry" />`,
      `${indent}</mxCell>`
    ].join('\n');
  }
  const terminals = [
    cell.source ? ` source="${escapeXml(cell.source)}"` : '',
    cell.target ? ` target="${escapeXml(cell.target)}"` : ''
  ].join('');
  const lines = [
    `${head} edge="1" parent="${escapeXml(cell.parent)}"${terminals}>`,
    `${indent}  <mxGeometry relative="1" as="geometry">`,
    `${indent}    ${point(cell.sourcePoint, 'sourcePoint')}`,
    `${indent}    ${point(cell.targetPoint, 'targetPoint')}`
  ];
  if (cell.points.length > 0) {
    lines.push(
      `${indent}    <Array as="points">`,
      ...cell.points.map((p) => `${indent}      ${point(p)}`),
      `${indent}    </Array>`
    );
  }
  if (cell.labelOffset) lines.push(`${indent}    ${point(cell.labelOffset, 'offset')}`);
  lines.push(`${indent}  </mxGeometry>`, `${indent}</mxCell>`);
  return lines.join('\n');
};

/** The whole `.drawio` file. */
export const buildDrawio = ({
  background,
  cells,
  code,
  config,
  height,
  name,
  width
}: DrawioInput): string => {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const page = background ? ` background="${escapeXml(background)}"` : '';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="mermaid-editor" type="device">',
    `  <diagram id="mermaid-diagram" name="${escapeXml(name)}">`,
    `    <mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${w}" pageHeight="${h}"${page} math="0" shadow="0">`,
    '      <root>',
    `        <UserObject label="" mermaidData="${escapeXml(mermaidData(code, config))}" id="0">`,
    '          <mxCell />',
    '        </UserObject>',
    `        <mxCell id="${LAYER}" parent="0" />`,
    ...cells.map((cell) => cellXml(cell, '        ')),
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>',
    ''
  ].join('\n');
};
