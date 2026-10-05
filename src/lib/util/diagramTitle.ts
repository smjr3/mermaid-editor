/**
 * Local: the diagram's title as YAML front matter (`---\ntitle: …\n---`), set,
 * changed or removed from the Layout card and written by the new-diagram
 * starters (newDiagram.ts). Front matter is plain mermaid, so a shared link and
 * mermaid.live show the same title. Other front-matter keys (`config:`) stay.
 * Timeline and C4 diagrams draw no front-matter title, so theirs is their own
 * `title …` statement after the header.
 */
import { headerIndex, oneLine } from './addActions';
import { headerLine, splitLines } from './diagramEdit';

// The types whose renderer draws the title, checked in a real render
// (tests/newDiagram.spec.ts). Mindmap, kanban, architecture and block diagrams
// accept the front matter but draw no title, so the Layout card says so instead.
const shownPattern =
  /^\s*(?:flowchart-elk|flowchart|graph|swimlane-beta|sequenceDiagram|stateDiagram(?:-v2)?|classDiagram(?:-v2)?|erDiagram|gantt|pie|timeline|C4(?:Context|Container|Component|Dynamic|Deployment)|requirementDiagram|journey|gitGraph|xychart(?:-beta)?|quadrantChart)\b/;
// The types whose title is a statement of their own.
const statementPattern = /^\s*(?:timeline|C4(?:Context|Container|Component|Dynamic|Deployment))\b/;
const titleStatement = /^(\s*)title\s+(.*?)\s*$/;
// `#` and `;` end the statement in both grammars.
const statementText = (text: string) => oneLine(text).replaceAll('#', '＃');

/** The line of the title statement right after the header, or -1. */
const statementIndex = (lines: string[]) => {
  const header = headerIndex(lines);
  const next = lines.findIndex((line, index) => index > header && line.trim() !== '');
  return next !== -1 && titleStatement.test(lines[next]) ? next : -1;
};

/** Whether mermaid draws a front-matter title for this type of diagram. */
export const titleShown = (code: string): boolean => shownPattern.test(headerLine(code));

/** The front matter's line range (the `---` lines), or undefined when there is none. */
const frontMatter = (lines: string[]): [number, number] | undefined => {
  if (lines[0]?.trim() !== '---') return undefined;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  return end === -1 ? undefined : [0, end];
};

const titleLine = /^title\s*:\s*(.*?)\s*$/;

const unquote = (value: string): string => {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll(/\\(["\\])/g, '$1');
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value.replace(/\s+#.*$/, '');
};

// Double quotes keep `:`, `#` and the like from being read as YAML.
const yamlString = (text: string) => `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

/** The title (front matter, or the statement of timeline and C4), or '' when there is none. */
export const getTitle = (code: string): string => {
  const { lines } = splitLines(code);
  if (statementPattern.test(headerLine(code))) {
    const at = statementIndex(lines);
    return at === -1 ? '' : (titleStatement.exec(lines[at])?.[2] ?? '');
  }
  const range = frontMatter(lines);
  if (!range) return '';
  for (let index = range[0] + 1; index < range[1]; index++) {
    const match = titleLine.exec(lines[index]);
    if (match) return unquote(match[1]);
  }
  return '';
};

/** The code with the title set; an empty title removes it (and front matter left empty). */
export const setTitle = (code: string, title: string): string => {
  const { eol, lines } = splitLines(code);
  const text = title.replaceAll(/\s*[\r\n]+\s*/g, ' ').trim();
  if (statementPattern.test(headerLine(code))) {
    const at = statementIndex(lines);
    const value = statementText(text);
    if (at !== -1 && value)
      lines[at] = `${titleStatement.exec(lines[at])?.[1] ?? '  '}title ${value}`;
    else if (at !== -1) lines.splice(at, 1);
    else if (value) {
      const header = headerIndex(lines);
      const indent = /^\s+/.exec(lines.slice(header + 1).find((line) => line.trim()) ?? '')?.[0];
      lines.splice(header + 1, 0, `${indent ?? '  '}title ${value}`);
    }
    return lines.join(eol);
  }
  const range = frontMatter(lines);
  const statement = `title: ${yamlString(text)}`;
  if (!range) {
    if (!text) return code;
    return ['---', statement, '---', ...lines].join(eol);
  }
  const at = lines.findIndex(
    (line, index) => index > range[0] && index < range[1] && titleLine.test(line)
  );
  if (text) {
    if (at === -1) lines.splice(range[0] + 1, 0, statement);
    else lines[at] = statement;
  } else if (at !== -1) {
    lines.splice(at, 1);
    // Nothing left between the `---` lines: the front matter goes too.
    if (lines.slice(range[0] + 1, range[1] - 1).every((line) => !line.trim())) {
      lines.splice(range[0], range[1]);
    }
  }
  return lines.join(eol);
};
