/**
 * Local: small helpers for reading and writing lines of mermaid code, shared by
 * the Add card (addActions.ts), the Edit card (diagramModify.ts, diagramDetails.ts)
 * and the title (diagramTitle.ts). This module imports nothing, so none of those
 * import each other in a circle.
 */

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
// Local (error recovery): a gantt line starting with one of the grammar's words is
// read as that statement (`click …` does not parse, `section …` starts a section),
// so a task or section name that does is put in 「」.
const ganttKeyword =
  /^(?:click|section|title|dateformat|axisformat|tickinterval|excludes|includes|todaymarker|weekday|weekend|inclusiveenddates|topaxis|acctitle|accdescr|displaymode)\b/i;
export const ganttSafe = (name: string) => (ganttKeyword.test(name) ? `「${name}」` : name);
export const indentOf = (line: string) => /^\s*/.exec(line)?.[0].length ?? 0;
export const isContent = (line: string) => line.trim() !== '' && !line.trim().startsWith('%%');

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

/** A requirement-diagram name as mermaid reads it: a word, else in double quotes. */
export const requirementName = (name: string) =>
  /^[A-Za-z_]\w*$/.test(name) ? name : `"${name.replaceAll('"', "'")}"`;
