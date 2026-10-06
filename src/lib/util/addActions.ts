/**
 * Local: the Add card for every other diagram type (AddActions.svelte). Each
 * type lists its actions — add a participant, a message, a state, a task, … —
 * as fields the card renders and a function that writes the mermaid lines.
 * New lines go after the last statement (before trailing style statements),
 * or into the chosen section, column, boundary or parent topic.
 */
import type { MessageKey } from '$/i18n/messages';
import mermaid from 'mermaid';
import {
  addClassMember,
  addEntityAttribute,
  attributeKeys,
  closingBrace,
  ensureTaskId,
  freshTaskId,
  ganttDate,
  ganttName,
  ganttStatuses,
  ganttTasks,
  taskStart,
  taskTags,
  visibilities,
  type Visibility
} from './diagramDetails';
import { headerIndex, indentOf, isContent, oneLine, requirementName } from './codeText';
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
  /** A choice that goes back to `initial` after an add, instead of carrying over to the next one. */
  reset?: boolean;
  initial?: string;
}

export type Values = Record<string, string>;
export type ActionResult =
  { code: string; name: string; follow?: Values; done?: MessageKey } | { error: MessageKey };

export interface Action {
  id: string;
  title: MessageKey;
  button: MessageKey;
  fields: Field[];
  apply: (code: string, values: Values) => ActionResult;
  /** Shown only when this holds for the diagram's parts (default: always). */
  when?: (parts: Record<string, DiagramObject[]>) => boolean;
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

// Sequence diagrams read `#…;` as an entity code and `#` + digits breaks the message.
export const sequenceText = (text: string) => oneLine(text).replaceAll('#', '#35;');
const noQuotes = (text: string) => oneLine(text).replaceAll('"', "'");
const noBrackets = (text: string) => oneLine(text).replaceAll(/[()[\]{}]/g, '');

const need = (values: Values, ...keys: string[]) => keys.every((key) => values[key]);

const item = (id: string, label: string): DiagramObject => ({
  id,
  label: decodeEntities(label) || id
});

// Shared with the Edit card and the title (kept in codeText.ts, which imports nothing).
export { headerIndex, indentOf, oneLine };

// ---- Indentation-based diagrams (mindmap, kanban) ----

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
    // Local: a quoted name keeps its quotes as mermaid's entity (see renameLine).
    .replaceAll('#quot;', '"')
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
        const { lines } = splitLines(code);
        const chosen = values.after ? Number(values.after) : Number.NaN;
        const chosenMessage = Number.isInteger(chosen) && messageLine.test(lines[chosen] ?? '');
        // An empty frame draws as a garbled column in mermaid, so "around" with no message
        // chosen takes the last one (the form's default) rather than writing an empty frame.
        const last = lines.findLastIndex((line) => messageLine.test(line));
        const at = chosenMessage ? chosen : values.after ? Number.NaN : last;
        const around = values.wrap === 'around' && Number.isInteger(at) && at >= 0;
        // Around a message; or empty, after the chosen one (or first inside a chosen block).
        return {
          code: around
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
          initial: 'around',
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

/** The `state … {` line that opens the composite state `id`, or -1. */
export const compositeStart = (lines: string[], id: string) =>
  lines.findIndex((line) =>
    new RegExp(
      `^\\s*state\\s+(?:"[^"]*"\\s+as\\s+)?${id.replaceAll(/[$()*+.?[\\\]^{|}-]/g, String.raw`\$&`)}\\s*\\{\\s*$`
    ).test(line)
  );

/** The code with lines added last inside the composite state `id`, or at the end without one. */
const intoComposite = (code: string, id: string | undefined, added: string[]) => {
  const { eol, lines } = splitLines(code);
  const start = id ? compositeStart(lines, id) : -1;
  const end = start === -1 ? -1 : closingBrace(lines, start);
  if (end === -1)
    return insert(
      code,
      added.map((line) => `  ${line}`)
    );
  const indent = ' '.repeat(indentOf(lines[start]) + 2);
  lines.splice(end, 0, ...added.map((line) => `${indent}${line}`));
  return lines.join(eol);
};

const stateParts = memoByCode(async (code: string) => {
  const plain = await objects(code);
  let composites: DiagramObject[] = [];
  try {
    await mermaid.parse(code);
    const db = (await diagramFromText(code)).db as {
      getData?: () => { nodes?: { id?: unknown; label?: unknown; shape?: unknown }[] };
    };
    composites = (db.getData?.().nodes ?? [])
      .filter(({ id, shape }) => shape === 'roundedWithTitle' && typeof id === 'string')
      .map(({ id, label }) => item(String(id), typeof label === 'string' ? label : String(id)))
      .filter(({ id }) => /^[\w-]+$/.test(id));
  } catch {
    // Not a diagram yet: nothing to choose.
  }
  // The start and end point too, for transitions from and to them.
  return { composites, plain, states: [item('[*]', '[*]'), ...plain, ...composites] };
});

const state: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const id = freshId(code, 's');
        const name = noQuotes(values.name) || id;
        const declared = intoComposite(code, values.parent || undefined, [
          `state "${name}" as ${id}`
        ]);
        const result = values.from
          ? insert(declared, [transition(values.from, id, values.text)])
          : declared;
        return { code: result, follow: { from: id }, name };
      },
      button: 'add.state.stateButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        {
          key: 'parent',
          kind: 'item',
          label: 'add.state.inComposite',
          optional: true,
          source: 'composites'
        },
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
    },
    {
      apply: (code, values) => {
        const id = freshId(code, 'g');
        const name = noQuotes(values.name) || id;
        const inside = values.inside && values.inside !== '[*]' ? values.inside : '';
        const block = (indent: string) => [
          `${indent}state "${name}" as ${id} {`,
          ...(inside ? [`${indent}  ${inside}`] : []),
          `${indent}}`
        ];
        if (!inside) return { code: insert(code, block('  ')), follow: { parent: id }, name };
        // Right after the state's first mention, so a state inside another composite stays in it.
        const { eol, lines } = splitLines(code);
        const word = new RegExp(`(?:^|[^\\p{L}\\p{N}_-])${inside}(?![\\p{L}\\p{N}_-])`, 'u');
        const at = lines.findIndex(
          (line, index) =>
            index > headerIndex(lines) && word.test(line.replaceAll(/"[^"]*"/g, '""'))
        );
        if (at === -1) return { code: insert(code, block('  ')), follow: { parent: id }, name };
        lines.splice(at + 1, 0, ...block(/^\s*/.exec(lines[at])?.[0] ?? '  '));
        return { code: lines.join(eol), follow: { parent: id }, name };
      },
      button: 'add.state.compositeButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        { key: 'inside', kind: 'item', label: 'add.state.inside', optional: true, source: 'plain' }
      ],
      id: 'composite',
      title: 'add.state.composite'
    }
  ],
  header: /^\s*stateDiagram(?:-v2)?\b/,
  kind: 'state',
  parts: stateParts
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
    },
    {
      apply: (code, values) => {
        if (!values.class) return { error: 'add.chooseClass' };
        const kind = values.kind === 'method' ? 'method' : 'attribute';
        const visibility = visibilities.includes(values.visibility as Visibility)
          ? (values.visibility as Visibility)
          : 'public';
        const name = oneLine(values.name) || (kind === 'method' ? 'method' : 'name');
        return {
          code: addClassMember(
            code,
            values.class,
            { args: values.args ?? '', kind, name, type: values.type ?? '', visibility },
            (text, added) => insert(text, added)
          ),
          name
        };
      },
      button: 'add.class.memberButton',
      fields: [
        { key: 'class', kind: 'item', label: 'add.class.ofClass', source: 'classes' },
        {
          initial: 'attribute',
          key: 'kind',
          kind: 'choice',
          label: 'add.class.memberKind',
          options: ['attribute', 'method']
        },
        {
          initial: 'public',
          key: 'visibility',
          kind: 'choice',
          label: 'add.class.visibility',
          options: visibilities
        },
        { key: 'name', kind: 'text', label: 'add.f.name' },
        { key: 'type', kind: 'text', label: 'add.class.type', optional: true },
        { key: 'args', kind: 'text', label: 'add.class.args', optional: true }
      ],
      id: 'member',
      title: 'add.class.member'
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
    },
    {
      apply: (code, values) => {
        if (!values.entity) return { error: 'add.chooseEntity' };
        const attribute = {
          comment: values.comment ?? '',
          key: values.key || 'none',
          name: values.name ?? '',
          type: values.type ?? ''
        };
        return {
          code: addEntityAttribute(code, values.entity, attribute, (text, added) =>
            insert(text, added)
          ),
          name: oneLine(values.name) || 'name'
        };
      },
      button: 'add.er.attributeButton',
      fields: [
        { key: 'entity', kind: 'item', label: 'add.er.ofEntity', source: 'entities' },
        { initial: 'string', key: 'type', kind: 'text', label: 'add.er.type' },
        { key: 'name', kind: 'text', label: 'add.f.name' },
        {
          initial: 'none',
          key: 'key',
          kind: 'choice',
          label: 'add.er.key',
          options: attributeKeys
        },
        { key: 'comment', kind: 'text', label: 'add.er.comment', optional: true }
      ],
      id: 'attribute',
      title: 'add.er.attribute'
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
      title: 'add.mind.topic',
      when: (parts) => (parts.topics ?? []).length > 0
    },
    {
      apply: (code, values) => {
        if (nodeLines(splitLines(code).lines).length > 0) return { error: 'add.mind.hasRoot' };
        const name = noBrackets(values.name) || 'New topic';
        return { code: insert(code, [`  ${name}`]), name };
      },
      button: 'add.mind.rootButton',
      fields: [{ key: 'name', kind: 'text', label: 'add.f.name' }],
      id: 'root',
      title: 'add.mind.root',
      // An empty mindmap has no topic to put the first one under.
      when: (parts) => (parts.topics ?? []).length === 0
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

const sectionLine = /^\s*section\s+(.+?)\s*$/;

const gantt: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const name = ganttName(values.name, '作業');
        const least = values.milestone === 'yes' ? 0 : 1;
        const asked = Math.round(Number(values.days));
        const days = Number.isFinite(asked) && asked >= least ? asked : Math.max(least, 1);
        const { eol, lines } = splitLines(code);
        // `after` gives the chosen task an id if it has none, so `lines` may change.
        let start = taskStart(code, lines, values);
        if (start === null) return { error: 'add.gantt.cannotFollow' };
        // The first task needs a date: mermaid has no task before it to follow.
        if (start === undefined && ganttTasks(lines).length === 0)
          start = ganttDate(code, new Date().toISOString().slice(0, 10));
        // mermaid names a task without an id `task1`, `task2`…, and a chart that already has
        // such an id then draws NaN: give the new task an id of its own, after the last one.
        let id = '';
        const last = ganttTasks(lines).at(-1);
        if (ganttTasks(lines).some((task) => /^task\d+$/.test(task.id))) {
          if (start === undefined && last) {
            const before = ensureTaskId(lines, last.line);
            if (before) start = `after ${before}`;
          }
          if (start) id = freshTaskId(lines);
        }
        const items = [
          ...taskTags(values),
          ...(id ? [id] : []),
          ...(start ? [start] : []),
          `${days}d`
        ];
        const line = `    ${name} : ${items.join(', ')}`;
        const text = lines.join(eol);
        const section = lines.findIndex((row) => sectionLine.exec(row)?.[1] === values.section);
        if (!values.section || section === -1) return { code: insert(text, [line]), name };
        let end = lines.findIndex((row, index) => index > section && sectionLine.test(row));
        if (end === -1) end = lines.length;
        while (end > section + 1 && !lines[end - 1].trim()) end--;
        return { code: insert(text, [line], end), name };
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
        { key: 'after', kind: 'item', label: 'add.gantt.after', optional: true, source: 'tasks' },
        { initial: '3', key: 'days', kind: 'number', label: 'add.gantt.days' },
        {
          initial: 'none',
          key: 'status',
          kind: 'choice',
          label: 'add.gantt.status',
          options: ganttStatuses,
          reset: true
        },
        {
          initial: 'no',
          key: 'crit',
          kind: 'choice',
          label: 'add.gantt.crit',
          options: ['no', 'yes'],
          reset: true
        },
        {
          initial: 'no',
          key: 'milestone',
          kind: 'choice',
          label: 'add.gantt.milestone',
          options: ['no', 'yes'],
          reset: true
        }
      ],
      id: 'task',
      title: 'add.gantt.task'
    },
    {
      apply: (code, values) => {
        const name = ganttName(values.name, 'セクション');
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
        .map((name) => item(name, name)),
      tasks: ganttTasks(splitLines(code).lines).map(({ line, name }) => item(String(line), name))
    })
};

const pie: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const name = noQuotes(values.name) || '項目';
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
    },
    {
      apply: (code, values) => {
        const { eol, lines } = splitLines(code);
        const at = headerIndex(lines);
        const header = lines[at] ?? '';
        const shown = /^\s*pie\s+showData\b/.test(header);
        const wanted = values.showData !== 'off';
        if (shown === wanted) return { error: 'add.pie.noChange' };
        lines[at] = wanted
          ? header.replace(/^(\s*pie)\b/, '$1 showData')
          : header.replace(/^(\s*pie)\s+showData\b/, '$1');
        return {
          code: lines.join(eol),
          done: wanted ? 'add.pie.shownDone' : 'add.pie.hiddenDone',
          name: ''
        };
      },
      button: 'add.pie.displayButton',
      fields: [
        {
          initial: 'on',
          key: 'showData',
          kind: 'choice',
          label: 'add.pie.showData',
          options: ['on', 'off']
        }
      ],
      id: 'display',
      title: 'add.pie.display'
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
    },
    {
      apply: (code, values) => {
        // mermaid rejects an empty boundary, so one is drawn around an element.
        if (!values.element) return { error: 'add.c4.chooseElement' };
        const { eol, lines } = splitLines(code);
        const element = new RegExp(
          `^\\s*(?!(?:Bi)?Rel|Update)\\w+\\(\\s*${values.element.replaceAll(/[$()*+.?[\\\]^{|}-]/g, String.raw`\$&`)}\\s*,`
        );
        const at = lines.findIndex(
          (line, index) => index > headerIndex(lines) && element.test(line) && !/\{\s*$/.test(line)
        );
        if (at === -1) return { error: 'add.c4.chooseElement' };
        const id = freshId(code, 'b');
        const name = noQuotes(values.name) || id;
        const kinds = ['System_Boundary', 'Container_Boundary', 'Enterprise_Boundary', 'Boundary'];
        const kind = kinds.includes(values.kind) ? values.kind : 'System_Boundary';
        const indent = /^\s*/.exec(lines[at])?.[0] ?? '  ';
        lines.splice(
          at,
          1,
          `${indent}${kind}(${id}, "${name}") {`,
          `${indent}  ${lines[at].trim()}`,
          `${indent}}`
        );
        return { code: lines.join(eol), follow: { boundary: id }, name };
      },
      button: 'add.c4.boundaryButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        {
          initial: 'System_Boundary',
          key: 'kind',
          kind: 'choice',
          label: 'add.c4.boundaryKind',
          options: ['System_Boundary', 'Container_Boundary', 'Enterprise_Boundary', 'Boundary']
        },
        { key: 'element', kind: 'item', label: 'add.c4.around', source: 'elements' }
      ],
      id: 'boundary',
      title: 'add.c4.boundaryTitle'
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

const requirementParts = memoByCode(async (code: string) => {
  try {
    await mermaid.parse(code);
    const db = (await diagramFromText(code)).db as {
      getRequirements?: () => Map<string, unknown>;
      getElements?: () => Map<string, unknown>;
    };
    const names = (found: Map<string, unknown> | undefined) =>
      [...(found?.keys() ?? [])].map((name) => item(name, name));
    const requirements = names(db.getRequirements?.());
    const elements = names(db.getElements?.());
    return { elements, items: [...requirements, ...elements], requirements };
  } catch {
    return { elements: [], items: [], requirements: [] };
  }
});

/** A requirement's or element's name: one line, unique in the diagram. */
const freshName = (code: string, typed: string, prefix: string) => {
  const name = noQuotes(typed).replaceAll(/[{}]/g, '');
  const taken = splitLines(code).lines.flatMap((line) => {
    const match =
      /^\s*(?:requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+("[^"]*"|[\w-]+)\s*\{/.exec(
        line
      );
    return match ? [match[1].replace(/^"(.*)"$/, '$1')] : [];
  });
  return name && !taken.includes(name) ? name : freshId(code, prefix);
};
const fieldText = (text: string) => `"${noQuotes(text).replaceAll(/[{}]/g, '')}"`;

const requirement: AddSpec = {
  actions: [
    {
      apply: (code, values) => {
        const name = freshName(code, values.name, 'req');
        const kinds = [
          'requirement',
          'functionalRequirement',
          'interfaceRequirement',
          'performanceRequirement',
          'physicalRequirement',
          'designConstraint'
        ];
        const kind = kinds.includes(values.kind) ? values.kind : 'requirement';
        const id = freshId(code, 'R');
        const body = [
          `    id: ${id}`,
          ...(oneLine(values.text ?? '') ? [`    text: ${fieldText(values.text)}`] : []),
          ...(['low', 'medium', 'high'].includes(values.risk) ? [`    risk: ${values.risk}`] : []),
          ...(['analysis', 'inspection', 'test', 'demonstration'].includes(values.verify)
            ? [`    verifymethod: ${values.verify}`]
            : [])
        ];
        return {
          code: insert(code, [`  ${kind} ${requirementName(name)} {`, ...body, '  }']),
          follow: { to: name },
          name
        };
      },
      button: 'add.req.requirementButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        {
          initial: 'requirement',
          key: 'kind',
          kind: 'choice',
          label: 'add.req.kind',
          options: [
            'requirement',
            'functionalRequirement',
            'interfaceRequirement',
            'performanceRequirement',
            'physicalRequirement',
            'designConstraint'
          ]
        },
        { key: 'text', kind: 'text', label: 'add.req.text', optional: true },
        {
          initial: 'medium',
          key: 'risk',
          kind: 'choice',
          label: 'add.req.risk',
          options: ['low', 'medium', 'high']
        },
        {
          initial: 'test',
          key: 'verify',
          kind: 'choice',
          label: 'add.req.verify',
          options: ['analysis', 'inspection', 'test', 'demonstration']
        }
      ],
      id: 'requirement',
      title: 'add.req.requirement'
    },
    {
      apply: (code, values) => {
        const name = freshName(code, values.name, 'el');
        const type = oneLine(values.type ?? '');
        return {
          code: insert(code, [
            `  element ${requirementName(name)} {`,
            ...(type ? [`    type: ${fieldText(type)}`] : []),
            '  }'
          ]),
          follow: { from: name },
          name
        };
      },
      button: 'add.req.elementButton',
      fields: [
        { key: 'name', kind: 'text', label: 'add.f.name' },
        { key: 'type', kind: 'text', label: 'add.req.type', optional: true }
      ],
      id: 'element',
      title: 'add.req.element'
    },
    {
      apply: (code, values) => {
        if (!need(values, 'from', 'to')) return { error: 'add.choose' };
        const kinds = [
          'satisfies',
          'verifies',
          'refines',
          'traces',
          'contains',
          'copies',
          'derives'
        ];
        const kind = kinds.includes(values.kind) ? values.kind : 'satisfies';
        return {
          code: insert(code, [
            `  ${requirementName(values.from)} - ${kind} -> ${requirementName(values.to)}`
          ]),
          name: `${values.from} → ${values.to}`
        };
      },
      button: 'add.connectButton',
      fields: [
        { key: 'from', kind: 'item', label: 'add.f.from', source: 'items' },
        { key: 'to', kind: 'item', label: 'add.f.to', source: 'items' },
        {
          initial: 'satisfies',
          key: 'kind',
          kind: 'choice',
          label: 'add.req.relation',
          options: ['satisfies', 'verifies', 'refines', 'traces', 'contains', 'copies', 'derives']
        }
      ],
      id: 'relationship',
      title: 'add.req.relationship'
    }
  ],
  header: /^\s*requirementDiagram\b/,
  kind: 'requirement',
  parts: requirementParts
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
  block,
  requirement
];

/** The Add spec for the code's diagram type, from its header line. */
export const specFor = (code: string): AddSpec | undefined => {
  const { lines } = splitLines(code);
  const header = lines[headerIndex(lines)] ?? '';
  return addSpecs.find((spec) => spec.header.test(header));
};

const diagramType = async (code: string) => {
  try {
    return (await mermaid.parse(code)).diagramType;
  } catch {
    return undefined;
  }
};

/**
 * Whether the Add card may write `after` over `before`: mermaid parses it as the
 * same type. Code that did not parse before (an empty `mindmap` has no root yet)
 * may become a diagram of the type its header names.
 */
export const checkAdd = async (before: string, after: string): Promise<boolean> => {
  const [was, is] = await Promise.all([diagramType(before), diagramType(after)]);
  if (is === undefined) return false;
  if (was !== undefined) return was === is;
  const spec = specFor(before);
  return spec !== undefined && specFor(after)?.kind === spec.kind;
};

/** The initial values of an action's fields. */
export const initialValues = (action: Action): Values =>
  Object.fromEntries(action.fields.map((field) => [field.key, field.initial ?? '']));
