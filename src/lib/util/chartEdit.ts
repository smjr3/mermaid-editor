/**
 * Local: the Add card, the Edit card and the table editor for the diagram
 * types that are lists of statements rather than nodes and arrows — user
 * journey, XY chart, quadrant chart, sankey, git graph, packet and ZenUML —
 * so they too can be made from zero without writing mermaid.
 *
 * Every type is read from its lines and written back as plain mermaid; the
 * cards apply a result only if mermaid still parses it (`checkAdd`,
 * `checkEdit`). Objects of these types are named by their line (`L<n>`),
 * except sankey nodes (`N:<name>`), git branches (`B:<name>`) and ZenUML
 * participants (their name), which are written in several places.
 *
 * mermaid limits found while building this: sankey reads ASCII only (its
 * lexer has no other characters, quoted or not), so its names are checked and
 * refused with a message; a git branch with Japanese in its name must be
 * quoted; packet fields must follow one another without a gap, so every
 * change renumbers the fields after it.
 */
import { t } from '$/i18n';
import type { MessageKey } from '$/i18n/messages';
import type { Action, AddSpec, Values } from './addActions';
import { headerIndex, indentOf, isContent, oneLine } from './codeText';
import type { DetailField, DetailValues } from './diagramDetails';
import { splitLines } from './diagramEdit';
import type { EditObject } from './diagramModify';
import type { DiagramObject } from './mermaid';

export type ChartKind = 'journey' | 'xychart' | 'quadrant' | 'sankey' | 'git' | 'packet' | 'zenuml';

export const chartHeaders: [ChartKind, RegExp][] = [
  ['journey', /^\s*journey\b/],
  ['xychart', /^\s*xychart(?:-beta)?\b/],
  ['quadrant', /^\s*quadrantChart\b/],
  ['sankey', /^\s*sankey(?:-beta)?\b/],
  ['git', /^\s*gitGraph\b/],
  ['packet', /^\s*packet(?:-beta)?\b/],
  ['zenuml', /^\s*zenuml\b/]
];

/** The chart kind of the code, from its header line. */
export const chartKind = (code: string): ChartKind | undefined => {
  const { lines } = splitLines(code);
  const header = lines[headerIndex(lines)] ?? '';
  return chartHeaders.find(([, pattern]) => pattern.test(header))?.[0];
};

// ---- Shared helpers ----

type Lines = string[];

/** The table columns and rows of a kind (tableEdit.ts turns them into its model). */
export interface ChartTableColumn {
  key: string;
  label: MessageKey;
  kind: 'text' | 'number' | 'date' | 'choice';
  options?: { value: string; key?: MessageKey; text?: string }[];
}
export interface ChartTableRow {
  line: number;
  end: number;
  cells: Record<string, string>;
}
export interface ChartTable {
  columns: ChartTableColumn[];
  rows: ChartTableRow[];
}

interface ChartDef {
  add: AddSpec;
  objects: (lines: Lines) => EditObject[];
  rename: (lines: Lines, object: EditObject, text: string) => Lines | undefined;
  remove: (lines: Lines, object: EditObject, keep: boolean) => Lines | undefined;
  fields?: (lines: Lines, object: EditObject) => DetailField[] | undefined;
  setFields?: (lines: Lines, object: EditObject, values: DetailValues) => Lines | undefined;
  table?: {
    read: (lines: Lines) => ChartTable;
    set: (lines: Lines, row: ChartTableRow, key: string, value: string) => Lines | undefined;
    add: (lines: Lines, values: Values) => Lines | undefined;
    /** What a new row holds when "Add a row" is pressed. */
    newRow: () => Values;
  };
  /** Puts the lines right after rows were swapped (packet: renumbers). */
  afterMove?: (lines: Lines) => Lines;
}

const escape = (text: string) => text.replaceAll(/[$()*+.?[\\\]^{|}-]/g, String.raw`\$&`);

/** The lines past the header, with their indexes. */
const bodyLines = (lines: Lines) => {
  const header = headerIndex(lines);
  return lines
    .map((line, index) => ({ index, line }))
    .filter(({ index, line }) => index > header && isContent(line));
};

/** Where a new line goes at the end: after the last content line. */
const endIndex = (lines: Lines) => {
  const header = headerIndex(lines);
  let at = lines.length;
  while (at > header + 1 && !isContent(lines[at - 1])) at--;
  return at;
};

const insertLines = (lines: Lines, added: string[], at = endIndex(lines)) => {
  const next = [...lines];
  next.splice(at, 0, ...added);
  return next;
};

const lineObject = (line: number, label: string, extra: Partial<EditObject> = {}): EditObject => ({
  id: `L${line}`,
  label,
  line,
  ...extra
});

const item = (id: string, label: string): DiagramObject => ({ id, label });

/** A number typed in any width (IME digits too); NaN when it is not one. */
export const toNumber = (text: string | undefined): number => {
  const plain = (text ?? '')
    .replaceAll(/[０-９．－]/g, (char) => String.fromCodePoint((char.codePointAt(0) ?? 0) - 0xfee0))
    .replaceAll(/[,，\s]/g, '');
  return plain === '' ? Number.NaN : Number(plain);
};

/** A list typed with commas (any width) or 、. */
const splitList = (text: string | undefined) =>
  (text ?? '')
    .split(/[,，、]/)
    .map((part) => part.trim())
    .filter(Boolean);

/** Splits `a, "b, c", d` on the commas outside quotes, quotes dropped. */
const splitQuoted = (text: string) => {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim() || parts.length > 0) parts.push(current.trim());
  return parts.filter((part) => part !== '');
};

const lineAt = (lines: Lines, object: EditObject) =>
  object.line === undefined ? undefined : lines[object.line];

const removeLine = (lines: Lines, index: number | undefined) => {
  if (index === undefined || lines[index] === undefined) return undefined;
  const next = [...lines];
  next.splice(index, 1);
  return next;
};

const fail = (error: MessageKey) => ({ error });

/** An Add action whose `apply` works on lines. */
const action = (
  spec: Omit<Action, 'apply'> & {
    run: (
      lines: Lines,
      values: Values
    ) => { lines: Lines; name: string; follow?: Values; done?: MessageKey } | { error: MessageKey };
  }
): Action => {
  const { run, ...rest } = spec;
  return {
    ...rest,
    apply: (code, values) => {
      const { eol, lines } = splitLines(code);
      const result = run(lines, values);
      if ('error' in result) return result;
      const { lines: next, ...more } = result;
      return { code: next.join(eol), ...more };
    }
  };
};

const scoreOptions = ['5', '4', '3', '2', '1'] as const;

// ---- User journey ----

const journeySection = /^(\s*)section\s+(.+?)\s*$/;
const journeyTask = /^(\s*)([^:]+?)\s*:\s*(\d+)\s*(?::\s*(.*?))?\s*$/;
const journeyText = (text: string | undefined) =>
  oneLine(text ?? '')
    .replaceAll(':', '：')
    .replaceAll('#', '＃');
const journeyActors = (text: string | undefined) =>
  splitList(text)
    .map((actor) => journeyText(actor))
    .filter(Boolean)
    .join(', ');

interface JourneyTask {
  index: number;
  indent: string;
  name: string;
  score: string;
  actors: string;
  section: number | undefined;
}

const journeyParts = (lines: Lines) => {
  const sections: { index: number; name: string }[] = [];
  const tasks: JourneyTask[] = [];
  for (const { index, line } of bodyLines(lines)) {
    const section = journeySection.exec(line);
    if (section) {
      sections.push({ index, name: section[2] });
      continue;
    }
    if (/^\s*(?:title|accTitle|accDescr)\b/.test(line)) continue;
    const task = journeyTask.exec(line);
    if (task)
      tasks.push({
        actors: task[4] ?? '',
        indent: task[1],
        index,
        name: task[2],
        score: task[3],
        section: sections.at(-1)?.index
      });
  }
  return { sections, tasks };
};

const renderJourneyTask = (indent: string, name: string, score: string, actors: string) =>
  `${indent}${name}: ${score}${actors ? `: ${actors}` : ''}`;

/** The line after the last line of the section starting at `index`. */
const sectionEnd = (lines: Lines, index: number) => {
  let end = index + 1;
  for (let at = index + 1; at < lines.length; at++) {
    if (journeySection.test(lines[at])) break;
    if (isContent(lines[at])) end = at + 1;
  }
  return end;
};

const addJourneyTask = (lines: Lines, values: Values) => {
  const name = journeyText(values.name);
  if (!name) return fail('add.journey.needTask');
  const score = scoreOptions.includes(values.score as (typeof scoreOptions)[number])
    ? values.score
    : '3';
  const { sections, tasks } = journeyParts(lines);
  const section = sections.find(({ index }) => `L${index}` === values.section);
  const target = section ?? sections.at(-1);
  const indent = target
    ? ' '.repeat(indentOf(lines[target.index]) + 2)
    : (tasks.at(-1)?.indent ?? '  ');
  const line = renderJourneyTask(indent, name, score, journeyActors(values.actors));
  const at = target ? sectionEnd(lines, target.index) : endIndex(lines);
  return { lines: insertLines(lines, [line], at), name };
};

const addJourneySection = (lines: Lines, values: Values) => {
  const name = journeyText(values.name);
  if (!name) return fail('add.journey.needSection');
  const at = endIndex(lines);
  return {
    follow: { section: `L${at}` },
    lines: insertLines(lines, [`  section ${name}`], at),
    name
  };
};

const journey: ChartDef = {
  add: {
    actions: [
      action({
        button: 'add.journey.taskButton',
        fields: [
          { key: 'name', kind: 'text', label: 'add.journey.task' },
          {
            key: 'section',
            kind: 'item',
            label: 'add.journey.section',
            optional: true,
            source: 'sections'
          },
          {
            initial: '3',
            key: 'score',
            kind: 'choice',
            label: 'add.journey.score',
            options: scoreOptions
          },
          { key: 'actors', kind: 'text', label: 'add.journey.actors', optional: true }
        ],
        id: 'task',
        run: addJourneyTask,
        title: 'add.journey.taskTitle'
      }),
      action({
        button: 'add.journey.sectionButton',
        fields: [{ key: 'name', kind: 'text', label: 'add.f.name' }],
        id: 'section',
        run: addJourneySection,
        title: 'add.journey.sectionTitle'
      })
    ],
    header: /^\s*journey\b/,
    kind: 'journey',
    parts: (code) => {
      const { sections, tasks } = journeyParts(splitLines(code).lines);
      return Promise.resolve({
        sections: sections.map(({ index, name }) => item(`L${index}`, name)),
        tasks: tasks.map(({ index, name }) => item(`L${index}`, name))
      });
    }
  },
  afterMove: (lines) => lines,
  fields: (lines, object) => {
    const task = journeyTask.exec(lineAt(lines, object) ?? '');
    if (!task || journeySection.test(lineAt(lines, object) ?? '')) return undefined;
    return [
      {
        key: 'score',
        kind: 'choice',
        label: 'add.journey.score',
        options: scoreOptions.includes(task[3] as (typeof scoreOptions)[number])
          ? scoreOptions
          : [...scoreOptions, task[3]],
        value: task[3]
      },
      { key: 'actors', kind: 'text', label: 'add.journey.actors', value: task[4] ?? '' }
    ];
  },
  objects: (lines) => {
    const { sections, tasks } = journeyParts(lines);
    return [
      ...sections.map(({ index, name }) => ({
        group: true,
        id: `L${index}`,
        label: name,
        line: index,
        members: tasks.filter((task) => task.section === index).map((task) => `L${task.index}`)
      })),
      ...tasks.map(({ index, name }) => lineObject(index, `  ${name}`))
    ].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  },
  remove: (lines, object, keep) => {
    const line = lineAt(lines, object) ?? '';
    if (!journeySection.test(line) || keep) return removeLine(lines, object.line);
    const next = [...lines];
    const start = object.line ?? 0;
    next.splice(start, sectionEnd(lines, start) - start);
    return next;
  },
  rename: (lines, object, text) => {
    const name = journeyText(text);
    const line = lineAt(lines, object);
    if (!name || line === undefined) return undefined;
    const next = [...lines];
    const section = journeySection.exec(line);
    const task = journeyTask.exec(line);
    if (section) next[object.line ?? 0] = `${section[1]}section ${name}`;
    else if (task)
      next[object.line ?? 0] = renderJourneyTask(task[1], name, task[3], task[4] ?? '');
    else return undefined;
    return next;
  },
  setFields: (lines, object, values) => {
    const line = lineAt(lines, object) ?? '';
    const task = journeySection.test(line) ? null : journeyTask.exec(line);
    if (!task) return undefined;
    const score = values.score ?? task[3];
    if (score !== task[3] && !scoreOptions.includes(score as (typeof scoreOptions)[number]))
      return undefined;
    const actors = values.actors === undefined ? (task[4] ?? '') : journeyActors(values.actors);
    const next = [...lines];
    next[object.line ?? 0] = renderJourneyTask(task[1], task[2], score, actors);
    return next;
  },
  table: {
    add: (lines, values) => {
      const { sections } = journeyParts(lines);
      let current = lines;
      let section = sections.find(
        ({ index, name }) => `L${index}` === values.section || name === values.section?.trim()
      );
      if (!section && values.section?.trim()) {
        const added = addJourneySection(current, { name: values.section });
        if ('error' in added) return undefined;
        current = added.lines;
        section = journeyParts(current).sections.at(-1);
      }
      const result = addJourneyTask(current, {
        actors: values.actors ?? '',
        name: values.task ?? '',
        score: values.score || '3',
        section: section ? `L${section.index}` : ''
      });
      return 'error' in result ? undefined : result.lines;
    },
    newRow: () => ({ task: t('table.newTask') }),
    read: (lines) => {
      const { sections, tasks } = journeyParts(lines);
      return {
        columns: [
          {
            key: 'section',
            kind: 'choice',
            label: 'add.journey.section',
            options: [
              { key: 'add.none', value: '' },
              ...sections.map(({ index, name }) => ({ text: name, value: `L${index}` }))
            ]
          },
          { key: 'task', kind: 'text', label: 'add.journey.task' },
          {
            key: 'score',
            kind: 'choice',
            label: 'add.journey.score',
            options: [
              ...scoreOptions.map((value) => ({
                key: `add.journey.score.${value}` as MessageKey,
                value
              })),
              ...[...new Set(tasks.map(({ score }) => score))]
                .filter((score) => !scoreOptions.includes(score as (typeof scoreOptions)[number]))
                .map((score) => ({ text: score, value: score }))
            ]
          },
          { key: 'actors', kind: 'text', label: 'add.journey.actors' }
        ],
        rows: tasks.map((task) => ({
          cells: {
            actors: task.actors,
            score: task.score,
            section: task.section === undefined ? '' : `L${task.section}`,
            task: task.name
          },
          end: task.index + 1,
          line: task.index
        }))
      };
    },
    set: (lines, row, key, value) => {
      const object = lineObject(row.line, row.cells.task);
      if (key === 'task') return journey.rename(lines, object, value);
      if (key === 'score' || key === 'actors')
        return journey.setFields?.(lines, object, { [key]: value });
      if (key !== 'section') return undefined;
      // Move the task to the end of the chosen section (or before the first one).
      const target = journeyParts(lines).sections.find(
        ({ index, name }) => `L${index}` === value || name === value
      );
      if (value && !target) return undefined;
      const next = [...lines];
      const [moved] = next.splice(row.line, 1);
      const text = moved.trim();
      if (target) {
        const at = target.index > row.line ? target.index - 1 : target.index;
        next.splice(sectionEnd(next, at), 0, `${' '.repeat(indentOf(next[at]) + 2)}${text}`);
      } else {
        const first = journeyParts(next).sections[0]?.index ?? endIndex(next);
        next.splice(first, 0, `  ${text}`);
      }
      return next;
    }
  }
};

// ---- XY chart ----

const xyAxis = /^(\s*)([xy])-axis\b\s*(.*?)\s*$/;
const xySeries = /^(\s*)(bar|line)\b\s*(?:"([^"]*)"\s*)?\[(.*)\]\s*$/;

interface Axis {
  title: string;
  categories?: string[];
  min: string;
  max: string;
}

const parseAxis = (rest: string): Axis | undefined => {
  const match = /^(?:"([^"]*)"|([^\s["]+))?\s*(?:\[(.*)\]|(-?[\d.]+)\s*-->\s*(-?[\d.]+))?$/.exec(
    rest
  );
  if (!match) return undefined;
  return {
    categories: match[3] === undefined ? undefined : splitQuoted(match[3]),
    max: match[5] ?? '',
    min: match[4] ?? '',
    title: match[1] ?? match[2] ?? ''
  };
};

const xyText = (text: string | undefined) => oneLine(text ?? '').replaceAll('"', "'");

const renderAxis = (indent: string, which: string, axis: Axis) => {
  const title = axis.title ? ` "${xyText(axis.title)}"` : '';
  const values = axis.categories
    ? ` [${axis.categories.map((category) => `"${xyText(category)}"`).join(', ')}]`
    : axis.min !== '' && axis.max !== ''
      ? ` ${axis.min} --> ${axis.max}`
      : '';
  return `${indent}${which}-axis${title}${values}`;
};

const renderSeries = (indent: string, kind: string, name: string, values: number[]) =>
  `${indent}${kind}${name ? ` "${xyText(name)}"` : ''} [${values.join(', ')}]`;

/** The numbers of a typed list; undefined when one is not a number. */
const numberList = (text: string | undefined) => {
  const parts = splitList(text);
  const values = parts.map((part) => toNumber(part));
  return parts.length > 0 && values.every((value) => Number.isFinite(value)) ? values : undefined;
};

const xyParts = (lines: Lines) => {
  const axes: { index: number; which: string; indent: string; axis: Axis }[] = [];
  const series: { index: number; indent: string; kind: string; name: string; values: string }[] =
    [];
  for (const { index, line } of bodyLines(lines)) {
    const axisMatch = xyAxis.exec(line);
    const axis = axisMatch ? parseAxis(axisMatch[3]) : undefined;
    if (axisMatch && axis) {
      axes.push({ axis, indent: axisMatch[1], index, which: axisMatch[2] });
      continue;
    }
    const match = xySeries.exec(line);
    if (match)
      series.push({
        indent: match[1],
        index,
        kind: match[2],
        name: match[3] ?? '',
        values: splitQuoted(match[4]).join(', ')
      });
  }
  return { axes, series };
};

/** The line after the header and a title statement, where the axes go. */
const afterTitle = (lines: Lines) => {
  const header = headerIndex(lines);
  let at = header + 1;
  while (at < lines.length && (!isContent(lines[at]) || /^\s*title\b/.test(lines[at]))) {
    if (/^\s*title\b/.test(lines[at])) return at + 1;
    at++;
  }
  return header + 1;
};

const setAxisLine = (lines: Lines, which: 'x' | 'y', axis: Axis | undefined) => {
  const next = [...lines];
  const { axes } = xyParts(next);
  const found = axes.find((entry) => entry.which === which);
  const empty = !axis || (!axis.title && !axis.categories && (axis.min === '' || axis.max === ''));
  if (found) {
    if (empty) next.splice(found.index, 1);
    else next[found.index] = renderAxis(found.indent, which, axis);
    return next;
  }
  if (empty) return next;
  const x = axes.find((entry) => entry.which === 'x');
  const at = which === 'y' && x ? x.index + 1 : afterTitle(next);
  next.splice(at, 0, renderAxis('  ', which, axis));
  return next;
};

const yRange = (minText: string | undefined, maxText: string | undefined) => {
  const min = toNumber(minText);
  const max = toNumber(maxText);
  if (Number.isNaN(min) && Number.isNaN(max)) return { max: '', min: '' };
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return undefined;
  return { max: String(max), min: String(min) };
};

const xyKindLabel = (kind: string) => t(kind === 'line' ? 'add.xy.kind.line' : 'add.xy.kind.bar');

const addXySeries = (lines: Lines, values: Values) => {
  const numbers = numberList(values.values);
  if (!numbers) return fail('add.xy.badValues');
  const kind = values.kind === 'line' ? 'line' : 'bar';
  const name = xyText(values.name);
  const indent = xyParts(lines).series.at(-1)?.indent ?? '  ';
  return {
    lines: insertLines(lines, [renderSeries(indent, kind, name, numbers)]),
    name: name || xyKindLabel(kind)
  };
};

const xychart: ChartDef = {
  add: {
    actions: [
      action({
        button: 'add.xy.axesButton',
        fields: [
          { key: 'xTitle', kind: 'text', label: 'add.xy.xTitle', optional: true },
          { key: 'categories', kind: 'text', label: 'add.xy.categories' },
          { key: 'yTitle', kind: 'text', label: 'add.xy.yTitle', optional: true },
          { key: 'yMin', kind: 'number', label: 'add.xy.yMin', optional: true },
          { key: 'yMax', kind: 'number', label: 'add.xy.yMax', optional: true }
        ],
        id: 'axes',
        run: (lines, values) => {
          const categories = splitList(values.categories).map((category) => xyText(category));
          if (categories.length === 0) return fail('add.xy.needCategories');
          const range = yRange(values.yMin, values.yMax);
          if (!range) return fail('add.xy.badRange');
          let next = setAxisLine(lines, 'x', {
            categories,
            max: '',
            min: '',
            title: xyText(values.xTitle)
          });
          const yTitle = xyText(values.yTitle);
          if (yTitle || range.min !== '') {
            const old = xyParts(next).axes.find((entry) => entry.which === 'y')?.axis;
            next = setAxisLine(next, 'y', {
              max: range.max || old?.max || '',
              min: range.min || old?.min || '',
              title: yTitle || old?.title || ''
            });
          }
          return { done: 'add.xy.axesDone', lines: next, name: '' };
        },
        title: 'add.xy.axesTitle'
      }),
      action({
        button: 'add.xy.seriesButton',
        fields: [
          {
            initial: 'bar',
            key: 'kind',
            kind: 'choice',
            label: 'add.xy.kind',
            options: ['bar', 'line']
          },
          { key: 'name', kind: 'text', label: 'add.xy.seriesName', optional: true },
          { key: 'values', kind: 'text', label: 'add.xy.values' }
        ],
        id: 'series',
        run: addXySeries,
        title: 'add.xy.seriesTitle'
      })
    ],
    header: /^\s*xychart(?:-beta)?\b/,
    kind: 'xychart',
    parts: () => Promise.resolve({})
  },
  fields: (lines, object) => {
    const line = lineAt(lines, object) ?? '';
    const axisMatch = xyAxis.exec(line);
    const axis = axisMatch ? parseAxis(axisMatch[3]) : undefined;
    if (axisMatch && axis) {
      if (axis.categories)
        return [
          {
            key: 'categories',
            kind: 'text',
            label: 'add.xy.categories',
            value: axis.categories.join(', ')
          }
        ];
      return [
        { key: 'min', kind: 'number', label: 'add.xy.yMin', value: axis.min },
        { key: 'max', kind: 'number', label: 'add.xy.yMax', value: axis.max }
      ];
    }
    const series = xySeries.exec(line);
    if (!series) return undefined;
    return [
      {
        key: 'kind',
        kind: 'choice',
        label: 'add.xy.kind',
        options: ['bar', 'line'],
        value: series[2]
      },
      {
        key: 'values',
        kind: 'text',
        label: 'add.xy.values',
        value: splitQuoted(series[4]).join(', ')
      }
    ];
  },
  objects: (lines) => {
    const { axes, series } = xyParts(lines);
    return [
      ...axes.map(({ axis, index, which }) =>
        lineObject(
          index,
          `${t(which === 'x' ? 'chart.xy.xAxis' : 'chart.xy.yAxis')}${axis.title ? `: ${axis.title}` : ''}`
        )
      ),
      ...series.map(({ index, kind, name, values }) =>
        lineObject(index, `${xyKindLabel(kind)}: ${name || values}`)
      )
    ].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  },
  remove: (lines, object) => removeLine(lines, object.line),
  rename: (lines, object, text) => {
    const line = lineAt(lines, object) ?? '';
    const next = [...lines];
    const axisMatch = xyAxis.exec(line);
    const axis = axisMatch ? parseAxis(axisMatch[3]) : undefined;
    if (axisMatch && axis) {
      next[object.line ?? 0] = renderAxis(axisMatch[1], axisMatch[2], {
        ...axis,
        title: xyText(text)
      });
      return next;
    }
    const series = xySeries.exec(line);
    if (!series) return undefined;
    const values = numberList(splitQuoted(series[4]).join(','));
    if (!values) return undefined;
    next[object.line ?? 0] = renderSeries(series[1], series[2], xyText(text), values);
    return next;
  },
  setFields: (lines, object, values) => {
    const line = lineAt(lines, object) ?? '';
    const next = [...lines];
    const axisMatch = xyAxis.exec(line);
    const axis = axisMatch ? parseAxis(axisMatch[3]) : undefined;
    if (axisMatch && axis) {
      if (axis.categories) {
        const categories = splitList(values.categories).map((category) => xyText(category));
        if (categories.length === 0) return undefined;
        next[object.line ?? 0] = renderAxis(axisMatch[1], axisMatch[2], { ...axis, categories });
      } else {
        const range = yRange(values.min ?? axis.min, values.max ?? axis.max);
        if (!range) return undefined;
        next[object.line ?? 0] = renderAxis(axisMatch[1], axisMatch[2], { ...axis, ...range });
      }
      return next;
    }
    const series = xySeries.exec(line);
    if (!series) return undefined;
    const numbers = numberList(values.values ?? splitQuoted(series[4]).join(','));
    if (!numbers) return undefined;
    const kind = values.kind === 'line' || values.kind === 'bar' ? values.kind : series[2];
    next[object.line ?? 0] = renderSeries(series[1], kind, series[3] ?? '', numbers);
    return next;
  },
  table: {
    add: (lines, values) => {
      const count =
        xyParts(lines).axes.find((entry) => entry.which === 'x')?.axis.categories?.length ?? 1;
      const result = addXySeries(lines, {
        kind: values.kind === 'line' ? 'line' : 'bar',
        name: values.name ?? '',
        values: values.values?.trim()
          ? values.values
          : Array.from({ length: count }, () => '0').join(',')
      });
      return 'error' in result ? undefined : result.lines;
    },
    newRow: () => ({ kind: 'bar', name: t('table.newSeries') }),
    read: (lines) => ({
      columns: [
        {
          key: 'kind',
          kind: 'choice',
          label: 'add.xy.kind',
          options: [
            { key: 'add.xy.kind.bar', value: 'bar' },
            { key: 'add.xy.kind.line', value: 'line' }
          ]
        },
        { key: 'name', kind: 'text', label: 'add.xy.seriesName' },
        { key: 'values', kind: 'text', label: 'add.xy.values' }
      ],
      rows: xyParts(lines).series.map(({ index, kind, name, values }) => ({
        cells: { kind, name, values },
        end: index + 1,
        line: index
      }))
    }),
    set: (lines, row, key, value) => {
      const object = lineObject(row.line, row.cells.name);
      if (key === 'name') {
        if (!value.trim()) {
          const series = xySeries.exec(lines[row.line] ?? '');
          const values = series ? numberList(splitQuoted(series[4]).join(',')) : undefined;
          if (!series || !values) return undefined;
          const next = [...lines];
          next[row.line] = renderSeries(series[1], series[2], '', values);
          return next;
        }
        return xychart.rename(lines, object, value);
      }
      return xychart.setFields?.(lines, object, { [key]: value });
    }
  }
};

// ---- Quadrant chart ----

const quadAxis = /^(\s*)([xy])-axis\s+(.*?)\s*$/;
const quadLabel = /^(\s*)quadrant-([1-4])\s+(.*?)\s*$/;
const quadPoint =
  /^(\s*)("[^"]*"|[^:"[\]]+?)((?::::[\w-]+)?)\s*:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\](.*)$/;
const quadText = (text: string | undefined) =>
  oneLine(text ?? '')
    .replaceAll('-->', '→')
    .replaceAll('"', "'")
    .trim();
const unquote = (text: string) => text.replace(/^"(.*)"$/, '$1');
/** Quadrant text as written: plain words as they are, anything else in quotes. */
const quadWord = (text: string) => (/^[\p{L}\p{N} _]+$/u.test(text) ? text : `"${text}"`);
// `low --> high`; a plain search rather than a regex, which CodeQL reads as HTML-comment parsing.
const axisEnds = (rest: string) => {
  const arrow = rest.indexOf('-->');
  const low = arrow === -1 ? rest : rest.slice(0, arrow);
  const high = arrow === -1 ? '' : rest.slice(arrow + 3);
  return { high: unquote(high.trim()), low: unquote(low.trim()) };
};
const renderQuadAxis = (indent: string, which: string, low: string, high: string) =>
  `${indent}${which}-axis ${quadWord(low)}${high ? ` --> ${quadWord(high)}` : ''}`;

const quadParts = (lines: Lines) => {
  const axes: { index: number; indent: string; which: string; low: string; high: string }[] = [];
  const labels: { index: number; indent: string; n: string; text: string }[] = [];
  const points: {
    index: number;
    indent: string;
    name: string;
    x: string;
    y: string;
    rest: string;
  }[] = [];
  for (const { index, line } of bodyLines(lines)) {
    const axis = quadAxis.exec(line);
    if (axis) {
      axes.push({ index, indent: axis[1], which: axis[2], ...axisEnds(axis[3]) });
      continue;
    }
    const label = quadLabel.exec(line);
    if (label) {
      labels.push({ index, indent: label[1], n: label[2], text: unquote(label[3]) });
      continue;
    }
    if (/^\s*(?:title|classDef|accTitle|accDescr)\b/.test(line)) continue;
    const point = quadPoint.exec(line);
    if (point)
      points.push({
        indent: point[1],
        index,
        name: unquote(point[2].trim()),
        rest: point[6],
        x: point[4],
        y: point[5]
      });
  }
  return { axes, labels, points };
};

const inUnit = (text: string | undefined) => {
  const value = toNumber(text);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? String(value) : undefined;
};

const addQuadPoint = (lines: Lines, values: Values) => {
  const name = quadText(values.name);
  if (!name) return fail('add.quad.needName');
  const x = inUnit(values.x);
  const y = inUnit(values.y);
  if (x === undefined || y === undefined) return fail('add.quad.badPoint');
  const indent = quadParts(lines).points.at(-1)?.indent ?? '  ';
  return { lines: insertLines(lines, [`${indent}${quadWord(name)}: [${x}, ${y}]`]), name };
};

/** The code with an axis or quadrant line set in place, or added before the points. */
const setQuadLine = (lines: Lines, find: (line: string) => boolean, text: string) => {
  const next = [...lines];
  const at = next.findIndex((line, index) => index > headerIndex(next) && find(line));
  if (at !== -1) {
    next[at] = `${/^\s*/.exec(next[at])?.[0] ?? '  '}${text}`;
    return next;
  }
  const first = quadParts(next).points[0]?.index ?? endIndex(next);
  next.splice(first, 0, `  ${text}`);
  return next;
};

const quadrant: ChartDef = {
  add: {
    actions: [
      action({
        button: 'add.quad.pointButton',
        fields: [
          { key: 'name', kind: 'text', label: 'add.f.name' },
          { initial: '0.5', key: 'x', kind: 'number', label: 'add.quad.x' },
          { initial: '0.5', key: 'y', kind: 'number', label: 'add.quad.y' }
        ],
        id: 'point',
        run: addQuadPoint,
        title: 'add.quad.pointTitle'
      }),
      action({
        button: 'add.quad.axesButton',
        fields: [
          { key: 'xLow', kind: 'text', label: 'add.quad.xLow', optional: true },
          { key: 'xHigh', kind: 'text', label: 'add.quad.xHigh', optional: true },
          { key: 'yLow', kind: 'text', label: 'add.quad.yLow', optional: true },
          { key: 'yHigh', kind: 'text', label: 'add.quad.yHigh', optional: true },
          { key: 'q1', kind: 'text', label: 'add.quad.q1', optional: true },
          { key: 'q2', kind: 'text', label: 'add.quad.q2', optional: true },
          { key: 'q3', kind: 'text', label: 'add.quad.q3', optional: true },
          { key: 'q4', kind: 'text', label: 'add.quad.q4', optional: true }
        ],
        id: 'axes',
        run: (lines, values) => {
          const typed = Object.fromEntries(
            ['xLow', 'xHigh', 'yLow', 'yHigh', 'q1', 'q2', 'q3', 'q4'].map((key) => [
              key,
              quadText(values[key])
            ])
          );
          if (Object.values(typed).every((value) => !value)) return fail('add.quad.needAxes');
          let next = lines;
          for (const which of ['x', 'y'] as const) {
            const low = typed[`${which}Low`];
            const high = typed[`${which}High`];
            if (!low && !high) continue;
            const old = quadParts(next).axes.find((axis) => axis.which === which);
            const ends = { high: high || old?.high || '', low: low || old?.low || '' };
            if (!ends.low) return fail('add.quad.needLow');
            next = setQuadLine(
              next,
              (line) => quadAxis.exec(line)?.[2] === which,
              renderQuadAxis('', which, ends.low, ends.high)
            );
          }
          for (const n of ['1', '2', '3', '4']) {
            const text = typed[`q${n}`];
            if (text)
              next = setQuadLine(
                next,
                (line) => quadLabel.exec(line)?.[2] === n,
                `quadrant-${n} ${quadWord(text)}`
              );
          }
          return { done: 'add.quad.axesDone', lines: next, name: '' };
        },
        title: 'add.quad.axesTitle'
      })
    ],
    header: /^\s*quadrantChart\b/,
    kind: 'quadrant',
    parts: () => Promise.resolve({})
  },
  fields: (lines, object) => {
    const line = lineAt(lines, object) ?? '';
    const axis = quadAxis.exec(line);
    if (axis) {
      const { high, low } = axisEnds(axis[3]);
      return [
        { key: 'low', kind: 'text', label: 'add.quad.low', value: low },
        { key: 'high', kind: 'text', label: 'add.quad.high', value: high }
      ];
    }
    if (quadLabel.test(line)) return undefined;
    const point = quadPoint.exec(line);
    return point
      ? [
          { key: 'x', kind: 'number', label: 'add.quad.x', value: point[4] },
          { key: 'y', kind: 'number', label: 'add.quad.y', value: point[5] }
        ]
      : undefined;
  },
  objects: (lines) => {
    const { axes, labels, points } = quadParts(lines);
    return [
      ...axes.map(({ high, index, low, which }) =>
        lineObject(
          index,
          `${t(which === 'x' ? 'chart.xy.xAxis' : 'chart.xy.yAxis')}: ${low}${high ? ` → ${high}` : ''}`,
          { noRename: true }
        )
      ),
      ...labels.map(({ index, n, text }) =>
        lineObject(index, `${t('chart.quad.quadrant', { n })}: ${text}`)
      ),
      ...points.map(({ index, name }) => lineObject(index, name))
    ].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  },
  remove: (lines, object) => removeLine(lines, object.line),
  rename: (lines, object, text) => {
    const name = quadText(text);
    const line = lineAt(lines, object) ?? '';
    if (!name) return undefined;
    const next = [...lines];
    const label = quadLabel.exec(line);
    const point = quadPoint.exec(line);
    if (label) next[object.line ?? 0] = `${label[1]}quadrant-${label[2]} ${quadWord(name)}`;
    else if (point && !quadAxis.test(line))
      next[object.line ?? 0] =
        `${point[1]}${quadWord(name)}${point[3]}: [${point[4]}, ${point[5]}]${point[6]}`;
    else return undefined;
    return next;
  },
  setFields: (lines, object, values) => {
    const line = lineAt(lines, object) ?? '';
    const next = [...lines];
    const axis = quadAxis.exec(line);
    if (axis) {
      const old = axisEnds(axis[3]);
      const low = values.low === undefined ? old.low : quadText(values.low);
      const high = values.high === undefined ? old.high : quadText(values.high);
      if (!low) return undefined;
      next[object.line ?? 0] = renderQuadAxis(axis[1], axis[2], low, high);
      return next;
    }
    const point = quadPoint.exec(line);
    if (!point || quadLabel.test(line)) return undefined;
    const x = inUnit(values.x ?? point[4]);
    const y = inUnit(values.y ?? point[5]);
    if (x === undefined || y === undefined) return undefined;
    next[object.line ?? 0] = `${point[1]}${point[2].trim()}${point[3]}: [${x}, ${y}]${point[6]}`;
    return next;
  },
  table: {
    add: (lines, values) => {
      const result = addQuadPoint(lines, {
        name: values.name ?? '',
        x: values.x?.trim() ? values.x : '0.5',
        y: values.y?.trim() ? values.y : '0.5'
      });
      return 'error' in result ? undefined : result.lines;
    },
    newRow: () => ({ name: t('table.newPoint') }),
    read: (lines) => ({
      columns: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        { key: 'x', kind: 'number', label: 'add.quad.x' },
        { key: 'y', kind: 'number', label: 'add.quad.y' }
      ],
      rows: quadParts(lines).points.map(({ index, name, x, y }) => ({
        cells: { name, x, y },
        end: index + 1,
        line: index
      }))
    }),
    set: (lines, row, key, value) => {
      const object = lineObject(row.line, row.cells.name);
      return key === 'name'
        ? quadrant.rename(lines, object, value)
        : quadrant.setFields?.(lines, object, { [key]: value });
    }
  }
};

// ---- Sankey ----

const sankeyField = String.raw`("(?:[^"]|"")*"|[^,"]*)`;
const sankeyLine = new RegExp(String.raw`^(\s*)${sankeyField},${sankeyField},\s*(-?[\d.]+)\s*$`);
const sankeyName = (field: string) =>
  field.trim().startsWith('"') ? field.trim().slice(1, -1).replaceAll('""', '"') : field.trim();
/** A sankey name as written: ASCII only (mermaid's limit), quoted when it holds a comma. */
const sankeyText = (text: string | undefined) => oneLine(text ?? '').replaceAll('"', "'");
export const sankeyAscii = (text: string) => /^[\x20-\x7e]+$/.test(text);
const renderSankeyName = (name: string) => (name.includes(',') ? `"${name}"` : name);
const renderFlow = (indent: string, from: string, to: string, value: string) =>
  `${indent}${renderSankeyName(from)},${renderSankeyName(to)},${value}`;

const sankeyFlows = (lines: Lines) =>
  bodyLines(lines).flatMap(({ index, line }) => {
    const match = sankeyLine.exec(line);
    return match
      ? [
          {
            from: sankeyName(match[2]),
            indent: match[1],
            index,
            to: sankeyName(match[3]),
            value: match[4]
          }
        ]
      : [];
  });

const sankeyNodes = (lines: Lines) => [
  ...new Set(sankeyFlows(lines).flatMap(({ from, to }) => [from, to]))
];

const positive = (text: string | undefined) => {
  const value = toNumber(text);
  return Number.isFinite(value) && value > 0 ? String(value) : undefined;
};

const addFlow = (lines: Lines, values: Values) => {
  const from = sankeyText(values.from);
  const to = sankeyText(values.to);
  if (!from || !to) return fail('add.sankey.needNames');
  if (!sankeyAscii(from) || !sankeyAscii(to)) return fail('add.sankey.ascii');
  if (from === to) return fail('add.sankey.same');
  const value = positive(values.value);
  if (!value) return fail('add.sankey.badValue');
  const indent = sankeyFlows(lines).at(-1)?.indent ?? '';
  return {
    lines: insertLines(lines, [renderFlow(indent, from, to, value)]),
    name: `${from} → ${to}`
  };
};

const flowObject = (lines: Lines, object: EditObject) =>
  sankeyFlows(lines).find(({ index }) => index === object.line);

const sankey: ChartDef = {
  add: {
    actions: [
      action({
        button: 'add.sankey.flowButton',
        fields: [
          { key: 'from', kind: 'text', label: 'add.f.from' },
          { key: 'to', kind: 'text', label: 'add.f.to' },
          { initial: '10', key: 'value', kind: 'number', label: 'add.sankey.value' }
        ],
        id: 'flow',
        run: addFlow,
        title: 'add.sankey.flowTitle'
      })
    ],
    header: /^\s*sankey(?:-beta)?\b/,
    kind: 'sankey',
    parts: (code) =>
      Promise.resolve({
        nodes: sankeyNodes(splitLines(code).lines).map((name) => item(name, name))
      })
  },
  fields: (lines, object) => {
    const flow = flowObject(lines, object);
    return flow
      ? [{ key: 'value', kind: 'number', label: 'add.sankey.value', value: flow.value }]
      : undefined;
  },
  objects: (lines) => {
    // mermaid cannot read a sankey without a flow, so what would take the last one stays.
    const flows = sankeyFlows(lines);
    const last = (gone: number) => (gone >= flows.length ? { noDelete: true } : {});
    return [
      ...sankeyNodes(lines).map((name) => ({
        id: `N:${name}`,
        label: name,
        ...last(flows.filter(({ from, to }) => from === name || to === name).length)
      })),
      ...flows.map(({ from, index, to, value }) =>
        lineObject(index, `${from} → ${to} (${value})`, { noRename: true, ...last(1) })
      )
    ];
  },
  remove: (lines, object) => {
    const flows = sankeyFlows(lines);
    const name = object.id.replace(/^N:/, '');
    const gone = new Set(
      flows
        .filter(({ from, index, to }) =>
          object.line === undefined ? from === name || to === name : index === object.line
        )
        .map(({ index }) => index)
    );
    if (gone.size === 0 || gone.size >= flows.length) return undefined;
    return lines.filter((_, index) => !gone.has(index));
  },
  rename: (lines, object, text) => {
    const name = sankeyText(text);
    if (object.line !== undefined || !name || !sankeyAscii(name)) return undefined;
    const old = object.id.replace(/^N:/, '');
    const next = [...lines];
    for (const flow of sankeyFlows(lines)) {
      if (flow.from !== old && flow.to !== old) continue;
      next[flow.index] = renderFlow(
        flow.indent,
        flow.from === old ? name : flow.from,
        flow.to === old ? name : flow.to,
        flow.value
      );
    }
    return next;
  },
  setFields: (lines, object, values) => {
    const flow = flowObject(lines, object);
    const value = positive(values.value);
    if (!flow || !value) return undefined;
    const next = [...lines];
    next[flow.index] = renderFlow(flow.indent, flow.from, flow.to, value);
    return next;
  },
  table: {
    add: (lines, values) => {
      const result = addFlow(lines, {
        from: values.from ?? '',
        to: values.to ?? '',
        value: values.value?.trim() ? values.value : '10'
      });
      return 'error' in result ? undefined : result.lines;
    },
    newRow: () => ({ from: 'From', to: 'To' }),
    read: (lines) => ({
      columns: [
        { key: 'from', kind: 'text', label: 'add.f.from' },
        { key: 'to', kind: 'text', label: 'add.f.to' },
        { key: 'value', kind: 'number', label: 'add.sankey.value' }
      ],
      rows: sankeyFlows(lines).map(({ from, index, to, value }) => ({
        cells: { from, to, value },
        end: index + 1,
        line: index
      }))
    }),
    set: (lines, row, key, value) => {
      const flow = sankeyFlows(lines).find(({ index }) => index === row.line);
      if (!flow) return undefined;
      if (key === 'value') return sankey.setFields?.(lines, lineObject(row.line, ''), { value });
      const name = sankeyText(value);
      if (!name || !sankeyAscii(name)) return undefined;
      const next = [...lines];
      next[row.line] = renderFlow(
        flow.indent,
        key === 'from' ? name : flow.from,
        key === 'to' ? name : flow.to,
        flow.value
      );
      return next;
    }
  }
};

// ---- Git graph ----

const gitCommit = /^(\s*)commit\b(.*)$/;
const gitBranch = /^(\s*)branch\s+("[^"]*"|[^\s"]+)(.*)$/;
const gitCheckout = /^(\s*)(checkout|switch)\s+("[^"]*"|[^\s"]+)\s*$/;
const gitMerge = /^(\s*)merge\s+("[^"]*"|[^\s"]+)(.*)$/;
const gitCherry = /^(\s*)cherry-pick\b(.*)$/;
const gitAttr = /([A-Za-z]+)\s*:\s*("[^"]*"|\S+)/g;
const gitTypes = ['NORMAL', 'HIGHLIGHT', 'REVERSE'] as const;

const gitAttrs = (text: string): [string, string][] =>
  [...text.matchAll(gitAttr)].map(([, key, value]) => [key, unquote(value)]);
const renderAttrs = (attrs: [string, string][]) =>
  attrs
    .map(([key, value]) =>
      key === 'type' || key === 'order' ? ` ${key}: ${value}` : ` ${key}: "${value}"`
    )
    .join('');
const gitText = (text: string | undefined) => oneLine(text ?? '').replaceAll('"', "'");
const branchName = (word: string) => unquote(word);
const renderBranch = (name: string) => (/^[A-Za-z_][\w./-]*$/.test(name) ? name : `"${name}"`);

interface GitStep {
  index: number;
  kind: 'commit' | 'merge' | 'branch' | 'checkout' | 'cherry';
  /** The branch the line works on (merge: into; branch: the new one; checkout: the target). */
  branch: string;
  /** branch, checkout, merge: the branch named on the line. */
  name: string;
  indent: string;
  attrs: [string, string][];
}

const gitSteps = (lines: Lines) => {
  let current = 'main';
  const steps: GitStep[] = [];
  const branches = ['main'];
  for (const { index, line } of bodyLines(lines)) {
    const commit = gitCommit.exec(line);
    const branch = gitBranch.exec(line);
    const checkout = gitCheckout.exec(line);
    const merge = gitMerge.exec(line);
    const cherry = gitCherry.exec(line);
    if (commit)
      steps.push({
        attrs: gitAttrs(commit[2]),
        branch: current,
        indent: commit[1],
        index,
        kind: 'commit',
        name: ''
      });
    else if (branch) {
      current = branchName(branch[2]);
      if (!branches.includes(current)) branches.push(current);
      steps.push({
        attrs: gitAttrs(branch[3]),
        branch: current,
        indent: branch[1],
        index,
        kind: 'branch',
        name: current
      });
    } else if (checkout) {
      current = branchName(checkout[3]);
      steps.push({
        attrs: [],
        branch: current,
        indent: checkout[1],
        index,
        kind: 'checkout',
        name: current
      });
    } else if (merge)
      steps.push({
        attrs: gitAttrs(merge[3]),
        branch: current,
        indent: merge[1],
        index,
        kind: 'merge',
        name: branchName(merge[2])
      });
    else if (cherry)
      steps.push({
        attrs: gitAttrs(cherry[2]),
        branch: current,
        indent: cherry[1],
        index,
        kind: 'cherry',
        name: ''
      });
  }
  return { branches, current, steps };
};

const attr = (attrs: [string, string][], key: string) =>
  attrs.find(([name]) => name === key)?.[1] ?? '';
const withAttr = (attrs: [string, string][], key: string, value: string): [string, string][] => {
  const rest = attrs.filter(([name]) => name !== key);
  if (!value) return rest;
  const at = attrs.findIndex(([name]) => name === key);
  const next: [string, string][] = [...rest];
  next.splice(at === -1 ? (key === 'id' ? 0 : next.length) : at, 0, [key, value]);
  return next;
};
const commitIds = (steps: GitStep[]) =>
  steps
    .filter(({ kind }) => kind === 'commit' || kind === 'merge')
    .map(({ attrs }) => attr(attrs, 'id'));

const renderStep = (step: GitStep) =>
  step.kind === 'merge'
    ? `${step.indent}merge ${renderBranch(step.name)}${renderAttrs(step.attrs)}`
    : `${step.indent}commit${renderAttrs(step.attrs)}`;

/**
 * The lines without the steps mermaid would refuse once something was deleted: a
 * checkout or merge of a branch that is gone, a merge with nothing new to merge
 * (mermaid: "already merged", "has no commits", "into itself"), a cherry-pick of a
 * commit that is gone or on the current branch, a branch created twice.
 */
const repairGit = (lines: Lines): Lines => {
  let current = lines;
  // Each pass drops one line, so there are never more passes than lines.
  for (let passes = lines.length; passes > 0; passes--) {
    const heads = new Map<string, string | undefined>([['main', undefined]]);
    const owner = new Map<string, string>();
    let on = 'main';
    let auto = 0;
    const commitOn = (id: string) => {
      owner.set(id, on);
      heads.set(on, id);
    };
    const bad = gitSteps(current).steps.find((step) => {
      const id = attr(step.attrs, 'id') || `#auto${auto++}`;
      switch (step.kind) {
        case 'commit':
          commitOn(id);
          return false;
        case 'branch':
          if (heads.has(step.name)) return true;
          heads.set(step.name, heads.get(on));
          on = step.name;
          return false;
        case 'checkout':
          if (!heads.has(step.name)) return true;
          on = step.name;
          return false;
        case 'merge': {
          const mine = heads.get(on);
          const theirs = heads.get(step.name);
          if (
            !heads.has(step.name) ||
            step.name === on ||
            !mine ||
            !theirs ||
            mine === theirs ||
            owner.get(mine) === step.name
          )
            return true;
          commitOn(id);
          return false;
        }
        case 'cherry': {
          const picked = attr(step.attrs, 'id');
          if (!owner.has(picked) || owner.get(picked) === on || !heads.get(on)) return true;
          commitOn(`#pick${auto++}`);
          return false;
        }
      }
    });
    if (!bad) return current;
    current = current.filter((_, index) => index !== bad.index);
  }
  return current;
};

/** The `checkout` line needed before working on `branch`, if it is not current at the end. */
const checkoutFor = (lines: Lines, branch: string | undefined) => {
  if (!branch) return [];
  const { branches, current } = gitSteps(lines);
  return branches.includes(branch) && branch !== current
    ? [`  checkout ${renderBranch(branch)}`]
    : [];
};

const git: ChartDef = {
  add: {
    actions: [
      action({
        button: 'add.git.commitButton',
        fields: [
          { key: 'name', kind: 'text', label: 'add.git.commitName' },
          {
            key: 'branch',
            kind: 'item',
            label: 'add.git.onBranch',
            optional: true,
            source: 'branches'
          },
          { key: 'tag', kind: 'text', label: 'add.git.tag', optional: true },
          {
            initial: 'NORMAL',
            key: 'type',
            kind: 'choice',
            label: 'add.git.type',
            options: gitTypes,
            reset: true
          }
        ],
        id: 'commit',
        run: (lines, values) => {
          const name = gitText(values.name);
          if (!name) return fail('add.git.needCommit');
          if (commitIds(gitSteps(lines).steps).includes(name))
            return fail('add.git.duplicateCommit');
          const type = gitTypes.includes(values.type as (typeof gitTypes)[number])
            ? values.type
            : 'NORMAL';
          const attrs: [string, string][] = [['id', name]];
          if (gitText(values.tag)) attrs.push(['tag', gitText(values.tag)]);
          if (type !== 'NORMAL') attrs.push(['type', type]);
          return {
            lines: insertLines(lines, [
              ...checkoutFor(lines, values.branch),
              `  commit${renderAttrs(attrs)}`
            ]),
            name
          };
        },
        title: 'add.git.commitTitle'
      }),
      action({
        button: 'add.git.branchButton',
        fields: [
          { key: 'name', kind: 'text', label: 'add.git.branchName' },
          {
            key: 'from',
            kind: 'item',
            label: 'add.git.fromBranch',
            optional: true,
            source: 'branches'
          }
        ],
        id: 'branch',
        run: (lines, values) => {
          const name = gitText(values.name).replaceAll(/\s+/g, '-');
          if (!name) return fail('add.git.needBranch');
          if (gitSteps(lines).branches.includes(name)) return fail('add.git.duplicateBranch');
          return {
            follow: { branch: name },
            lines: insertLines(lines, [
              ...checkoutFor(lines, values.from),
              `  branch ${renderBranch(name)}`
            ]),
            name
          };
        },
        title: 'add.git.branchTitle'
      }),
      action({
        button: 'add.git.mergeButton',
        fields: [
          { key: 'from', kind: 'item', label: 'add.git.mergeFrom', source: 'branches' },
          {
            initial: 'main',
            key: 'into',
            kind: 'item',
            label: 'add.git.mergeInto',
            source: 'branches'
          },
          { key: 'tag', kind: 'text', label: 'add.git.tag', optional: true }
        ],
        id: 'merge',
        run: (lines, values) => {
          if (!values.from || !values.into) return fail('add.git.chooseBranches');
          if (values.from === values.into) return fail('add.git.sameBranch');
          const tag = gitText(values.tag);
          return {
            lines: insertLines(lines, [
              ...checkoutFor(lines, values.into),
              `  merge ${renderBranch(values.from)}${tag ? ` tag: "${tag}"` : ''}`
            ]),
            name: `${values.from} → ${values.into}`
          };
        },
        title: 'add.git.mergeTitle'
      }),
      action({
        button: 'add.git.checkoutButton',
        fields: [{ key: 'branch', kind: 'item', label: 'add.git.checkoutTo', source: 'branches' }],
        id: 'checkout',
        run: (lines, values) => {
          if (!values.branch) return fail('add.git.chooseBranch');
          const added = checkoutFor(lines, values.branch);
          if (added.length === 0) return fail('add.git.alreadyThere');
          return {
            done: 'add.git.checkoutDone',
            lines: insertLines(lines, added),
            name: values.branch
          };
        },
        title: 'add.git.checkoutTitle'
      })
    ],
    header: /^\s*gitGraph\b/,
    kind: 'git',
    parts: (code) => {
      const { branches, steps } = gitSteps(splitLines(code).lines);
      return Promise.resolve({
        branches: branches.map((name) => item(name, name)),
        commits: steps
          .filter(({ kind }) => kind === 'commit')
          .map(({ attrs, index }) => item(`L${index}`, attr(attrs, 'id') || `#${index}`))
      });
    }
  },
  fields: (lines, object) => {
    const step = gitSteps(lines).steps.find(({ index }) => index === object.line);
    if (!step || (step.kind !== 'commit' && step.kind !== 'merge')) return undefined;
    return [
      { key: 'tag', kind: 'text', label: 'add.git.tag', value: attr(step.attrs, 'tag') },
      ...(step.kind === 'commit'
        ? [
            {
              key: 'type',
              kind: 'choice' as const,
              label: 'add.git.type' as MessageKey,
              options: gitTypes,
              value: attr(step.attrs, 'type') || 'NORMAL'
            }
          ]
        : [])
    ];
  },
  objects: (lines) => {
    const { branches, steps } = gitSteps(lines);
    return [
      ...branches.map((name) => ({
        id: `B:${name}`,
        label: name,
        ...(name === 'main' ? { noDelete: true, noRename: true } : {})
      })),
      ...steps
        .filter(({ kind }) => kind === 'commit' || kind === 'merge')
        .map((step) =>
          lineObject(
            step.index,
            `  ${attr(step.attrs, 'id') || (step.kind === 'merge' ? t('chart.git.merge', { name: step.name }) : t('chart.git.unnamed'))}`
          )
        )
    ];
  },
  remove: (lines, object) => {
    const { steps } = gitSteps(lines);
    if (object.line !== undefined) {
      const step = steps.find(({ index }) => index === object.line);
      if (!step) return undefined;
      const id = attr(step.attrs, 'id');
      // A cherry-pick of the commit goes with it.
      const gone = new Set([
        step.index,
        ...steps
          .filter(({ attrs, kind }) => id && kind === 'cherry' && attr(attrs, 'id') === id)
          .map(({ index }) => index)
      ]);
      return repairGit(lines.filter((_, index) => !gone.has(index)));
    }
    const name = object.id.replace(/^B:/, '');
    if (name === 'main') return undefined;
    // The branch, its checkouts and merges, and every commit made on it.
    const gone = new Set(
      steps
        .filter(
          (step) =>
            ((step.kind === 'branch' || step.kind === 'checkout' || step.kind === 'merge') &&
              step.name === name) ||
            ((step.kind === 'commit' || step.kind === 'cherry' || step.kind === 'merge') &&
              step.branch === name)
        )
        .map(({ index }) => index)
    );
    return repairGit(lines.filter((_, index) => !gone.has(index)));
  },
  rename: (lines, object, text) => {
    const name = gitText(text);
    if (!name) return undefined;
    const { branches, steps } = gitSteps(lines);
    const next = [...lines];
    if (object.line !== undefined) {
      const step = steps.find(({ index }) => index === object.line);
      if (!step || (step.kind !== 'commit' && step.kind !== 'merge')) return undefined;
      const old = attr(step.attrs, 'id');
      if (name !== old && commitIds(steps).includes(name)) return undefined;
      next[step.index] = renderStep({ ...step, attrs: withAttr(step.attrs, 'id', name) });
      for (const other of steps)
        if (old && other.kind === 'cherry' && attr(other.attrs, 'id') === old)
          next[other.index] =
            `${other.indent}cherry-pick${renderAttrs(withAttr(other.attrs, 'id', name))}`;
      return next;
    }
    const old = object.id.replace(/^B:/, '');
    const renamed = name.replaceAll(/\s+/g, '-');
    if (old === 'main' || (renamed !== old && branches.includes(renamed))) return undefined;
    for (const step of steps) {
      if (step.name !== old) continue;
      if (step.kind === 'branch')
        next[step.index] =
          `${step.indent}branch ${renderBranch(renamed)}${renderAttrs(step.attrs)}`;
      else if (step.kind === 'checkout')
        next[step.index] = `${step.indent}checkout ${renderBranch(renamed)}`;
      else if (step.kind === 'merge') next[step.index] = renderStep({ ...step, name: renamed });
    }
    return next;
  },
  setFields: (lines, object, values) => {
    const step = gitSteps(lines).steps.find(({ index }) => index === object.line);
    if (!step || (step.kind !== 'commit' && step.kind !== 'merge')) return undefined;
    let attrs = step.attrs;
    if (values.tag !== undefined) attrs = withAttr(attrs, 'tag', gitText(values.tag));
    if (values.type !== undefined && step.kind === 'commit') {
      if (!gitTypes.includes(values.type as (typeof gitTypes)[number])) return undefined;
      attrs = withAttr(attrs, 'type', values.type === 'NORMAL' ? '' : values.type);
    }
    const next = [...lines];
    next[step.index] = renderStep({ ...step, attrs });
    return next;
  }
};

// ---- Packet ----

const packetRow = /^(\s*)(?:(\d+)(?:\s*-\s*(\d+))?|\+(\d+))\s*:\s*"([^"]*)"\s*$/;
const packetText = (text: string | undefined) => oneLine(text ?? '').replaceAll('"', "'");

interface PacketField {
  index: number;
  indent: string;
  start: number;
  end: number;
  bits: number;
  plus: boolean;
  name: string;
}

const packetFields = (lines: Lines) => {
  const fields: PacketField[] = [];
  let last = -1;
  for (const { index, line } of bodyLines(lines)) {
    const match = packetRow.exec(line);
    if (!match) continue;
    const plus = match[4] !== undefined;
    const start = plus ? last + 1 : Number(match[2]);
    const end = plus ? last + Number(match[4]) : Number(match[3] ?? match[2]);
    fields.push({
      bits: end - start + 1,
      end,
      indent: match[1],
      index,
      name: match[5],
      plus,
      start
    });
    last = end;
  }
  return fields;
};

const renderPacket = (field: PacketField, start: number) =>
  field.plus
    ? `${field.indent}+${field.bits}: "${field.name}"`
    : `${field.indent}${field.bits === 1 ? start : `${start}-${start + field.bits - 1}`}: "${field.name}"`;

/** The fields renumbered to follow one another from 0, each keeping its width. */
const renumberPacket = (lines: Lines) => {
  const next = [...lines];
  let start = 0;
  for (const field of packetFields(lines)) {
    next[field.index] = renderPacket(field, start);
    start += field.bits;
  }
  return next;
};

const bitsOf = (text: string | undefined) => {
  const bits = toNumber(text);
  return Number.isInteger(bits) && bits >= 1 ? bits : undefined;
};

const addPacketField = (lines: Lines, values: Values) => {
  const name = packetText(values.name);
  if (!name) return fail('add.packet.needName');
  const bits = bitsOf(values.bits);
  if (!bits) return fail('add.packet.badBits');
  const fields = packetFields(lines);
  const start = (fields.at(-1)?.end ?? -1) + 1;
  const indent = fields.at(-1)?.indent ?? '  ';
  const range = bits === 1 ? `${start}` : `${start}-${start + bits - 1}`;
  return { lines: insertLines(lines, [`${indent}${range}: "${name}"`]), name };
};

const packet: ChartDef = {
  add: {
    actions: [
      action({
        button: 'add.packet.fieldButton',
        fields: [
          { key: 'name', kind: 'text', label: 'add.f.name' },
          { initial: '8', key: 'bits', kind: 'number', label: 'add.packet.bits' }
        ],
        id: 'field',
        run: addPacketField,
        title: 'add.packet.fieldTitle'
      })
    ],
    header: /^\s*packet(?:-beta)?\b/,
    kind: 'packet',
    parts: () => Promise.resolve({})
  },
  afterMove: renumberPacket,
  fields: (lines, object) => {
    const field = packetFields(lines).find(({ index }) => index === object.line);
    return field
      ? [{ key: 'bits', kind: 'number', label: 'add.packet.bits', value: String(field.bits) }]
      : undefined;
  },
  objects: (lines) =>
    packetFields(lines).map(({ end, index, name, start }) =>
      lineObject(index, `${name} (${start === end ? start : `${start}-${end}`})`)
    ),
  remove: (lines, object) => {
    const next = removeLine(lines, object.line);
    return next && renumberPacket(next);
  },
  rename: (lines, object, text) => {
    const name = packetText(text);
    const field = packetFields(lines).find(({ index }) => index === object.line);
    if (!name || !field) return undefined;
    const next = [...lines];
    next[field.index] = renderPacket({ ...field, name }, field.start);
    return next;
  },
  setFields: (lines, object, values) => {
    const field = packetFields(lines).find(({ index }) => index === object.line);
    const bits = bitsOf(values.bits);
    if (!field || !bits) return undefined;
    const next = [...lines];
    next[field.index] = renderPacket({ ...field, bits }, field.start);
    return renumberPacket(next);
  },
  table: {
    add: (lines, values) => {
      const result = addPacketField(lines, {
        bits: values.bits?.trim() ? values.bits : '8',
        name: values.name ?? ''
      });
      return 'error' in result ? undefined : result.lines;
    },
    newRow: () => ({ name: t('table.newField') }),
    read: (lines) => ({
      columns: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        { key: 'bits', kind: 'number', label: 'add.packet.bits' }
      ],
      rows: packetFields(lines).map(({ bits, index, name }) => ({
        cells: { bits: String(bits), name },
        end: index + 1,
        line: index
      }))
    }),
    set: (lines, row, key, value) => {
      const object = lineObject(row.line, row.cells.name);
      return key === 'name'
        ? packet.rename(lines, object, value)
        : packet.setFields?.(lines, object, { bits: value });
    }
  }
};

// ---- ZenUML ----

const zenWord = String.raw`[\p{L}_][\p{L}\p{N}_]*`;
const zenDeclaration = new RegExp(String.raw`^(\s*)(?:@(\w+)\s+)?(${zenWord})\s*$`, 'u');
const zenMessage = new RegExp(
  String.raw`^(\s*)(${zenWord})\s*->\s*(${zenWord})\s*:\s*(.*?)\s*$`,
  'u'
);
const zenKinds = ['participant', 'Actor', 'Database'] as const;
/** A ZenUML name: one word (spaces and symbols become `_`). */
const zenName = (text: string | undefined) => {
  const name = oneLine(text ?? '')
    .replaceAll(/[^\p{L}\p{N}_]+/gu, '_')
    .replaceAll(/^_+|_+$/g, '');
  return /^\p{N}/u.test(name) ? `_${name}` : name;
};
const zenText = (text: string | undefined) => oneLine(text ?? '').replaceAll(/[{}]/g, '');

const zenParts = (lines: Lines) => {
  const declared: { index: number; name: string }[] = [];
  const messages: { index: number; indent: string; from: string; to: string; text: string }[] = [];
  for (const { index, line } of bodyLines(lines)) {
    const message = zenMessage.exec(line);
    if (message) {
      messages.push({
        from: message[2],
        indent: message[1],
        index,
        text: message[4],
        to: message[3]
      });
      continue;
    }
    const declaration = zenDeclaration.exec(line);
    if (declaration && declaration[3] !== 'title') declared.push({ index, name: declaration[3] });
  }
  const participants = [
    ...new Set([
      ...declared.map(({ name }) => name),
      ...messages.flatMap(({ from, to }) => [from, to])
    ])
  ];
  return { declared, messages, participants };
};

const zenuml: ChartDef = {
  add: {
    actions: [
      action({
        button: 'add.zen.participantButton',
        fields: [
          { key: 'name', kind: 'text', label: 'add.f.name' },
          {
            initial: 'participant',
            key: 'kind',
            kind: 'choice',
            label: 'add.zen.kind',
            options: zenKinds
          }
        ],
        id: 'participant',
        run: (lines, values) => {
          const name = zenName(values.name);
          if (!name) return fail('add.zen.needName');
          const { declared, participants } = zenParts(lines);
          if (participants.includes(name)) return fail('add.zen.duplicate');
          const kind =
            values.kind === 'Actor' || values.kind === 'Database' ? `@${values.kind} ` : '';
          const at = declared.length > 0 ? (declared.at(-1)?.index ?? 0) + 1 : afterTitle(lines);
          return {
            follow: { to: name },
            lines: insertLines(lines, [`  ${kind}${name}`], at),
            name
          };
        },
        title: 'add.zen.participantTitle'
      }),
      action({
        button: 'add.zen.messageButton',
        fields: [
          { key: 'from', kind: 'item', label: 'add.f.from', source: 'participants' },
          { key: 'to', kind: 'item', label: 'add.f.to', source: 'participants' },
          { key: 'text', kind: 'text', label: 'add.zen.text' }
        ],
        id: 'message',
        run: (lines, values) => {
          if (!values.from || !values.to) return fail('add.choose');
          const text = zenText(values.text);
          if (!text) return fail('add.zen.needText');
          return {
            lines: insertLines(lines, [`  ${values.from}->${values.to}: ${text}`]),
            name: text
          };
        },
        title: 'add.zen.messageTitle'
      })
    ],
    header: /^\s*zenuml\b/,
    kind: 'zenuml',
    parts: (code) =>
      Promise.resolve({
        participants: zenParts(splitLines(code).lines).participants.map((name) => item(name, name))
      })
  },
  objects: (lines) => {
    const { messages, participants } = zenParts(lines);
    return [
      ...participants.map((name) => ({ id: name, label: name })),
      ...messages.map(({ from, index, text, to }) =>
        lineObject(index, `  ${from} → ${to}: ${text}`)
      )
    ];
  },
  remove: (lines, object) => {
    if (object.line !== undefined) return removeLine(lines, object.line);
    const { declared, messages } = zenParts(lines);
    const gone = new Set([
      ...declared.filter(({ name }) => name === object.id).map(({ index }) => index),
      ...messages
        .filter(({ from, to }) => from === object.id || to === object.id)
        .map(({ index }) => index)
    ]);
    return lines.filter((_, index) => !gone.has(index));
  },
  rename: (lines, object, text) => {
    const next = [...lines];
    const { declared, messages, participants } = zenParts(lines);
    if (object.line !== undefined) {
      const message = messages.find(({ index }) => index === object.line);
      const value = zenText(text);
      if (!message || !value) return undefined;
      next[message.index] = `${message.indent}${message.from}->${message.to}: ${value}`;
      return next;
    }
    const name = zenName(text);
    if (!name || (name !== object.id && participants.includes(name))) return undefined;
    const word = new RegExp(
      String.raw`(?<![\p{L}\p{N}_])${escape(object.id)}(?![\p{L}\p{N}_])`,
      'gu'
    );
    for (const { index } of [...declared, ...messages])
      next[index] = next[index].replace(word, name);
    return next;
  }
};

const defs: Record<ChartKind, ChartDef> = {
  git,
  journey,
  packet,
  quadrant,
  sankey,
  xychart,
  zenuml
};

// ---- What the cards call ----

/** The Add specs of these kinds (listed in addActions.ts). */
export const chartAddSpecs: AddSpec[] = Object.values(defs).map(({ add }) => add);

const withCode = (code: string, change: (lines: Lines) => Lines | undefined) => {
  const { eol, lines } = splitLines(code);
  return change(lines)?.join(eol);
};

export const chartObjects = (code: string, kind: ChartKind): EditObject[] =>
  defs[kind].objects(splitLines(code).lines);

export const renameChartObject = (
  code: string,
  kind: ChartKind,
  object: EditObject,
  text: string
) => withCode(code, (lines) => defs[kind].rename(lines, object, text));

export const deleteChartObject = (
  code: string,
  kind: ChartKind,
  object: EditObject,
  keep = false
) => withCode(code, (lines) => defs[kind].remove(lines, object, keep)) ?? code;

export const chartFields = (code: string, kind: ChartKind, object: EditObject) =>
  defs[kind].fields?.(splitLines(code).lines, object);

export const setChartFields = (
  code: string,
  kind: ChartKind,
  object: EditObject,
  values: DetailValues
) => withCode(code, (lines) => defs[kind].setFields?.(lines, object, values));

/** The kinds with a table, and their tables. */
export const chartTableKinds = (Object.keys(defs) as ChartKind[]).filter(
  (kind) => defs[kind].table
);

export const readChartTable = (code: string, kind: ChartKind): ChartTable | undefined =>
  defs[kind].table?.read(splitLines(code).lines);

export const setChartCell = (
  code: string,
  kind: ChartKind,
  row: ChartTableRow,
  key: string,
  value: string
) => withCode(code, (lines) => defs[kind].table?.set(lines, row, key, value));

export const addChartRow = (code: string, kind: ChartKind, values: Values) =>
  withCode(code, (lines) => defs[kind].table?.add(lines, values));

export const newChartRow = (kind: ChartKind): Values => defs[kind].table?.newRow() ?? {};

/** The lines after two rows were swapped, put right (packet fields are renumbered). */
export const afterChartMove = (kind: ChartKind, lines: Lines): Lines =>
  defs[kind].afterMove?.(lines) ?? lines;
