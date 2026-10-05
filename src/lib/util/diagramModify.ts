/**
 * Local: the "Edit" card (EditControls.svelte) — change the text shown on an
 * object, delete an object with everything that refers to it, and relabel,
 * reverse, restyle or delete the arrows between objects, without writing the
 * syntax. Everything is a rewrite of the mermaid code, so a shared link keeps
 * the result, and every rewrite is checked with mermaid's own parse before it
 * is applied (`checkEdit`).
 *
 * Flowcharts and swimlane diagrams get a small tokenizer for their statements
 * (`A[x] & B --> C -->|yes| D`), so a node can be taken out of a chain, one
 * arrow of a chain can be edited on its own, and `linkStyle N` statements are
 * renumbered the way mermaid numbers arrows: by their order in the code. The
 * other types are edited statement by statement with patterns of their syntax.
 */
import mermaid from 'mermaid';
import {
  blockEnd,
  headerIndex,
  indentOf,
  nodeLabel,
  nodeLines,
  oneLine,
  sequenceText
} from './addActions';
import { headerLine, laneEnd, splitLines } from './diagramEdit';
import { memoByCode } from './memo';
import { decodeEntities, diagramEdges, diagramObjects, type DiagramObject } from './mermaid';
import { findOccurrences } from './mermaidRename';

export type EditKind =
  | 'flowchart'
  | 'state'
  | 'class'
  | 'er'
  | 'c4'
  | 'architecture'
  | 'sequence'
  | 'mindmap'
  | 'kanban'
  | 'timeline';

export interface EditObject {
  id: string;
  label: string;
  /** A lane, subgraph, group or topic with children: deleting it can keep what is inside. */
  group?: boolean;
  /** What is inside a group (recursively), for deleting it with its contents. */
  members?: string[];
  /** Line-based diagrams (mindmap, kanban, timeline): the 0-based line. */
  line?: number;
  /** Timeline events: which `: event` of the line, from 0. */
  part?: number;
  /** Has no text of its own (an architecture junction). */
  noRename?: boolean;
  /** Cannot go (the root of a mindmap). */
  noDelete?: boolean;
  /** Sequence participants: the ones that come before it, so a declaration keeps the order. */
  after?: string[];
}

export interface EditObjects {
  kind: EditKind;
  items: EditObject[];
}

export type EdgeStyle = 'solid' | 'dotted' | 'thick';

export interface EditEdge {
  /** Its position in the list (for flowcharts: its `linkStyle` number). */
  index: number;
  /** mermaid's edge id (flowcharts), for picking it in the drawing. */
  id?: string;
  from: string;
  to: string;
  label: string;
  /** How the list shows it. */
  title: string;
  style: EdgeStyle;
  head: boolean;
  /** The 0-based line of the statement (not for flowcharts). */
  line?: number;
}

export interface EditEdges {
  kind: EditKind;
  items: EditEdge[];
  /** What this type's arrow syntax allows. */
  can: { label: boolean; reverse: boolean; styles: EdgeStyle[]; head: boolean };
  /** The statements could not be matched to what mermaid drew, so the list is empty. */
  unsure?: boolean;
}

const kinds: [EditKind, RegExp][] = [
  ['flowchart', /^\s*(?:flowchart-elk|flowchart|graph|swimlane-beta)\b/],
  ['state', /^\s*stateDiagram(?:-v2)?\b/],
  ['class', /^\s*classDiagram(?:-v2)?\b/],
  ['er', /^\s*erDiagram\b/],
  ['c4', /^\s*C4(?:Context|Container|Component|Dynamic|Deployment)\b/],
  ['architecture', /^\s*architecture-beta\b/],
  ['sequence', /^\s*sequenceDiagram\b/],
  ['mindmap', /^\s*mindmap\b/],
  ['kanban', /^\s*kanban\b/],
  ['timeline', /^\s*timeline\b/]
];

/** The kind of diagram the Edit card handles, or undefined for the others. */
export const editKind = (code: string): EditKind | undefined =>
  kinds.find(([, header]) => header.test(headerLine(code)))?.[0];

// ---- Shared helpers ----

type Db = Record<string, unknown>;
const read = (db: Db, name: string): unknown =>
  typeof db[name] === 'function' ? (db[name] as () => unknown).call(db) : undefined;
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

/** mermaid's database for the code, or undefined when it does not parse. */
const parseDb = async (code: string): Promise<Db | undefined> => {
  try {
    await mermaid.parse(code);
    return (await mermaid.mermaidAPI.getDiagramFromText(code)).db as Db;
  } catch {
    return undefined;
  }
};

const escape = (id: string) => id.replaceAll(/[$()*+.?[\\\]^{|}-]/g, String.raw`\$&`);
/** A label in double quotes; a quote inside becomes mermaid's entity. */
const quoted = (text: string) => `"${text.replaceAll('"', '#quot;')}"`;
const isBlank = (line: string) => line.trim() === '' || line.trim().startsWith('%%');
const lastContent = (lines: string[]) => lines.findLastIndex((line) => line.trim() !== '');

/** The code with lines added after its last statement. */
const append = (lines: string[], added: string[]) => {
  lines.splice(lastContent(lines) + 1, 0, ...added);
};

/** Whether `id` is still named anywhere in these lines (as an identifier, not inside a label). */
const mentioned = (lines: string[], id: string) => findOccurrences(lines.join('\n'), id).length > 0;

const removeWhere = (lines: string[], test: (line: string) => boolean) => {
  for (let index = lines.length - 1; index >= 0; index--) {
    if (test(lines[index])) lines.splice(index, 1);
  }
};

/** Drops `id` from a `keyword a,b,c rest` statement; the whole line when nothing is left. */
const dropFromList = (
  lines: string[],
  pattern: RegExp,
  id: string,
  rebuild: (indent: string, ids: string[], rest: string) => string
) => {
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = pattern.exec(lines[index]);
    if (!match) continue;
    const ids = match[2].split(',').map((part) => part.trim());
    if (!ids.includes(id)) continue;
    const rest = ids.filter((part) => part !== id);
    if (rest.length === 0) lines.splice(index, 1);
    else lines[index] = rebuild(match[1], rest, match[3]);
  }
};

// ---- Flowchart statements ----

const flowKeyword =
  /^\s*(?:flowchart-elk|flowchart|graph|swimlane-beta|subgraph|end|direction|style|linkStyle|classDef|class|click|accTitle|accDescr|title)\b/;
const idPattern = /^[\p{L}\p{N}_]+(?:-(?=[\p{L}\p{N}_])[\p{L}\p{N}_]+)*/u;

interface NodeRef {
  id: string;
  /** The node as written, `A["x"]:::cls`. */
  text: string;
}
interface Chain {
  groups: NodeRef[][];
  links: string[];
}
interface FlowLine {
  index: number;
  indent: string;
  chains: Chain[];
}
interface FlowEdge {
  index: number;
  line: number;
  chain: number;
  from: NodeRef;
  to: NodeRef;
}

/** The index just past the bracket closing the one at `start`, or -1. */
const closeBracket = (text: string, start: number): number => {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      const close = text.indexOf('"', i + 1);
      if (close === -1) return -1;
      i = close;
    } else if ('[({'.includes(char) || (i === start && char === '>')) depth++;
    else if ('])}'.includes(char) && --depth === 0) return i + 1;
  }
  return -1;
};

const parseNode = (text: string, at: number): { node: NodeRef; end: number } | undefined => {
  const match = idPattern.exec(text.slice(at));
  if (!match) return undefined;
  let end = at + match[0].length;
  if (end < text.length && '[({>'.includes(text[end])) {
    end = closeBracket(text, end);
    if (end === -1) return undefined;
  }
  if (text.startsWith('@{', end)) {
    end = closeBracket(text, end + 1);
    if (end === -1) return undefined;
  }
  const cls = /^:::[\w-]+/.exec(text.slice(end));
  if (cls) end += cls[0].length;
  return { end, node: { id: match[0], text: text.slice(at, end) } };
};

// `-- text -->`, `-. text .->`, `== text ==>`; or `-->`, `-.->`, `==>`, `---`, `--o`, `<-->`,
// `~~~` …, optionally followed by `|text|`.
const arrowBody = String.raw`-{2,}(?:>|[xo])|-{3,}|={2,}(?:>|[xo])|={3,}|-\.+-(?:>|[xo])?|~{3,}`;
const linkPattern = new RegExp(
  `^(?:[<xo]?(?:--|==|-\\.)\\s+\\S.*?\\s+(?:${arrowBody}|\\.+-(?:>|[xo])?)(?![-=.>xo])|[<xo]?(?:${arrowBody})(?:\\|[^|]*\\|)?)`
);

/** The statements of one line, or undefined when it is not made of node chains. */
const parseChains = (line: string): Chain[] | undefined => {
  if (line.includes('%%')) return undefined;
  const chains: Chain[] = [];
  let i = 0;
  const skip = () => {
    while (i < line.length && /\s/.test(line[i])) i++;
  };
  const group = (chain: Chain): boolean => {
    const nodes: NodeRef[] = [];
    for (;;) {
      skip();
      const parsed = parseNode(line, i);
      if (!parsed) return false;
      nodes.push(parsed.node);
      i = parsed.end;
      skip();
      if (line[i] !== '&') break;
      i++;
    }
    chain.groups.push(nodes);
    return true;
  };
  skip();
  while (i < line.length) {
    const chain: Chain = { groups: [], links: [] };
    if (!group(chain)) return undefined;
    for (;;) {
      skip();
      if (i >= line.length || line[i] === ';') break;
      const match = linkPattern.exec(line.slice(i));
      if (!match) return undefined;
      i += match[0].length;
      chain.links.push(match[0].trim());
      if (!group(chain)) return undefined;
    }
    chains.push(chain);
    if (line[i] === ';') i++;
    skip();
  }
  return chains;
};

const flowLines = (lines: string[]): FlowLine[] => {
  const header = headerIndex(lines);
  const found: FlowLine[] = [];
  lines.forEach((line, index) => {
    if (index <= header || isBlank(line) || flowKeyword.test(line)) return;
    const chains = parseChains(line);
    if (chains) found.push({ chains, indent: /^\s*/.exec(line)?.[0] ?? '', index });
  });
  return found;
};

/** Every arrow in the order mermaid numbers them: by line, chain, link, then start × end. */
const chainEdges = (chain: Chain): [NodeRef, NodeRef][] =>
  chain.links.flatMap((_, k) =>
    chain.groups[k].flatMap((from) =>
      chain.groups[k + 1].map((to): [NodeRef, NodeRef] => [from, to])
    )
  );

const flowEdges = (flow: FlowLine[]): FlowEdge[] => {
  const edges: FlowEdge[] = [];
  for (const { chains, index: line } of flow) {
    chains.forEach((chain, chainIndex) => {
      for (const [from, to] of chainEdges(chain)) {
        edges.push({ chain: chainIndex, from, index: edges.length, line, to });
      }
    });
  }
  return edges;
};

const renderChain = (indent: string, chain: Chain) =>
  indent +
  chain.groups
    .map((group) => group.map(({ text }) => text).join(' & '))
    .reduce((result, group, k) => `${result} ${chain.links[k - 1]} ${group}`);

const hasShape = ({ id, text }: NodeRef) => text !== id;

/** The chain as single arrows between single nodes, in arrow order; a shape is written once. */
const expandChain = (chain: Chain): Chain[] => {
  if (chain.links.length === 0) return [chain];
  const seen = new Set<string>();
  const ref = (node: NodeRef): NodeRef => {
    if (seen.has(node.id)) return { id: node.id, text: node.id };
    seen.add(node.id);
    return node;
  };
  return chain.links.flatMap((link, k) =>
    chain.groups[k].flatMap((from) =>
      chain.groups[k + 1].map((to): Chain => ({ groups: [[ref(from)], [ref(to)]], links: [link] }))
    )
  );
};

/** The chain without these nodes: an emptied group splits it into pieces. */
const withoutNodes = (chain: Chain, ids: Set<string>): Chain[] => {
  const pieces: Chain[] = [];
  let current: Chain | undefined;
  chain.groups.forEach((group, k) => {
    const rest = group.filter(({ id }) => !ids.has(id));
    if (rest.length === 0) {
      current = undefined;
    } else if (current) {
      current.links.push(chain.links[k - 1]);
      current.groups.push(rest);
    } else {
      current = { groups: [rest], links: [] };
      pieces.push(current);
    }
  });
  return pieces;
};

// `linkStyle 1 …` or `linkStyle 0,2 …`; `linkStyle default` is left alone.
const linkStylePattern = /^(\s*)linkStyle\s+(\d+(?:\s*,\s*\d+)*)\s+(.*)$/;

/** `linkStyle` statements renumbered; a number mapped to undefined is dropped. */
const renumberLinkStyles = (lines: string[], map: (index: number) => number | undefined) => {
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = linkStylePattern.exec(lines[index]);
    if (!match) continue;
    const mapped = match[2]
      .split(',')
      .map((value) => map(Number(value.trim())))
      .filter((value) => value !== undefined);
    if (mapped.length === 0) lines.splice(index, 1);
    else lines[index] = `${match[1]}linkStyle ${mapped.join(',')} ${match[3]}`;
  }
};

const afterRemoving = (removed: Set<number>) => (index: number) =>
  removed.has(index) ? undefined : index - [...removed].filter((r) => r < index).length;

/**
 * A node statement left behind by a deletion (`A` from `A --> B`) is only
 * needed when it carries a shape or nothing else names the node.
 */
const dropRedundantBare = (lines: string[], candidates: { index: number; id: string }[]) => {
  for (const { index, id } of candidates.sort((a, b) => b.index - a.index)) {
    const rest = [...lines.slice(0, index), ...lines.slice(index + 1)];
    if (mentioned(rest, id)) lines.splice(index, 1);
  }
};

/** Replaces chain lines; returns the bare single-node statements it wrote, for dropRedundantBare. */
const writeChains = (
  lines: string[],
  replacements: Map<number, { indent: string; chains: Chain[] }>
): { index: number; id: string }[] => {
  const bare: { index: number; id: string }[] = [];
  for (const [index, { chains, indent }] of [...replacements.entries()].sort(
    (a, b) => b[0] - a[0]
  )) {
    lines.splice(index, 1, ...chains.map((chain) => renderChain(indent, chain)));
    // Lines after this one moved by the difference.
    for (const item of bare) if (item.index > index) item.index += chains.length - 1;
    chains.forEach((chain, offset) => {
      const only = chain.groups.length === 1 && chain.groups[0].length === 1 && chain.groups[0][0];
      if (only && !hasShape(only)) bare.push({ id: only.id, index: index + offset });
    });
  }
  return bare;
};

/**
 * Removes nodes from every statement (and whole line ranges, for a lane with
 * its contents), with their arrows, `style`, `class` and `click` statements,
 * and renumbers `linkStyle`.
 */
const removeFromFlow = (lines: string[], ids: Set<string>, range?: [number, number]) => {
  const flow = flowLines(lines);
  const removedEdges = new Set<number>();
  const inRange = (index: number) => range !== undefined && index >= range[0] && index <= range[1];
  const replacements = new Map<number, { indent: string; chains: Chain[] }>();
  for (const edge of flowEdges(flow)) {
    if (inRange(edge.line) || ids.has(edge.from.id) || ids.has(edge.to.id))
      removedEdges.add(edge.index);
  }
  if (range) {
    for (let index = range[0]; index <= range[1]; index++)
      replacements.set(index, { chains: [], indent: '' });
  }
  for (const { chains, indent, index } of flow) {
    if (inRange(index) || !chains.some((chain) => chain.groups.flat().some((n) => ids.has(n.id))))
      continue;
    replacements.set(index, {
      chains: chains.flatMap((chain) => withoutNodes(chain, ids)),
      indent
    });
  }
  dropRedundantBare(lines, writeChains(lines, replacements));
  for (const id of ids) {
    removeWhere(lines, (line) => new RegExp(`^\\s*(?:style|click)\\s+${escape(id)}\\b`).test(line));
    dropFromList(
      lines,
      /^(\s*)class\s+([\w\s,-]+?)\s+([\w-]+)\s*;?\s*$/,
      id,
      (indent, rest, cls) => `${indent}class ${rest.join(',')} ${cls}`
    );
  }
  renumberLinkStyles(lines, afterRemoving(removedEdges));
};

const subgraphPattern = (id: string) => new RegExp(`^(\\s*)subgraph\\s+${escape(id)}\\b`);

const deleteFlowObject = (lines: string[], object: EditObject, keepContents: boolean): string[] => {
  const start = lines.findIndex((line) => subgraphPattern(object.id).test(line));
  if (!object.group || start === -1) {
    removeFromFlow(lines, new Set([object.id]));
    return lines;
  }
  const end = laneEnd(lines, object.id);
  if (end === -1) return lines;
  if (!keepContents) {
    removeFromFlow(lines, new Set([object.id, ...(object.members ?? [])]), [start, end]);
    return lines;
  }
  // The wrapper goes, what is inside moves out one level.
  const inner = lines.slice(start + 1, end);
  const own = indentOf(lines[start]);
  const depth = Math.min(...inner.filter((line) => !isBlank(line)).map(indentOf));
  const shift = Number.isFinite(depth) ? Math.max(0, depth - own) : 0;
  const moved = inner
    .filter((line) => !(indentOf(line) === depth && /^\s*direction\s+\w+\s*$/.test(line)))
    .map((line) => (isBlank(line) ? line : line.slice(Math.min(shift, indentOf(line)))));
  lines.splice(start, end - start + 1, ...moved);
  removeFromFlow(lines, new Set([object.id]));
  return lines;
};

// The brackets of a shape and what closes them; `[/`, `[\` close with whatever the text ends in.
const shapeOpeners = ['(((', '[[', '[(', '[/', '[\\', '((', '([', '{{', '[', '(', '{', '>'];
const shapeClosers: Record<string, string> = {
  '(': ')',
  '((': '))',
  '(((': ')))',
  '([': '])',
  '>': ']',
  '[': ']',
  '[(': ')]',
  '[[': ']]',
  '{': '}',
  '{{': '}}'
};

/** The node's text with a new label, keeping its shape, `@{…}` data and `:::class`. */
const relabelNode = ({ id, text }: NodeRef, label: string): string => {
  let rest = text.slice(id.length);
  let shape = '';
  if (rest !== '' && '[({>'.includes(rest[0])) {
    const end = closeBracket(rest, 0);
    shape = rest.slice(0, end);
    rest = rest.slice(end);
  }
  if (shape) {
    const open = shapeOpeners.find((opener) => shape.startsWith(opener)) ?? '[';
    const close = shapeClosers[open] ?? shape.slice(-2);
    return `${id}${open}${quoted(label)}${close}${rest}`;
  }
  if (rest.startsWith('@{')) {
    const end = closeBracket(rest, 1);
    const data = rest.slice(0, end);
    const next = /\blabel\s*:/.test(data)
      ? data.replace(/\blabel\s*:\s*(?:"[^"]*"|[^,}]*)/, `label: ${quoted(label)}`)
      : data.replace(/\s*\}$/, `, label: ${quoted(label)} }`);
    return `${id}${next}${rest.slice(end)}`;
  }
  return `${id}[${quoted(label)}]${rest}`;
};

const renameFlowObject = (lines: string[], object: EditObject, label: string): string[] => {
  if (object.group) {
    const index = lines.findIndex((line) => subgraphPattern(object.id).test(line));
    if (index === -1) return lines;
    lines[index] = lines[index].replace(
      new RegExp(`^(\\s*subgraph\\s+${escape(object.id)})\\b.*$`),
      (_, start: string) => `${start} [${quoted(label)}]`
    );
    return lines;
  }
  // The first statement that gives the node a shape, else its first mention.
  const flow = flowLines(lines);
  const refs = flow.flatMap(({ chains, index }) =>
    chains.flatMap((chain) =>
      chain.groups
        .flat()
        .filter((node) => node.id === object.id)
        .map((node) => ({ index, node }))
    )
  );
  const target = refs.find(({ node }) => hasShape(node)) ?? refs[0];
  if (!target) {
    append(lines, [`  ${object.id}[${quoted(label)}]`]);
    return lines;
  }
  // The same text may occur twice on the line; the replacement keeps the node's id, so once is enough.
  lines[target.index] = lines[target.index].replace(target.node.text, () =>
    relabelNode(target.node, label)
  );
  return lines;
};

// Flowchart arrows: one link's parts and their text.

interface Link {
  style: EdgeStyle | 'invisible';
  head: '' | '>' | 'x' | 'o';
  tail: '' | '<' | 'x' | 'o';
  /** Extra length beyond the shortest arrow (`--->` is 1). */
  extra: number;
  text: string;
}

const parseLink = (link: string): Link => {
  let text = '';
  let arrow = link;
  const pipe = /^(\S+)\|([^|]*)\|$/.exec(link);
  const inline = /^(\S+)\s+(.*\S)\s+(\S+)$/.exec(link);
  if (pipe) {
    [, arrow, text] = pipe;
  } else if (inline) {
    // `-- text -->`: the opening dashes stand for the whole line, the closing ones add the head.
    text = inline[2];
    arrow = inline[1] + inline[3].replace(/^[-=.]+/, '');
  }
  const tail = (/^[<xo]/.exec(arrow)?.[0] ?? '') as Link['tail'];
  const head = (/[>xo]$/.exec(arrow)?.[0] ?? '') as Link['head'];
  const body = arrow.slice(tail.length, arrow.length - head.length);
  const style: Link['style'] = body.includes('~')
    ? 'invisible'
    : body.includes('=')
      ? 'thick'
      : body.includes('.')
        ? 'dotted'
        : 'solid';
  const shortest = style === 'dotted' ? 3 : head || tail ? 2 : 3;
  return { extra: Math.max(0, body.length - shortest), head, style, tail, text };
};

const renderLink = ({ extra, head, style, tail, text }: Link): string => {
  const body =
    style === 'dotted'
      ? `-${'.'.repeat(1 + extra)}-`
      : style === 'invisible'
        ? '~'.repeat(3 + extra)
        : (style === 'thick' ? '=' : '-').repeat((head || tail ? 2 : 3) + extra);
  return `${tail}${body}${head}${text ? `|${text}|` : ''}`;
};

/** Rewrites one arrow; a chain is first split so the arrow stands on its own and numbers stay. */
const rewriteFlowEdge = (
  lines: string[],
  index: number,
  change: (chain: Chain) => Chain | undefined
): string[] => {
  const flow = flowLines(lines);
  const edges = flowEdges(flow);
  const edge = edges.find((candidate) => candidate.index === index);
  const line = edge && flow.find((candidate) => candidate.index === edge.line);
  if (!edge || !line) return lines;
  const chain = line.chains[edge.chain];
  const first = edges.find((e) => e.line === edge.line && e.chain === edge.chain) ?? edge;
  const position = index - first.index;
  const expanded = expandChain(chain);
  const changed = change(expanded[position]);
  if (changed) {
    expanded[position] = changed;
  } else {
    // Deleted: a shape its nodes carried moves to their next mention, or stays as a statement.
    const [removed] = expanded.splice(position, 1);
    const left: Chain[] = [];
    for (const node of removed.groups.flat()) {
      const later = expanded.flatMap((c) => c.groups.flat()).find((n) => n.id === node.id);
      if (later && hasShape(node)) later.text = node.text;
      else if (!later) left.push({ groups: [[node]], links: [] });
    }
    expanded.splice(position, 0, ...left);
  }
  const chains = [...line.chains];
  chains.splice(edge.chain, 1, ...expanded);
  const bare = writeChains(lines, new Map([[line.index, { chains, indent: line.indent }]]));
  if (!changed) {
    dropRedundantBare(lines, bare);
    renumberLinkStyles(lines, afterRemoving(new Set([index])));
  }
  return lines;
};

const changeLink = (update: (link: Link) => Link) => (chain: Chain) => ({
  ...chain,
  links: [renderLink(update(parseLink(chain.links[0])))]
});

// Flowchart edge text: `|…|` ends at a pipe, so one inside becomes a slash; brackets
// and quotes need the text in quotes.
const flowText = (text: string) => {
  const plain = oneLine(text).replaceAll('|', '/');
  return /["[\](){}]/.test(plain) ? quoted(plain) : plain;
};

// ---- Statement patterns of the other types ----

interface Statement {
  indent: string;
  from: string;
  to: string;
  label: string;
  /** The rest of the parse, as the type's renderer wants it. */
  parts: Record<string, string>;
}

interface EdgeSyntax {
  pattern: RegExp;
  parse: (match: RegExpExecArray) => Statement;
  render: (statement: Statement) => string;
  reverse: (statement: Statement) => Statement;
  setStyle?: (statement: Statement, style: EdgeStyle) => Statement;
  setHead?: (statement: Statement, head: boolean) => Statement;
  style: (statement: Statement) => EdgeStyle;
  head: (statement: Statement) => boolean;
  label: (text: string) => string;
  can: EditEdges['can'];
  /** How many arrows mermaid found, to confirm the patterns saw every one. */
  count?: (db: Db) => number;
}

const stateSyntax: EdgeSyntax = {
  can: { head: false, label: true, reverse: true, styles: [] },
  count: (db) => list(read(db, 'getRelations')).length,
  head: () => true,
  label: (text) => oneLine(text).replaceAll(':', '：'),
  parse: ([, indent, from, to, label = '']) => ({ from, indent, label, parts: {}, to }),
  pattern: /^(\s*)(\[\*\]|[\w-]+)\s*-->\s*(\[\*\]|[\w-]+)\s*(?::\s*(.*?))?\s*$/,
  render: ({ from, indent, label, to }) =>
    `${indent}${from} --> ${to}${label ? ` : ${label}` : ''}`,
  reverse: (s) => ({ ...s, from: s.to, to: s.from }),
  style: () => 'solid'
};

const classSyntax: EdgeSyntax = {
  can: { head: true, label: true, reverse: true, styles: ['solid', 'dotted'] },
  count: (db) => list(read(db, 'getRelations')).length,
  head: ({ parts }) => parts.head !== '' || parts.tail !== '',
  label: (text) => oneLine(text).replaceAll(/[:"]/g, ' ').replaceAll(/\s+/g, ' ').trim(),
  parse: ([
    ,
    indent,
    from,
    cardA = '',
    tail = '',
    line,
    head = '',
    cardB = '',
    to,
    label = ''
  ]) => ({
    from,
    indent,
    label,
    parts: { cardA, cardB, head, line, tail },
    to
  }),
  pattern:
    /^(\s*)([\w.~-]+)\s*(?:"([^"]*)"\s*)?(<\||[<*o]|\(\))?(--|\.\.)(\|>|[>*o]|\(\))?\s*(?:"([^"]*)"\s*)?([\w.~-]+)\s*(?::\s*(.*?))?\s*$/,
  render: ({ from, indent, label, parts, to }) =>
    `${indent}${from} ${parts.cardA ? `"${parts.cardA}" ` : ''}${parts.tail}${parts.line}${parts.head} ${parts.cardB ? `"${parts.cardB}" ` : ''}${to}${label ? ` : ${label}` : ''}`,
  reverse: (s) => ({
    ...s,
    from: s.to,
    parts: { ...s.parts, cardA: s.parts.cardB, cardB: s.parts.cardA },
    to: s.from
  }),
  setHead: (s, head) => ({
    ...s,
    parts: {
      ...s.parts,
      head: head ? (s.parts.head || s.parts.tail ? s.parts.head : '>') : '',
      tail: head ? s.parts.tail : ''
    }
  }),
  setStyle: (s, style) => ({ ...s, parts: { ...s.parts, line: style === 'dotted' ? '..' : '--' } }),
  style: ({ parts }) => (parts.line === '..' ? 'dotted' : 'solid')
};

const erSyntax: EdgeSyntax = {
  can: { head: false, label: true, reverse: true, styles: ['solid', 'dotted'] },
  count: (db) => list(read(db, 'getRelationships')).length,
  head: () => true,
  label: (text) => oneLine(text).replaceAll('"', "'"),
  parse: ([, indent, from, cardA, line, cardB, to, label]) => ({
    from,
    indent,
    label: label.replace(/^"(.*)"$/, '$1'),
    parts: { cardA, cardB, line },
    to
  }),
  pattern: /^(\s*)([\w-]+)\s+([|}][o|])(--|\.\.)([o|][|{])\s+([\w-]+)\s*:\s*(.*?)\s*$/,
  render: ({ from, indent, label, parts, to }) =>
    `${indent}${from} ${parts.cardA}${parts.line}${parts.cardB} ${to} : "${label}"`,
  reverse: (s) => ({ ...s, from: s.to, to: s.from }),
  setStyle: (s, style) => ({ ...s, parts: { ...s.parts, line: style === 'dotted' ? '..' : '--' } }),
  style: ({ parts }) => (parts.line === '..' ? 'dotted' : 'solid')
};

const sequenceSyntax: EdgeSyntax = {
  can: { head: false, label: true, reverse: true, styles: ['solid', 'dotted'] },
  head: () => true,
  label: sequenceText,
  parse: ([, indent, from, both = '', arrow, mark = '', to, label = '']) => ({
    from,
    indent,
    label,
    parts: { arrow, both, mark },
    to
  }),
  pattern:
    /^(\s*)([\p{L}\p{N}_]+)\s*(<<)?(-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-]?)\s*([\p{L}\p{N}_]+)\s*:\s*(.*?)\s*$/u,
  render: ({ from, indent, label, parts, to }) =>
    `${indent}${from}${parts.both}${parts.arrow}${parts.mark}${to}: ${label}`,
  reverse: (s) => ({ ...s, from: s.to, to: s.from }),
  setStyle: (s, style) => ({
    ...s,
    parts: {
      ...s.parts,
      arrow: (style === 'dotted' ? '--' : '-') + s.parts.arrow.replace(/^-+/, '')
    }
  }),
  style: ({ parts }) => (parts.arrow.startsWith('--') ? 'dotted' : 'solid')
};

const architectureSyntax: EdgeSyntax = {
  can: { head: true, label: false, reverse: true, styles: [] },
  count: (db) => list(read(db, 'getEdges')).length,
  head: ({ parts }) => parts.head !== '' || parts.tail !== '',
  label: () => '',
  parse: ([, indent, from, groupA = '', sideA, tail = '', head = '', sideB, to, groupB = '']) => ({
    from,
    indent,
    label: '',
    parts: { groupA, groupB, head, sideA, sideB, tail },
    to
  }),
  pattern: /^(\s*)([\w-]+)(\{group\})?:([LRTB])\s*(<)?--(>)?\s*([LRTB]):([\w-]+)(\{group\})?\s*$/,
  render: ({ from, indent, parts, to }) =>
    `${indent}${from}${parts.groupA}:${parts.sideA} ${parts.tail}--${parts.head} ${parts.sideB}:${to}${parts.groupB}`,
  reverse: (s) => ({
    ...s,
    from: s.to,
    parts: {
      ...s.parts,
      groupA: s.parts.groupB,
      groupB: s.parts.groupA,
      sideA: s.parts.sideB,
      sideB: s.parts.sideA
    },
    to: s.from
  }),
  setHead: (s, head) => ({
    ...s,
    parts: {
      ...s.parts,
      head: head ? (s.parts.tail ? s.parts.head : '>') : '',
      tail: head ? s.parts.tail : ''
    }
  }),
  style: () => 'solid'
};

/**
 * `A->>+B` activates B and a later `B-->>-A` deactivates it; when one of the
 * two goes (deleted, or turned round so the marker would apply to the other
 * participant), its partner's marker goes too, or mermaid rejects the diagram.
 */
const unpairActivation = (lines: string[], line: number, statement: Statement) => {
  const { mark } = statement.parts;
  if (!mark) return;
  const actor = mark === '+' ? statement.to : statement.from;
  const step = mark === '+' ? 1 : -1;
  for (let index = line + step; index >= 0 && index < lines.length; index += step) {
    const match = sequenceSyntax.pattern.exec(lines[index]);
    if (!match) continue;
    const other = sequenceSyntax.parse(match);
    const partner =
      mark === '+'
        ? other.from === actor && other.parts.mark === '-'
        : other.to === actor && other.parts.mark === '+';
    if (partner) {
      lines[index] = sequenceSyntax.render({ ...other, parts: { ...other.parts, mark: '' } });
      return;
    }
  }
};

const syntaxes: Partial<Record<EditKind, EdgeSyntax>> = {
  architecture: architectureSyntax,
  class: classSyntax,
  er: erSyntax,
  sequence: sequenceSyntax,
  state: stateSyntax
};

/** The arrow statements of a diagram, in order, with their lines. */
const statements = (lines: string[], syntax: EdgeSyntax) => {
  const header = headerIndex(lines);
  const found: (Statement & { line: number })[] = [];
  lines.forEach((line, index) => {
    const match = index > header ? syntax.pattern.exec(line) : null;
    if (match) found.push({ ...syntax.parse(match), line: index });
  });
  return found;
};

// ---- Objects of the other types ----

/**
 * The first line past the header that names `id` as a word outside quotes and
 * outside `{ }` bodies; a new statement about it goes right after, so the
 * object keeps its place in the diagram's order.
 */
const firstMention = (lines: string[], id: string): number => {
  const word = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escape(id)}(?![\\p{L}\\p{N}_])`, 'u');
  let depth = 0;
  for (let index = headerIndex(lines) + 1; index < lines.length; index++) {
    const line = lines[index].replaceAll(/"[^"]*"/g, '""');
    if (depth === 0 && !isBlank(line) && word.test(line)) return index;
    depth += (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0);
  }
  return lastContent(lines);
};

const stateDeclaration = (id: string) =>
  new RegExp(`^(\\s*)state\\s+"([^"]*)"\\s+as\\s+${escape(id)}\\s*$`);
const stateDescription = (id: string) => new RegExp(`^(\\s*)${escape(id)}\\s*:\\s*(.*?)\\s*$`);

const renameState = (lines: string[], id: string, label: string) => {
  const declared = lines.findIndex((line) => stateDeclaration(id).test(line));
  if (declared !== -1) {
    lines[declared] = lines[declared].replace(
      stateDeclaration(id),
      (_, indent: string) => `${indent}state "${label}" as ${id}`
    );
    return lines;
  }
  const described = lines.findIndex((line) => stateDescription(id).test(line));
  if (described !== -1) {
    lines[described] = lines[described].replace(
      stateDescription(id),
      (_, indent: string) => `${indent}${id} : ${label}`
    );
    return lines;
  }
  const at = firstMention(lines, id);
  lines.splice(at + 1, 0, `${/^\s*/.exec(lines[at])?.[0] ?? '  '}${id} : ${label}`);
  return lines;
};

const deleteState = (lines: string[], id: string) => {
  const name = escape(id);
  const touches = new RegExp(
    `^\\s*(?:(?:\\[\\*\\]|[\\w-]+)\\s*-->\\s*${name}\\b|${name}\\s*-->|state\\s+"[^"]*"\\s+as\\s+${name}\\s*$|state\\s+${name}\\s*(?:<<\\w+>>)?\\s*$|${name}\\s*:|note\\s+(?:left|right)\\s+of\\s+${name}\\s*:|style\\s+${name}\\b)`
  );
  // A multi-line note: `note right of id` … `end note`.
  const noteStart = new RegExp(`^\\s*note\\s+(?:left|right)\\s+of\\s+${name}\\s*$`);
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!noteStart.test(lines[index])) continue;
    const end = lines.findIndex((line, i) => i > index && /^\s*end\s+note\s*$/.test(line));
    lines.splice(index, (end === -1 ? index : end) - index + 1);
  }
  removeWhere(lines, (line) => touches.test(line));
  dropFromList(
    lines,
    /^(\s*)class\s+([\w\s,-]+?)\s+([\w-]+)\s*$/,
    id,
    (indent, rest, cls) => `${indent}class ${rest.join(',')} ${cls}`
  );
  return lines;
};

const classStatement = (id: string) =>
  new RegExp(`^(\\s*)class\\s+${escape(id)}(?:\\s*\\[\\s*"[^"]*"\\s*\\])?(.*)$`);

const renameClass = (lines: string[], id: string, label: string) => {
  const index = lines.findIndex((line) => classStatement(id).test(line));
  if (index !== -1) {
    lines[index] = lines[index].replace(
      classStatement(id),
      (_, indent: string, rest: string) => `${indent}class ${id}[${quoted(label)}]${rest}`
    );
    return lines;
  }
  const at = firstMention(lines, id);
  lines.splice(at + 1, 0, `${/^\s*/.exec(lines[at])?.[0] ?? '  '}class ${id}[${quoted(label)}]`);
  return lines;
};

/** Removes a `… {` block (class body, entity attributes, boundary) from `start` to its `}`. */
const removeBlock = (lines: string[], start: number) => {
  let depth = 0;
  for (let index = start; index < lines.length; index++) {
    depth += (lines[index].match(/\{/g)?.length ?? 0) - (lines[index].match(/\}/g)?.length ?? 0);
    if (depth <= 0) {
      lines.splice(start, index - start + 1);
      return;
    }
  }
  lines.splice(start, 1);
};

const deleteClass = (lines: string[], id: string) => {
  const name = escape(id);
  for (let index = lines.length - 1; index >= 0; index--) {
    if (new RegExp(`^\\s*class\\s+${name}\\b.*\\{\\s*$`).test(lines[index]))
      removeBlock(lines, index);
  }
  // A note whose quoted text runs over several lines.
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!new RegExp(`^\\s*note\\s+for\\s+${name}\\b`).test(lines[index])) continue;
    let end = index;
    let quotes = (lines[end].match(/"/g)?.length ?? 0) % 2;
    while (quotes === 1 && end + 1 < lines.length) {
      end++;
      quotes = (quotes + (lines[end].match(/"/g)?.length ?? 0)) % 2;
    }
    lines.splice(index, end - index + 1);
  }
  const relation = classSyntax.pattern;
  removeWhere(lines, (line) => {
    const match = relation.exec(line);
    if (match && (match[2] === id || match[8] === id)) return true;
    return new RegExp(
      `^\\s*(?:class\\s+${name}\\b|${name}\\s*:|<<[^>]*>>\\s+${name}\\s*$|note\\s+for\\s+${name}\\b|style\\s+${name}\\b|(?:click|link|callback)\\s+${name}\\b|${name}\\s*:::)`
    ).test(line);
  });
  dropFromList(
    lines,
    /^(\s*)cssClass\s+"([^"]*)"\s+([\w-]+)\s*$/,
    id,
    (indent, rest, cls) => `${indent}cssClass "${rest.join(',')}" ${cls}`
  );
  // A namespace left empty.
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!/^\s*namespace\s+\S+\s*\{\s*$/.test(lines[index])) continue;
    let end = index + 1;
    while (end < lines.length && isBlank(lines[end])) end++;
    if (/^\s*\}\s*$/.test(lines[end] ?? '')) lines.splice(index, end - index + 1);
  }
  return lines;
};

const erAlias = (id: string) => new RegExp(`^(\\s*)${escape(id)}\\s*\\[[^\\]]*\\](.*)$`);
const erBlock = (id: string) => new RegExp(`^(\\s*)${escape(id)}\\s*\\{\\s*$`);

const renameEntity = (lines: string[], id: string, label: string) => {
  const alias = lines.findIndex((line) => erAlias(id).test(line));
  if (alias !== -1) {
    lines[alias] = lines[alias].replace(
      erAlias(id),
      (_, indent: string, rest: string) => `${indent}${id}[${quoted(label)}]${rest}`
    );
    return lines;
  }
  const block = lines.findIndex((line) => erBlock(id).test(line));
  if (block !== -1) {
    lines[block] = lines[block].replace(
      erBlock(id),
      (_, indent: string) => `${indent}${id}[${quoted(label)}] {`
    );
    return lines;
  }
  append(lines, [`  ${id}[${quoted(label)}]`]);
  return lines;
};

const deleteEntity = (lines: string[], id: string) => {
  const name = escape(id);
  for (let index = lines.length - 1; index >= 0; index--) {
    if (new RegExp(`^\\s*${name}(?:\\s*\\[[^\\]]*\\])?\\s*\\{\\s*$`).test(lines[index]))
      removeBlock(lines, index);
  }
  removeWhere(lines, (line) => {
    const match = erSyntax.pattern.exec(line);
    if (match && (match[2] === id || match[6] === id)) return true;
    return new RegExp(
      `^\\s*(?:${name}\\s*\\[|${name}\\s*$|${name}\\s*:::|style\\s+${name}\\b)`
    ).test(line);
  });
  dropFromList(
    lines,
    /^(\s*)class\s+([\w\s,-]+?)\s+([\w-]+)\s*$/,
    id,
    (indent, rest, cls) => `${indent}class ${rest.join(',')} ${cls}`
  );
  return lines;
};

const c4Element = (id: string) =>
  new RegExp(`^(\\s*\\w+\\(\\s*${escape(id)}\\s*,\\s*)("[^"]*"|[^,)]*)`);

const renameC4 = (lines: string[], id: string, label: string) => {
  const index = lines.findIndex((line) => c4Element(id).test(line));
  if (index !== -1)
    lines[index] = lines[index].replace(c4Element(id), (_, start: string) => `${start}"${label}"`);
  return lines;
};

const deleteC4 = (lines: string[], id: string) => {
  const name = escape(id);
  removeWhere(lines, (line) =>
    new RegExp(
      `^\\s*(?:\\w+\\(\\s*${name}\\s*,|(?:Bi)?Rel\\w*\\(\\s*(?:${name}\\s*,|[^,]+,\\s*${name}\\s*[,)])|UpdateRelStyle\\(\\s*(?:${name}\\s*,|[^,]+,\\s*${name}\\s*[,)]))`
    ).test(line)
  );
  // A boundary left empty does not parse.
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!/^\s*(?:\w*Boundary|Deployment_Node\w*)\(.*\)\s*\{\s*$/.test(lines[index])) continue;
    let end = index + 1;
    while (end < lines.length && isBlank(lines[end])) end++;
    if (/^\s*\}\s*$/.test(lines[end] ?? '')) lines.splice(index, end - index + 1);
  }
  return lines;
};

const archLine = (id: string) =>
  new RegExp(
    `^(\\s*)(service|group|junction)\\s+${escape(id)}(\\([^)]*\\))?\\s*(?:\\[[^\\]]*\\])?(.*)$`
  );
const archMembers = (lines: string[], id: string): string[] =>
  lines.flatMap((line) => {
    const match = new RegExp(
      `^\\s*(?:service|group|junction)\\s+([\\w-]+)\\b.*\\bin\\s+${escape(id)}\\s*$`
    ).exec(line);
    return match ? [match[1], ...archMembers(lines, match[1])] : [];
  });

const renameArch = (lines: string[], id: string, label: string) => {
  const index = lines.findIndex((line) => archLine(id).test(line));
  const match = index === -1 ? null : archLine(id).exec(lines[index]);
  if (!match || match[2] === 'junction') return lines;
  const text = oneLine(label).replaceAll('[', '(').replaceAll(']', ')');
  lines[index] = `${match[1]}${match[2]} ${id}${match[3] ?? ''}[${text}]${match[4]}`;
  return lines;
};

const deleteArch = (lines: string[], object: EditObject, keepContents: boolean) => {
  const ids = [object.id, ...(object.group && !keepContents ? (object.members ?? []) : [])];
  if (object.group && keepContents) {
    const own = lines.find((line) => archLine(object.id).test(line));
    const parent = /\bin\s+([\w-]+)\s*$/.exec(own ?? '')?.[1];
    const inGroup = new RegExp(`\\s+in\\s+${escape(object.id)}\\s*$`);
    lines.forEach((line, index) => {
      if (inGroup.test(line)) lines[index] = line.replace(inGroup, parent ? ` in ${parent}` : '');
    });
  }
  for (const id of ids) {
    const name = escape(id);
    removeWhere(lines, (line) => {
      const match = architectureSyntax.pattern.exec(line);
      if (match && (match[2] === id || match[8] === id)) return true;
      return new RegExp(`^\\s*(?:service|group|junction)\\s+${name}\\b`).test(line);
    });
  }
  return lines;
};

const participant = (id: string) =>
  new RegExp(`^(\\s*(?:create\\s+)?(?:participant|actor)\\s+${escape(id)})(?:\\s+as\\s+.*)?\\s*$`);

const renameParticipant = (lines: string[], object: EditObject, label: string) => {
  const index = lines.findIndex((line) => participant(object.id).test(line));
  const text = sequenceText(label);
  if (index !== -1) {
    lines[index] = lines[index].replace(
      participant(object.id),
      (_, start: string) => `${start} as ${text}`
    );
    return lines;
  }
  // Declared in its place in the order of appearance, with the undeclared ones before it.
  const declared = (id: string) => lines.some((line) => participant(id).test(line));
  const before = (object.after ?? []).filter((id) => !declared(id));
  let at = lines.findLastIndex((line) => /^\s*(?:participant|actor)\s+/.test(line));
  if (at === -1) at = headerIndex(lines);
  const indent = at > headerIndex(lines) ? (/^\s*/.exec(lines[at])?.[0] ?? '  ') : '  ';
  lines.splice(
    at + 1,
    0,
    ...before.map((id) => `${indent}participant ${id}`),
    `${indent}participant ${object.id} as ${text}`
  );
  return lines;
};

const deleteParticipant = (lines: string[], id: string) => {
  const name = escape(id);
  // Its messages go; an activation one of them started or ended must not be left half-paired.
  lines.forEach((line, index) => {
    const match = sequenceSyntax.pattern.exec(line);
    if (match && (match[2] === id || match[6] === id))
      unpairActivation(lines, index, sequenceSyntax.parse(match));
  });
  removeWhere(lines, (line) => {
    const match = sequenceSyntax.pattern.exec(line);
    if (match && (match[2] === id || match[6] === id)) return true;
    return new RegExp(
      `^\\s*(?:(?:create\\s+)?(?:participant|actor)\\s+${name}\\b|destroy\\s+${name}\\s*$|(?:de)?activate\\s+${name}\\s*$|Note\\s+(?:left|right)\\s+of\\s+${name}\\s*:|(?:links?|properties|details)\\s+${name}\\s*:)`,
      'i'
    ).test(line);
  });
  const over = /^(\s*Note\s+over\s+)([\w\s,-]+?)(\s*:.*)$/i;
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = over.exec(lines[index]);
    if (!match) continue;
    const ids = match[2].split(',').map((part) => part.trim());
    if (!ids.includes(id)) continue;
    const rest = ids.filter((part) => part !== id);
    if (rest.length === 0) lines.splice(index, 1);
    else lines[index] = `${match[1]}${rest.join(',')}${match[3]}`;
  }
  // A box left empty.
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!/^\s*box\b/.test(lines[index])) continue;
    let end = index + 1;
    while (end < lines.length && isBlank(lines[end])) end++;
    if (/^\s*end\s*$/.test(lines[end] ?? '')) lines.splice(index, end - index + 1);
  }
  return lines;
};

// Mindmap and kanban lines: `id[Text]`, `id((Text))`, `root)Text(` or plain text.
const shapedLine =
  /^(\s*)([\w-]*)(\[|\(\(\(|\(\(|\(|\)\)|\)|\{\{)(.*?)(\]|\)\)\)|\)\)|\)|\(\(|\(|\}\})\s*$/;
const plainText = (text: string) =>
  oneLine(text)
    .replaceAll(/[()[\]{}]/g, '')
    .trim();

const renameLine = (lines: string[], line: number, label: string) => {
  const match = shapedLine.exec(lines[line]);
  const text = plainText(label);
  lines[line] = match
    ? `${match[1]}${match[2]}${match[3]}${text}${match[5]}`
    : `${/^\s*/.exec(lines[line])?.[0] ?? ''}${text}`;
  return lines;
};

const deleteLines = (lines: string[], line: number, keepContents: boolean) => {
  let end = blockEnd(lines, line);
  // `::icon(…)` and `:::class` lines after the block decorate the node.
  const decorated = end;
  while (end < lines.length && /^\s*(?::::|::icon\()/.test(lines[end])) end++;
  if (!keepContents) {
    lines.splice(line, end - line);
    return lines;
  }
  lines.splice(decorated, end - decorated);
  end = decorated;
  const inner = lines.slice(line + 1, end);
  const shift = Math.min(...inner.filter((l) => !isBlank(l)).map(indentOf)) - indentOf(lines[line]);
  lines.splice(
    line,
    end - line,
    ...inner.map((l) => (isBlank(l) || shift <= 0 ? l : l.slice(Math.min(shift, indentOf(l)))))
  );
  return lines;
};

// Timeline: `period : event : event`, continued by `: event` lines.
const periodLine = /^(\s*)([^:\s][^:]*?)?\s*(?::\s*(.*?))?\s*$/;
const timelineParts = (line: string) => {
  const match = periodLine.exec(line);
  const period = match?.[2];
  const events = match?.[3] === undefined ? [] : match[3].split(/\s*:\s*/);
  return { events, indent: match?.[1] ?? '', period };
};
const renderTimeline = ({ events, indent, period }: ReturnType<typeof timelineParts>) =>
  period === undefined
    ? `${indent}: ${events.join(' : ')}`
    : `${indent}${[period, ...events].join(' : ')}`;

const timelineText = (text: string) => oneLine(text).replaceAll(':', '：');

const renameTimeline = (lines: string[], object: EditObject, label: string) => {
  const line = object.line ?? -1;
  const parts = timelineParts(lines[line] ?? '');
  if (object.part === undefined) parts.period = timelineText(label);
  else parts.events[object.part] = timelineText(label);
  lines[line] = renderTimeline(parts);
  return lines;
};

const deleteTimeline = (lines: string[], object: EditObject) => {
  const line = object.line ?? -1;
  if (object.part === undefined) {
    let end = line + 1;
    while (end < lines.length && /^\s*:/.test(lines[end])) end++;
    lines.splice(line, end - line);
    return lines;
  }
  const parts = timelineParts(lines[line]);
  parts.events.splice(object.part, 1);
  if (parts.events.length === 0 && parts.period === undefined) lines.splice(line, 1);
  else lines[line] = renderTimeline(parts);
  return lines;
};

// ---- The lists ----

const sequenceOrder = memoByCode(async (code: string): Promise<DiagramObject[]> => {
  const db = await parseDb(code);
  const actors = read(db ?? {}, 'getActors');
  return actors instanceof Map
    ? [...(actors as Map<string, { description?: string }>).entries()].map(
        ([id, { description }]) => ({ id, label: decodeEntities(description ?? '') || id })
      )
    : [];
});

/**
 * The objects the Edit card can rename and delete, from mermaid's own parse
 * (nodes, states, classes, entities, C4 elements, participants, services) or
 * from the lines (mindmap, kanban, timeline). Undefined for other types.
 */
export const editableObjects = memoByCode(
  async (code: string): Promise<EditObjects | undefined> => {
    const kind = editKind(code);
    if (!kind) return undefined;
    const { lines } = splitLines(code);
    switch (kind) {
      case 'mindmap':
      case 'kanban': {
        const nodes = nodeLines(lines);
        return {
          items: nodes.map(({ index, indent, line }, position) => ({
            group:
              kind === 'mindmap' &&
              nodes.some((n) => n.index > index && n.index < blockEnd(lines, index)),
            id: `L${index}`,
            label: `${' '.repeat(Math.max(0, indent - 2))}${nodeLabel(line)}`,
            line: index,
            ...(kind === 'mindmap' && position === 0 ? { noDelete: true } : {})
          })),
          kind
        };
      }
      case 'timeline': {
        const header = headerIndex(lines);
        const items: EditObject[] = [];
        lines.forEach((line, index) => {
          if (index <= header || isBlank(line) || /^\s*(?:title|section)\b/.test(line)) return;
          const { events, period } = timelineParts(line);
          if (period === undefined && events.length === 0) return;
          if (period !== undefined) items.push({ id: `L${index}`, label: period, line: index });
          events.forEach((event, part) =>
            items.push({ id: `L${index}E${part}`, label: `  ${event}`, line: index, part })
          );
        });
        return { items, kind };
      }
      case 'sequence': {
        const order = await sequenceOrder(code);
        return {
          items: order.map((item, index) => ({
            ...item,
            after: order.slice(0, index).map((o) => o.id)
          })),
          kind
        };
      }
      case 'architecture': {
        const db = await parseDb(code);
        if (!db) return undefined;
        const named = (name: string, extra: Partial<EditObject> = {}) =>
          list(read(db, name)).map(({ id, title }): EditObject => ({
            id: String(id),
            label: decodeEntities(typeof title === 'string' ? title : '') || String(id),
            ...extra
          }));
        return {
          items: [
            ...named('getServices'),
            ...named('getGroups', { group: true }).map((group) => ({
              ...group,
              members: archMembers(lines, group.id)
            })),
            ...named('getJunctions', { noRename: true })
          ],
          kind
        };
      }
      case 'flowchart': {
        const [objects, db] = await Promise.all([diagramObjects(code), parseDb(code)]);
        if (!objects || !db) return undefined;
        const subgraphs = list(read(db, 'getSubGraphs'));
        const members = (id: string): string[] =>
          (subgraphs.find((s) => s.id === id)?.nodes as string[] | undefined)?.flatMap((node) =>
            subgraphs.some((s) => s.id === node) ? [node, ...members(node)] : [node]
          ) ?? [];
        const groups = subgraphs
          .filter(({ id }) => typeof id === 'string' && /^[\w-]+$/.test(id))
          .map(({ id, title }): EditObject => ({
            group: true,
            id: String(id),
            label: decodeEntities(typeof title === 'string' ? title : '') || String(id),
            members: members(String(id))
          }));
        return { items: [...objects.items, ...groups], kind };
      }
      default: {
        const objects = await diagramObjects(code);
        return objects ? { items: objects.items, kind } : undefined;
      }
    }
  }
);

/**
 * The arrows the Edit card can edit. Flowchart arrows are matched against
 * mermaid's own list; when the statements cannot be matched (a syntax the
 * tokenizer does not know) the list is empty, so nothing is edited blindly.
 */
export const editableEdges = memoByCode(async (code: string): Promise<EditEdges | undefined> => {
  const kind = editKind(code);
  if (!kind) return undefined;
  const { lines } = splitLines(code);
  if (kind === 'flowchart') {
    const can = {
      head: true,
      label: true,
      reverse: true,
      styles: ['solid', 'dotted', 'thick'] as EdgeStyle[]
    };
    const [known, db] = await Promise.all([diagramEdges(code), parseDb(code)]);
    const mine = flowEdges(flowLines(lines));
    const theirs = list(read(db ?? {}, 'getEdges'));
    const agree =
      mine.length === known.length &&
      mine.length === theirs.length &&
      mine.every(({ from, to }, i) => theirs[i].start === from.id && theirs[i].end === to.id);
    if (!agree) return { can, items: [], kind, unsure: true };
    const flow = flowLines(lines);
    return {
      can,
      items: mine.map((edge, i) => {
        const chain = flow.find((l) => l.index === edge.line)?.chains[edge.chain];
        const first = mine.find((e) => e.line === edge.line && e.chain === edge.chain) ?? edge;
        const link = parseLink(chain ? expandChain(chain)[i - first.index].links[0] : '-->');
        return {
          from: edge.from.id,
          head: link.head !== '' || link.tail !== '',
          id: known[i].id,
          index: i,
          label: decodeEntities(link.text),
          style: link.style === 'invisible' ? 'solid' : link.style,
          title: known[i].label,
          to: edge.to.id
        };
      }),
      kind
    };
  }
  const syntax = syntaxes[kind];
  if (!syntax) return undefined;
  const found = statements(lines, syntax);
  if (syntax.count) {
    const db = await parseDb(code);
    if (!db || syntax.count(db) !== found.length)
      return { can: syntax.can, items: [], kind, unsure: true };
  }
  const objects = kind === 'sequence' ? await sequenceOrder(code) : await diagramObjects(code);
  const names = new Map(
    (Array.isArray(objects) ? objects : (objects?.items ?? [])).map((o) => [o.id, o.label])
  );
  const name = (id: string) => names.get(id) ?? id;
  return {
    can: syntax.can,
    items: found.map((statement, index) => ({
      from: statement.from,
      head: syntax.head(statement),
      index,
      label: decodeEntities(statement.label),
      line: statement.line,
      style: syntax.style(statement),
      title: `${name(statement.from)} → ${name(statement.to)}${statement.label ? ` (${decodeEntities(statement.label)})` : ''}`,
      to: statement.to
    })),
    kind
  };
});

// ---- The edits ----

const clean = (label: string) => oneLine(label).trim();

/** The code with the object's shown text changed; undefined when this object has none. */
export const renameObject = (
  code: string,
  kind: EditKind,
  object: EditObject,
  label: string
): string | undefined => {
  const text = clean(label);
  if (!text || object.noRename) return undefined;
  const { eol, lines } = splitLines(code);
  const edited: Record<EditKind, () => string[] | undefined> = {
    architecture: () => renameArch(lines, object.id, text),
    c4: () => renameC4(lines, object.id, text.replaceAll('"', "'")),
    class: () => renameClass(lines, object.id, text),
    er: () => renameEntity(lines, object.id, text),
    flowchart: () => renameFlowObject(lines, object, text),
    kanban: () => renameLine(lines, object.line ?? -1, text),
    mindmap: () => renameLine(lines, object.line ?? -1, text),
    sequence: () => renameParticipant(lines, object, text),
    state: () => renameState(lines, object.id, text.replaceAll('"', "'")),
    timeline: () => renameTimeline(lines, object, text)
  };
  return edited[kind]()?.join(eol);
};

/**
 * The code without the object: its definition, every arrow or relationship
 * touching it, and its style statements. A lane, group or topic goes with its
 * contents unless `keepContents` moves them out one level.
 */
export const deleteObject = (
  code: string,
  kind: EditKind,
  object: EditObject,
  { keepContents = false }: { keepContents?: boolean } = {}
): string => {
  const { eol, lines } = splitLines(code);
  const edited: Record<EditKind, () => string[]> = {
    architecture: () => deleteArch(lines, object, keepContents),
    c4: () => deleteC4(lines, object.id),
    class: () => deleteClass(lines, object.id),
    er: () => deleteEntity(lines, object.id),
    flowchart: () => deleteFlowObject(lines, object, keepContents),
    kanban: () => deleteLines(lines, object.line ?? -1, false),
    mindmap: () => deleteLines(lines, object.line ?? -1, keepContents),
    sequence: () => deleteParticipant(lines, object.id),
    state: () => deleteState(lines, object.id),
    timeline: () => deleteTimeline(lines, object)
  };
  return edited[kind]().join(eol);
};

const rewriteStatement = (
  code: string,
  kind: EditKind,
  edge: EditEdge,
  change: (statement: Statement, syntax: EdgeSyntax) => Statement | undefined
): string => {
  const syntax = syntaxes[kind];
  const { eol, lines } = splitLines(code);
  const match = syntax && edge.line !== undefined ? syntax.pattern.exec(lines[edge.line]) : null;
  if (!syntax || !match || edge.line === undefined) return code;
  const statement = syntax.parse(match);
  const next = change(statement, syntax);
  if (kind === 'sequence' && (!next || next.from !== statement.from)) {
    unpairActivation(lines, edge.line, statement);
    if (next) next.parts = { ...next.parts, mark: '' };
  }
  if (next) lines[edge.line] = syntax.render(next);
  else lines.splice(edge.line, 1);
  return lines.join(eol);
};

const rewriteFlow = (code: string, index: number, change: (chain: Chain) => Chain | undefined) => {
  const { eol, lines } = splitLines(code);
  return rewriteFlowEdge(lines, index, change).join(eol);
};

/** The arrow with another label (empty removes it). */
export const setEdgeLabel = (
  code: string,
  kind: EditKind,
  edge: EditEdge,
  label: string
): string =>
  kind === 'flowchart'
    ? rewriteFlow(
        code,
        edge.index,
        changeLink((link) => ({ ...link, text: flowText(label) }))
      )
    : rewriteStatement(code, kind, edge, (s, syntax) => ({ ...s, label: syntax.label(label) }));

/** The arrow pointing the other way. */
export const reverseEdge = (code: string, kind: EditKind, edge: EditEdge): string =>
  kind === 'flowchart'
    ? rewriteFlow(code, edge.index, (chain) => ({
        groups: [chain.groups[1], chain.groups[0]],
        links: chain.links
      }))
    : rewriteStatement(code, kind, edge, (s, syntax) => syntax.reverse(s));

/** The arrow drawn solid, dotted or thick. */
export const setEdgeStyle = (
  code: string,
  kind: EditKind,
  edge: EditEdge,
  style: EdgeStyle
): string =>
  kind === 'flowchart'
    ? rewriteFlow(
        code,
        edge.index,
        changeLink((link) => ({ ...link, style }))
      )
    : rewriteStatement(code, kind, edge, (s, syntax) => syntax.setStyle?.(s, style) ?? s);

/** The arrow with or without its head. */
export const setEdgeHead = (code: string, kind: EditKind, edge: EditEdge, head: boolean): string =>
  kind === 'flowchart'
    ? rewriteFlow(
        code,
        edge.index,
        changeLink((link) => ({
          ...link,
          head: head ? (link.head || link.tail ? link.head : '>') : '',
          tail: head ? link.tail : ''
        }))
      )
    : rewriteStatement(code, kind, edge, (s, syntax) => syntax.setHead?.(s, head) ?? s);

/** The code without the arrow; flowchart `linkStyle` numbers are shifted down past it. */
export const deleteEdge = (code: string, kind: EditKind, edge: EditEdge): string =>
  kind === 'flowchart'
    ? rewriteFlow(code, edge.index, () => undefined)
    : rewriteStatement(code, kind, edge, () => undefined);

/** Whether the edited code still parses as the same diagram type as before. */
export const checkEdit = async (before: string, after: string): Promise<boolean> => {
  try {
    const [a, b] = await Promise.all([mermaid.parse(before), mermaid.parse(after)]);
    return a.diagramType === b.diagramType;
  } catch {
    return false;
  }
};
