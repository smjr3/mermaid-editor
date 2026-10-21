/**
 * Local: what is selected in the diagram — objects (node, state, class, participant,
 * service, topic, …) by their Edit-card id, or arrows by their position in the Edit
 * card's list (diagramModify.ts). The inspector beside the diagram, the add bar, the
 * right-click menu and the keyboard all act on it, through the same edit functions as
 * the Edit and Colours cards.
 *
 * The selection holds several items (`items`, in the order they were chosen). `current`
 * is the primary one — the last chosen — so every reader of a single selection keeps
 * working: it is always `items.at(-1)`. A plain click replaces the list (`select`);
 * Ctrl/⌘+click adds or removes one (`toggleSelect`); a rubber band or 「同じものを選ぶ」
 * replaces it with many (`selectMany`).
 *
 * `connectFrom` is set while "ここから矢印" waits for the node to connect to;
 * `renaming` is true while the inline rename of the selection is open (F2, a double
 * click, a new node); the inspector shows its field while it is set.
 * `revealSession` counts the requests to bring the selection into view once it is
 * drawn (a node just added, which may land outside the visible canvas).
 */

export type Selected = { type: 'node'; id: string } | { type: 'edge'; index: number };

export const selection = $state<{
  /** The primary selection: the item chosen last, `items.at(-1)`. */
  current: Selected | undefined;
  /** Everything selected, in the order it was chosen. */
  items: Selected[];
  connectFrom: string | undefined;
  renaming: boolean;
  /** Counts the times the rename opened, so the field starts afresh each time. */
  renameSession: number;
  /** Counts the requests to scroll the selection into view (SelectionLayer). */
  revealSession: number;
}>({
  connectFrom: undefined,
  current: undefined,
  items: [],
  renameSession: 0,
  renaming: false,
  revealSession: 0
});

export const sameSelection = (a: Selected | undefined, b: Selected | undefined): boolean =>
  a?.type === b?.type &&
  (a?.type === 'node'
    ? a.id === (b as { id: string }).id
    : a?.type === 'edge'
      ? a.index === (b as { index: number }).index
      : true);

/** A key that names a selection (for maps and `data-selected`). */
export const selectionKey = (selected: Selected): string =>
  selected.type === 'node' ? selected.id : `edge-${selected.index}`;

/** Whether `sel` is one of the selected items. */
export const isSelected = (sel: Selected | undefined): boolean =>
  !!sel && selection.items.some((item) => sameSelection(item, sel));

export const selectionCount = (): number => selection.items.length;

/** Whether two lists hold the same items in the same order. */
const sameItems = (a: Selected[], b: Selected[]) =>
  a.length === b.length && a.every((item, index) => sameSelection(item, b[index]));

/** Writes the list; `current` follows its last item. */
const setItems = (items: Selected[], keepRename: boolean) => {
  if (sameItems(selection.items, items)) {
    selection.connectFrom = undefined;
    return;
  }
  const previous = selection.current;
  selection.items = items;
  const next = items.at(-1);
  // The same primary (an item added beside it) keeps its identity for `$effect`s on it.
  if (!sameSelection(previous, next)) selection.current = next;
  if (!keepRename && !sameSelection(previous, next)) selection.renaming = false;
  selection.connectFrom = undefined;
};

/**
 * Selects `next` alone (a plain click). Another selection closes the inline rename,
 * unless `keepRename`: a node just added has its rename open before it exists
 * (selectionModel's `added`).
 */
export const select = (
  next: Selected | undefined,
  { keepRename = false }: { keepRename?: boolean } = {}
): void => {
  setItems(next ? [next] : [], keepRename);
};

/** Replaces the selection with `list` (a rubber band, 「同じものを選ぶ」); duplicates are dropped. */
export const selectMany = (list: Selected[]): void => {
  const items: Selected[] = [];
  for (const item of list) if (!items.some((seen) => sameSelection(seen, item))) items.push(item);
  setItems(items, false);
};

/**
 * Ctrl/⌘+click: adds `next` to the selection (it becomes the primary), or takes it out
 * when it is already selected (the primary becomes the last one left).
 */
export const toggleSelect = (next: Selected): void => {
  const without = selection.items.filter((item) => !sameSelection(item, next));
  setItems(without.length === selection.items.length ? [...without, next] : without, false);
};

export const clearSelection = (): void => select(undefined);

/** Opens the inline rename of the selection (F2, double click, the menu). */
export const requestRename = (): void => {
  if (!selection.current || selection.renaming) return;
  selection.renaming = true;
  selection.renameSession += 1;
};

/** Brings the selection into view once it is drawn (a node just added). */
export const requestReveal = (): void => {
  selection.revealSession += 1;
};

/** "ここから矢印": the next node clicked is joined from the selected one. */
export const startConnect = (): void => {
  const current = selection.current;
  selection.connectFrom = current?.type === 'node' ? current.id : undefined;
};

/** Closes the inline rename. */
export const endRename = (): void => {
  selection.renaming = false;
};

export const cancelConnect = (): void => {
  selection.connectFrom = undefined;
};
