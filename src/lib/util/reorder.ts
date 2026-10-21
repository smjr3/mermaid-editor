/**
 * Local: move a flowchart node left or right among the nodes drawn beside it,
 * by reordering lines of the mermaid code. Nothing is rewritten: only whole
 * lines change places, so every node, arrow, label, style and comment keeps
 * its text; `linkStyle N` statements follow their arrows when arrow lines swap
 * (`renumberAfterMove` in diagramModify.ts).
 *
 * Why line order decides the drawing (dagre, mermaid's default layout): nodes
 * of one rank are first laid out by a depth-first walk from the roots, in the
 * order the roots were declared, following each node's outgoing arrows in the
 * order they were declared. So the order of a fan-out `C --> D`, `C --> E` is
 * the order of those arrow statements, and the order of two roots is the order
 * of their first mentions. The crossing-reduction sweeps that follow keep that
 * order for the common shapes (a chain, a fan-out from a decision, parallel
 * branches, nodes inside subgraphs).
 *
 * Siblings (`siblings`) are the nodes drawn in the same rank as the node: the
 * nodes in the same subgraph (mermaid gives a node to the first subgraph to
 * close that mentions it) with the same set of predecessors, in the order of
 * their first incoming arrow; a node without predecessors is a root, and its
 * siblings are the other roots of its subgraph at the same depth (a root whose
 * only arrows reach deep into the diagram is drawn next to its targets'
 * predecessors, not at the top), in the order of their first mentions. Known
 * limits: nodes of one rank that have different predecessors (the ends of two
 * parallel branches) are not siblings — move the branch heads instead; a node
 * with several predecessors is a sibling only of nodes with the same ones; and
 * when the two lines that decide the order are the same line (`C --> D & E`,
 * `C --> D; C --> E` on one line) the node cannot be moved, because a line's
 * content never changes.
 *
 * Supported: `flowchart`, `graph` and `flowchart-elk` headers. A swimlane
 * (`swimlane-beta`) is laid out by its own algorithm, which orders the nodes
 * of a lane by their ids and arrows, not by the code's order, so a line swap
 * would change nothing in the picture: `canMove` is false there. State and
 * class diagrams are not handled: their statements span several lines (`state
 * X { … }`, `class X { … }`, `note … end note`), so a line swap could break
 * them.
 */
import mermaid from 'mermaid';
import { headerLine, splitLines } from './diagramEdit';
import {
  checkEdit,
  editKind,
  flowEdges,
  flowLines,
  renumberAfterMove,
  subgraphRanges,
  type EditKind,
  type FlowEdge,
  type Range
} from './diagramModify';
import { memoByCode } from './memo';
import { diagramFromText } from './mermaid';

export type MoveDirection = 'left' | 'right';

type Db = Record<string, unknown>;
const read = (db: Db, name: string): unknown =>
  typeof db[name] === 'function' ? (db[name] as () => unknown).call(db) : undefined;
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

const flowchartHeader = /^\s*(?:flowchart-elk|flowchart|graph)\b/;

/** Only a flowchart drawn by dagre or ELK follows the code's order (see the header comment). */
const supported = (code: string, kind: EditKind): boolean =>
  kind === 'flowchart' && editKind(code) === 'flowchart' && flowchartHeader.test(headerLine(code));

/** mermaid's database for the code, or undefined when it does not parse. */
const parseDb = async (code: string): Promise<Db | undefined> => {
  try {
    await mermaid.parse(code);
    return (await diagramFromText(code)).db as Db;
  } catch {
    return undefined;
  }
};

interface Analysis {
  /** Every arrow in the code, in mermaid's order (its `linkStyle` number). */
  edges: FlowEdge[];
  eol: string;
  /** The index (in `edges`) of each node's first incoming arrow. */
  firstIn: Map<string, number>;
  lines: string[];
  /** The line of each node's first mention; the map is in first-mention order. */
  mention: Map<string, number>;
  /** The subgraph each node is drawn in ('' at the top level). */
  parent: Map<string, string>;
  /** The nodes each node has arrows from (self loops left out). */
  preds: Map<string, Set<string>>;
  ranges: Range[];
  /** Each node's rank: its depth from the roots, roots pulled down to their targets. */
  rank: Map<string, number>;
}

/** The depth of each node: the longest path from a root; a root sits one rank above its nearest target. */
const rankNodes = (ids: string[], edges: FlowEdge[]): Map<string, number> => {
  const rank = new Map(ids.map((id) => [id, 0]));
  const forward = edges.filter(({ from, to }) => from.id !== to.id);
  // Relax until stable; a cycle stops at the node count, like a bounded longest path.
  let rounds = ids.length;
  while (rounds-- > 0) {
    let changed = false;
    for (const { from, to } of forward) {
      const next = (rank.get(from.id) ?? 0) + 1;
      if (next > (rank.get(to.id) ?? 0)) {
        rank.set(to.id, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const hasIn = new Set(forward.map(({ to }) => to.id));
  for (const id of ids) {
    if (hasIn.has(id)) continue;
    const targets = forward
      .filter(({ from }) => from.id === id)
      .map(({ to }) => rank.get(to.id) ?? 1);
    if (targets.length > 0) rank.set(id, Math.min(...targets) - 1);
  }
  return rank;
};

/**
 * The code's arrows and nodes as the statements place them. Undefined when the
 * code does not parse or the statements cannot be matched with mermaid's own
 * arrow list (a syntax the tokenizer does not know): nothing is moved blindly.
 */
const analyse = memoByCode(async (code: string): Promise<Analysis | undefined> => {
  const { eol, lines } = splitLines(code);
  const flow = flowLines(lines);
  const edges = flowEdges(flow);
  const db = await parseDb(code);
  if (!db) return undefined;
  const theirs = list(read(db, 'getEdges'));
  const agree =
    edges.length === theirs.length &&
    edges.every(({ from, to }, i) => theirs[i].start === from.id && theirs[i].end === to.id);
  if (!agree) return undefined;

  const mention = new Map<string, number>();
  for (const { chains, index } of flow) {
    for (const chain of chains) {
      for (const node of chain.groups.flat()) {
        if (!mention.has(node.id)) mention.set(node.id, index);
      }
    }
  }
  const preds = new Map<string, Set<string>>();
  const firstIn = new Map<string, number>();
  for (const edge of edges) {
    if (edge.from.id === edge.to.id) continue;
    if (!preds.has(edge.to.id)) preds.set(edge.to.id, new Set());
    preds.get(edge.to.id)?.add(edge.from.id);
    if (!firstIn.has(edge.to.id)) firstIn.set(edge.to.id, edge.index);
  }
  const subgraphs = list(read(db, 'getSubGraphs'));
  const parent = new Map<string, string>();
  for (const id of mention.keys()) {
    const inside = subgraphs.find(({ nodes }) => Array.isArray(nodes) && nodes.includes(id));
    parent.set(id, inside ? String(inside.id) : '');
  }
  return {
    edges,
    eol,
    firstIn,
    lines,
    mention,
    parent,
    preds,
    ranges: subgraphRanges(lines),
    rank: rankNodes([...mention.keys()], edges)
  };
});

/**
 * The ids drawn in the same rank as `id`, in the order they are drawn (left
 * to right for a top-down diagram, top to bottom for a left-to-right one),
 * `id` included; undefined when the node is unknown or the diagram is not a
 * supported flowchart. See the header comment for the heuristic.
 */
export const siblings = async (
  code: string,
  kind: EditKind,
  id: string
): Promise<string[] | undefined> => {
  if (!supported(code, kind)) return undefined;
  const found = await analyse(code);
  if (!found?.mention.has(id)) return undefined;
  const { firstIn, mention, parent, preds, rank } = found;
  const key = (node: string) =>
    [...(preds.get(node) ?? [])].sort().join('\u0000') || `\u0000root ${rank.get(node) ?? 0}`;
  const own = key(id);
  const same = [...mention.keys()].filter(
    (node) => parent.get(node) === parent.get(id) && key(node) === own
  );
  if (firstIn.has(id)) same.sort((a, b) => (firstIn.get(a) ?? 0) - (firstIn.get(b) ?? 0));
  return same;
};

/** The innermost subgraph a line is in (its `subgraph` line), or -1 at the top level. */
const blockOf = (ranges: Range[], index: number): number =>
  ranges.find(({ end, start }) => index > start && index < end)?.start ?? -1;

interface Plan {
  found: Analysis;
  /** The two lines to swap: the node's and its neighbour's. */
  pair: [number, number];
}

/**
 * The line swap that moves the node one place: for a node with predecessors,
 * the lines of its and its neighbour's first incoming arrows; for a root, the
 * lines of their first mentions. Undefined at the edge of the rank, when both
 * statements share one line, or when the lines are in different subgraphs.
 */
const plan = async (
  code: string,
  kind: EditKind,
  id: string,
  direction: MoveDirection
): Promise<Plan | undefined> => {
  const [found, same] = await Promise.all([analyse(code), siblings(code, kind, id)]);
  if (!found || !same) return undefined;
  const at = same.indexOf(id);
  const other = same[direction === 'left' ? at - 1 : at + 1];
  if (at === -1 || other === undefined) return undefined;
  const { edges, firstIn, mention, ranges } = found;
  const lineOf = (node: string): number | undefined => {
    const first = firstIn.get(node);
    return first === undefined ? mention.get(node) : edges[first].line;
  };
  const mine = lineOf(id);
  const theirs = lineOf(other);
  if (mine === undefined || theirs === undefined || mine === theirs) return undefined;
  if (blockOf(ranges, mine) !== blockOf(ranges, theirs)) return undefined;
  return { found, pair: [mine, theirs] };
};

/** Whether `moveNode` has a line swap for this node (the result is still checked by `moveNode`). */
export const canMove = async (
  code: string,
  kind: EditKind,
  id: string,
  direction: MoveDirection
): Promise<boolean> => (await plan(code, kind, id, direction)) !== undefined;

/** What a rewrite must keep: the nodes, the subgraphs' members and the arrows, as a multiset. */
const shape = async (code: string): Promise<string | undefined> => {
  const db = await parseDb(code);
  if (!db) return undefined;
  const vertices = read(db, 'getVertices');
  const nodes = vertices instanceof Map ? [...(vertices as Map<string, unknown>).keys()] : [];
  const groups = list(read(db, 'getSubGraphs')).map(
    ({ id, nodes: members }) => `${String(id)}:${list(members).map(String).sort().join(',')}`
  );
  const edges = list(read(db, 'getEdges')).map(({ end, start, stroke, text, type }) =>
    [start, end, text, type, stroke].map((value) => String(value ?? '')).join('|')
  );
  return [nodes.sort().join(' '), groups.sort().join(' '), edges.sort().join(' ')].join('\n');
};

/**
 * The code with the node moved one place left (or right) among its siblings,
 * or undefined when it cannot be moved that way. Two whole lines change
 * places and `linkStyle` numbers follow their arrows; the result must parse
 * as the same diagram with the same nodes, subgraph members and arrows.
 */
export const moveNode = async (
  code: string,
  kind: EditKind,
  id: string,
  direction: MoveDirection
): Promise<string | undefined> => {
  const planned = await plan(code, kind, id, direction);
  if (!planned) return undefined;
  const {
    found: { edges, eol, lines },
    pair: [a, b]
  } = planned;
  const out = [...lines];
  [out[a], out[b]] = [out[b], out[a]];
  renumberAfterMove(edges, out);
  const next = out.join(eol);
  if (!(await checkEdit(code, next))) return undefined;
  const [before, after] = await Promise.all([shape(code), shape(next)]);
  return before !== undefined && before === after ? next : undefined;
};
