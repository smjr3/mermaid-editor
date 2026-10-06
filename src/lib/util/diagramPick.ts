/**
 * Local: which object or arrow of the Edit card's lists (diagramModify.ts) a click
 * in the rendered SVG lands on, from the ids mermaid gives the drawn elements.
 *
 * The click's target and its ancestors up to the `<svg>` are described as plain
 * records (`PickElement`), innermost first, so the rules are testable without a
 * render. What mermaid 12 draws:
 *
 * - flowchart, state, class, ER, requirement, block, C4 nodes: `<svg>-<kind>-<id>-<n>`
 *   or `<svg>-<id>` (`pickedObject` in colors.ts, shared with the Colours card)
 * - flowchart arrows: `data-id` is mermaid's edge id, a label `edge-label-…-<id>`
 *   (`pickedEdge`)
 * - architecture: `<svg>-service-<id>`, `<svg>-group-<id>`, `<svg>-junction-<id>`;
 *   arrows `<svg>-L_<from>_<to>_<n>`
 * - class arrows `data-id="id_<from>_<to>_<n>"`, ER `id_entity-<from>-<n>_entity-<to>-<n>_<n>`,
 *   requirement `<from>-<to>-<n>`, block `<svg>-<n>-<from>-<to>`, state `edge<n>` (the
 *   n-th transition)
 * - sequence: a participant's shapes carry `data-id="<participant>"`; a message is
 *   recognised by its text (on its line too), or by the line's order when the text is
 *   not unique
 * - C4 relationships: a `<line>` and its `<text>` without ids, recognised by the text
 * - lanes and groups: a swimlane lane is `<g class="cluster swimlane" id="<lane id>">`,
 *   unprefixed; an architecture group's rect has no fill, so a click inside it lands
 *   on the canvas and is found by position (`containing`, SelectionLayer.svelte)
 * - mindmap: `<svg>-node_<n>`, the n-th topic; timeline: a `node-<n>` shape, the n-th
 *   period or event; kanban: `<svg>-<card or column id>`; gantt: `<svg>-<task id>` and
 *   `<svg>-<task id>-text`, recognised by the task's name
 */
import { pickedEdge, pickedObject } from './colors';
import { splitLines } from './diagramEdit';
import type { EditEdge, EditKind, EditObject } from './diagramModify';
import type { Selected } from './selection.svelte';

export interface PickElement {
  id: string;
  dataId: string | null;
  /** The class attribute. */
  cls: string;
  /** The text it shows (for a gantt bar, its task's name). */
  text: string;
  /** The id of the first descendant that has one (a timeline node's shape). */
  childId?: string;
  /** The text of the arrow this element draws, when the text is beside it (a sequence
   *  message's or a C4 relationship's line, or the text next to that line). */
  edgeText?: string;
  /** A sequence message line: its place among the message lines drawn, when that count
   *  matches the arrows listed. */
  order?: number;
}

export interface PickContext {
  svgId: string;
  kind: EditKind;
  code: string;
  objects: EditObject[];
  edges: EditEdge[];
}

const escape = (text: string) => text.replaceAll(/[$()*+.?[\\\]^{|}-]/g, String.raw`\$&`);
const plain = (text: string) => text.replaceAll(/\s+/g, ' ').trim();

/** The element's id without the `<svg id>-` prefix, or undefined when it has none. */
const own = (id: string, svgId: string) =>
  id.startsWith(`${svgId}-`) ? id.slice(svgId.length + 1) : undefined;

const edgePatterns: Partial<Record<EditKind, (edge: EditEdge, svgId: string) => RegExp>> = {
  architecture: ({ from, to }, svgId) =>
    new RegExp(`^${escape(svgId)}-L_${escape(from)}_${escape(to)}_\\d+$`),
  block: ({ from, to }, svgId) =>
    new RegExp(`^${escape(svgId)}-\\d+-${escape(from)}-${escape(to)}$`),
  class: ({ from, to }) => new RegExp(`^id_${escape(from)}_${escape(to)}_\\d+$`),
  er: ({ from, to }) =>
    new RegExp(`^id_entity-${escape(from)}-\\d+_entity-${escape(to)}-\\d+_\\d+$`),
  requirement: ({ from, to }) => new RegExp(`^${escape(from)}-${escape(to)}-\\d+$`)
};

const pickEdge = (element: PickElement, context: PickContext): number | undefined => {
  const { edges, kind, svgId } = context;
  if (edges.length === 0) return undefined;
  if (kind === 'flowchart') {
    return pickedEdge(
      { dataId: element.dataId, id: element.id },
      edges.map(({ id }) => id ?? '')
    );
  }
  const pattern = edgePatterns[kind];
  if (pattern) {
    const value = kind === 'architecture' ? element.id : (element.dataId ?? '');
    // Each edge's own pattern; between the same two objects the first is taken.
    const found = edges.find((edge) => value && pattern(edge, svgId).test(value));
    if (found) return found.index;
  }
  if (kind === 'state') {
    const n = /^edge(\d+)$/.exec(element.dataId ?? '')?.[1];
    if (n !== undefined && Number(n) < edges.length) return Number(n);
  }
  // A label: the arrow whose text it is, when only one has that text.
  const labelled =
    element.edgeText ??
    (/\b(?:edgeLabel|messageText)\b/.test(element.cls) ? element.text : undefined);
  if (labelled !== undefined) {
    const text = plain(labelled);
    const matches = edges.filter(({ label }) => text && plain(label) === text);
    if (matches.length === 1) return matches[0].index;
  }
  if (kind === 'sequence' && element.order !== undefined && element.order < edges.length)
    return edges[element.order].index;
  return undefined;
};

const lineId = (line: string) => /^\s*([^\s[({]+)/.exec(line)?.[1];

const pickNode = (element: PickElement, context: PickContext): string | undefined => {
  const { code, kind, objects, svgId } = context;
  const ids = objects.map(({ id }) => id);
  const rest = own(element.id, svgId);
  switch (kind) {
    case 'architecture': {
      const id = /^(?:service|group|junction)-(.+)$/.exec(rest ?? '')?.[1];
      return id && ids.includes(id) ? id : undefined;
    }
    case 'sequence': {
      // A participant's lifeline and boxes (by `data-id`, or by the name in an actor box);
      // notes and blocks are chosen from the list.
      const participants = objects.filter(({ line }) => line === undefined);
      const id = element.dataId ?? '';
      if (participants.some((o) => o.id === id)) return id;
      if (!/\bactor\b/.test(element.cls)) return undefined;
      const text = plain(element.text);
      const named = participants.filter(({ label }) => text && plain(label) === text);
      return named.length === 1 ? named[0].id : undefined;
    }
    case 'mindmap': {
      const n = /^node_(\d+)$/.exec(rest ?? '')?.[1];
      return n === undefined ? undefined : objects[Number(n)]?.id;
    }
    case 'timeline': {
      // The shape itself, or the group around it and its text.
      const itself = /^node-(\d+)$/.exec(rest ?? '')?.[1];
      const inside = /\btimeline-node\b/.test(element.cls)
        ? /^node-(\d+)$/.exec(own(element.childId ?? '', svgId) ?? '')?.[1]
        : undefined;
      const shape = itself ?? inside;
      return shape === undefined ? undefined : objects[Number(shape)]?.id;
    }
    case 'kanban': {
      if (!rest) return undefined;
      const { lines } = splitLines(code);
      return objects.find(({ line }) => line !== undefined && lineId(lines[line]) === rest)?.id;
    }
    case 'gantt': {
      if (!rest) return undefined;
      const text = plain(element.text);
      return objects.find(({ group, label }) => !group && text && plain(label) === text)?.id;
    }
    default: {
      // A lane or group: a swimlane's carries its own id, without the svg's prefix.
      const cluster = /\bcluster\b/.test(element.cls) ? (element.dataId ?? element.id) : '';
      if (cluster && ids.includes(cluster)) return cluster;
      return pickedObject(element.id, svgId, ids);
    }
  }
};

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The boxes that hold the point, smallest first, by their index (a lane in a lane: the inner one). */
export const containing = (boxes: Box[], x: number, y: number): number[] =>
  boxes
    .map((box, index) => ({ area: box.width * box.height, box, index }))
    .filter(
      ({ box }) =>
        x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height
    )
    .sort((a, b) => a.area - b.area)
    .map(({ index }) => index);

/** The object or arrow under a click: `path` is the target and its ancestors, innermost first. */
export const pickTarget = (path: PickElement[], context: PickContext): Selected | undefined => {
  for (const element of path) {
    const index = pickEdge(element, context);
    if (index !== undefined) return { index, type: 'edge' };
    const id = pickNode(element, context);
    if (id !== undefined) return { id, type: 'node' };
  }
  return undefined;
};
