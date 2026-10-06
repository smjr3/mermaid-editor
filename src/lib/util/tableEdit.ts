/**
 * Local: the table editor (TableEditor.svelte) — the list-like diagram types
 * as rows and columns, the way a business user thinks of them: gantt tasks,
 * kanban cards, timeline periods, pie slices and the attributes of an ER
 * entity. Rows are read from the code's lines (checked against mermaid's own
 * parse by `tableModel`) and written back through the Add and Edit cards'
 * functions where they exist (diagramDetails.ts, diagramModify.ts,
 * addActions.ts); the rest — a task's section, a card's column, assignee and
 * priority, a period's events, reordering — rewrites the lines here. The card
 * applies a result only if mermaid still parses it (`checkEdit`).
 */
import { messages, type MessageKey } from '$/i18n/messages';
import mermaid from 'mermaid';
import { blockEnd, nodeLabel, nodeLines, specFor, splitMeta, type Values } from './addActions';
import {
  addChartRow,
  afterChartMove,
  chartHeaders,
  chartTableKinds,
  readChartTable,
  setChartCell
} from './chartEdit';
import { headerIndex, indentOf, isContent, oneLine } from './codeText';
import {
  addEntityAttribute,
  attributeKeys,
  deleteEntityAttribute,
  entityAttributes,
  ganttSection,
  ganttTasks,
  objectFields,
  parseGanttTask,
  pieSlice,
  renderGanttTask,
  setEntityAttribute,
  setObjectFields
} from './diagramDetails';
import { freshId, splitLines } from './diagramEdit';
import { deleteObject, renameObject, type EditKind, type EditObject } from './diagramModify';
import { memoByCode } from './memo';
import { decodeEntities, diagramFromText, type DiagramObject } from './mermaid';

type ChartTableKind = 'journey' | 'xychart' | 'quadrant' | 'sankey' | 'packet';
export type TableKind = 'gantt' | 'kanban' | 'timeline' | 'pie' | 'er' | ChartTableKind;
const isChartTable = (kind: TableKind): kind is ChartTableKind =>
  (chartTableKinds as string[]).includes(kind);

export interface TableOption {
  value: string;
  /** Shown as the message `key` when there is one, else as `text`. */
  key?: MessageKey;
  text?: string;
}

export interface TableColumn {
  key: string;
  label: MessageKey;
  kind: 'text' | 'number' | 'date' | 'choice';
  options?: TableOption[];
}

export interface TableRow {
  /** The row's first line (0-based) and the line after its block. */
  line: number;
  end: number;
  cells: Record<string, string>;
}

export interface TableModel {
  kind: TableKind;
  columns: TableColumn[];
  rows: TableRow[];
  /** ER: the entity whose attributes are the rows, and every entity to choose from. */
  entity?: string;
  entities?: DiagramObject[];
}

const headers: [TableKind, RegExp][] = [
  ['gantt', /^\s*gantt\b/],
  ['kanban', /^\s*kanban\b/],
  ['timeline', /^\s*timeline\b/],
  ['pie', /^\s*pie\b/],
  ['er', /^\s*erDiagram\b/],
  // Local: the list-like chart types (chartEdit.ts).
  ...(chartHeaders.filter(([kind]) => (chartTableKinds as string[]).includes(kind)) as [
    TableKind,
    RegExp
  ][])
];

/** The table's kind for the code's diagram type, from its header line. */
export const tableKind = (code: string): TableKind | undefined => {
  const { lines } = splitLines(code);
  const header = lines[headerIndex(lines)] ?? '';
  return headers.find(([, pattern]) => pattern.test(header))?.[0];
};

const lineObject = (line: number, label = '', part?: number): EditObject => ({
  id: `L${line}`,
  label,
  line,
  ...(part === undefined ? {} : { part })
});
const keyed = (key: MessageKey, value: string): TableOption => ({ key, value });

// ---- Gantt ----

const statusTags = ['done', 'active', 'crit', 'milestone'];
const statusKeys: Record<string, MessageKey> = {
  active: 'add.gantt.status.active',
  crit: 'table.status.crit',
  done: 'add.gantt.status.done',
  milestone: 'table.status.milestone',
  none: 'add.gantt.status.none'
};

const ganttSections = (lines: string[]) => {
  const header = headerIndex(lines);
  return lines.flatMap((line, index) => {
    const match = index > header ? ganttSection.exec(line) : null;
    return match ? [{ index, name: match[2] }] : [];
  });
};

const ganttTable = (code: string, lines: string[]): Omit<TableModel, 'kind'> => {
  const sections = ganttSections(lines);
  const tasks = ganttTasks(lines);
  const rows = tasks.map((task): TableRow => {
    const fields = Object.fromEntries(
      (objectFields(code, 'gantt', lineObject(task.line)) ?? []).map(({ key, value }) => [
        key,
        value
      ])
    );
    const section = sections.findLast(({ index }) => index < task.line);
    const status = statusTags.filter((tag) => task.tags.includes(tag)).join(',') || 'none';
    return {
      cells: {
        after: fields.after ?? '',
        days: fields.days ?? '',
        section: section ? `L${section.index}` : '',
        start: fields.start ?? '',
        status,
        task: task.name
      },
      end: task.line + 1,
      line: task.line
    };
  });
  const combos = [...new Set(rows.map(({ cells }) => cells.status))].filter(
    (status) => !(status in statusKeys)
  );
  return {
    columns: [
      {
        key: 'section',
        kind: 'choice',
        label: 'add.gantt.section',
        options: [
          keyed('add.none', ''),
          ...sections.map(({ index, name }) => ({ text: name, value: `L${index}` }))
        ]
      },
      { key: 'task', kind: 'text', label: 'add.gantt.task' },
      { key: 'start', kind: 'date', label: 'table.col.start' },
      { key: 'days', kind: 'number', label: 'add.gantt.days' },
      {
        key: 'status',
        kind: 'choice',
        label: 'table.col.status',
        options: [
          ...['none', ...statusTags].map((value) => keyed(statusKeys[value], value)),
          ...combos.map((value) => ({
            text: value
              .split(',')
              .map((tag) => messages.ja[statusKeys[tag]] ?? tag)
              .join('・'),
            value
          }))
        ]
      },
      {
        key: 'after',
        kind: 'choice',
        label: 'table.col.after',
        options: [
          keyed('add.none', ''),
          ...tasks.map(({ line, name }) => ({ text: name, value: `L${line}` }))
        ]
      }
    ],
    rows
  };
};

/** The values setObjectFields takes for a status cell. */
const statusValues = (status: string): Values => {
  const tags = status === 'none' ? [] : status.split(',');
  return {
    crit: tags.includes('crit') ? 'yes' : 'no',
    milestone: tags.includes('milestone') ? 'yes' : 'no',
    status: tags.includes('done') ? 'done' : tags.includes('active') ? 'active' : 'none'
  };
};

/** Gives the first task a start when it has none (mermaid cannot draw one without), from `start`. */
const keepFirstStart = (lines: string[], start: string) => {
  const first = ganttTasks(lines)[0];
  if (first && !first.start && start) lines[first.line] = renderGanttTask({ ...first, start });
};

const firstStart = (lines: string[]) => ganttTasks(lines)[0]?.start ?? '';

/** The code with the task on `line` moved to the end of a section (`L<line>`), or before every section. */
const moveTask = (code: string, line: number, section: string): string | undefined => {
  const { eol, lines } = splitLines(code);
  const task = parseGanttTask(lines[line] ?? '', line);
  if (!task) return undefined;
  const start = firstStart(lines);
  // A task that started straight after this one starts where this one started.
  const next = ganttTasks(lines).find((other) => other.line > line);
  if (next && !next.start && task.start)
    lines[next.line] = renderGanttTask({ ...next, start: task.start });
  const sections = ganttSections(lines);
  let at: number;
  if (section) {
    const index = Number(section.slice(1));
    if (!sections.some((s) => s.index === index)) return undefined;
    at = sections.find((s) => s.index > index)?.index ?? lines.length;
    while (at > index + 1 && !isContent(lines[at - 1])) at--;
  } else {
    at = sections[0]?.index ?? lines.length;
  }
  const indent = ganttTasks(lines).find((other) => other.line < at && other.line !== line)?.indent;
  const text = renderGanttTask({ ...task, indent: indent ?? task.indent });
  lines.splice(at, 0, text);
  lines.splice(at <= line ? line + 1 : line, 1);
  keepFirstStart(lines, start);
  return lines.join(eol);
};

const ganttCell = (code: string, row: TableRow, key: string, value: string) => {
  const object = lineObject(row.line, row.cells.task);
  switch (key) {
    case 'task':
      return renameObject(code, 'gantt', object, value);
    case 'section':
      return moveTask(code, row.line, value);
    case 'status':
      return setObjectFields(code, 'gantt', object, statusValues(value));
    case 'start':
      return setObjectFields(code, 'gantt', object, { after: '', start: value });
    case 'after':
      return setObjectFields(code, 'gantt', object, { after: value, start: '' });
    case 'days':
      if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return undefined;
      return setObjectFields(code, 'gantt', object, { days: value.trim() });
    default:
      return undefined;
  }
};

/** A date as Excel or a person writes it (2024/3/1, 2024-03-01) as YYYY-MM-DD. */
const isoDate = (text: string) => {
  const match = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(text.trim());
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
};

const addGantt = (code: string, values: Values): string | undefined => {
  const spec = specFor(code);
  const taskAction = spec?.actions.find(({ id }) => id === 'task');
  const sectionAction = spec?.actions.find(({ id }) => id === 'section');
  if (!taskAction || !sectionAction) return undefined;
  let text = code;
  const sections = ganttSections(splitLines(text).lines);
  let section = values.section?.startsWith('L')
    ? sections.find(({ index }) => `L${index}` === values.section)?.name
    : values.section?.trim();
  if (section && !sections.some(({ name }) => name === section)) {
    const added = sectionAction.apply(text, { name: section });
    if ('error' in added) return undefined;
    text = added.code;
    section = added.follow?.section ?? section;
  }
  if (!values.section) section = sections.at(-1)?.name;
  const { lines } = splitLines(text);
  let after = '';
  if (values.after) {
    const tasks = ganttTasks(lines);
    const found = values.after.startsWith('L')
      ? tasks.find(({ line }) => `L${line}` === values.after)
      : tasks.find(({ name }) => name === values.after.trim());
    after = found ? String(found.line) : '';
  }
  const result = taskAction.apply(text, {
    after,
    days: values.days?.trim() || '3',
    name: values.task ?? '',
    section: section ?? '',
    start: values.start ? isoDate(values.start) || values.start : '',
    ...statusValues(values.status || 'none')
  });
  return 'error' in result ? undefined : result.code;
};

// ---- Kanban ----

const priorities = ['', 'Very High', 'High', 'Low', 'Very Low'];
const priorityKeys: Record<string, MessageKey> = {
  '': 'table.priority.none',
  High: 'table.priority.high',
  Low: 'table.priority.low',
  'Very High': 'table.priority.veryHigh',
  'Very Low': 'table.priority.veryLow'
};

/** The `key: value` pairs of a card's `@{ … }` metadata, in order. */
const metaPairs = (meta: string): [string, string][] => {
  const inner = /@\{(.*)\}/.exec(meta)?.[1] ?? '';
  const pairs: [string, string][] = [];
  for (const part of inner.match(/(?:[^,'"]|'[^']*'|"[^"]*")+/g) ?? []) {
    const match = /^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(part);
    if (match) pairs.push([match[1], match[2]]);
  }
  return pairs;
};
const unquote = (value: string) => value.replace(/^(['"])(.*)\1$/, '$2');
const metaText = (text: string) =>
  oneLine(text)
    .replaceAll(/['"{}]/g, '')
    .replaceAll(',', '、')
    .trim();

const kanbanParts = (lines: string[]) => {
  const nodes = nodeLines(lines);
  const indent = Math.min(...nodes.map((node) => node.indent));
  const columns = nodes.filter((node) => node.indent === indent);
  const cards = nodes.filter((node) => node.indent > indent);
  return { cards, columns };
};

const kanbanTable = (lines: string[]): Omit<TableModel, 'kind'> => {
  const { cards, columns } = kanbanParts(lines);
  const rows = cards.map(({ index, line }): TableRow => {
    const meta = Object.fromEntries(metaPairs(splitMeta(line)[1]));
    return {
      cells: {
        assignee: unquote(meta.assigned ?? ''),
        card: nodeLabel(line),
        column: `L${columns.findLast((column) => column.index < index)?.index ?? ''}`,
        priority: unquote(meta.priority ?? '')
      },
      end: blockEnd(lines, index),
      line: index
    };
  });
  const asked = [...new Set(rows.map(({ cells }) => cells.priority))].filter(
    (value) => !priorities.includes(value)
  );
  return {
    columns: [
      {
        key: 'column',
        kind: 'choice',
        label: 'add.kanban.column',
        options: columns.map(({ index, line }) => ({ text: nodeLabel(line), value: `L${index}` }))
      },
      { key: 'card', kind: 'text', label: 'add.kanban.card' },
      { key: 'assignee', kind: 'text', label: 'table.col.assignee' },
      {
        key: 'priority',
        kind: 'choice',
        label: 'table.col.priority',
        options: [
          ...priorities.map((value) => keyed(priorityKeys[value], value)),
          ...asked.map((value) => ({ text: value, value }))
        ]
      }
    ],
    rows
  };
};

/** The card on `line` with one metadata key set (or removed, when empty). */
const setCardMeta = (code: string, line: number, name: string, value: string) => {
  const { eol, lines } = splitLines(code);
  let [head, meta] = splitMeta(lines[line] ?? '');
  const pairs = metaPairs(meta);
  const text = metaText(value);
  const at = pairs.findIndex(([key]) => key === name);
  if (text && at === -1) pairs.splice(name === 'assigned' ? 0 : pairs.length, 0, [name, '']);
  const next = pairs
    .map(([key, old]): [string, string] => (key === name ? [key, `'${text}'`] : [key, old]))
    .filter(([key]) => key !== name || text);
  // Metadata follows a bracket: a card written as plain text gets an id and brackets.
  if (next.length > 0 && !/[)\]}]\s*$/.test(head)) {
    const indent = /^\s*/.exec(head)?.[0] ?? '';
    const label = head.trim().replaceAll(/[[\]()]/g, '');
    head = `${indent}${freshId(code, 'card')}[${label}]`;
  }
  meta = next.length > 0 ? `@{ ${next.map(([key, v]) => `${key}: ${v}`).join(', ')} }` : '';
  lines[line] = `${head.trimEnd()}${meta}`;
  return lines.join(eol);
};

const reindent = (block: string[], from: number, to: number) =>
  block.map((line) => {
    if (!isContent(line)) return line;
    return to >= from
      ? `${' '.repeat(to - from)}${line}`
      : line.slice(Math.min(from - to, indentOf(line)));
  });

/** The code with the card on `row` moved to the end of the column on line `column`. */
const moveCard = (code: string, row: TableRow, column: string): string | undefined => {
  const { eol, lines } = splitLines(code);
  const target = Number(column.slice(1));
  const { cards, columns } = kanbanParts(lines);
  if (!columns.some(({ index }) => index === target)) return undefined;
  const end = blockEnd(lines, target);
  const sibling = cards.find(({ index }) => index > target && index < end);
  const indent = sibling?.indent ?? indentOf(lines[target]) + 2;
  const block = reindent(lines.slice(row.line, row.end), indentOf(lines[row.line]), indent);
  lines.splice(end, 0, ...block);
  lines.splice(end <= row.line ? row.line + block.length : row.line, row.end - row.line);
  return lines.join(eol);
};

const kanbanCell = (code: string, row: TableRow, key: string, value: string) => {
  switch (key) {
    case 'card':
      return renameObject(code, 'kanban', lineObject(row.line), value);
    case 'column':
      return moveCard(code, row, value);
    case 'assignee':
      return setCardMeta(code, row.line, 'assigned', value);
    case 'priority':
      return setCardMeta(code, row.line, 'priority', value);
    default:
      return undefined;
  }
};

const addKanban = (code: string, values: Values): string | undefined => {
  const spec = specFor(code);
  const cardAction = spec?.actions.find(({ id }) => id === 'card');
  const columnAction = spec?.actions.find(({ id }) => id === 'column');
  if (!cardAction || !columnAction) return undefined;
  let text = code;
  const columns = kanbanTable(splitLines(text).lines).columns[0].options ?? [];
  const asked = values.column?.trim() ?? '';
  let column = columns.find(
    ({ text: name, value }) => value === asked || (asked && name === asked)
  )?.value;
  if (!column && (asked || columns.length === 0)) {
    const added = columnAction.apply(text, { name: asked || 'Todo' });
    if ('error' in added) return undefined;
    text = added.code;
    column = `L${added.follow?.column ?? ''}`;
  }
  column ??= columns[0]?.value;
  const id = freshId(text, 'card');
  const result = cardAction.apply(text, {
    column: column?.slice(1) ?? '',
    name: values.card ?? ''
  });
  if ('error' in result) return undefined;
  text = result.code;
  const line = splitLines(text).lines.findIndex((row) => row.trim().startsWith(`${id}[`));
  if (line === -1) return undefined;
  if (values.assignee?.trim()) text = setCardMeta(text, line, 'assigned', values.assignee);
  const priority = choiceValue(kanbanTable(splitLines(text).lines).columns[3], values.priority);
  if (priority) text = setCardMeta(text, line, 'priority', priority);
  return text;
};

// ---- Timeline ----

const periodLine = /^(\s*)([^:\s][^:]*?)\s*(?::\s*(.*?))?\s*$/;
const timelineText = (text: string) => oneLine(text).replaceAll(':', '：');
const eventList = (text: string) =>
  text
    .split(/[/／]/)
    .map((event) => timelineText(event))
    .filter(Boolean);

const timelineTable = (lines: string[]): Omit<TableModel, 'kind'> => {
  const header = headerIndex(lines);
  const rows: TableRow[] = [];
  lines.forEach((line, index) => {
    if (
      index <= header ||
      !isContent(line) ||
      /^\s*(?:title|section|accTitle|accDescr)\b/.test(line)
    )
      return;
    const match = periodLine.exec(line);
    if (!match) return;
    const events = match[3] ? match[3].split(/\s*:\s*/) : [];
    let end = index + 1;
    while (end < lines.length && /^\s*:/.test(lines[end])) {
      events.push(...lines[end].replace(/^\s*:\s*/, '').split(/\s*:\s*/));
      end++;
    }
    rows.push({
      cells: { events: events.filter(Boolean).join(' / '), period: match[2] },
      end,
      line: index
    });
  });
  return {
    columns: [
      { key: 'period', kind: 'text', label: 'add.timeline.period' },
      { key: 'events', kind: 'text', label: 'table.col.events' }
    ],
    rows
  };
};

const periodText = (indent: string, period: string, events: string[]) =>
  `${indent}${[period, ...events].join(' : ')}`;

const timelineCell = (code: string, row: TableRow, key: string, value: string) => {
  if (key === 'period') return renameObject(code, 'timeline', lineObject(row.line), value);
  if (key !== 'events') return undefined;
  const { eol, lines } = splitLines(code);
  const indent = /^\s*/.exec(lines[row.line])?.[0] ?? '';
  lines.splice(
    row.line,
    row.end - row.line,
    periodText(indent, row.cells.period, eventList(value))
  );
  return lines.join(eol);
};

const addTimeline = (code: string, values: Values): string => {
  const { lines } = splitLines(code);
  const last = timelineTable(lines).rows.at(-1);
  const indent = last ? (/^\s*/.exec(lines[last.line])?.[0] ?? '') : '    ';
  const period = timelineText(values.period ?? '') || 'Period';
  return insertLines(code, [periodText(indent, period, eventList(values.events ?? ''))]);
};

// ---- Pie ----

const pieTable = (lines: string[]): Omit<TableModel, 'kind'> => {
  const header = headerIndex(lines);
  return {
    columns: [
      { key: 'label', kind: 'text', label: 'table.col.label' },
      { key: 'value', kind: 'number', label: 'add.pie.value' }
    ],
    rows: lines.flatMap((line, index) => {
      const match = index > header ? pieSlice.exec(line) : null;
      return match
        ? [{ cells: { label: match[2], value: match[3] }, end: index + 1, line: index }]
        : [];
    })
  };
};

const pieCell = (code: string, row: TableRow, key: string, value: string) => {
  const object = lineObject(row.line, row.cells.label);
  if (key === 'label') return renameObject(code, 'pie', object, value);
  if (key === 'value') return setObjectFields(code, 'pie', object, { value: number(value) });
  return undefined;
};

const number = (text: string) => text.replaceAll(/[,，\s]/g, '');

const addPie = (code: string, values: Values): string | undefined => {
  const action = specFor(code)?.actions.find(({ id }) => id === 'slice');
  const result = action?.apply(code, {
    name: values.label ?? '',
    value: number(values.value ?? '') || '10'
  });
  return !result || 'error' in result ? undefined : result.code;
};

// ---- ER attributes ----

const entityLine = /^\s*([\p{L}\p{N}_-]+)(?:\s*\[[^\]]*\])?\s*\{\s*$/u;

const erTable = (lines: string[], entity: string): Omit<TableModel, 'kind'> => {
  const code = lines.join('\n');
  const rows = entityAttributes(code, entity).map(({ fields, line }): TableRow => ({
    cells: Object.fromEntries(fields.map(({ key, value }) => [key, value])),
    end: line + 1,
    line
  }));
  const custom = [...new Set(rows.map(({ cells }) => cells.key))].filter(
    (key) => !(attributeKeys as readonly string[]).includes(key)
  );
  return {
    columns: [
      { key: 'type', kind: 'text', label: 'add.er.type' },
      { key: 'name', kind: 'text', label: 'add.f.name' },
      {
        key: 'key',
        kind: 'choice',
        label: 'add.er.key',
        options: [
          ...attributeKeys.map((key) => keyed(`add.er.key.${key}`, key)),
          ...custom.map((key) => ({ text: key, value: key }))
        ]
      },
      { key: 'comment', kind: 'text', label: 'add.er.comment' }
    ],
    entity,
    rows
  };
};

const firstEntity = (lines: string[]) => {
  const header = headerIndex(lines);
  return lines.map((line) => entityLine.exec(line)?.[1]).find((id, index) => id && index > header);
};

const erKey = (text: string) => {
  const keys: string[] = text.toUpperCase().match(/PK|FK|UK/g) ?? [];
  if (keys.includes('PK') && keys.includes('FK')) return 'PKFK';
  return keys[0] ?? text;
};

const addEr = (code: string, values: Values, entity: string): string =>
  addEntityAttribute(
    code,
    entity,
    {
      comment: values.comment ?? '',
      key: erKey(values.key ?? '') || 'none',
      name: values.name ?? '',
      type: values.type?.trim() || 'string'
    },
    insertLines
  );

// ---- Shared ----

// Statements that style what is drawn; new content goes before a trailing run of them.
const trailing = /^\s*(?:style|linkStyle|classDef|class|click)\b/;
const insertLines = (code: string, added: string[]) => {
  const { eol, lines } = splitLines(code);
  let at = lines.length;
  while (at > 1 && (!lines[at - 1].trim() || trailing.test(lines[at - 1]))) at--;
  lines.splice(at, 0, ...added);
  return lines.join(eol);
};

/** The table of the code's rows and columns; for ER, the attributes of `entity` (default: the first). */
export const readTable = (code: string, entity?: string): TableModel | undefined => {
  const kind = tableKind(code);
  if (!kind) return undefined;
  if (isChartTable(kind)) {
    const table = readChartTable(code, kind);
    return table ? { kind, ...table } : undefined;
  }
  const { lines } = splitLines(code);
  const tables: Record<
    Exclude<TableKind, ChartTableKind>,
    () => Omit<TableModel, 'kind'> | undefined
  > = {
    er: () => {
      const chosen = entity ?? firstEntity(lines);
      return chosen ? erTable(lines, chosen) : undefined;
    },
    gantt: () => ganttTable(code, lines),
    kanban: () => kanbanTable(lines),
    pie: () => pieTable(lines),
    timeline: () => timelineTable(lines)
  };
  const table = tables[kind]();
  return table ? { kind, ...table } : undefined;
};

type Db = Record<string, unknown>;
const call = (db: Db, name: string): unknown =>
  typeof db[name] === 'function' ? (db[name] as () => unknown).call(db) : undefined;

/** mermaid's parse of the code: its database, or undefined when it does not parse. */
const parsedDb = memoByCode(async (code: string): Promise<Db | undefined> => {
  try {
    await mermaid.parse(code);
    return (await diagramFromText(code)).db as Db;
  } catch {
    return undefined;
  }
});

/**
 * The table as the card shows it: undefined unless mermaid parses the code; the
 * ER entities and the kanban assignees and priorities as mermaid read them.
 */
export const tableModel = async (
  code: string,
  entity?: string
): Promise<TableModel | undefined> => {
  const kind = tableKind(code);
  if (!kind) return undefined;
  const db = await parsedDb(code);
  if (!db) return undefined;
  if (kind === 'er') {
    const found = call(db, 'getEntities');
    const entities = (found instanceof Map ? [...found.entries()] : []).map(
      ([id, value]: [string, Record<string, unknown>]) => ({
        id,
        label: decodeEntities(String(value.alias || value.label || id))
      })
    );
    const chosen = entities.some(({ id }) => id === entity) ? entity : entities[0]?.id;
    if (!chosen) return { columns: [], entities, kind, rows: [] };
    const model = readTable(code, chosen);
    return model && { ...model, entities };
  }
  const model = readTable(code);
  if (model && kind === 'kanban') {
    const data = call(db, 'getData') as { nodes?: Record<string, unknown>[] } | undefined;
    const cards = (data?.nodes ?? []).filter((node) => node.isGroup === false);
    if (cards.length === model.rows.length)
      model.rows.forEach((row, index) => {
        const { assigned, priority } = cards[index];
        row.cells.assignee = typeof assigned === 'string' ? decodeEntities(assigned) : '';
        row.cells.priority = typeof priority === 'string' ? priority : '';
      });
  }
  return model;
};

/** The code with one cell changed; undefined when that is not possible. */
export const setCell = (
  code: string,
  row: number,
  key: string,
  value: string,
  entity?: string
): string | undefined => {
  const model = readTable(code, entity);
  const target = model?.rows[row];
  if (!model || !target || target.cells[key] === value) return undefined;
  if (isChartTable(model.kind)) return setChartCell(code, model.kind, target, key, value);
  switch (model.kind) {
    case 'gantt':
      return ganttCell(code, target, key, value);
    case 'kanban':
      return kanbanCell(code, target, key, value);
    case 'timeline':
      return timelineCell(code, target, key, value);
    case 'pie':
      return pieCell(code, target, key, value);
    case 'er':
      return setEntityAttribute(code, model.entity ?? '', target.line, { [key]: value });
  }
};

/** The code with a row added last (gantt: in the last or the named section; kanban: in the first or the named column). */
export const addRow = (code: string, values: Values, entity?: string): string | undefined => {
  const kind = tableKind(code);
  if (kind && isChartTable(kind)) return addChartRow(code, kind, values);
  switch (kind) {
    case 'gantt':
      return addGantt(code, values);
    case 'kanban':
      return addKanban(code, values);
    case 'timeline':
      return addTimeline(code, values);
    case 'pie':
      return addPie(code, values);
    case 'er': {
      const chosen = entity ?? firstEntity(splitLines(code).lines);
      return chosen ? addEr(code, values, chosen) : undefined;
    }
    default:
      return undefined;
  }
};

/** The code without one row. */
export const deleteRow = (code: string, row: number, entity?: string): string | undefined => {
  const model = readTable(code, entity);
  const target = model?.rows[row];
  if (!model || !target) return undefined;
  if (model.kind === 'er') return deleteEntityAttribute(code, model.entity ?? '', target.line);
  return deleteObject(code, model.kind as EditKind, lineObject(target.line));
};

/** The code with a row swapped with the one above (`-1`) or below (`1`). */
export const moveRow = (
  code: string,
  row: number,
  by: -1 | 1,
  entity?: string
): string | undefined => {
  const model = readTable(code, entity);
  const first = model?.rows[by === -1 ? row - 1 : row];
  const second = model?.rows[by === -1 ? row : row + 1];
  if (!model || !first || !second) return undefined;
  const { eol, lines } = splitLines(code);
  const start = firstStart(lines);
  const a = lines.slice(first.line, first.end);
  const b = lines.slice(second.line, second.end);
  const aIndent = indentOf(lines[first.line]);
  const bIndent = indentOf(lines[second.line]);
  lines.splice(
    first.line,
    second.end - first.line,
    ...reindent(b, bIndent, aIndent),
    ...lines.slice(first.end, second.line),
    ...reindent(a, aIndent, bIndent)
  );
  if (model.kind === 'gantt') keepFirstStart(lines, start);
  if (isChartTable(model.kind)) return afterChartMove(model.kind, lines).join(eol);
  return lines.join(eol);
};

/** Tab-separated rows as Excel copies them: quoted cells may hold tabs, newlines and `""`. */
export const parseTsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let index = 0;
  const endRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
    cell = '';
  };
  while (index < text.length) {
    const char = text[index];
    if (char === '"' && cell === '') {
      // A quoted cell: up to the closing quote, `""` standing for one quote.
      index++;
      while (index < text.length) {
        if (text[index] === '"' && text[index + 1] === '"') {
          cell += '"';
          index += 2;
        } else if (text[index] === '"') {
          index++;
          break;
        } else cell += text[index++];
      }
      continue;
    }
    if (char === '\t') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      endRow();
    } else cell += char;
    index++;
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
};

const labelsOf = (key: MessageKey) =>
  Object.values(messages).map((catalogue) => (catalogue as Record<string, string>)[key]);

/** The option a pasted value names: its value, its text, or its label in either language. */
const choiceValue = (column: TableColumn | undefined, text: string | undefined) => {
  const wanted = (text ?? '').trim();
  if (!column?.options || !wanted) return wanted;
  const lower = wanted.toLowerCase();
  return (
    column.options.find(
      ({ key, text: shown, value }) =>
        value.toLowerCase() === lower ||
        shown === wanted ||
        (key && labelsOf(key).some((label) => label === wanted))
    )?.value ?? wanted
  );
};

/** The code with pasted tab-separated rows appended, cells in column order; a header row is skipped. */
export const pasteRows = (code: string, text: string, entity?: string): string | undefined => {
  const model = readTable(code, entity);
  let rows = parseTsv(text);
  if (!model || rows.length === 0) return undefined;
  const { columns } = model;
  const labels = new Set(columns.flatMap(({ label }) => labelsOf(label)));
  const header = rows[0].filter((cell) => cell.trim());
  if (
    header.length > 0 &&
    header.filter((cell) => labels.has(cell.trim())).length * 2 >= header.length
  )
    rows = rows.slice(1);
  if (rows.length === 0) return undefined;
  let next = code;
  for (const row of rows) {
    const values: Values = {};
    columns.forEach((column, index) => {
      const cell = (row[index] ?? '').trim();
      // Sections, columns and tasks are named by their text; the add functions find them.
      values[column.key] =
        column.kind === 'choice' && !['section', 'column', 'after'].includes(column.key)
          ? choiceValue(column, cell)
          : cell;
    });
    const added = addRow(next, values, model.entity);
    if (added === undefined) return undefined;
    next = added;
  }
  return next;
};
