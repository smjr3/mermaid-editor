/**
 * Local: what the add bar over the diagram (canvas/InsertBar.svelte) adds to a flowchart
 * or swimlane diagram with one click — a shape (処理, 分岐, 開始・終了, …) or a lane — as
 * an `Added` result that `selectionModel.insert` applies, selects and opens the rename of.
 *
 * A shape is joined from the selected node (and goes into that node's lane), goes into
 * the selected lane or group, or stands alone when nothing (or an arrow) is selected.
 * The writing itself is the Add card's (diagramEdit.ts), so nothing is written twice.
 */
import { headerIndex, isContent } from './codeText';
import { addLane, addNode, splitLines, type NodeShape } from './diagramEdit';
import { flowNodeDetails, type EditKind, type EditObject } from './diagramModify';
import type { Added } from './selectionActions';

/** The shapes the add bar offers: three on the bar, the other two under その他. */
export const barShapes: NodeShape[] = ['rect', 'diamond', 'stadium'];
export const moreShapes: NodeShape[] = ['rounded', 'circle'];

/** Where a shape added now goes, for the selection `selected` (a flowchart object). */
export type InsertPlace =
  { kind: 'after'; from: string; lane?: string } | { kind: 'in'; lane: string } | { kind: 'alone' };

export const insertPlace = (code: string, selected: EditObject | undefined): InsertPlace => {
  if (!selected) return { kind: 'alone' };
  if (selected.group) return { kind: 'in', lane: selected.id };
  const lane = flowNodeDetails(code, selected.id).lane || undefined;
  return { from: selected.id, kind: 'after', ...(lane ? { lane } : {}) };
};

/** A new shape `label`, joined from or put into the selection (see `insertPlace`). */
export const insertShape = (
  code: string,
  shape: NodeShape,
  label: string,
  selected?: EditObject
): Added => {
  const place = insertPlace(code, selected);
  const added =
    place.kind === 'after'
      ? addNode(code, { from: place.from, label, lane: place.lane, shape })
      : place.kind === 'in'
        ? addNode(code, { label, lane: place.lane, shape })
        : addNode(code, { label, shape });
  return { ...added, name: label };
};

const escapeRegExp = (text: string) => text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);

/**
 * Whether the object is a decision — a flowchart diamond (`{…}`, `@{ shape: diamond }` and
 * mermaid's other names for it) or a state diagram's `<<choice>>` — so that ＋分岐 adds
 * one more way out of it instead of a node beside it (selectionActions' `branchSource`).
 */
export const isDecision = (
  code: string,
  kind: EditKind | undefined,
  object: EditObject | undefined
): boolean => {
  if (!object || object.group) return false;
  if (kind === 'flowchart') return flowNodeDetails(code, object.id).shapeName === 'diam';
  if (kind === 'state') {
    const choice = new RegExp(
      String.raw`^\s*state\s+${escapeRegExp(object.id)}\s*<<choice>>\s*$`,
      'm'
    );
    return choice.test(code);
  }
  return false;
};

/** A new, empty lane (a `subgraph`: a lane in a swimlane diagram, a group in a flowchart). */
export const insertLane = (code: string, label: string): Added => ({
  ...addLane(code, label),
  name: label
});

/**
 * Whether the code is only its header (`mindmap`, `kanban`, …). Some types do not parse
 * until their first item is there, so the add bar stays open for them while the code
 * counts as broken: adding that first item is the way to a diagram (addActions' checkAdd).
 */
export const headerOnly = (code: string): boolean => {
  const { lines } = splitLines(code);
  const header = headerIndex(lines);
  return header < lines.length && !lines.slice(header + 1).some(isContent);
};
