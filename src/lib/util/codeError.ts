/**
 * Local: where a mermaid error is in the code, and what to tell someone who does
 * not read mermaid's grammar errors.
 *
 * mermaid's line numbers count the text it parsed, not the editor's: front
 * matter, `%%` comments and leading blank lines are taken out first, and some
 * parsers add a newline. Its jison parsers (flowchart, sequence, …) also print
 * the 20 characters before the error with the newlines taken out
 * (`...> B[Next]  B -->` over `-----^`), which is what upstream matched against
 * the code by longest common substring — that picked the wrong line whenever
 * the excerpt spanned two lines. Here the excerpt is found in the code with the
 * same lines taken out and the newlines dropped, so the character after it
 * names the line; mermaid's own line number only breaks a tie.
 */
import type { MessageKey } from '$/i18n/messages';

/** The code's lines that mermaid parses, by their line number in the editor (1-based). */
const parsedLines = (code: string): { line: number; text: string }[] => {
  const lines = code.split(/\r?\n/);
  let start = 0;
  if (/^-{3}\s*$/.test(lines[0] ?? '')) {
    const end = lines.findIndex((line, index) => index > 0 && /^-{3}\s*$/.test(line));
    if (end !== -1) start = end + 1;
  }
  const kept: { line: number; text: string }[] = [];
  for (let index = start; index < lines.length; index++) {
    const text = lines[index];
    // `%%` comments and `%%{…}%%` directives are removed before parsing.
    if (/^\s*%%/.test(text)) continue;
    // So are the blank lines before the first statement.
    if (kept.length === 0 && text.trim() === '') continue;
    kept.push({ line: index + 1, text });
  }
  return kept;
};

/** The first line of the code mermaid reads (its header), or undefined when there is none. */
const headerLineNumber = (code: string): number | undefined => parsedLines(code)[0]?.line;

const jisonPattern = /(?:Parse|Lexical) error on line (\d+)[^\n]*\n([^\n]*)\n(-*)\^/;

/** The line of a jison error, from its excerpt. */
const jisonLine = (message: string, code: string): number | undefined => {
  const match = jisonPattern.exec(message);
  if (!match) return undefined;
  const [, reported, excerpt, dashes] = match;
  let before = excerpt.slice(0, dashes.length);
  if (before.startsWith('...')) before = before.slice(3);
  const kept = parsedLines(code);
  if (kept.length === 0) return undefined;
  const lineAt: number[] = [];
  let flat = '';
  for (const { line, text } of kept) {
    flat += text;
    lineAt.push(...Array.from({ length: text.length }, () => line));
  }
  const candidates: number[] = [];
  for (let at = flat.indexOf(before); at !== -1; at = flat.indexOf(before, at + 1)) {
    const end = at + before.length;
    // The error is at the character after the excerpt; at the end, on the last line.
    candidates.push(end < flat.length ? lineAt[end] : lineAt[flat.length - 1]);
  }
  if (candidates.length === 0) return undefined;
  const near = kept[Math.min(Number(reported), kept.length) - 1]?.line ?? candidates[0];
  return candidates.reduce((best, line) =>
    Math.abs(line - near) < Math.abs(best - near) ? line : best
  );
};

/** The line of a langium error (`… on line 3, column 5`), counted from the code's header. */
const langiumLine = (message: string, code: string): number | undefined => {
  const match = /on line (\d+), column \d+/.exec(message);
  if (!match) return undefined;
  const kept = parsedLines(code);
  const header = kept[0]?.line;
  if (header === undefined) return undefined;
  const line = header + Number(match[1]) - 1;
  return Math.min(line, code.split(/\r?\n/).length);
};

/** The line (1-based, as the editor numbers it) a mermaid error is on, or undefined. */
export const errorLineOf = (message: string, code: string): number | undefined => {
  if (/UnknownDiagramError|No diagram type detected/.test(message)) {
    return headerLineNumber(code);
  }
  return jisonLine(message, code) ?? langiumLine(message, code);
};

export interface CodeErrorDescription {
  key: MessageKey;
  line?: number;
  /** The object the message names (a self-nested state). */
  name?: string;
}

// ---- Code mermaid parses but cannot draw without hanging the page ----

export interface RenderHazard {
  line: number;
  name: string;
}

/**
 * A composite state that refers to itself inside its own braces
 * (`state A { A --> B }`): mermaid parses it, then overflows the stack laying it
 * out and leaves the tab unresponsive — and, the code being saved, again on every
 * reload. Such code is reported as a mistake instead of being drawn.
 */
export const renderHazard = (code: string, diagramType?: string): RenderHazard | undefined => {
  // Without the type mermaid detected, the header says (the embed renders unvalidated code).
  const type =
    diagramType ?? (/^\s*stateDiagram/.test(parsedLines(code)[0]?.text ?? '') ? 'state' : '');
  if (!type.startsWith('state')) return undefined;
  const open: string[] = [];
  const lines = code.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (/^\s*%%/.test(line)) continue;
    const composite = /^\s*state\s+(?:"[^"]*"\s+as\s+)?([\p{L}\p{N}_-]+)[^{]*\{\s*$/u.exec(line);
    if (composite) {
      open.push(composite[1]);
      continue;
    }
    if (/^\s*\}\s*$/.test(line)) {
      open.pop();
      continue;
    }
    // What follows a colon is a label or a description, not a state.
    const statement = line.replace(/:.*$/, '');
    for (const name of open) {
      if (new RegExp(`(?<![\\p{L}\\p{N}_-])${name}(?![\\p{L}\\p{N}_-])`, 'u').test(statement)) {
        return { line: index + 1, name };
      }
    }
  }
  return undefined;
};

/** The error message a hazard is reported with (read back by describeCodeError). */
export const hazardMessage = ({ line, name }: RenderHazard): string =>
  `Error: The state "${name}" is used inside itself on line ${line}`;
const hazardPattern = /The state "(.+)" is used inside itself on line (\d+)/;

/** A plain description of a mermaid error: which message, and the line it is on. */
export const describeCodeError = (message: string, code: string): CodeErrorDescription => {
  if (code.trim() === '') return { key: 'recover.empty' };
  const hazard = hazardPattern.exec(message);
  if (hazard) return { key: 'recover.selfNested', line: Number(hazard[2]), name: hazard[1] };
  const line = errorLineOf(message, code);
  if (/UnknownDiagramError|No diagram type detected/.test(message)) {
    return line === undefined ? { key: 'recover.unknown' } : { key: 'recover.noType', line };
  }
  if (line === undefined) return { key: 'recover.unknown' };
  // The line ended where mermaid expected more: an arrow without its target, an open bracket.
  if (/got 'EOF'|got 'NEWLINE'|Expecting[^\n]*but found end of input/.test(message)) {
    return { key: 'recover.unfinished', line };
  }
  return { key: 'recover.atLine', line };
};
