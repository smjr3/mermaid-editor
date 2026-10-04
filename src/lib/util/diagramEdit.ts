/**
 * Local: the "Add" card's edits (AddControls.svelte) — a new lane, or a new
 * node in a lane, optionally joined by an arrow from another node — for
 * flowcharts and swimlane diagrams. Plain mermaid statements go into the code
 * before the trailing style statements, so the numbers of the existing arrows
 * (which `linkStyle` refers to) do not change.
 */

const header = /^\s*(?:flowchart-elk|flowchart|graph|swimlane-beta)\b/;
const styleStatement = /^\s*(?:style|linkStyle|classDef|class|click)\b/;

const splitLines = (code: string) => ({
  eol: code.includes('\r\n') ? '\r\n' : '\n',
  lines: code.split(/\r?\n/)
});

export const canAdd = (code: string): boolean => {
  const first = splitLines(code).lines.find((line) => line.trim() && !line.trim().startsWith('%%'));
  return first !== undefined && header.test(first);
};

// A title in quotes; a quote inside would end it, so it becomes mermaid's entity.
const quoted = (text: string) => `"${text.replaceAll('"', '#quot;')}"`;

/** The first `<prefix><n>` that does not appear anywhere in the code. */
const freshId = (code: string, prefix: string) => {
  let n = 1;
  while (new RegExp(`\\b${prefix}${n}\\b`).test(code)) n++;
  return `${prefix}${n}`;
};

/** Where new top-level statements go: after the last one that is not a style statement. */
const insertionIndex = (lines: string[]) => {
  let index = lines.length;
  while (index > 1 && (!lines[index - 1].trim() || styleStatement.test(lines[index - 1]))) index--;
  return index;
};

export const addLane = (code: string, label: string): { code: string; id: string } => {
  const { eol, lines } = splitLines(code);
  const id = freshId(code, 'Lane');
  lines.splice(insertionIndex(lines), 0, `  subgraph ${id} [${quoted(label)}]`, '  end');
  return { code: lines.join(eol), id };
};

/** The index of the `end` that closes the subgraph `id`, or -1. */
const laneEnd = (lines: string[], id: string) => {
  const start = lines.findIndex((line) => new RegExp(`^\\s*subgraph\\s+${id}\\b`).test(line));
  if (start === -1) return -1;
  let depth = 0;
  for (let index = start; index < lines.length; index++) {
    if (/^\s*subgraph\b/.test(lines[index])) depth++;
    if (/^\s*end\s*$/.test(lines[index]) && --depth === 0) return index;
  }
  return -1;
};

export const addNode = (
  code: string,
  { from, label, lane }: { from?: string; label: string; lane?: string }
): { code: string; id: string } => {
  const { eol, lines } = splitLines(code);
  const id = freshId(code, 'n');
  const node = `${id}[${quoted(label)}]`;
  // The arrow first: inserting it moves nothing above it.
  if (from) lines.splice(insertionIndex(lines), 0, `  ${from} --> ${id}`);
  const end = lane ? laneEnd(lines, lane) : -1;
  if (end === -1) {
    lines.splice(from ? insertionIndex(lines) - 1 : insertionIndex(lines), 0, `  ${node}`);
  } else {
    const indent = /^(\s*)/.exec(lines[end])?.[1] ?? '  ';
    lines.splice(end, 0, `${indent}  ${node}`);
  }
  return { code: lines.join(eol), id };
};

// Architecture diagrams: groups, services and the edges between them.

const archHeader = /^\s*architecture-beta\b/;

export const isArchitecture = (code: string): boolean => {
  const first = splitLines(code).lines.find((line) => line.trim() && !line.trim().startsWith('%%'));
  return first !== undefined && archHeader.test(first);
};

/** Where the new service sits relative to the one it is joined from. */
export type Placement = 'right' | 'down' | 'left' | 'up';
const sides: Record<Placement, [string, string]> = {
  down: ['B', 'T'],
  left: ['L', 'R'],
  right: ['R', 'L'],
  up: ['T', 'B']
};

// `[…]` ends the title; any icon name a pack could hold, else the standard server.
const archLabel = (text: string) =>
  text
    .replaceAll(/[[\]\r\n]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
const archIcon = (icon: string) => (/^[\w-]+(?::[\w-]+)?$/.test(icon) ? icon : 'server');

/** The code with lines added after its last statement. */
const append = (code: string, added: string[]) => {
  const { eol, lines } = splitLines(code);
  const last = lines.findLastIndex((line) => line.trim());
  lines.splice(last + 1, 0, ...added);
  return lines.join(eol);
};

const edge = (from: string, to: string, place: Placement, arrow: boolean) => {
  const [out, into] = sides[place];
  return `  ${from}:${out} ${arrow ? '-->' : '--'} ${into}:${to}`;
};

export const addArchGroup = (
  code: string,
  { icon, label, parent }: { icon: string; label: string; parent?: string }
): { code: string; id: string } => {
  const id = freshId(code, 'grp');
  const statement = `  group ${id}(${archIcon(icon)})[${archLabel(label)}]${parent ? ` in ${parent}` : ''}`;
  return { code: append(code, [statement]), id };
};

export const addArchService = (
  code: string,
  {
    arrow = false,
    from,
    group,
    icon,
    label,
    place = 'right'
  }: {
    arrow?: boolean;
    from?: string;
    group?: string;
    icon: string;
    label: string;
    place?: Placement;
  }
): { code: string; id: string } => {
  const id = freshId(code, 'svc');
  const statement = `  service ${id}(${archIcon(icon)})[${archLabel(label)}]${group ? ` in ${group}` : ''}`;
  return { code: append(code, [statement, ...(from ? [edge(from, id, place, arrow)] : [])]), id };
};

export const addArchEdge = (
  code: string,
  {
    arrow = false,
    from,
    place,
    to
  }: { arrow?: boolean; from: string; place: Placement; to: string }
): string => append(code, [edge(from, to, place, arrow)]);
