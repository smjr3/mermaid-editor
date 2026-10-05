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
import { memoByCode } from './memo';
import { decodeEntities, diagramFromText, diagramObjects, type DiagramObject } from './mermaid';

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

// One line; a `;` ends a statement in several grammars, and an HTML tag typed into
// a form (an unclosed one blanks a kanban board) is never meant literally.
const tagPattern = /<\/?[a-z][^<>]*>/gi;
const stripTags = (text: string) => {
  // Removing a tag can expose another (`<<b>b>`): repeat until nothing is left.
  let previous;
  do {
    previous = text;
    text = text.replaceAll(tagPattern, '');
  } while (text !== previous);
  return text;
};
export const oneLine = (text: string) =>
  stripTags(text.replaceAll(/[\r\n]+/g, ' ').replaceAll(';', ',')).trim();
// Sequence diagrams read `#…;` as an entity code and `#` + digits breaks the message.
export const sequenceText = (text: string) => oneLine(text).replaceAll('#', '#35;');
const noQuotes = (text: string) => oneLine(text).replaceAll('"', "'");
const noBrackets = (text: string) => oneLine(text).replaceAll(/[()[\]{}]/g, '');
export const indentOf = (line: string) => /^\s*/.exec(line)?.[0].length ?? 0;
const isContent = (line: string) => line.trim() !== '' && !line.trim().startsWith('%%');

const need = (values: Values, ...keys: string[]) => keys.every((key) => values[key]);

const item = (id: string, label: string): DiagramObject => ({
  id,
  label: decodeEntities(label) || id
});

// ---- Indentation-based diagrams (mindmap, kanban) ----

/** The index of the header line: the first content line past any front matter. */
export const headerIndex = (lines: string[]) => {
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    start = end === -1 ? lines.length : end + 1;
  }
  const index = lines.findIndex((line, i) => i >= start && isContent(line));
  return index === -1 ? lines.length : index;
};

/** The lines after the header that hold a node, with their indentation. */
export const nodeLines = (lines: string[]) => {
  const header = headerIndex(lines);
  return lines
    .map((line, index) => ({ index, indent: indentOf(line), line }))
    .filter(
      ({ index, line }) =>
        index > header && isContent(line) && !/^\s*(?::::|::icon\(|@\{)/.test(line)
    );
};

/** The index after the last line of the block a node line starts. */
export const blockEnd = (lines: string[], start: number) => {
  const indent = indentOf(lines[start]);
  let end = start + 1;
  for (let index = start + 1; index < lines.length; index++) {
    if (!isContent(lines[index])) continue;
    if (indentOf(lines[index]) <= indent) break;
    end = index + 1;
  }
  return end;
};

/** Splits a kanban card's `@{ … }` metadata off the end of its line. */
export const splitMeta = (line: string): [string, string] => {
  const match = /^(.*?[)\]}])(\s*@\{.*\})\s*$/.exec(line);
  return match ? [match[1], match[2]] : [line, ''];
};

export const nodeLabel = (line: string) =>
  splitMeta(line)[0]
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

// A message statement, `A->>+B: text`, and the header of a block (`alt …`, `else …`):
// a new message, note or block can go after a message, or first inside a block.
const messageLine =
  /^\s*([\p{L}\p{N}_]+)\s*(?:<<)?(?:-->>|->>|-->|->|--x|-x|--\)|-\))\s*[+-]?\s*([\p{L}\p{N}_]+)\s*:\s*(.*?)\s*$/u;
const blockHeader = /^\s*(?:alt|loop|opt|par|critical|break|else|and|option)\b/;

/** The messages and block headers past the header, by line; a block reads `alt … ⋯` (inside it). */
const sequenceAnchors = (code: string): DiagramObject[] => {
  const { lines } = splitLines(code);
  const header = headerIndex(lines);
  return lines.flatMap((line, index) => {
    if (index <= header) return [];
    const match = messageLine.exec(line);
    if (match) return [item(String(index), `${match[1]} → ${match[2]}: ${match[3]}`)];
    return blockHeader.test(line) ? [item(String(index), `${line.trim()} ⋯`)] : [];
  });
};

const sequenceParts = memoByCode(async (code: string) => {
  try {
    await mermaid.parse(code);
    const db = (await diagramFromText(code)).db as {
      getActors?: () => Map<string, { name: string; description?: string }>;
    };
    return {
      messages: sequenceAnchors(code),
      participants: [...(db.getActors?.().values() ?? [])].map(({ description, name }) =>
        item(name, description ?? name)
      )
    };
  } catch {
    return { messages: [], participants: [] };
  }
});

/**
 * The code with lines after the message on line `after` (indented like it), first
 * inside the block whose header is on that line, or else at the end.
 */
const insertAfterAnchor = (code: string, added: string[], after: string | undefined) => {
  const { lines } = splitLines(code);
  const at = after ? Number(after) : Number.NaN;
  const line = Number.isInteger(at) ? (lines[at] ?? '') : '';
  const inside = blockHeader.test(line);
  if (!messageLine.test(line) && !inside) {
    return insert(
      code,
      added.map((text) => `  ${text}`)
    );
  }
  const indent = ' '.repeat(indentOf(line) + (inside ? 2 : 0));
  return insert(
    code,
    added.map((text) => `${indent}${text}`),
    at + 1
  );
};

/** The code with a block around the message on line `at`, which moves inside it. */
const wrapMessage = (code: string, at: number, header: string) => {
  const { eol, lines } = splitLines(code);
  const indent = ' '.repeat(indentOf(lines[at]));
  lines.splice(at, 1, `${indent}${header}`, `  ${lines[at]}`, `${indent}end`);
  return lines.join(eol);
};

const blockDefaults: Record<string, string> = { alt: '条件', loop: '繰り返し', opt: '任意' };

const c4Parts = memoByCode(async (code: string) => {
  try {
    await mermaid.parse(code);
    const db = (await diagramFromText(code)).db as {
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
});

// ---- The specs ----

const sequence: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const id = freshId(code, 'p');
        const name = sequenceText(values.name) || id;
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
        const text = sequenceText(values.text);
        return {
          code: insertAfterAnchor(
            code,
            [`${values.from}${arrows[values.kind] ?? '->>'}${values.to}: ${text}`],
            values.after
          ),
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
        },
        { key: 'after', kind: 'item', label: 'add.f.after', optional: true, source: 'messages' }
      ],
      id: 'message',
      title: 'add.seq.message'
    },
    {
      apply: (code, values) => {
        if (!values.at) return { error: 'add.seq.noteChoose' };
        const text = sequenceText(values.text) || 'メモ';
        const place = values.place === 'right' || values.place === 'left' ? values.place : 'over';
        const who =
          place === 'over'
            ? values.to && values.to !== values.at
              ? `over ${values.at},${values.to}`
              : `over ${values.at}`
            : `${place} of ${values.at}`;
        return {
          code: insertAfterAnchor(code, [`Note ${who}: ${text}`], values.after),
          name: text
        };
      },
      button: 'add.seq.noteButton',
      fields: [
        { key: 'at', kind: 'item', label: 'add.seq.noteAt', source: 'participants' },
        {
          initial: 'over',
          key: 'place',
          kind: 'choice',
          label: 'add.seq.notePlace',
          options: ['over', 'right', 'left']
        },
        {
          key: 'to',
          kind: 'item',
          label: 'add.seq.noteTo',
          optional: true,
          source: 'participants'
        },
        { key: 'text', kind: 'text', label: 'add.f.text' },
        { key: 'after', kind: 'item', label: 'add.f.after', optional: true, source: 'messages' }
      ],
      id: 'note',
      title: 'add.seq.note'
    },
    {
      apply: (code, values) => {
        const kind = values.kind in blockDefaults ? values.kind : 'alt';
        const text = sequenceText(values.text) || blockDefaults[kind];
        const at = values.after ? Number(values.after) : Number.NaN;
        const message = Number.isInteger(at) && messageLine.test(splitLines(code).lines[at] ?? '');
        // Around the chosen message; or empty, after it (or first inside a chosen block).
        return {
          code:
            values.wrap === 'around' && message
              ? wrapMessage(code, at, `${kind} ${text}`)
              : insertAfterAnchor(code, [`${kind} ${text}`, 'end'], values.after),
          name: text
        };
      },
      button: 'add.seq.blockButton',
      fields: [
        {
          initial: 'alt',
          key: 'kind',
          kind: 'choice',
          label: 'add.seq.blockKind',
          options: ['alt', 'loop', 'opt']
        },
        { key: 'text', kind: 'text', label: 'add.seq.blockText', optional: true },
        { key: 'after', kind: 'item', label: 'add.f.after', optional: true, source: 'messages' },
        {
          initial: 'after',
          key: 'wrap',
          kind: 'choice',
          label: 'add.seq.blockWrap',
          options: ['after', 'around']
        }
      ],
      id: 'block',
      title: 'add.seq.block'
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
        if (!values.parent || !lines[parent]) return { error: 'add.chooseParent' };
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
  if (!year || !month || !day) return date;
  // Unix time, in seconds (X) or milliseconds (x).
  if (format === 'X' || format === 'x') {
    const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));
    return String(format === 'X' ? ms / 1000 : ms);
  }
  if (!/^[YMD\-./]+$/.test(format)) return date;
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
        if (!values.column || !lines[column]) return { error: 'add.chooseColumn' };
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
        if (!values.period || !lines[start]) return { error: 'add.choosePeriod' };
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
    new RegExp(`^\\s*(?:\\w*Boundary|Deployment_Node)\\(\\s*${alias}\\s*,`).test(line)
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
