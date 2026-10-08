import { t } from '$/i18n';
import type * as Monaco from 'monaco-editor';

/**
 * Rename an identifier — a node, participant, state or class id — everywhere
 * it is used in a diagram, without touching text that only happens to contain
 * the same word: labels, edge text, messages, comments, strings, front matter.
 *
 * Mermaid has a grammar per diagram type, so this is a lexical scan with
 * rules that hold across the common types rather than a parser:
 *
 * - `%%` starts a comment; `"…"` is a string; a leading `---` block is front matter.
 * - A bracket opened right after an identifier or another bracket (`A[…]`,
 *   `B{…}`, `db(…)[…]`, `A@{…}`) or at the end of a line (`class Foo {`) is
 *   label or body text until it closes, across lines.
 * - `|…|` is edge text.
 * - A colon followed by a space or the line end starts label text for the rest
 *   of the line (`Alice->>Bob: Hi`, `s1 : desc`). An unspaced colon is syntax
 *   (`db:R -- L:api` in architecture, `A:::cls`).
 */

export interface Occurrence {
  /** 1-based line. */
  line: number;
  /** 1-based column of the first character. */
  start: number;
  /** 1-based column just past the last character. */
  end: number;
}

const identifierChar = /[\p{L}\p{N}_]/u;
const identifierPattern = /^[\p{L}\p{N}_]+$/u;

// Words a rename must neither start from nor produce: diagram keywords that
// would change the meaning of the line they land on. Compared case-insensitively.
const keywords = new Set(
  [
    'graph',
    'flowchart',
    'subgraph',
    'end',
    'direction',
    'tb',
    'td',
    'bt',
    'rl',
    'lr',
    'classdef',
    'class',
    'style',
    'linkstyle',
    'click',
    'call',
    'href',
    'sequencediagram',
    'participant',
    'actor',
    'as',
    'note',
    'over',
    'left',
    'right',
    'of',
    'loop',
    'alt',
    'else',
    'opt',
    'par',
    'and',
    'rect',
    'critical',
    'break',
    'activate',
    'deactivate',
    'autonumber',
    'box',
    'statediagram',
    'state',
    'classdiagram',
    'erdiagram',
    'gantt',
    'pie',
    'title',
    'section',
    'dateformat',
    'group',
    'service',
    'junction',
    'in',
    'mindmap',
    'timeline',
    'journey',
    'gitgraph',
    'commit',
    'branch',
    'checkout',
    'merge',
    'accTitle',
    'accDescr'
  ].map((word) => word.toLowerCase())
);

const isIdentifierChar = (char: string | undefined): boolean =>
  char !== undefined && identifierChar.test(char);

// Plain numbers are values (coordinates, sizes, data), not names.
export const isValidIdentifier = (name: string): boolean =>
  identifierPattern.test(name) && !/^\p{N}+$/u.test(name) && !keywords.has(name.toLowerCase());

/** The identifier at a 1-based Monaco column (the character after or before the cursor). */
export const identifierAt = (
  line: string,
  column: number
): { name: string; start: number; end: number } | undefined => {
  let index = column - 1;
  if (!isIdentifierChar(line[index])) {
    index -= 1;
  }
  if (!isIdentifierChar(line[index])) {
    return undefined;
  }
  let start = index;
  while (isIdentifierChar(line[start - 1])) start--;
  let end = index + 1;
  while (isIdentifierChar(line[end])) end++;
  return { end: end + 1, name: line.slice(start, end), start: start + 1 };
};

const openers: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const closers = new Set([')', ']', '}']);

/** Every place `name` is used as an identifier, in document order. */
export const findOccurrences = (code: string, name: string): Occurrence[] => {
  const occurrences: Occurrence[] = [];
  const lines = code.split('\n');
  // Bracketed label or body text may span lines (class and entity bodies).
  const stack: string[] = [];
  let lineIndex = 0;

  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex((text, i) => i > 0 && text.trim() === '---');
    lineIndex = close === -1 ? lines.length : close + 1;
  }

  for (; lineIndex < lines.length; lineIndex++) {
    const text = lines[lineIndex];
    let i = 0;
    while (i < text.length) {
      const char = text[i];

      if (stack.length > 0) {
        if (char === '"') {
          const close = text.indexOf('"', i + 1);
          i = close === -1 ? text.length : close + 1;
          continue;
        }
        if (char in openers) stack.push(openers[char]);
        else if (char === stack.at(-1)) stack.pop();
        i++;
        continue;
      }

      if (text.startsWith('%%', i)) break;
      if (char === '"') {
        const close = text.indexOf('"', i + 1);
        i = close === -1 ? text.length : close + 1;
        continue;
      }
      if (char === '|') {
        const close = text.indexOf('|', i + 1);
        i = close === -1 ? text.length : close + 1;
        continue;
      }
      if (text.startsWith(':::', i)) {
        i += 3;
        continue;
      }
      if (char === ':' && (i + 1 >= text.length || /\s/.test(text[i + 1]))) break;
      if (char in openers) {
        const before = text[i - 1];
        const afterIdentifier = isIdentifierChar(before) || closers.has(before ?? '');
        // `o{` in an ER cardinality (`||--o{`) is syntax, not a label.
        const erCardinality = before === 'o' && /[-.]/.test(text[i - 2] ?? '');
        const opensBlock = text.slice(i + 1).trim() === '';
        if ((afterIdentifier && !erCardinality) || before === '@' || opensBlock) {
          stack.push(openers[char]);
        }
        i++;
        continue;
      }
      if (char === '>' && isIdentifierChar(text[i - 1])) {
        // Asymmetric shape: `A>label]`.
        stack.push(']');
        i++;
        continue;
      }
      if (isIdentifierChar(char)) {
        let end = i + 1;
        while (isIdentifierChar(text[end])) end++;
        if (text.slice(i, end) === name) {
          occurrences.push({ end: end + 1, line: lineIndex + 1, start: i + 1 });
        }
        i = end;
        continue;
      }
      i++;
    }
  }
  return occurrences;
};

/** `code` with every identifier occurrence of `from` replaced by `to`. */
export const renameIn = (code: string, from: string, to: string): string => {
  const lines = code.split('\n');
  // Right to left, so earlier columns on a line stay valid.
  for (const { line, start, end } of findOccurrences(code, from).reverse()) {
    const text = lines[line - 1];
    lines[line - 1] = text.slice(0, start - 1) + to + text.slice(end - 1);
  }
  return lines.join('\n');
};

/** The ids of a diagram's objects from mermaid's parse (diagramIds.ts), or undefined. */
export type IdReader = (code: string) => Promise<ReadonlySet<string> | undefined>;

/**
 * A rename checked against mermaid itself: the lexical scan above cannot know
 * every grammar (C4's `Rel`, xychart's `axis`, architecture's `R`/`L`/`T`/`B`
 * sides, which also forbid ids starting with those capitals), so a rename is
 * only applied when the result still parses as the same diagram type.
 *
 * Local (R02): nor may it land on an id another object already has — mermaid
 * merges the two without an error (`B[Alpha] --> B[Beta]` is one node). With
 * `ids` the objects come from mermaid's parse, so a label with the same text is
 * not a collision; for a type it cannot read, any identifier use of the new name is.
 */
export const checkedRename = async (
  code: string,
  from: string,
  to: string,
  parse: (code: string) => Promise<string | undefined>,
  ids?: IdReader
): Promise<{ code: string } | { reason: 'invalid' | 'breaks' | 'taken' }> => {
  if (!isValidIdentifier(to)) return { reason: 'invalid' };
  if (to === from) return { code };
  const known = await ids?.(code);
  if (known ? known.has(to) : findOccurrences(code, to).length > 0) return { reason: 'taken' };
  const renamed = renameIn(code, from, to);
  try {
    const [before, after] = await Promise.all([parse(code), parse(renamed)]);
    if (before !== after) return { reason: 'breaks' };
  } catch {
    return { reason: 'breaks' };
  }
  // Fewer objects afterwards means two were joined under one id all the same.
  const after = known && (await ids?.(renamed));
  return after && after.size < known.size ? { reason: 'taken' } : { code: renamed };
};

let registered = false;

const rejections = {
  breaks: 'editor.renameBreaks',
  invalid: 'editor.renameInvalid',
  taken: 'editor.renameTaken'
} as const;

/**
 * F2 / "Rename Symbol" in the Monaco editor for the `mermaid` language.
 * `parse` returns the diagram type (mermaid.parse), for checkedRename.
 */
export const registerMermaidRename = (
  monaco: typeof Monaco,
  parse: (code: string) => Promise<string | undefined>,
  ids?: IdReader,
  // Local: the standalone editor only logs a refused rename to the console.
  onReject?: (message: string) => void
): void => {
  if (registered) return;
  registered = true;

  const target = (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
    const found = identifierAt(model.getLineContent(position.lineNumber), position.column);
    if (!found || keywords.has(found.name.toLowerCase())) return undefined;
    const isUse = findOccurrences(model.getValue(), found.name).some(
      ({ line, start }) => line === position.lineNumber && start === found.start
    );
    return isUse ? found : undefined;
  };

  monaco.languages.registerRenameProvider('mermaid', {
    async provideRenameEdits(model, position, newName) {
      const found = target(model, position);
      if (!found) return { edits: [], rejectReason: t('editor.renameNotName') };
      const versionId = model.getVersionId();
      const code = model.getValue();
      const result = await checkedRename(code, found.name, newName, parse, ids);
      if ('reason' in result) {
        const rejectReason = t(rejections[result.reason], { name: newName });
        onReject?.(rejectReason);
        return { edits: [], rejectReason };
      }
      return {
        edits: findOccurrences(code, found.name).map(({ line, start, end }) => ({
          resource: model.uri,
          textEdit: { range: new monaco.Range(line, start, line, end), text: newName },
          versionId
        }))
      };
    },
    resolveRenameLocation(model, position) {
      const found = target(model, position);
      if (!found) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          rejectReason: t('editor.renameNotName'),
          text: ''
        };
      }
      return {
        range: new monaco.Range(position.lineNumber, found.start, position.lineNumber, found.end),
        text: found.name
      };
    }
  });
};
