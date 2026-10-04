/**
 * Local: the Add card for every other diagram type (AddActions.svelte). Each
 * type lists its actions — add a participant, a message, a state, a task, … —
 * as fields the card renders and a function that writes the mermaid lines.
 * New lines go after the last statement (before trailing style statements),
 * or into the chosen section, column, boundary or parent topic.
 */
import type { MessageKey } from '$/i18n/messages';
import mermaid from 'mermaid';
import { freshId, splitLines } from './diagramEdit';
import { diagramObjects, type DiagramObject } from './mermaid';

export type FieldKind = 'text' | 'number' | 'date' | 'choice' | 'item';

export interface Field {
  key: string;
  kind: FieldKind;
  label: MessageKey;
  /** choice: the values; each is labelled by the message `<label>.<value>`. */
  options?: readonly string[];
  /** item: which list of the diagram's parts to choose from. */
  source?: string;
  /** May be left empty (item: "none"). */
  optional?: boolean;
  initial?: string;
}

export type Values = Record<string, string>;
export type ActionResult = { code: string; name: string; follow?: Values } | { error: MessageKey };

export interface Action {
  id: string;
  title: MessageKey;
  button: MessageKey;
  fields: Field[];
  apply: (code: string, values: Values) => ActionResult;
}

export interface AddSpec {
  kind: string;
  header: RegExp;
  actions: Action[];
  parts: (code: string) => Promise<Record<string, DiagramObject[]>>;
}

// Statements that style what is drawn; new content goes before a trailing run of them.
const trailing =
  /^\s*(?:style|linkStyle|classDef|cssClass|click|Update\w*Style|UpdateLayoutConfig)\b/;

/** The code with lines inserted at `index` (default: after the last content statement). */
const insert = (code: string, added: string[], index?: number) => {
  const { eol, lines } = splitLines(code);
  let at = index;
  if (at === undefined) {
    at = lines.length;
    while (at > 1 && (!lines[at - 1].trim() || trailing.test(lines[at - 1]))) at--;
  }
  lines.splice(at, 0, ...added);
  return lines.join(eol);
};

const oneLine = (text: string) => text.replaceAll(/[\r\n]+/g, ' ').trim();
const noQuotes = (text: string) => oneLine(text).replaceAll('"', "'");
const noBrackets = (text: string) => oneLine(text).replaceAll(/[()[\]{}]/g, '');
const indentOf = (line: string) => /^\s*/.exec(line)?.[0].length ?? 0;
const isContent = (line: string) => line.trim() !== '' && !line.trim().startsWith('%%');

const need = (values: Values, ...keys: string[]) => keys.every((key) => values[key]);

const item = (id: string, label: string): DiagramObject => ({ id, label: label || id });

// ---- Indentation-based diagrams (mindmap, kanban) ----

/** The index of the header line: the first content line past any front matter. */
const headerIndex = (lines: string[]) => {
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    start = end === -1 ? lines.length : end + 1;
  }
  const index = lines.findIndex((line, i) => i >= start && isContent(line));
  return index === -1 ? lines.length : index;
};

/** The lines after the header that hold a node, with their indentation. */
const nodeLines = (lines: string[]) => {
  const header = headerIndex(lines);
  return lines
    .map((line, index) => ({ index, indent: indentOf(line), line }))
    .filter(
      ({ index, line }) =>
        index > header && isContent(line) && !/^\s*(?::::|::icon\(|@\{)/.test(line)
    );
};

/** The index after the last line of the block a node line starts. */
const blockEnd = (lines: string[], start: number) => {
  const indent = indentOf(lines[start]);
  let end = start + 1;
  for (let index = start + 1; index < lines.length; index++) {
    if (!isContent(lines[index])) continue;
    if (indentOf(lines[index]) <= indent) break;
    end = index + 1;
  }
  return end;
};

const nodeLabel = (line: string) =>
  line
    .trim()
    .replace(/^[\w-]+(?=[([{)])/, '')
    .replaceAll(/^[([{)]+|[)\]}(]+$/g, '')
    .replaceAll(/^"|"$/g, '')
    .trim();

/** Adds a child under the node on line `parent`, after its last descendant. */
const addChild = (code: string, parent: number, text: string) => {
  const { lines } = splitLines(code);
  const end = blockEnd(lines, parent);
  const child = nodeLines(lines).find(({ index }) => index > parent && index < end);
  const indent = child?.indent ?? indentOf(lines[parent]) + 2;
  return insert(code, [`${' '.repeat(indent)}${text}`], end);
};

// ---- Parts read from mermaid's parse ----

const objects = async (code: string) => (await diagramObjects(code))?.items ?? [];

const sequenceParts = async (code: string) => {
  try {
    await mermaid.parse(code);
    const db = (await mermaid.mermaidAPI.getDiagramFromText(code)).db as {
      getActors?: () => Map<string, { name: string; description?: string }>;
    };
    return {
      participants: [...(db.getActors?.().values() ?? [])].map(({ description, name }) =>
        item(name, description ?? name)
      )
    };
  } catch {
    return { participants: [] };
  }
};

const c4Parts = async (code: string) => {
  try {
    await mermaid.parse(code);
    const db = (await mermaid.mermaidAPI.getDiagramFromText(code)).db as {
      getBoundaries?: () => { alias: string; label?: { text?: string } }[];
    };
    return {
      boundaries: (db.getBoundaries?.() ?? [])
        .filter(({ alias }) => alias !== 'global')
        .map(({ alias, label }) => item(alias, label?.text ?? alias)),
      elements: await objects(code)
    };
  } catch {
    return { boundaries: [], elements: [] };
  }
};

// ---- The specs ----

const sequence: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const id = freshId(code, 'p');
        const name = oneLine(values.name) || id;
        return {
          code: insert(code, [`  ${values.kind || 'participant'} ${id} as ${name}`]),
          follow: { to: id },
          name
        };
      },
      button: 'add.seq.participantButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        {
          initial: 'participant',
          key: 'kind',
          kind: 'choice',
          label: 'add.seq.kind',
          options: ['participant', 'actor']
        }
      ],
      id: 'participant',
      title: 'add.seq.participant'
    },
    {
      apply: (code, values) => {
        if (!need(values, 'from', 'to')) return { error: 'add.choose' };
        const arrows: Record<string, string> = { async: '-)', reply: '-->>', sync: '->>' };
        const text = oneLine(values.text).replaceAll(';', ',');
        return {
          code: insert(code, [
            `  ${values.from}${arrows[values.kind] ?? '->>'}${values.to}: ${text}`
          ]),
          name: text || `${values.from} → ${values.to}`
        };
      },
      button: 'add.seq.messageButton',
      fields: [
        { key: 'from', kind: 'item', label: 'add.f.from', source: 'participants' },
        { key: 'to', kind: 'item', label: 'add.f.to', source: 'participants' },
        { key: 'text', kind: 'text', label: 'add.f.text', optional: true },
        {
          initial: 'sync',
          key: 'kind',
          kind: 'choice',
          label: 'add.seq.arrow',
          options: ['sync', 'reply', 'async']
        }
      ],
      id: 'message',
      title: 'add.seq.message'
    }
  ],
  header: /^\s*sequenceDiagram\b/,
  kind: 'sequence',
  parts: sequenceParts
};

const transition = (from: string, to: string, text: string) =>
  `  ${from} --> ${to}${oneLine(text) ? ` : ${oneLine(text)}` : ''}`;

const state: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const id = freshId(code, 's');
        const name = noQuotes(values.name) || id;
        const lines = [`  state "${name}" as ${id}`];
        if (values.from) lines.push(transition(values.from, id, values.text));
        return { code: insert(code, lines), follow: { from: id }, name };
      },
      button: 'add.state.stateButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        { key: 'from', kind: 'item', label: 'add.f.arrowFrom', optional: true, source: 'states' },
        { key: 'text', kind: 'text', label: 'add.f.arrowText', optional: true }
      ],
      id: 'state',
      title: 'add.state.state'
    },
    {
      apply: (code, values) => {
        if (!need(values, 'from', 'to')) return { error: 'add.choose' };
        return {
          code: insert(code, [transition(values.from, values.to, values.text)]),
          name: `${values.from} → ${values.to}`
        };
      },
      button: 'add.connectButton',
      fields: [
        { key: 'from', kind: 'item', label: 'add.f.from', source: 'states' },
        { key: 'to', kind: 'item', label: 'add.f.to', source: 'states' },
        { key: 'text', kind: 'text', label: 'add.f.text', optional: true }
      ],
      id: 'transition',
      title: 'add.state.transition'
    }
  ],
  header: /^\s*stateDiagram(?:-v2)?\b/,
  kind: 'state',
  parts: async (code) => ({
    // The start and end point too, for transitions from and to them.
    states: [item('[*]', '[*]'), ...(await objects(code))]
  })
};

const classRelation: Record<string, (from: string, to: string) => string> = {
  aggregation: (from, to) => `${to} o-- ${from}`,
  association: (from, to) => `${from} --> ${to}`,
  composition: (from, to) => `${to} *-- ${from}`,
  dependency: (from, to) => `${from} ..> ${to}`,
  inheritance: (from, to) => `${to} <|-- ${from}`
};

const classSpec: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const id = freshId(code, 'c');
        const name = noQuotes(values.name) || id;
        return { code: insert(code, [`  class ${id}["${name}"]`]), follow: { from: id }, name };
      },
      button: 'add.class.classButton',
      fields: [{ key: 'name', kind: 'text', label: 'add.f.name' }],
      id: 'class',
      title: 'add.class.class'
    },
    {
      apply: (code, values) => {
        if (!need(values, 'from', 'to')) return { error: 'add.choose' };
        const relation = (classRelation[values.kind] ?? classRelation.association)(
          values.from,
          values.to
        );
        // A colon or a double quote in the label ends the statement.
        const text = noQuotes(values.text).replaceAll(':', ' ').replaceAll(/\s+/g, ' ').trim();
        return {
          code: insert(code, [`  ${relation}${text ? ` : ${text}` : ''}`]),
          name: `${values.from} → ${values.to}`
        };
      },
      button: 'add.connectButton',
      fields: [
        { key: 'from', kind: 'item', label: 'add.f.from', source: 'classes' },
        { key: 'to', kind: 'item', label: 'add.f.to', source: 'classes' },
        {
          initial: 'association',
          key: 'kind',
          kind: 'choice',
          label: 'add.class.kind',
          options: ['association', 'inheritance', 'composition', 'aggregation', 'dependency']
        },
        { key: 'text', kind: 'text', label: 'add.f.text', optional: true }
      ],
      id: 'relation',
      title: 'add.class.relation'
    }
  ],
  header: /^\s*classDiagram(?:-v2)?\b/,
  kind: 'class',
  parts: async (code) => ({ classes: await objects(code) })
};

const cardinalities: Record<string, string> = {
  manyToMany: '}o--o{',
  oneToMany: '||--o{',
  oneToOne: '||--||',
  zeroOrOne: '||--o|'
};

const er: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const id = freshId(code, 'e');
        const name = noQuotes(values.name) || id;
        return { code: insert(code, [`  ${id}["${name}"]`]), follow: { to: id }, name };
      },
      button: 'add.er.entityButton',
      fields: [{ key: 'name', kind: 'text', label: 'add.f.name' }],
      id: 'entity',
      title: 'add.er.entity'
    },
    {
      apply: (code, values) => {
        if (!need(values, 'from', 'to')) return { error: 'add.choose' };
        const card = cardinalities[values.kind] ?? cardinalities.oneToMany;
        return {
          code: insert(code, [
            `  ${values.from} ${card} ${values.to} : "${noQuotes(values.text)}"`
          ]),
          name: `${values.from} → ${values.to}`
        };
      },
      button: 'add.connectButton',
      fields: [
        { key: 'from', kind: 'item', label: 'add.f.from', source: 'entities' },
        { key: 'to', kind: 'item', label: 'add.f.to', source: 'entities' },
        {
          initial: 'oneToMany',
          key: 'kind',
          kind: 'choice',
          label: 'add.er.kind',
          options: ['oneToOne', 'oneToMany', 'manyToMany', 'zeroOrOne']
        },
        { key: 'text', kind: 'text', label: 'add.f.text', optional: true }
      ],
      id: 'relationship',
      title: 'add.er.relationship'
    }
  ],
  header: /^\s*erDiagram\b/,
  kind: 'er',
  parts: async (code) => ({ entities: await objects(code) })
};

const mindmap: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const { lines } = splitLines(code);
        const parent = Number(values.parent);
        if (!values.parent || !lines[parent]) return { error: 'add.choose' };
        const name = noBrackets(values.name) || 'New topic';
        return { code: addChild(code, parent, name), name };
      },
      button: 'add.mind.topicButton',
      fields: [
        { key: 'parent', kind: 'item', label: 'add.mind.parent', source: 'topics' },
        { key: 'name', kind: 'text', label: 'add.f.name' }
      ],
      id: 'topic',
      title: 'add.mind.topic'
    }
  ],
  header: /^\s*mindmap\b/,
  kind: 'mindmap',
  parts: (code) =>
    Promise.resolve({
      topics: nodeLines(splitLines(code).lines).map(({ index, indent, line }) =>
        // Indented like the map, so the tree shows in the list.
        item(String(index), `${' '.repeat(Math.max(0, indent - 2))}${nodeLabel(line)}`)
      )
    })
};

/** A date from the date input (YYYY-MM-DD) in the chart's dateFormat. */
const ganttDate = (code: string, date: string) => {
  const format = /^\s*dateFormat\s+(\S+)/m.exec(code)?.[1] ?? 'YYYY-MM-DD';
  const [year, month, day] = date.split('-');
  if (!/^[YMD\-./]+$/.test(format) || !year || !month || !day) return date;
  return format.replace('YYYY', year).replace('MM', month).replace('DD', day);
};

const sectionLine = /^\s*section\s+(.+?)\s*$/;

const gantt: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const name = oneLine(values.name).replaceAll(/[:#;]/g, ' ').trim() || 'Task';
        const days = Math.max(1, Math.round(Number(values.days) || 1));
        const start = values.start ? `${ganttDate(code, values.start)}, ` : '';
        const line = `    ${name} : ${start}${days}d`;
        const { lines } = splitLines(code);
        const section = lines.findIndex((text) => sectionLine.exec(text)?.[1] === values.section);
        if (!values.section || section === -1) return { code: insert(code, [line]), name };
        let end = lines.findIndex((text, index) => index > section && sectionLine.test(text));
        if (end === -1) end = lines.length;
        while (end > section + 1 && !lines[end - 1].trim()) end--;
        return { code: insert(code, [line], end), name };
      },
      button: 'add.gantt.taskButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        {
          key: 'section',
          kind: 'item',
          label: 'add.gantt.section',
          optional: true,
          source: 'sections'
        },
        { key: 'start', kind: 'date', label: 'add.gantt.start', optional: true },
        { initial: '3', key: 'days', kind: 'number', label: 'add.gantt.days' }
      ],
      id: 'task',
      title: 'add.gantt.task'
    },
    {
      apply: (code, values) => {
        const name = oneLine(values.name).replaceAll(/[:#;]/g, ' ').trim() || 'Section';
        return { code: insert(code, [`  section ${name}`]), follow: { section: name }, name };
      },
      button: 'add.gantt.sectionButton',
      fields: [{ key: 'name', kind: 'text', label: 'add.f.name' }],
      id: 'section',
      title: 'add.gantt.sectionTitle'
    }
  ],
  header: /^\s*gantt\b/,
  kind: 'gantt',
  parts: (code) =>
    Promise.resolve({
      sections: splitLines(code)
        .lines.map((line) => sectionLine.exec(line)?.[1])
        .filter((name) => name !== undefined)
        .map((name) => item(name, name))
    })
};

const pie: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const name = noQuotes(values.name) || 'Item';
        const value = Number(values.value);
        if (!Number.isFinite(value) || value < 0) return { error: 'add.pie.badValue' };
        return { code: insert(code, [`    "${name}" : ${value}`]), name };
      },
      button: 'add.pie.sliceButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        { initial: '10', key: 'value', kind: 'number', label: 'add.pie.value' }
      ],
      id: 'slice',
      title: 'add.pie.slice'
    }
  ],
  header: /^\s*pie\b/,
  kind: 'pie',
  parts: () => Promise.resolve({})
};

const kanbanColumns = (code: string) => {
  const nodes = nodeLines(splitLines(code).lines);
  const indent = Math.min(...nodes.map((node) => node.indent));
  return nodes.filter((node) => node.indent === indent);
};

const kanban: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const { lines } = splitLines(code);
        const column = Number(values.column);
        if (!values.column || !lines[column]) return { error: 'add.choose' };
        const id = freshId(code, 'card');
        const name = noBrackets(values.name) || id;
        return { code: addChild(code, column, `${id}[${name}]`), name };
      },
      button: 'add.kanban.cardButton',
      fields: [
        { key: 'column', kind: 'item', label: 'add.kanban.column', source: 'columns' },
        { key: 'name', kind: 'text', label: 'add.f.name' }
      ],
      id: 'card',
      title: 'add.kanban.card'
    },
    {
      apply: (code, values) => {
        const id = freshId(code, 'col');
        const name = noBrackets(values.name) || id;
        const indent = kanbanColumns(code)[0]?.indent ?? 2;
        const result = insert(code, [`${' '.repeat(indent)}${id}[${name}]`]);
        const index = splitLines(result).lines.findIndex((line) =>
          line.trim().startsWith(`${id}[`)
        );
        return { code: result, follow: { column: String(index) }, name };
      },
      button: 'add.kanban.columnButton',
      fields: [{ key: 'name', kind: 'text', label: 'add.f.name' }],
      id: 'column',
      title: 'add.kanban.columnTitle'
    }
  ],
  header: /^\s*kanban\b/,
  kind: 'kanban',
  parts: (code) =>
    Promise.resolve({
      columns: kanbanColumns(code).map(({ index, line }) => item(String(index), nodeLabel(line)))
    })
};

// `2021 : event` starts a period; `  : event` continues it.
const periodLine = /^\s*([^:\s][^:]*?)\s*:\s*(.*)$/;
const timelineText = (text: string) => oneLine(text).replaceAll(':', '：');

const timeline: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const { lines } = splitLines(code);
        const start = Number(values.period);
        if (!values.period || !lines[start]) return { error: 'add.choose' };
        let end = start + 1;
        while (end < lines.length && /^\s*:/.test(lines[end])) end++;
        const event = timelineText(values.text) || 'Event';
        const indent = ' '.repeat(indentOf(lines[start]) + 2);
        return { code: insert(code, [`${indent}: ${event}`], end), name: event };
      },
      button: 'add.timeline.eventButton',
      fields: [
        { key: 'period', kind: 'item', label: 'add.timeline.period', source: 'periods' },
        { key: 'text', kind: 'text', label: 'add.f.text' }
      ],
      id: 'event',
      title: 'add.timeline.event'
    },
    {
      apply: (code, values) => {
        const period = timelineText(values.name) || 'Period';
        const event = timelineText(values.text);
        return { code: insert(code, [`    ${period} : ${event}`]), name: period };
      },
      button: 'add.timeline.periodButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.timeline.periodName' },
        { key: 'text', kind: 'text', label: 'add.timeline.firstEvent', optional: true }
      ],
      id: 'period',
      title: 'add.timeline.periodTitle'
    }
  ],
  header: /^\s*timeline\b/,
  kind: 'timeline',
  parts: (code) =>
    Promise.resolve({
      periods: splitLines(code)
        .lines.map((line, index) => ({ index, match: periodLine.exec(line) }))
        .filter(({ match }) => match && !/^(?:title|section)\b/.test(match[1]))
        .map(({ index, match }) => item(String(index), match?.[1] ?? ''))
    })
};

/** The index of the `}` that closes the C4 boundary `alias`, or -1. */
const boundaryEnd = (lines: string[], alias: string) => {
  const start = lines.findIndex((line) =>
    new RegExp(`^\\s*\\w*Boundary\\(\\s*${alias}\\s*,`).test(line)
  );
  if (start === -1) return -1;
  let depth = 0;
  for (let index = start; index < lines.length; index++) {
    depth += (lines[index].match(/\{/g)?.length ?? 0) - (lines[index].match(/\}/g)?.length ?? 0);
    if (depth === 0 && index > start) return index;
  }
  return -1;
};

const rel = (from: string, to: string, text: string) =>
  `  Rel(${from}, ${to}, "${noQuotes(text)}")`;

const c4: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const id = freshId(code, 'el');
        const name = noQuotes(values.name) || id;
        const description = noQuotes(values.description ?? '');
        const element = `${values.kind || 'System'}(${id}, "${name}"${description ? `, "${description}"` : ''})`;
        const { lines } = splitLines(code);
        const end = values.boundary ? boundaryEnd(lines, values.boundary) : -1;
        let result =
          end === -1
            ? insert(code, [`  ${element}`])
            : insert(code, [`${' '.repeat(indentOf(lines[end]) + 2)}${element}`], end);
        if (values.from) result = insert(result, [rel(values.from, id, values.text ?? '')]);
        return { code: result, follow: { from: id }, name };
      },
      button: 'add.c4.elementButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        {
          initial: 'System',
          key: 'kind',
          kind: 'choice',
          label: 'add.c4.kind',
          options: [
            'Person',
            'Person_Ext',
            'System',
            'System_Ext',
            'SystemDb',
            'Container',
            'ContainerDb',
            'Component'
          ]
        },
        { key: 'description', kind: 'text', label: 'add.c4.description', optional: true },
        {
          key: 'boundary',
          kind: 'item',
          label: 'add.c4.boundary',
          optional: true,
          source: 'boundaries'
        },
        { key: 'from', kind: 'item', label: 'add.f.arrowFrom', optional: true, source: 'elements' },
        { key: 'text', kind: 'text', label: 'add.f.arrowText', optional: true }
      ],
      id: 'element',
      title: 'add.c4.element'
    },
    {
      apply: (code, values) => {
        if (!need(values, 'from', 'to')) return { error: 'add.choose' };
        return {
          code: insert(code, [rel(values.from, values.to, values.text ?? '')]),
          name: `${values.from} → ${values.to}`
        };
      },
      button: 'add.connectButton',
      fields: [
        { key: 'from', kind: 'item', label: 'add.f.from', source: 'elements' },
        { key: 'to', kind: 'item', label: 'add.f.to', source: 'elements' },
        { key: 'text', kind: 'text', label: 'add.f.text', optional: true }
      ],
      id: 'rel',
      title: 'add.c4.rel'
    }
  ],
  header: /^\s*C4(?:Context|Container|Component|Dynamic|Deployment)\b/,
  kind: 'c4',
  parts: c4Parts
};

const block: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const id = freshId(code, 'blk');
        const name = noQuotes(values.name) || id;
        const lines = [`  ${id}["${name}"]`];
        if (values.from) lines.push(`  ${values.from} --> ${id}`);
        return { code: insert(code, lines), follow: { from: id }, name };
      },
      button: 'add.block.blockButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        { key: 'from', kind: 'item', label: 'add.f.arrowFrom', optional: true, source: 'blocks' }
      ],
      id: 'block',
      title: 'add.block.block'
    },
    {
      apply: (code, values) => {
        if (!need(values, 'from', 'to')) return { error: 'add.choose' };
        return {
          code: insert(code, [`  ${values.from} --> ${values.to}`]),
          name: `${values.from} → ${values.to}`
        };
      },
      button: 'add.connectButton',
      fields: [
        { key: 'from', kind: 'item', label: 'add.f.from', source: 'blocks' },
        { key: 'to', kind: 'item', label: 'add.f.to', source: 'blocks' }
      ],
      id: 'link',
      title: 'add.block.link'
    }
  ],
  header: /^\s*block(?:-beta)?\b/,
  kind: 'block',
  parts: async (code) => ({ blocks: await objects(code) })
};

export const addSpecs: AddSpec[] = [
  sequence,
  state,
  classSpec,
  er,
  mindmap,
  gantt,
  pie,
  kanban,
  timeline,
  c4,
  block
];

/** The Add spec for the code's diagram type, from its header line. */
export const specFor = (code: string): AddSpec | undefined => {
  const { lines } = splitLines(code);
  const header = lines[headerIndex(lines)] ?? '';
  return addSpecs.find((spec) => spec.header.test(header));
};

/** The initial values of an action's fields. */
export const initialValues = (action: Action): Values =>
  Object.fromEntries(action.fields.map((field) => [field.key, field.initial ?? '']));
