/**
 * Local: what is inside an object, for the Add and Edit cards — the members
 * (attributes and methods) of a class and the attributes of an ER entity —
 * and the properties of an object beyond its text: a gantt task's start,
 * length, status and dependency, a pie slice's value. Each is read from the
 * lines of the code and written back as plain mermaid, so a shared link keeps
 * it; the cards apply a change only if mermaid still parses the result as the
 * same type of diagram (`checkEdit`).
 */
import type { MessageKey } from '$/i18n/messages';
import { ganttSafe, headerIndex, indentOf, oneLine } from './codeText';
import { splitLines } from './diagramEdit';
import type { EditObject } from './diagramModify';
import type { DiagramObject } from './mermaid';

export interface DetailField {
  key: string;
  kind: 'text' | 'number' | 'date' | 'choice' | 'item';
  label: MessageKey;
  /** choice: the values; each is labelled by the message `<label>.<value>`. */
  options?: readonly string[];
  /** item: what can be chosen (an empty value is "none"). */
  choices?: DiagramObject[];
  value: string;
}

export interface Member {
  /** `L<line>`: the member's 0-based line. */
  id: string;
  label: string;
  line: number;
  fields: DetailField[];
}

export type DetailValues = Record<string, string>;

const escape = (id: string) => id.replaceAll(/[$()*+.?[\\\]^{|}-]/g, String.raw`\$&`);
const isBlank = (line: string) => line.trim() === '' || line.trim().startsWith('%%');

/** The index of the `}` closing the block opened on line `start`, or -1. */
export const closingBrace = (lines: string[], start: number): number => {
  let depth = 0;
  for (let index = start; index < lines.length; index++) {
    const line = lines[index].replaceAll(/"[^"]*"/g, '""');
    depth += (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0);
    if (depth <= 0 && index > start) return index;
    if (depth <= 0) return -1;
  }
  return -1;
};

/** Where a new line goes inside the block from `start` to `end`: before `end`, indented like its contents. */
const intoBlock = (lines: string[], start: number, end: number, text: string) => {
  const inner = lines.slice(start + 1, end).find((line) => !isBlank(line));
  const indent = inner === undefined ? indentOf(lines[start]) + 2 : indentOf(inner);
  lines.splice(end, 0, `${' '.repeat(indent)}${text}`);
};

// ---- Class members ----

export type Visibility = 'public' | 'private' | 'protected' | 'package' | 'none';
export const visibilities: Visibility[] = ['public', 'private', 'protected', 'package', 'none'];
const visibilityMark: Record<Visibility, string> = {
  none: '',
  package: '~',
  private: '-',
  protected: '#',
  public: '+'
};

export interface ClassMember {
  kind: 'attribute' | 'method';
  visibility: Visibility;
  name: string;
  /** An attribute's type, or a method's return type. */
  type: string;
  /** A method's parameters. */
  args: string;
  /** `$` (static) or `*` (abstract). */
  classifier: string;
  /** An attribute written `Type name` rather than `name: Type`. */
  typeFirst: boolean;
}

/** A member's text (`+name: String`, `-run(x) bool`) as its parts. */
export const parseMember = (text: string): ClassMember => {
  const trimmed = text.trim();
  const mark = /^[+\-#~]/.exec(trimmed)?.[0] ?? '';
  const visibility =
    (Object.entries(visibilityMark).find(([, value]) => value === mark)?.[0] as Visibility) ??
    'none';
  const rest = trimmed.slice(mark.length).trim();
  const method = /^([^(]*)\((.*)\)\s*([$*])?\s*(.*)$/.exec(rest);
  if (method) {
    return {
      args: method[2].trim(),
      classifier: method[3] ?? '',
      kind: 'method',
      name: method[1].trim(),
      type: method[4].replace(/^:\s*/, '').trim(),
      typeFirst: false,
      visibility
    };
  }
  const classifier = /[$*]$/.exec(rest)?.[0] ?? '';
  const core = rest.slice(0, rest.length - classifier.length).trim();
  const colon = core.indexOf(':');
  if (colon !== -1) {
    return {
      args: '',
      classifier,
      kind: 'attribute',
      name: core.slice(0, colon).trim(),
      type: core.slice(colon + 1).trim(),
      typeFirst: false,
      visibility
    };
  }
  const space = core.lastIndexOf(' ');
  return {
    args: '',
    classifier,
    kind: 'attribute',
    name: space === -1 ? core : core.slice(space + 1),
    type: space === -1 ? '' : core.slice(0, space).trim(),
    typeFirst: space !== -1,
    visibility
  };
};

// A brace ends the class body and a quote is never part of a member; outside a
// body (`A : …`) a colon ends the statement, so there it becomes a space.
const memberPart = (text: string, inBody: boolean) => {
  const cleaned = oneLine(text).replaceAll(/[{}"]/g, '');
  return (inBody ? cleaned : cleaned.replaceAll(':', ' ')).replaceAll(/\s+/g, ' ').trim();
};

/** The member as mermaid text: `+name: Type` in a body, `+Type name` in a statement. */
export const renderMember = (member: ClassMember, inBody: boolean): string => {
  const mark = visibilityMark[member.visibility] ?? '';
  const name = memberPart(member.name, inBody).replaceAll(/[():]/g, '').replaceAll(' ', '_');
  const type = memberPart(member.type, inBody).replaceAll(/[()]/g, '');
  if (member.kind === 'method') {
    const args = memberPart(member.args, inBody).replaceAll(/[()]/g, '');
    return `${mark}${name || 'method'}(${args})${member.classifier}${type ? ` ${type}` : ''}`;
  }
  if (!type) return `${mark}${name || 'name'}${member.classifier}`;
  // Before the name, a type is one word.
  if (member.typeFirst || !inBody)
    return `${mark}${type.replaceAll(' ', '')} ${name || 'name'}${member.classifier}`;
  return `${mark}${name || 'name'}: ${type}${member.classifier}`;
};

const classBody = (id: string) =>
  new RegExp(`^\\s*class\\s+${escape(id)}(?![\\p{L}\\p{N}_-])[^{]*\\{\\s*$`, 'u');
const classStatement = (id: string) => new RegExp(`^(\\s*)${escape(id)}\\s*:\\s*(.*?)\\s*$`);

interface MemberLine {
  line: number;
  text: string;
  inBody: boolean;
  indent: string;
}

/** The lines holding the class's members: in its `class X { … }` bodies and `X : …` statements. */
const classMemberLines = (lines: string[], id: string): MemberLine[] => {
  const found: MemberLine[] = [];
  const header = headerIndex(lines);
  for (let index = header + 1; index < lines.length; index++) {
    if (classBody(id).test(lines[index])) {
      const end = closingBrace(lines, index);
      if (end === -1) continue;
      for (let inner = index + 1; inner < end; inner++) {
        const text = lines[inner].trim();
        if (isBlank(lines[inner]) || text.startsWith('<<')) continue;
        found.push({
          indent: /^\s*/.exec(lines[inner])?.[0] ?? '',
          inBody: true,
          line: inner,
          text
        });
      }
      index = end;
      continue;
    }
    const match = classStatement(id).exec(lines[index]);
    if (match && !match[2].startsWith('<<'))
      found.push({ indent: match[1], inBody: false, line: index, text: match[2] });
  }
  return found;
};

const memberFields = (member: ClassMember): DetailField[] => [
  {
    key: 'visibility',
    kind: 'choice',
    label: 'add.class.visibility',
    options: visibilities,
    value: member.visibility
  },
  { key: 'name', kind: 'text', label: 'add.f.name', value: member.name },
  ...(member.kind === 'method'
    ? [{ key: 'args', kind: 'text', label: 'add.class.args', value: member.args } as DetailField]
    : []),
  {
    key: 'type',
    kind: 'text',
    label: member.kind === 'method' ? 'add.class.returns' : 'add.class.type',
    value: member.type
  }
];

/** The class's members, each with the fields the Edit card shows. */
export const classMembers = (code: string, id: string): Member[] =>
  classMemberLines(splitLines(code).lines, id).map(({ line, text }) => ({
    fields: memberFields(parseMember(text)),
    id: `L${line}`,
    label: text.replaceAll(/^\\/g, ''),
    line
  }));

const withValues = (member: ClassMember, values: DetailValues): ClassMember => ({
  ...member,
  args: values.args ?? member.args,
  name: values.name ?? member.name,
  type: values.type ?? member.type,
  visibility: visibilities.includes(values.visibility as Visibility)
    ? (values.visibility as Visibility)
    : member.visibility
});

/** The code with the class member on `line` changed; undefined when it is not one. */
export const setClassMember = (
  code: string,
  id: string,
  line: number,
  values: DetailValues
): string | undefined => {
  const { eol, lines } = splitLines(code);
  const found = classMemberLines(lines, id).find((member) => member.line === line);
  if (!found) return undefined;
  const text = renderMember(withValues(parseMember(found.text), values), found.inBody);
  lines[line] = found.inBody ? `${found.indent}${text}` : `${found.indent}${id} : ${text}`;
  return lines.join(eol);
};

/** The code without the class member on `line`; undefined when it is not one. */
export const deleteClassMember = (code: string, id: string, line: number): string | undefined => {
  const { eol, lines } = splitLines(code);
  if (!classMemberLines(lines, id).some((member) => member.line === line)) return undefined;
  lines.splice(line, 1);
  return lines.join(eol);
};

/**
 * The code with a member added to the class: last in its body when it has
 * one, else as an `X : …` statement after its last member statement (or at
 * `fallback`, the end of the diagram's statements).
 */
export const addClassMember = (
  code: string,
  id: string,
  member: Omit<ClassMember, 'typeFirst' | 'classifier'>,
  fallback: (code: string, added: string[]) => string
): string => {
  const { eol, lines } = splitLines(code);
  const full: ClassMember = { ...member, classifier: '', typeFirst: false };
  const body = lines.findIndex(
    (line, index) => index > headerIndex(lines) && classBody(id).test(line)
  );
  const end = body === -1 ? -1 : closingBrace(lines, body);
  if (end !== -1) {
    intoBlock(lines, body, end, renderMember(full, true));
    return lines.join(eol);
  }
  const statement = `${id} : ${renderMember(full, false)}`;
  const last = classMemberLines(lines, id).at(-1);
  if (last) {
    lines.splice(last.line + 1, 0, `${last.indent}${statement}`);
    return lines.join(eol);
  }
  return fallback(code, [`  ${statement}`]);
};

// ---- ER attributes ----

export const attributeKeys = ['none', 'PK', 'FK', 'UK', 'PKFK'] as const;
export type AttributeKey = (typeof attributeKeys)[number];

export interface ErAttribute {
  type: string;
  name: string;
  key: AttributeKey | string;
  comment: string;
}

const keyList = String.raw`(?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*`;
const attributeLine = new RegExp(
  String.raw`^(\s*)(\S+)\s+(\S+)(?:\s+(${keyList}))?(?:\s+"([^"]*)")?\s*$`
);

const keyOf = (keys: string): string => {
  const list = keys.split(',').map((part) => part.trim());
  if (list.length === 0 || !list[0]) return 'none';
  if (list.length === 2 && list.includes('PK') && list.includes('FK')) return 'PKFK';
  return list.length === 1 ? list[0] : list.join(', ');
};
const keyText = (key: string) => (key === 'none' || !key ? '' : key === 'PKFK' ? 'PK, FK' : key);

// A type or a name is one word; mermaid's ER grammar allows letters, digits, `_`, `-`, `()` and `[]`.
const erWord = (text: string, fallback: string) =>
  oneLine(text)
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^\p{L}\p{N}_\-()[\]]/gu, '') || fallback;

export const renderAttribute = ({ comment, key, name, type }: ErAttribute): string => {
  const keys = keyText(key);
  const note = oneLine(comment).replaceAll('"', "'");
  return [erWord(type, 'string'), erWord(name, 'name'), keys, note ? `"${note}"` : '']
    .filter(Boolean)
    .join(' ');
};

const entityBlock = (id: string) =>
  new RegExp(`^\\s*${escape(id)}(?:\\s*\\[[^\\]]*\\])?\\s*\\{\\s*$`);
const entityAlias = (id: string) => new RegExp(`^(\\s*${escape(id)}\\s*\\[[^\\]]*\\])\\s*$`);

const entityAttributeLines = (lines: string[], id: string) => {
  const found: { line: number; attribute: ErAttribute; indent: string }[] = [];
  for (let index = headerIndex(lines) + 1; index < lines.length; index++) {
    if (!entityBlock(id).test(lines[index])) continue;
    const end = closingBrace(lines, index);
    if (end === -1) continue;
    for (let inner = index + 1; inner < end; inner++) {
      const match = attributeLine.exec(lines[inner]);
      if (!match || isBlank(lines[inner])) continue;
      found.push({
        attribute: {
          comment: match[5] ?? '',
          key: keyOf(match[4] ?? ''),
          name: match[3],
          type: match[2]
        },
        indent: match[1],
        line: inner
      });
    }
    index = end;
  }
  return found;
};

const attributeFields = (attribute: ErAttribute): DetailField[] => [
  { key: 'type', kind: 'text', label: 'add.er.type', value: attribute.type },
  { key: 'name', kind: 'text', label: 'add.f.name', value: attribute.name },
  {
    key: 'key',
    kind: 'choice',
    label: 'add.er.key',
    options: attributeKeys.includes(attribute.key as AttributeKey)
      ? attributeKeys
      : [...attributeKeys, attribute.key],
    value: attribute.key
  },
  { key: 'comment', kind: 'text', label: 'add.er.comment', value: attribute.comment }
];

/** The entity's attributes, each with the fields the Edit card shows. */
export const entityAttributes = (code: string, id: string): Member[] =>
  entityAttributeLines(splitLines(code).lines, id).map(({ attribute, line }) => ({
    fields: attributeFields(attribute),
    id: `L${line}`,
    label: renderAttribute(attribute),
    line
  }));

export const setEntityAttribute = (
  code: string,
  id: string,
  line: number,
  values: DetailValues
): string | undefined => {
  const { eol, lines } = splitLines(code);
  const found = entityAttributeLines(lines, id).find((attribute) => attribute.line === line);
  if (!found) return undefined;
  const { attribute } = found;
  lines[line] = `${found.indent}${renderAttribute({
    comment: values.comment ?? attribute.comment,
    key: values.key ?? attribute.key,
    name: values.name ?? attribute.name,
    type: values.type ?? attribute.type
  })}`;
  return lines.join(eol);
};

export const deleteEntityAttribute = (
  code: string,
  id: string,
  line: number
): string | undefined => {
  const { eol, lines } = splitLines(code);
  if (!entityAttributeLines(lines, id).some((attribute) => attribute.line === line))
    return undefined;
  lines.splice(line, 1);
  return lines.join(eol);
};

/**
 * The code with an attribute added last to the entity's `{ }` block; an entity
 * without one gets it on its `id["label"]` line, or a new block at `fallback`.
 */
export const addEntityAttribute = (
  code: string,
  id: string,
  attribute: ErAttribute,
  fallback: (code: string, added: string[]) => string
): string => {
  const { eol, lines } = splitLines(code);
  const text = renderAttribute(attribute);
  const header = headerIndex(lines);
  const block = lines.findIndex((line, index) => index > header && entityBlock(id).test(line));
  const end = block === -1 ? -1 : closingBrace(lines, block);
  if (end !== -1) {
    intoBlock(lines, block, end, text);
    return lines.join(eol);
  }
  const alias = lines.findIndex((line, index) => index > header && entityAlias(id).test(line));
  if (alias !== -1) {
    const indent = ' '.repeat(indentOf(lines[alias]));
    lines.splice(alias, 1, `${lines[alias].trimEnd()} {`, `${indent}  ${text}`, `${indent}}`);
    return lines.join(eol);
  }
  return fallback(code, [`  ${id} {`, `    ${text}`, '  }']);
};

// ---- Gantt tasks ----

const ganttFormat = (code: string) => /^\s*dateFormat\s+(\S+)/m.exec(code)?.[1] ?? 'YYYY-MM-DD';

/** A date from a date input (YYYY-MM-DD) in the chart's `dateFormat`. */
export const ganttDate = (code: string, date: string) => {
  const format = ganttFormat(code);
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  // Unix time, in seconds (X) or milliseconds (x).
  if (format === 'X' || format === 'x') {
    const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));
    return String(format === 'X' ? ms / 1000 : ms);
  }
  if (!/^[YMD\-./]+$/.test(format)) return date;
  return format.replace('YYYY', year).replace('MM', month).replace('DD', day);
};

/** A date written in the chart's `dateFormat` as YYYY-MM-DD, or undefined when it is not one. */
export const fromGanttDate = (code: string, text: string): string | undefined => {
  const format = ganttFormat(code);
  if (format === 'X' || format === 'x') {
    if (!/^\d+$/.test(text)) return undefined;
    const ms = Number(text) * (format === 'X' ? 1000 : 1);
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (!/^[YMD\-./]+$/.test(format) || !format.includes('YYYY')) return undefined;
  const pattern = new RegExp(
    `^${escape(format).replace('YYYY', '(?<y>\\d{4})').replace('MM', '(?<m>\\d{2})').replace('DD', '(?<d>\\d{2})')}$`
  );
  const groups = pattern.exec(text)?.groups;
  return groups?.y && groups.m && groups.d ? `${groups.y}-${groups.m}-${groups.d}` : undefined;
};

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

// Statements of the chart that are not tasks, though some have a colon.
const ganttKeyword =
  /^\s*(?:title|dateFormat|axisFormat|tickInterval|excludes|includes|todayMarker|weekday|weekend|section|click|accTitle|accDescr|displayMode|inclusiveEndDates|topAxis)\b/;
export const ganttSection = /^(\s*)section\s+(.+?)\s*$/;
export const ganttTags = ['active', 'done', 'crit', 'milestone', 'vert'];

export interface GanttTask {
  line: number;
  indent: string;
  name: string;
  tags: string[];
  id: string;
  /** A date, `after a b`, or empty: straight after the previous task. */
  start: string;
  /** A length (`3d`), a date or `until x`. */
  end: string;
}

/** The task on a line, or undefined when it is not one. */
export const parseGanttTask = (line: string, index: number): GanttTask | undefined => {
  if (ganttKeyword.test(line) || line.trim().startsWith('%%')) return undefined;
  const match = /^(\s*)([^:]+?)\s*:\s*(.*?)\s*$/.exec(line);
  if (!match) return undefined;
  const items = match[3].split(',').map((item) => item.trim());
  const tags: string[] = [];
  while (items.length > 1 && ganttTags.includes(items[0])) tags.push(items.shift() ?? '');
  const [first = '', second = '', third = ''] = items;
  const task = { indent: match[1], line: index, name: match[2], tags };
  if (items.length >= 3) return { ...task, end: third, id: first, start: second };
  if (items.length === 2) return { ...task, end: second, id: '', start: first };
  return { ...task, end: first, id: '', start: '' };
};

/** Every task of the chart, in order. */
export const ganttTasks = (lines: string[]): GanttTask[] => {
  const header = headerIndex(lines);
  return lines.flatMap((line, index) => {
    if (index <= header) return [];
    const task = parseGanttTask(line, index);
    return task ? [task] : [];
  });
};

export const renderGanttTask = ({ end, id, indent, name, start, tags }: GanttTask): string => {
  const items = [...tags, ...(start ? (id ? [id, start] : [start]) : []), end];
  return `${indent}${name} : ${items.join(', ')}`;
};

/** A task name: one line, without the colon, `#` and `;` that end it. */
export const ganttName = (text: string, fallback: string) =>
  ganttSafe(oneLine(text).replaceAll(/[:#;]/g, ' ').replaceAll(/\s+/g, ' ').trim() || fallback);

const freshTaskId = (lines: string[]) => {
  const used = new Set(ganttTasks(lines).map(({ id }) => id));
  let n = 1;
  while (used.has(`t${n}`)) n++;
  return `t${n}`;
};

/**
 * The id of the task on `line`, giving it one when it has none so another task
 * can follow it (`after t1`). A task with no start of its own starts after the
 * one before it, which then needs an id too. Undefined when there is none.
 */
export const ensureTaskId = (lines: string[], line: number, depth = 0): string | undefined => {
  const task = parseGanttTask(lines[line] ?? '', line);
  if (!task || depth > 50) return undefined;
  if (task.id) return task.id;
  let { start } = task;
  if (!start) {
    const previous = ganttTasks(lines)
      .filter((other) => other.line < line)
      .at(-1);
    const before = previous ? ensureTaskId(lines, previous.line, depth + 1) : undefined;
    if (!before) return undefined;
    start = `after ${before}`;
  }
  const id = freshTaskId(lines);
  lines[line] = renderGanttTask({ ...task, id, start });
  return id;
};

export const ganttStatuses = ['none', 'done', 'active'] as const;
const yesNo = ['no', 'yes'] as const;

/** The fields of a task's start, length, status and marks, as the Add and Edit cards show them. */
const taskFields = (code: string, lines: string[], task: GanttTask): DetailField[] => {
  const tasks = ganttTasks(lines);
  const afterId = /^after\s+(\S+)/.exec(task.start)?.[1];
  const after = afterId ? tasks.find(({ id }) => id === afterId) : undefined;
  const start = fromGanttDate(code, task.start);
  const end = fromGanttDate(code, task.end);
  const length = /^(\d+(?:\.\d+)?)([dw])$/.exec(task.end);
  const days = length
    ? String(Number(length[1]) * (length[2] === 'w' ? 7 : 1))
    : start && end
      ? String(daysBetween(start, end))
      : '';
  return [
    { key: 'start', kind: 'date', label: 'add.gantt.start', value: start ?? '' },
    {
      choices: tasks
        .filter(({ line }) => line !== task.line)
        .map(({ line, name }) => ({ id: `L${line}`, label: name })),
      key: 'after',
      kind: 'item',
      label: 'add.gantt.after',
      value: after ? `L${after.line}` : ''
    },
    { key: 'days', kind: 'number', label: 'add.gantt.days', value: days },
    {
      key: 'status',
      kind: 'choice',
      label: 'add.gantt.status',
      options: ganttStatuses,
      value: task.tags.includes('done') ? 'done' : task.tags.includes('active') ? 'active' : 'none'
    },
    {
      key: 'crit',
      kind: 'choice',
      label: 'add.gantt.crit',
      options: yesNo,
      value: task.tags.includes('crit') ? 'yes' : 'no'
    },
    {
      key: 'milestone',
      kind: 'choice',
      label: 'add.gantt.milestone',
      options: yesNo,
      value: task.tags.includes('milestone') ? 'yes' : 'no'
    }
  ];
};

/** The tags for a status and marks, keeping any other tag (`vert`) the task had. */
export const taskTags = (values: DetailValues, kept: string[] = []): string[] => [
  ...(values.status === 'done' || values.status === 'active' ? [values.status] : []),
  ...(values.crit === 'yes' ? ['crit'] : []),
  ...(values.milestone === 'yes' ? ['milestone'] : []),
  ...kept.filter((tag) => !['active', 'done', 'crit', 'milestone'].includes(tag))
];

/**
 * The start written for chosen values: `after <id>` of the chosen task (given an
 * id if it has none), else the date, else undefined (straight after the previous task).
 * Null when the chosen task cannot be followed.
 */
export const taskStart = (
  code: string,
  lines: string[],
  values: DetailValues
): string | undefined | null => {
  if (values.after) {
    const line = Number(values.after.replace(/^L/, ''));
    const id = Number.isInteger(line) ? ensureTaskId(lines, line) : undefined;
    return id ? `after ${id}` : null;
  }
  return values.start ? ganttDate(code, values.start) : undefined;
};

const setGanttTask = (code: string, line: number, values: DetailValues): string | undefined => {
  const { eol, lines } = splitLines(code);
  const task = parseGanttTask(lines[line] ?? '', line);
  if (!task) return undefined;
  const before = Object.fromEntries(
    taskFields(code, lines, task).map(({ key, value }) => [key, value])
  );
  const changed = (key: string) => (values[key] ?? before[key]) !== before[key];
  const next: GanttTask = { ...task };
  if (changed('status') || changed('crit') || changed('milestone'))
    next.tags = taskTags({ ...before, ...values }, task.tags);
  if (changed('start') || changed('after')) {
    const start = taskStart(code, lines, {
      after: values.after ?? before.after,
      start: values.start ?? before.start
    });
    if (start === null) return undefined;
    if (start === undefined && task.id) {
      // An id needs a start of its own: straight after the previous task.
      const previous = ganttTasks(lines)
        .filter((other) => other.line < line)
        .at(-1);
      const id = previous ? ensureTaskId(lines, previous.line) : undefined;
      next.start = id ? `after ${id}` : task.start;
    } else {
      next.start = start ?? '';
    }
  }
  if (changed('days')) {
    const days = Math.max(0, Math.round(Number(values.days)));
    if (Number.isFinite(days) && values.days !== '') next.end = `${days}d`;
  }
  lines[line] = renderGanttTask(next);
  return lines.join(eol);
};

// ---- Pie slices ----

/** A slice: `"label" : value`. */
export const pieSlice = /^(\s*)"([^"]*)"\s*:\s*(\S+)\s*$/;

const setPieSlice = (code: string, line: number, values: DetailValues): string | undefined => {
  const { eol, lines } = splitLines(code);
  const match = pieSlice.exec(lines[line] ?? '');
  const value = Number(values.value);
  if (!match || !values.value?.trim() || !Number.isFinite(value) || value < 0) return undefined;
  lines[line] = `${match[1]}"${match[2]}" : ${value}`;
  return lines.join(eol);
};

// ---- What the Edit card calls ----

/** The properties of the chosen object beyond its text; undefined for kinds that have none. */
export const objectFields = (
  code: string,
  kind: string,
  object: EditObject
): DetailField[] | undefined => {
  const { lines } = splitLines(code);
  const line = object.line ?? -1;
  if (kind === 'gantt' && !object.group) {
    const task = parseGanttTask(lines[line] ?? '', line);
    return task ? taskFields(code, lines, task) : undefined;
  }
  if (kind === 'pie') {
    const match = pieSlice.exec(lines[line] ?? '');
    return match
      ? [{ key: 'value', kind: 'number', label: 'add.pie.value', value: match[3] }]
      : undefined;
  }
  return undefined;
};

/** The code with the object's properties changed; undefined when that is not possible. */
export const setObjectFields = (
  code: string,
  kind: string,
  object: EditObject,
  values: DetailValues
): string | undefined => {
  if (object.line === undefined || object.group) return undefined;
  if (kind === 'gantt') return setGanttTask(code, object.line, values);
  if (kind === 'pie') return setPieSlice(code, object.line, values);
  return undefined;
};

/** The members of the chosen object (class members, entity attributes); undefined for other kinds. */
export const objectMembers = (code: string, kind: string, id: string): Member[] | undefined => {
  if (kind === 'class') return classMembers(code, id);
  if (kind === 'er') return entityAttributes(code, id);
  return undefined;
};

/** The code with the member changed; undefined when that is not possible. */
export const setMember = (
  code: string,
  kind: string,
  id: string,
  member: Member,
  values: DetailValues
): string | undefined => {
  if (kind === 'class') return setClassMember(code, id, member.line, values);
  if (kind === 'er') return setEntityAttribute(code, id, member.line, values);
  return undefined;
};

/** The code without the member; undefined when that is not possible. */
export const deleteMember = (
  code: string,
  kind: string,
  id: string,
  member: Member
): string | undefined => {
  if (kind === 'class') return deleteClassMember(code, id, member.line);
  if (kind === 'er') return deleteEntityAttribute(code, id, member.line);
  return undefined;
};
