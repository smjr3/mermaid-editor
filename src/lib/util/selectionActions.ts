/**
 * Local: the selection's own edits — "この後に追加" (a new node joined after the
 * selected one), "ここから矢印" (join it to another) and moving along the arrows —
 * made of the Add card's functions (diagramEdit.ts, addActions.ts) so nothing is
 * written twice. Each returns the new code (and the new object's id where the Add
 * function names it), or undefined where the type has no such edit; the caller
 * checks the result with mermaid before applying it.
 */
import { addSpecs, initialValues, type Values } from './addActions';
import { addArchEdge, addArchService, addEdge, addNode, splitLines } from './diagramEdit';
import {
  flowNodeDetails,
  serviceDetails,
  type EditEdge,
  type EditKind,
  type EditObject
} from './diagramModify';
import type { ColorSyntax } from './colors';

/** Runs an Add card action of the type by its id, with its defaults filled in. */
const runAction = (code: string, kind: EditKind, actionId: string, values: Values) => {
  const action = addSpecs
    .find((spec) => spec.kind === kind)
    ?.actions.find((a) => a.id === actionId);
  if (!action) return undefined;
  const result = action.apply(code, { ...initialValues(action), ...values });
  return 'error' in result ? undefined : result;
};

/** The types whose objects get "この後に追加". */
const addAfterKinds = new Set<EditKind>([
  'flowchart',
  'architecture',
  'state',
  'class',
  'er',
  'c4',
  'block',
  'mindmap',
  'sequence'
]);

/** Whether "この後に追加" applies to this object. */
export const canAddAfter = (
  kind: EditKind | undefined,
  object: EditObject | undefined
): boolean => {
  if (!kind || !object || !addAfterKinds.has(kind)) return false;
  // Sequence notes and blocks have a line; participants do not.
  if (kind === 'sequence') return object.line === undefined;
  // A block group has no text: nothing to join from.
  if (kind === 'block') return !object.group;
  return true;
};

export interface Added {
  code: string;
  /** The new object's id, when the Add function names it. */
  id?: string;
  name: string;
}

/**
 * The code with a new object `label` joined after `object` — inside it instead,
 * when it is a lane, group, composite state or boundary.
 */
export const addAfter = (
  code: string,
  kind: EditKind,
  object: EditObject,
  label: string
): Added | undefined => {
  if (!canAddAfter(kind, object)) return undefined;
  const from = object.group ? undefined : object.id;
  switch (kind) {
    case 'flowchart': {
      const lane = object.group ? object.id : flowNodeDetails(code, object.id).lane || undefined;
      const added = addNode(code, { from, label, lane });
      return { ...added, name: label };
    }
    case 'architecture': {
      const group = object.group ? object.id : serviceDetails(code, object.id)?.group || undefined;
      if (!object.group && !serviceDetails(code, object.id)) return undefined;
      const added = addArchService(code, { arrow: true, from, group, icon: 'server', label });
      return { ...added, name: label };
    }
    case 'state': {
      const result = object.group
        ? runAction(code, kind, 'state', { name: label, parent: object.id })
        : runAction(code, kind, 'state', { from: object.id, name: label });
      return result && { code: result.code, id: result.follow?.from, name: result.name };
    }
    case 'class': {
      const made = runAction(code, kind, 'class', { name: label });
      const id = made?.follow?.from;
      if (!made || !id) return undefined;
      const joined = runAction(made.code, kind, 'relation', { from: object.id, to: id });
      return joined && { code: joined.code, id, name: made.name };
    }
    case 'er': {
      const made = runAction(code, kind, 'entity', { name: label });
      const id = made?.follow?.to;
      if (!made || !id) return undefined;
      const joined = runAction(made.code, kind, 'relationship', { from: object.id, to: id });
      return joined && { code: joined.code, id, name: made.name };
    }
    case 'c4': {
      const result = object.group
        ? runAction(code, kind, 'element', { boundary: object.id, name: label })
        : runAction(code, kind, 'element', { from: object.id, name: label });
      return result && { code: result.code, id: result.follow?.from, name: result.name };
    }
    case 'block': {
      const result = runAction(code, kind, 'block', { from: object.id, name: label });
      return result && { code: result.code, id: result.follow?.from, name: result.name };
    }
    case 'mindmap': {
      // A topic under the selected one; its id (a line) is found by the caller.
      const result = runAction(code, kind, 'topic', { name: label, parent: String(object.line) });
      return result && { code: result.code, name: result.name };
    }
    case 'sequence': {
      const made = runAction(code, kind, 'participant', { name: label });
      const id = made?.follow?.to;
      if (!made || !id) return undefined;
      const message = runAction(made.code, kind, 'message', { from: object.id, to: id });
      return message && { code: message.code, id, name: made.name };
    }
    default:
      return undefined;
  }
};

/** The Add card's "connect" action per type (flowchart and architecture have their own functions). */
const connectActions: Partial<Record<EditKind, string>> = {
  block: 'link',
  c4: 'rel',
  class: 'relation',
  er: 'relationship',
  requirement: 'relationship',
  sequence: 'message',
  state: 'transition'
};

/** Whether "ここから矢印" applies to this object. */
export const canConnect = (kind: EditKind | undefined, object: EditObject | undefined): boolean => {
  if (!kind || !object || object.group) return false;
  if (kind === 'sequence' && object.line !== undefined) return false;
  return kind === 'flowchart' || kind === 'architecture' || kind in connectActions;
};

/** The code with an arrow from one object to another; undefined where the type has none. */
export const connect = (
  code: string,
  kind: EditKind,
  from: string,
  to: string
): string | undefined => {
  if (from === to) return undefined;
  if (kind === 'flowchart') return addEdge(code, { from, to });
  if (kind === 'architecture') return addArchEdge(code, { arrow: true, from, place: 'right', to });
  const action = connectActions[kind];
  return action ? runAction(code, kind, action, { from, to })?.code : undefined;
};

/**
 * Whether turning `edge` round would draw an arrow the diagram already has — the
 * same ends the other way and the same label — leaving two identical arrows.
 */
export const reverseDuplicates = (edges: EditEdge[], edge: EditEdge): boolean =>
  edges.some(
    (other) =>
      other.index !== edge.index &&
      other.from === edge.to &&
      other.to === edge.from &&
      other.label.trim() === edge.label.trim()
  );

/** The node the first arrow out of `id` leads to, or into it comes from. */
export const neighbour = (
  edges: EditEdge[],
  id: string,
  direction: 'next' | 'previous'
): string | undefined =>
  direction === 'next'
    ? edges.find(({ from }) => from === id)?.to
    : edges.find(({ to }) => to === id)?.from;

/**
 * Where a branch beside the selected object comes from: the object its first
 * incoming arrow starts at (a mindmap topic's parent), else the object itself.
 */
export const branchSource = (
  code: string,
  kind: EditKind,
  objects: EditObject[],
  edges: EditEdge[],
  object: EditObject
): EditObject => {
  if (kind === 'mindmap' && object.line !== undefined) {
    const { lines } = splitLines(code);
    const depth = (line: number) => /^(\s*)/.exec(lines[line] ?? '')?.[1].length ?? 0;
    const own = depth(object.line);
    const parent = objects
      .filter(({ line }) => line !== undefined && line < (object.line ?? 0) && depth(line) < own)
      .at(-1);
    return parent ?? object;
  }
  const source = neighbour(edges, object.id, 'previous');
  return objects.find(({ id }) => id === source) ?? object;
};

/**
 * How the selected object's colour is written (colors.ts), or undefined where the
 * type has no per-object colour: the Colours card's objects, plus flowchart lanes.
 */
export const colorSyntaxFor = (
  kind: EditKind | undefined,
  object: EditObject | undefined,
  colourable: string[]
): ColorSyntax | undefined => {
  if (!kind || !object) return undefined;
  if (!colourable.includes(object.id) && !(kind === 'flowchart' && object.group)) return undefined;
  if (kind === 'class') return 'class';
  if (kind === 'c4') return 'c4';
  return 'style';
};

/** The object the code gained, comparing the lists before and after (for ids no Add function names). */
export const addedObject = (
  before: EditObject[],
  after: EditObject[],
  name: string
): EditObject | undefined => {
  const seen = new Set(before.map(({ id, label }) => `${id}\n${label.trim()}`));
  const fresh = after.filter(({ id, label }) => !seen.has(`${id}\n${label.trim()}`));
  return (
    fresh.find(({ label }) => label.trim() === name.trim()) ??
    (fresh.length === 1 ? fresh[0] : undefined)
  );
};

/** The Add card's first "new object" action per type, for "図形を追加" on the empty canvas. */
const standaloneActions: Partial<Record<EditKind, [string, string]>> = {
  block: ['block', 'from'],
  c4: ['element', 'from'],
  class: ['class', 'from'],
  er: ['entity', 'to'],
  sequence: ['participant', 'to'],
  state: ['state', 'from']
};

/** The code with a new object that is joined to nothing; undefined where the type has none. */
export const addStandalone = (
  code: string,
  kind: EditKind | undefined,
  objects: EditObject[],
  label: string
): Added | undefined => {
  if (!kind) return undefined;
  if (kind === 'flowchart') return { ...addNode(code, { label }), name: label };
  if (kind === 'architecture') {
    return { ...addArchService(code, { icon: 'server', label }), name: label };
  }
  if (kind === 'mindmap') {
    const root = objects[0];
    const result = root
      ? runAction(code, kind, 'topic', { name: label, parent: String(root.line) })
      : runAction(code, kind, 'root', { name: label });
    return result && { code: result.code, name: result.name };
  }
  const [action, key] = standaloneActions[kind] ?? [];
  if (!action || !key) return undefined;
  const result = runAction(code, kind, action, { name: label });
  return result && { code: result.code, id: result.follow?.[key], name: result.name };
};
