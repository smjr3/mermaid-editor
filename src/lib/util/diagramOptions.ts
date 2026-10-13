/**
 * Local: the options of the whole diagram that mermaid offers per type, for the
 * inspector's 図全体 (DiagramSettings.svelte) — beyond the theme, direction, engine,
 * spacing, colours, title and font, which have rows of their own. Some are written in
 * the code (`autonumber`, a gantt's `excludes weekends`, `pie showData`, `gitGraph TB:`,
 * `accTitle:` …), the others in the mermaid config (the line curve, the look, a
 * mindmap's layout, sankey and packet settings …). Each is plain mermaid, so a shared
 * link renders it the same. A type that cannot express an option does not list it.
 */
import type { MessageKey } from '$/i18n/messages';
import { headerIndex, indentOf, isContent, oneLine } from './codeText';
import type { DetailField } from './diagramDetails';
import { freshId, splitLines } from './diagramEdit';
import { blockTokens, edgeCurves, shapedLine, type EditObject } from './diagramModify';

export interface DiagramOption {
  key: string;
  kind: 'choice' | 'switch' | 'number' | 'text';
  /** The row's label; a choice's values are labelled by `<label>.<value>` when that exists. */
  label: MessageKey;
  options?: readonly string[];
  /** `on` / `off` for a switch. */
  value: string;
  /** Written in the config (always available) rather than the code. */
  config?: boolean;
}

export type OptionChange = { code: string } | { config: string };

type Config = Record<string, unknown>;

const types: [string, RegExp][] = [
  ['flowchart', /^\s*(?:flowchart-elk|flowchart|graph)\b/],
  ['swimlane', /^\s*swimlane-beta\b/],
  ['sequence', /^\s*sequenceDiagram\b/],
  ['class', /^\s*classDiagram(?:-v2)?\b/],
  ['state', /^\s*stateDiagram(?:-v2)?\b/],
  ['er', /^\s*erDiagram\b/],
  ['gantt', /^\s*gantt\b/],
  ['pie', /^\s*pie\b/],
  ['journey', /^\s*journey\b/],
  ['requirement', /^\s*requirementDiagram\b/],
  ['git', /^\s*gitGraph\b/],
  ['quadrant', /^\s*quadrantChart\b/],
  ['xychart', /^\s*xychart(?:-beta)?\b/],
  ['c4', /^\s*C4(?:Context|Container|Component|Dynamic|Deployment)\b/],
  ['architecture', /^\s*architecture-beta\b/],
  ['packet', /^\s*packet(?:-beta)?\b/],
  ['mindmap', /^\s*mindmap\b/],
  ['block', /^\s*block(?:-beta)?\b/],
  ['sankey', /^\s*sankey(?:-beta)?\b/],
  ['timeline', /^\s*timeline\b/]
];

/** The diagram type, as this file names it, from the header line. */
export const optionType = (code: string): string | undefined => {
  const { lines } = splitLines(code);
  const header = lines[headerIndex(lines)] ?? '';
  return types.find(([, pattern]) => pattern.test(header))?.[0];
};

// Types whose grammar reads `accTitle:` / `accDescr:` (mindmap, kanban and timeline
// take them for nodes; block and sankey reject them).
const accessible = new Set([
  'flowchart',
  'swimlane',
  'sequence',
  'class',
  'state',
  'er',
  'gantt',
  'pie',
  'journey',
  'requirement',
  'git',
  'quadrant',
  'xychart',
  'c4',
  'architecture',
  'packet'
]);
// Types drawn with mermaid's `look` (classic, hand-drawn, neo).
const withLook = new Set(['flowchart', 'swimlane', 'sequence', 'class', 'state', 'er']);

export const looks = ['default', 'classic', 'handDrawn', 'neo'] as const;
export const ganttAxisFormats = {
  bd: '%b %d',
  hm: '%H:%M',
  md: '%m/%d',
  mdJa: '%m月%d日',
  ym: '%Y-%m',
  ymd: '%Y-%m-%d'
} as const;
export const ganttTicks = ['1day', '1week', '2week', '1month'] as const;
export const mindmapLayouts = ['default', 'tidy-tree', 'cose-bilkent'] as const;
export const sankeyLinkColors = ['default', 'source', 'target', 'gradient'] as const;
export const sankeyAlignments = ['default', 'justify', 'left', 'right', 'center'] as const;
const gitDirections = ['LR', 'TB', 'BT'] as const;

const parseConfig = (config: string): Config | undefined => {
  try {
    const value: unknown = JSON.parse(config);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Config)
      : undefined;
  } catch {
    return undefined;
  }
};
const section = (config: Config, name: string): Config =>
  config[name] && typeof config[name] === 'object' ? (config[name] as Config) : {};

// Local (N06): which `{` and `}` open and close a block depends on the diagram's
// grammar — a brace in a message, a label or a quoted string is text.
// The types whose grammar has `{ … }` blocks (class, state, entity, requirement and
// C4 boundary bodies; a flowchart's `@{ … }` over several lines).
const braceTypes = new Set([
  'block',
  'c4',
  'class',
  'er',
  'flowchart',
  'mindmap',
  'requirement',
  'state',
  'swimlane'
]);
// Where a `:` starts free text (a relation's or a state's label, a field's value).
const colonLabelTypes = new Set(['class', 'er', 'requirement', 'state']);
// Where `[…]`, `(…)` and `|…|` hold a label.
const bracketLabelTypes = new Set(['block', 'er', 'flowchart', 'mindmap', 'swimlane']);
// An entity relationship's cardinality, which is drawn with braces (`||--o{`).
const erCardinality = /(?:\|o|\|\||\}o|\}\|)(?:--|\.\.)(?:o\||\|\||o\{|\|\{)/g;

/** The line up to its first `:` that is not inside a `@{ … }`. */
const beforeLabel = (line: string) => {
  let inData = false;
  for (let index = 0; index < line.length; index++) {
    if (line.startsWith('@{', index)) inData = true;
    else if (line[index] === '}') inData = false;
    else if (line[index] === ':' && !inData) return line.slice(0, index);
  }
  return line;
};

/**
 * How a line changes the block depth: +1 for each block it opens, -1 for each it closes.
 * `depth` is the depth before the line.
 */
const braceDelta = (line: string, type: string | undefined, depth: number): number => {
  // Titles and accessible texts are free text to the end of the line.
  if (/^\s*(?:title|accTitle|accDescr)\s*:|^\s*title\s/.test(line)) return 0;
  const text = line.replaceAll(/"[^"]*"/g, '""');
  if (type !== undefined && braceTypes.has(type)) {
    let structure = type === 'er' ? text.replaceAll(erCardinality, '--') : text;
    if (bracketLabelTypes.has(type)) {
      structure = structure.replaceAll(/\[[^\]]*\]|\([^)]*\)|\|[^|]*\|/g, '');
    }
    if (colonLabelTypes.has(type)) structure = beforeLabel(structure);
    return (structure.match(/\{/g)?.length ?? 0) - (structure.match(/\}/g)?.length ?? 0);
  }
  // The others (sequence, gantt, pie, …) have no brace blocks; only an object's
  // `@{ … }` metadata may run over several lines, and it cannot contain a `}`.
  if (depth > 0) return text.includes('}') ? -1 : 0;
  const head = beforeLabel(text);
  const open = head.lastIndexOf('@{');
  return open !== -1 && !head.slice(open).includes('}') ? 1 : 0;
};

/**
 * The top-level line (outside any block the diagram's grammar opens with `{ }`, an
 * `accDescr { … }` text, or `block:` … `end`) the test matches, or -1.
 */
const topLine = (lines: string[], test: (line: string) => boolean, blocks = false) => {
  const type = types.find(([, pattern]) => pattern.test(lines[headerIndex(lines)] ?? ''))?.[0];
  let depth = 0;
  let inDescription = false;
  for (let index = headerIndex(lines) + 1; index < lines.length; index++) {
    const line = lines[index];
    if (inDescription) {
      if (line.includes('}')) inDescription = false;
      continue;
    }
    if (!isContent(line)) continue;
    if (depth === 0 && test(line)) return index;
    const description = /^\s*accDescr\s*\{(.*)$/.exec(line);
    if (description) {
      inDescription = !description[1].includes('}');
      continue;
    }
    depth = Math.max(0, depth + braceDelta(line, type, depth));
    if (blocks) {
      if (/^\s*block:/.test(line)) depth++;
      else if (/^\s*end\s*$/.test(line)) depth--;
    }
  }
  return -1;
};

/** The indentation of the diagram's statements, for a line added after the header. */
const bodyIndent = (lines: string[]) => {
  const header = headerIndex(lines);
  const next = lines.slice(header + 1).find((line) => isContent(line));
  return next && indentOf(next) > 0 ? ' '.repeat(indentOf(next)) : '  ';
};

/** Sets, replaces or (with `undefined`) removes the top-level statement the pattern finds. */
const setStatement = (
  code: string,
  pattern: RegExp,
  text: string | undefined,
  blocks = false
): string => {
  const { eol, lines } = splitLines(code);
  const at = topLine(lines, (line) => pattern.test(line), blocks);
  if (text === undefined) {
    if (at !== -1) lines.splice(at, 1);
    return lines.join(eol);
  }
  if (at === -1) lines.splice(headerIndex(lines) + 1, 0, `${bodyIndent(lines)}${text}`);
  else lines[at] = `${' '.repeat(indentOf(lines[at]))}${text}`;
  return lines.join(eol);
};

const statementValue = (code: string, pattern: RegExp, blocks = false): string | undefined => {
  const { lines } = splitLines(code);
  const at = topLine(lines, (line) => pattern.test(line), blocks);
  return at === -1 ? undefined : (pattern.exec(lines[at])?.[1] ?? '').trim();
};

// ---- Accessibility: accTitle / accDescr ----

const accTitle = /^\s*accTitle\s*:\s*(.*)$/;
const accDescr = /^\s*accDescr\s*:\s*(.*)$/;
const accDescrBlock = /^\s*accDescr\s*\{\s*(.*)$/;

const readDescription = (code: string): string => {
  const single = statementValue(code, accDescr);
  if (single !== undefined) return single;
  const { lines } = splitLines(code);
  const start = lines.findIndex((line) => accDescrBlock.test(line));
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index >= start && line.includes('}'));
  return lines
    .slice(start, end === -1 ? undefined : end + 1)
    .join(' ')
    .replace(/^\s*accDescr\s*\{/, '')
    .replace(/\}\s*$/, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
};

const writeDescription = (code: string, text: string): string => {
  const { eol, lines } = splitLines(code);
  const start = lines.findIndex((line) => accDescrBlock.test(line));
  if (start !== -1) {
    const end = lines.findIndex((line, index) => index >= start && line.includes('}'));
    lines.splice(start, (end === -1 ? start : end) - start + 1);
  }
  const value = oneLine(text).replaceAll(/[{}]/g, '');
  return setStatement(lines.join(eol), accDescr, value ? `accDescr: ${value}` : undefined);
};

// ---- What each type offers ----

const choice = (
  key: string,
  label: MessageKey,
  options: readonly string[],
  value: string,
  config?: boolean
): DiagramOption => ({
  config,
  key,
  kind: 'choice',
  label,
  // A value written by hand that is not one of the choices is shown as it is.
  options: options.includes(value) ? options : [value, ...options],
  value
});
const toggle = (key: string, label: MessageKey, on: boolean, config?: boolean): DiagramOption => ({
  config,
  key,
  kind: 'switch',
  label,
  value: on ? 'on' : 'off'
});

/** The options this diagram's type has, with their values in the code and config. */
export const diagramOptions = (code: string, config: string): DiagramOption[] => {
  const type = optionType(code);
  if (!type) return [];
  const parsed = parseConfig(config) ?? {};
  const { lines } = splitLines(code);
  const header = lines[headerIndex(lines)] ?? '';
  const options: DiagramOption[] = [];
  if (type === 'flowchart') {
    const curve = section(parsed, 'flowchart').curve;
    options.push(
      choice(
        'curve',
        'opt.curve',
        ['default', ...edgeCurves],
        typeof curve === 'string' ? curve : 'default',
        true
      )
    );
  }
  if (withLook.has(type)) {
    const look = typeof parsed.look === 'string' ? parsed.look : 'default';
    options.push(choice('look', 'opt.look', looks, look, true));
  }
  if (type === 'sequence') {
    options.push(
      toggle(
        'autonumber',
        'opt.autonumber',
        statementValue(code, /^\s*autonumber\b(.*)$/) !== undefined
      )
    );
  }
  if (type === 'gantt') {
    const excludes = statementValue(code, /^\s*excludes\s+(.*)$/) ?? '';
    const format = statementValue(code, /^\s*axisFormat\s+(.*)$/);
    const tick = statementValue(code, /^\s*tickInterval\s+(.*)$/);
    const formatId =
      format === undefined
        ? 'default'
        : (Object.entries(ganttAxisFormats).find(([, value]) => value === format)?.[0] ?? format);
    options.push(
      toggle('weekends', 'opt.weekends', /(?:^|,)\s*weekends\s*(?:,|$)/i.test(excludes)),
      toggle(
        'today',
        'opt.today',
        statementValue(code, /^\s*todayMarker\s+(off)\s*$/) === undefined
      ),
      choice(
        'axisFormat',
        'opt.axisFormat',
        ['default', ...Object.keys(ganttAxisFormats)],
        formatId
      ),
      choice('tick', 'opt.tick', ['default', ...ganttTicks], tick ?? 'default')
    );
  }
  if (type === 'pie')
    options.push(toggle('showData', 'opt.showData', /^\s*pie\s+showData\b/.test(header)));
  if (type === 'xychart') {
    options.push(
      toggle('horizontal', 'opt.horizontal', /^\s*xychart(?:-beta)?\s+horizontal\b/.test(header))
    );
  }
  if (type === 'git') {
    const direction = /^\s*gitGraph\s+(LR|TB|BT)\s*:/.exec(header)?.[1] ?? 'LR';
    options.push(choice('gitDirection', 'opt.gitDirection', gitDirections, direction));
  }
  if (type === 'block') {
    options.push({
      key: 'columns',
      kind: 'number',
      label: 'opt.columns',
      value: statementValue(code, /^\s*columns\s+(\d+|auto)\s*$/, true) ?? ''
    });
  }
  if (type === 'mindmap') {
    const layout = typeof parsed.layout === 'string' ? parsed.layout : 'default';
    options.push(choice('mindmapLayout', 'opt.mindmapLayout', mindmapLayouts, layout, true));
  }
  if (type === 'sankey') {
    const sankey = section(parsed, 'sankey');
    options.push(
      toggle('sankeyValues', 'opt.sankeyValues', sankey.showValues !== false, true),
      choice(
        'sankeyLinkColor',
        'opt.sankeyLinkColor',
        sankeyLinkColors,
        typeof sankey.linkColor === 'string' ? sankey.linkColor : 'default',
        true
      ),
      choice(
        'sankeyAlign',
        'opt.sankeyAlign',
        sankeyAlignments,
        typeof sankey.nodeAlignment === 'string' ? sankey.nodeAlignment : 'default',
        true
      )
    );
  }
  if (type === 'packet') {
    const packet = section(parsed, 'packet');
    options.push(
      {
        config: true,
        key: 'bitsPerRow',
        kind: 'number',
        label: 'opt.bitsPerRow',
        value: typeof packet.bitsPerRow === 'number' ? String(packet.bitsPerRow) : ''
      },
      toggle('showBits', 'opt.showBits', packet.showBits !== false, true)
    );
  }
  if (type === 'timeline') {
    const timeline = section(parsed, 'timeline');
    options.push(toggle('multicolor', 'opt.multicolor', timeline.disableMulticolor !== true, true));
  }
  if (accessible.has(type)) {
    options.push(
      {
        key: 'accTitle',
        kind: 'text',
        label: 'opt.accTitle',
        value: statementValue(code, accTitle) ?? ''
      },
      { key: 'accDescr', kind: 'text', label: 'opt.accDescr', value: readDescription(code) }
    );
  }
  return options;
};

/** The config JSON with `path` set, or removed with `undefined`; an emptied section goes. */
const writeConfig = (config: string, path: string[], value: unknown): string | undefined => {
  const parsed = parseConfig(config);
  if (!parsed) return undefined;
  const [name, key] = path;
  const without = (object: Config, drop: string) =>
    Object.fromEntries(Object.entries(object).filter(([entry]) => entry !== drop));
  if (key === undefined) {
    return JSON.stringify(
      value === undefined ? without(parsed, name) : { ...parsed, [name]: value },
      undefined,
      2
    );
  }
  const inner =
    value === undefined
      ? without(section(parsed, name), key)
      : { ...section(parsed, name), [key]: value };
  const next = Object.keys(inner).length > 0 ? { ...parsed, [name]: inner } : without(parsed, name);
  return JSON.stringify(next, undefined, 2);
};

const withHeader = (code: string, change: (header: string) => string): string => {
  const { eol, lines } = splitLines(code);
  const at = headerIndex(lines);
  lines[at] = change(lines[at] ?? '');
  return lines.join(eol);
};

/**
 * The code or config with one option changed; undefined when the value is not one the
 * option takes (or the config does not parse).
 */
export const setDiagramOption = (
  code: string,
  config: string,
  key: string,
  value: string
): OptionChange | undefined => {
  const on = value === 'on';
  const inConfig = (path: string[], next: unknown) => {
    const written = writeConfig(config, path, next);
    return written === undefined ? undefined : { config: written };
  };
  switch (key) {
    case 'curve': {
      if (value !== 'default' && !(edgeCurves as readonly string[]).includes(value))
        return undefined;
      return inConfig(['flowchart', 'curve'], value === 'default' ? undefined : value);
    }
    case 'look': {
      if (!(looks as readonly string[]).includes(value)) return undefined;
      return inConfig(['look'], value === 'default' ? undefined : value);
    }
    case 'autonumber': {
      return { code: setStatement(code, /^\s*autonumber\b/, on ? 'autonumber' : undefined) };
    }
    case 'weekends': {
      const current = statementValue(code, /^\s*excludes\s+(.*)$/) ?? '';
      const rest = current
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part && part.toLowerCase() !== 'weekends');
      const parts = on ? ['weekends', ...rest] : rest;
      return {
        code: setStatement(
          code,
          /^\s*excludes\s/,
          parts.length > 0 ? `excludes ${parts.join(', ')}` : undefined
        )
      };
    }
    case 'today': {
      // A `todayMarker` style stays; only `off` hides it.
      const hidden = /^\s*todayMarker\s+off\s*$/;
      if (on) return { code: setStatement(code, hidden, undefined) };
      return { code: setStatement(code, /^\s*todayMarker\b/, 'todayMarker off') };
    }
    case 'axisFormat': {
      const format = ganttAxisFormats[value as keyof typeof ganttAxisFormats];
      if (value !== 'default' && !format) return undefined;
      return {
        code: setStatement(code, /^\s*axisFormat\s/, format ? `axisFormat ${format}` : undefined)
      };
    }
    case 'tick': {
      if (value !== 'default' && !(ganttTicks as readonly string[]).includes(value))
        return undefined;
      return {
        code: setStatement(
          code,
          /^\s*tickInterval\s/,
          value === 'default' ? undefined : `tickInterval ${value}`
        )
      };
    }
    case 'showData': {
      return {
        code: withHeader(code, (header) =>
          on
            ? header.replace(/^(\s*pie)(?!\s+showData\b)\b/, '$1 showData')
            : header.replace(/^(\s*pie)\s+showData\b/, '$1')
        )
      };
    }
    case 'horizontal': {
      return {
        code: withHeader(code, (header) =>
          on
            ? header.replace(/^(\s*xychart(?:-beta)?)(?!\s+horizontal\b)\b/, '$1 horizontal')
            : header.replace(/^(\s*xychart(?:-beta)?)\s+horizontal\b/, '$1')
        )
      };
    }
    case 'gitDirection': {
      if (!(gitDirections as readonly string[]).includes(value)) return undefined;
      return {
        code: withHeader(code, (header) => {
          const base = header.replace(/^(\s*gitGraph)(?:\s+(?:LR|TB|BT))?\s*:?/, '$1');
          // Left to right is mermaid's default: written without a direction.
          return value === 'LR' ? base : base.replace(/^(\s*gitGraph)/, `$1 ${value}:`);
        })
      };
    }
    case 'columns': {
      const text = value.trim();
      if (text !== '' && !/^[1-9]\d?$/.test(text)) return undefined;
      return {
        code: setStatement(
          code,
          /^\s*columns\s+(?:\d+|auto)\s*$/,
          text ? `columns ${text}` : undefined,
          true
        )
      };
    }
    case 'mindmapLayout': {
      if (!(mindmapLayouts as readonly string[]).includes(value)) return undefined;
      return inConfig(['layout'], value === 'default' ? undefined : value);
    }
    case 'sankeyValues': {
      return inConfig(['sankey', 'showValues'], on ? undefined : false);
    }
    case 'sankeyLinkColor': {
      if (!(sankeyLinkColors as readonly string[]).includes(value)) return undefined;
      return inConfig(['sankey', 'linkColor'], value === 'default' ? undefined : value);
    }
    case 'sankeyAlign': {
      if (!(sankeyAlignments as readonly string[]).includes(value)) return undefined;
      return inConfig(['sankey', 'nodeAlignment'], value === 'default' ? undefined : value);
    }
    case 'bitsPerRow': {
      const text = value.trim();
      if (text !== '' && !/^[1-9]\d{0,2}$/.test(text)) return undefined;
      return inConfig(['packet', 'bitsPerRow'], text ? Number(text) : undefined);
    }
    case 'showBits': {
      return inConfig(['packet', 'showBits'], on ? undefined : false);
    }
    case 'multicolor': {
      return inConfig(['timeline', 'disableMulticolor'], on ? undefined : true);
    }
    case 'accTitle': {
      const text = oneLine(value);
      return { code: setStatement(code, accTitle, text ? `accTitle: ${text}` : undefined) };
    }
    case 'accDescr': {
      return { code: writeDescription(code, value) };
    }
    default: {
      return undefined;
    }
  }
};

// ---- The selected object's options (the inspector's rows under it) ----

const escapeId = (id: string) => id.replaceAll(/[$()*+.?[\\\]^{|}-]/g, String.raw`\$&`);
const idEnd = String.raw`(?![\p{L}\p{N}_-])`;

/** A flowchart subgraph's own direction: `direction LR` among its direct contents. */
const subgraphStart = (id: string) =>
  new RegExp(String.raw`^\s*subgraph\s+${escapeId(id)}${idEnd}`, 'u');
const directionLine = /^(\s*)direction\s+(TB|TD|BT|LR|RL)\s*$/;
export const laneDirections = ['inherit', 'TB', 'BT', 'LR', 'RL'] as const;

const subgraphDirection = (lines: string[], id: string) => {
  const start = lines.findIndex((line) => subgraphStart(id).test(line));
  if (start === -1) return undefined;
  let depth = 0;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (/^\s*subgraph\b/.test(line)) depth++;
    else if (/^\s*end\s*$/.test(line)) {
      if (depth === 0) return { line: -1, start, value: 'inherit' };
      depth--;
    } else if (depth === 0) {
      const match = directionLine.exec(line);
      if (match) return { line: index, start, value: match[2] === 'TD' ? 'TB' : match[2] };
    }
  }
  return undefined;
};

/**
 * A sequence participant's declaration: keyword, id, the space before `@{ … }`, the
 * `@{ … }` (mermaid's lexer: any spaces between the id and `@{`, no `}` inside, which
 * may run over several lines) and ` as Label`.
 */
const declaration = (id: string) =>
  new RegExp(
    String.raw`^(\s*)((?:create\s+)?)(participant|actor)\s+${escapeId(id)}(?:(\s*)(@\{[^}]*\}))?((?:\s+as\s+.*)?)\s*$`,
    'u'
  );
// The first line of any declaration of the id, whatever follows it.
const declarationStart = (id: string) =>
  new RegExp(
    String.raw`^\s*(?:create\s+)?(?:participant|actor)\s+${escapeId(id)}(?=\s|@\{|$)`,
    'u'
  );

/** The participant's declaration: its lines (`@{ … }` may span several) and their parts. */
const findDeclaration = (lines: string[], id: string) => {
  for (let start = 0; start < lines.length; start++) {
    if (!declarationStart(id).test(lines[start])) continue;
    let end = start;
    if (/@\{[^}]*$/.test(lines[start])) {
      while (end < lines.length - 1 && !lines[end].includes('}')) end++;
    }
    const match = declaration(id).exec(lines.slice(start, end + 1).join('\n'));
    return { end, match, start };
  }
  return undefined;
};
export const participantTypes = [
  'participant',
  'actor',
  'boundary',
  'control',
  'entity',
  'database',
  'collections',
  'queue'
] as const;
// The `type` entry of a participant's `@{ … }`, which mermaid reads as YAML: the key
// and the value quoted or not.
const typeEntry = /(?<=[{,\s])(["']?)type\1\s*:\s*(["']?)([A-Za-z]+)\2/;
const typeInData = (data: string) => typeEntry.exec(data)?.[3].toLowerCase();
/** The `@{ … }` with its `type` set to `value`, or dropped (`undefined`); '' when nothing is left. */
const dataWithType = (data: string, value: string | undefined): string => {
  if (!data || /^@\{\s*\}$/.test(data)) return value ? `@{ "type": "${value}" }` : '';
  if (typeEntry.test(data)) {
    if (value) return data.replace(typeEntry, `"type": "${value}"`);
    const rest = data
      .replace(new RegExp(String.raw`${typeEntry.source}\s*,?`), '')
      .replace(/,(\s*)\}$/, '$1}');
    return /^@\{\s*\}$/.test(rest) ? '' : rest;
  }
  if (!value) return data;
  // Over several lines mermaid reads the entries as a YAML block: one more line.
  const block = /^@\{[^\S\n]*\n([^\S\n]*)/.exec(data);
  if (block) return data.replace(/^@\{[^\S\n]*\n/, `@{\n${block[1]}type: ${value}\n`);
  return data.replace(/^@\{\s*/, (open) => `${open}"type": "${value}", `);
};

/** A mindmap topic's shape, by the brackets around its text. */
export const mindmapShapes = {
  bang: ['))', '(('],
  circle: ['((', '))'],
  cloud: [')', '('],
  default: ['', ''],
  hexagon: ['{{', '}}'],
  rounded: ['(', ')'],
  square: ['[', ']']
} as const;

export const classAnnotations = [
  'none',
  'interface',
  'abstract',
  'service',
  'enumeration'
] as const;
const annotationLine = (id: string) =>
  new RegExp(String.raw`^\s*<<\s*([^>]+?)\s*>>\s*${escapeId(id)}\s*$`, 'u');
const classDeclaration = (id: string) =>
  new RegExp(String.raw`^(\s*class\s+)${escapeId(id)}(~[^~]*~)?(?=[\s[{:]|$)`, 'u');

/** A kanban card's `@{ … }` metadata. */
export const kanbanPriorities = {
  high: 'High',
  low: 'Low',
  none: '',
  veryHigh: 'Very High',
  veryLow: 'Very Low'
} as const;
const metaPairs = (meta: string): [string, string][] =>
  [...meta.matchAll(/([\w-]+)\s*:\s*('[^']*'|"[^"]*"|[^,}]*)/g)].map(([, key, value]) => [
    key,
    value.trim().replace(/^(['"])(.*)\1$/, '$2')
  ]);
const renderMeta = (pairs: [string, string][]) =>
  pairs.length > 0
    ? `@{ ${pairs.map(([key, value]) => `${key}: '${value.replaceAll("'", '’')}'`).join(', ')} }`
    : '';

/** A requirement's or element's block: `functionalRequirement name { … }`. */
export const requirementTypes = [
  'requirement',
  'functionalRequirement',
  'interfaceRequirement',
  'performanceRequirement',
  'physicalRequirement',
  'designConstraint'
] as const;
export const requirementRisks = ['none', 'low', 'medium', 'high'] as const;
export const verifyMethods = ['none', 'analysis', 'inspection', 'test', 'demonstration'] as const;
const requirementStart = (name: string) =>
  new RegExp(
    String.raw`^(\s*)(${[...requirementTypes, 'element'].join('|')})\s+(?:${escapeId(name)}(?![\w-])|"${escapeId(name)}")\s*\{\s*$`
  );
const blockClose = (lines: string[], start: number) =>
  lines.findIndex((line, index) => index > start && /^\s*\}\s*$/.test(line));
const requirementKey = (key: string) => new RegExp(String.raw`^(\s*)${key}\s*:\s*(.*?)\s*$`, 'i');

const objectChoice = (
  key: string,
  label: MessageKey,
  options: readonly string[],
  value: string
): DetailField => ({
  key,
  kind: 'choice',
  label,
  options: options.includes(value) ? options : [value, ...options],
  value
});

/**
 * Options of the selected object that mermaid offers for its type, as rows: a
 * subgraph's own direction, a participant's symbol, a topic's shape, a class's
 * annotation and type parameter, a kanban card's assignee, ticket and priority, a
 * requirement's kind, id, text, risk and verification, a block's width.
 */
export const objectOptions = (code: string, kind: string, object: EditObject): DetailField[] => {
  const { lines } = splitLines(code);
  const header = lines[headerIndex(lines)] ?? '';
  if (kind === 'flowchart' && object.group && !/^\s*swimlane-beta\b/.test(header)) {
    const found = subgraphDirection(lines, object.id);
    return found
      ? [objectChoice('laneDirection', 'opt.laneDirection', laneDirections, found.value)]
      : [];
  }
  if (kind === 'sequence' && object.line === undefined && !object.group) {
    const match = findDeclaration(lines, object.id)?.match;
    const found = match ? (typeInData(match[5] ?? '') ?? match[3]) : 'participant';
    const type = (participantTypes as readonly string[]).includes(found) ? found : 'participant';
    return [objectChoice('participantType', 'opt.participantType', participantTypes, type)];
  }
  if (kind === 'mindmap' && object.line !== undefined) {
    const match = shapedLine.exec(lines[object.line] ?? '');
    const shape = match
      ? (Object.entries(mindmapShapes).find(([, [open]]) => open === match[3])?.[0] ?? 'default')
      : 'default';
    return [objectChoice('topicShape', 'opt.topicShape', Object.keys(mindmapShapes), shape)];
  }
  if (kind === 'class' && !object.group) {
    const annotation =
      lines.map((line) => annotationLine(object.id).exec(line)?.[1]).find(Boolean) ?? 'none';
    const generic =
      lines
        .map((line) => classDeclaration(object.id).exec(line)?.[2])
        .find(Boolean)
        ?.slice(1, -1) ?? '';
    return [
      objectChoice('annotation', 'opt.annotation', classAnnotations, annotation),
      { key: 'generic', kind: 'text', label: 'opt.generic', value: generic }
    ];
  }
  if (kind === 'kanban' && object.line !== undefined) {
    const nodes = lines
      .map((line, index) => ({ index, indent: indentOf(line), line }))
      .filter(({ index, line }) => index > headerIndex(lines) && isContent(line));
    const own = nodes.find(({ index }) => index === object.line);
    const isCard =
      own && nodes.some(({ indent, index }) => index < own.index && indent < own.indent);
    if (!isCard) return [];
    const pairs = metaPairs(/@\{(.*)\}\s*$/.exec(lines[object.line])?.[1] ?? '');
    const value = (key: string) => pairs.find(([name]) => name === key)?.[1] ?? '';
    const priority =
      Object.entries(kanbanPriorities).find(([, text]) => text === value('priority'))?.[0] ??
      value('priority');
    return [
      { key: 'assigned', kind: 'text', label: 'opt.assigned', value: value('assigned') },
      { key: 'ticket', kind: 'text', label: 'opt.ticket', value: value('ticket') },
      objectChoice('priority', 'opt.priority', Object.keys(kanbanPriorities), priority)
    ];
  }
  if (kind === 'requirement') {
    const start = lines.findIndex((line) => requirementStart(object.id).test(line));
    if (start === -1) return [];
    const end = blockClose(lines, start);
    const body = lines.slice(start + 1, end === -1 ? undefined : end);
    const value = (key: string) =>
      body
        .map((line) => requirementKey(key).exec(line)?.[2])
        .find((found) => found !== undefined) ?? '';
    const type = requirementStart(object.id).exec(lines[start])?.[2] ?? 'requirement';
    if (type === 'element') {
      return [
        { key: 'elementType', kind: 'text', label: 'opt.elementType', value: value('type') },
        { key: 'docRef', kind: 'text', label: 'opt.docRef', value: value('docref') }
      ];
    }
    return [
      objectChoice('requirementType', 'opt.requirementType', requirementTypes, type),
      { key: 'reqId', kind: 'text', label: 'opt.reqId', value: value('id') },
      { key: 'reqText', kind: 'text', label: 'opt.reqText', value: value('text') },
      objectChoice('risk', 'opt.risk', requirementRisks, value('risk').toLowerCase() || 'none'),
      objectChoice(
        'verifyMethod',
        'opt.verifyMethod',
        verifyMethods,
        value('verifymethod').toLowerCase() || 'none'
      )
    ];
  }
  if (kind === 'block' && !object.group) {
    const found = blockPlace(lines, object.id);
    return found
      ? [{ key: 'blockWidth', kind: 'number', label: 'opt.blockWidth', value: found.width }]
      : [];
  }
  return [];
};

/** Where a block is placed: its line, its token and the width written after it. */
const blockPlace = (lines: string[], id: string) => {
  for (let index = headerIndex(lines) + 1; index < lines.length; index++) {
    const token = blockTokens(lines[index])?.find((candidate) => candidate.id === id);
    if (!token) continue;
    const text = lines[index].slice(token.start, token.end);
    return { index, text, token, width: /:(\d+)$/.exec(text)?.[1] ?? '' };
  }
  return undefined;
};

/** Every key objectOptions writes, so the selection model knows which writer takes a change. */
export const objectOptionKeys = new Set([
  'laneDirection',
  'participantType',
  'topicShape',
  'annotation',
  'generic',
  'assigned',
  'ticket',
  'priority',
  'requirementType',
  'reqId',
  'reqText',
  'risk',
  'verifyMethod',
  'elementType',
  'docRef',
  'blockWidth'
]);

/** The code with one of the object's options changed; undefined when that is not possible. */
export const setObjectOption = (
  code: string,
  kind: string,
  object: EditObject,
  key: string,
  value: string
): string | undefined => {
  const { eol, lines } = splitLines(code);
  const done = () => lines.join(eol);
  if (key === 'laneDirection' && kind === 'flowchart') {
    if (!(laneDirections as readonly string[]).includes(value)) return undefined;
    const found = subgraphDirection(lines, object.id);
    if (!found) return undefined;
    if (found.line !== -1) {
      if (value === 'inherit') lines.splice(found.line, 1);
      else lines[found.line] = lines[found.line].replace(directionLine, `$1direction ${value}`);
    } else if (value !== 'inherit') {
      const inner = lines[found.start + 1];
      const indent =
        inner && !/^\s*end\s*$/.test(inner) && indentOf(inner) > indentOf(lines[found.start])
          ? ' '.repeat(indentOf(inner))
          : ' '.repeat(indentOf(lines[found.start]) + 2);
      lines.splice(found.start + 1, 0, `${indent}direction ${value}`);
    }
    return done();
  }
  if (key === 'participantType' && kind === 'sequence') {
    if (!(participantTypes as readonly string[]).includes(value)) return undefined;
    const keyword = value === 'actor' ? 'actor' : 'participant';
    const found = findDeclaration(lines, object.id);
    if (found) {
      // Rewritten in place, keeping the space before `@{`, its other entries and the alias.
      // A declaration this cannot read is left alone rather than declared a second time.
      if (!found.match) return undefined;
      const [, indent, create, , space = '', data = '', alias] = found.match;
      const typed = dataWithType(
        data,
        value === 'participant' || value === 'actor' ? undefined : value
      );
      const text = `${indent}${create}${keyword} ${object.id}${typed ? `${space}${typed}` : ''}${alias}`;
      lines.splice(found.start, found.end - found.start + 1, ...text.split('\n'));
      return done();
    }
    // Declared where the undeclared ones before it are declared too, so the order stays.
    const declared = (id: string) => lines.some((line) => declarationStart(id).test(line));
    const before = (object.after ?? []).filter((id) => !declared(id));
    let last = lines.findLastIndex((line) => /^\s*(?:participant|actor)\s+/.test(line));
    if (last === -1) last = headerIndex(lines);
    const indent = last > headerIndex(lines) ? (/^\s*/.exec(lines[last])?.[0] ?? '  ') : '  ';
    const typed = value === 'participant' || value === 'actor' ? '' : `@{ "type": "${value}" }`;
    const label =
      object.label.trim() && object.label.trim() !== object.id ? ` as ${object.label.trim()}` : '';
    lines.splice(
      last + 1,
      0,
      ...before.map((id) => `${indent}participant ${id}`),
      `${indent}${keyword} ${object.id}${typed}${label}`
    );
    return done();
  }
  if (key === 'topicShape' && kind === 'mindmap' && object.line !== undefined) {
    const brackets = mindmapShapes[value as keyof typeof mindmapShapes];
    if (!brackets) return undefined;
    const line = lines[object.line] ?? '';
    const match = shapedLine.exec(line);
    const indent = /^\s*/.exec(line)?.[0] ?? '';
    const text = match ? match[4] : line.trim();
    if (value === 'default') {
      // Plain text cannot hold brackets or quotes: such a topic keeps its shape.
      if (/[()[\]{}"]/.test(text)) return undefined;
      lines[object.line] = `${indent}${text}`;
      return done();
    }
    const id = match?.[2] || freshId(code, 'n');
    lines[object.line] = `${indent}${id}${brackets[0]}${text}${brackets[1]}`;
    return done();
  }
  if (key === 'annotation' && kind === 'class') {
    const name = value.trim();
    if (name !== 'none' && !/^[\p{L}\p{N}_ ]+$/u.test(name)) return undefined;
    const existing = lines.findIndex((line) => annotationLine(object.id).test(line));
    const indent = existing === -1 ? bodyIndent(lines) : ' '.repeat(indentOf(lines[existing]));
    if (existing !== -1) lines.splice(existing, 1);
    if (name === 'none') return done();
    const declared = lines.findIndex((line) => classDeclaration(object.id).test(line));
    const at = declared === -1 ? headerIndex(lines) : declared;
    // After the whole `class X { … }` block, when the declaration opens one.
    const close =
      declared !== -1 && lines[declared].includes('{') && !lines[declared].includes('}')
        ? lines.findIndex((line, index) => index > declared && /^\s*\}\s*$/.test(line))
        : -1;
    lines.splice((close === -1 ? at : close) + 1, 0, `${indent}<<${name}>> ${object.id}`);
    return done();
  }
  if (key === 'generic' && kind === 'class') {
    const text = value.trim();
    if (text && !/^[\p{L}\p{N}_ ,]+$/u.test(text)) return undefined;
    const generic = text ? `~${text}~` : '';
    const at = lines.findIndex((line) => classDeclaration(object.id).test(line));
    if (at === -1) {
      if (!text) return code;
      lines.splice(headerIndex(lines) + 1, 0, `${bodyIndent(lines)}class ${object.id}${generic}`);
      return done();
    }
    lines[at] = lines[at].replace(classDeclaration(object.id), `$1${object.id}${generic}`);
    return done();
  }
  if ((key === 'assigned' || key === 'ticket' || key === 'priority') && kind === 'kanban') {
    if (object.line === undefined) return undefined;
    const line = lines[object.line] ?? '';
    const metaMatch = /\s*@\{(.*)\}\s*$/.exec(line);
    const head = metaMatch ? line.slice(0, metaMatch.index) : line.trimEnd();
    const pairs = metaPairs(metaMatch?.[1] ?? '').filter(([name]) => name !== key);
    let text = oneLine(value).replaceAll(/[{}]/g, '');
    if (key === 'priority') {
      if (!(value in kanbanPriorities)) return undefined;
      text = kanbanPriorities[value as keyof typeof kanbanPriorities];
    }
    // A card needs brackets for metadata (`id[Text]@{ … }`).
    const shaped = /[)\]}]$/.test(head.trim())
      ? head
      : `${/^\s*/.exec(head)?.[0] ?? ''}${freshId(code, 'k')}[${head.trim()}]`;
    const next = text ? [...pairs, [key, text] as [string, string]] : pairs;
    lines[object.line] = `${next.length > 0 ? shaped : head}${renderMeta(next)}`;
    return done();
  }
  if (kind === 'requirement') {
    const start = lines.findIndex((line) => requirementStart(object.id).test(line));
    if (start === -1) return undefined;
    if (key === 'requirementType') {
      if (!(requirementTypes as readonly string[]).includes(value)) return undefined;
      lines[start] = lines[start].replace(
        new RegExp(String.raw`^(\s*)(?:${requirementTypes.join('|')})\b`),
        `$1${value}`
      );
      return done();
    }
    const names: Record<string, string> = {
      docRef: 'docref',
      elementType: 'type',
      reqId: 'id',
      reqText: 'text',
      risk: 'risk',
      verifyMethod: 'verifymethod'
    };
    const name = names[key];
    if (!name) return undefined;
    if (key === 'risk' && !(requirementRisks as readonly string[]).includes(value))
      return undefined;
    if (key === 'verifyMethod' && !(verifyMethods as readonly string[]).includes(value))
      return undefined;
    const text = value === 'none' ? '' : oneLine(value).replaceAll(/[{}]/g, '');
    const end = blockClose(lines, start);
    if (end === -1) return undefined;
    const at = lines.findIndex(
      (line, index) => index > start && index < end && requirementKey(name).test(line)
    );
    const indent = ' '.repeat(indentOf(lines[start]) + 2);
    const written = /["]/.test(text) || !/[:]/.test(text) ? text : `"${text}"`;
    if (at === -1) {
      if (text) lines.splice(end, 0, `${indent}${name}: ${written}`);
    } else if (text) {
      lines[at] = `${/^\s*/.exec(lines[at])?.[0] ?? indent}${name}: ${written}`;
    } else lines.splice(at, 1);
    return done();
  }
  if (key === 'blockWidth' && kind === 'block') {
    const text = value.trim();
    if (text !== '' && !/^[1-9]\d?$/.test(text)) return undefined;
    const found = blockPlace(lines, object.id);
    if (!found) return undefined;
    const base = found.text.replace(/:\d+$/, '');
    const line = lines[found.index];
    lines[found.index] =
      line.slice(0, found.token.start) +
      (text && text !== '1' ? `${base}:${text}` : base) +
      line.slice(found.token.end);
    return done();
  }
  return undefined;
};
