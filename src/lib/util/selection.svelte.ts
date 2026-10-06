/**
 * Local: the one thing selected in the diagram — an object (node, state, class,
 * participant, service, topic, …) by its Edit-card id, or an arrow by its position
 * in the Edit card's list (diagramModify.ts). The mini toolbar over the diagram, the
 * "選択中" panel in the tools pane, the right-click menu and the keyboard all act on
 * it, through the same edit functions as the Edit and Colours cards.
 *
 * `connectFrom` is set while "ここから矢印" waits for the node to connect to;
 * `renaming` is true while the inline rename of the selection is open (F2, a double
 * click, a new node); the mini toolbar shows its field while it is set.
 */

export type Selected = { type: 'node'; id: string } | { type: 'edge'; index: number };

export const selection = $state<{
  current: Selected | undefined;
  connectFrom: string | undefined;
  renaming: boolean;
  /** Counts the times the rename opened, so the field starts afresh each time. */
  renameSession: number;
}>({ connectFrom: undefined, current: undefined, renameSession: 0, renaming: false });

export const sameSelection = (a: Selected | undefined, b: Selected | undefined): boolean =>
  a?.type === b?.type &&
  (a?.type === 'node'
    ? a.id === (b as { id: string }).id
    : a?.type === 'edge'
      ? a.index === (b as { index: number }).index
      : true);

/**
 * Selects `next`. Another selection closes the inline rename, unless `keepRename`: a
 * node just added has its rename open before it exists (selectionModel's `added`).
 */
export const select = (
  next: Selected | undefined,
  { keepRename = false }: { keepRename?: boolean } = {}
): void => {
  if (!sameSelection(selection.current, next)) {
    selection.current = next;
    if (!keepRename) selection.renaming = false;
  }
  selection.connectFrom = undefined;
};

export const clearSelection = (): void => select(undefined);

/** Opens the inline rename of the selection (F2, double click, the menu). */
export const requestRename = (): void => {
  if (!selection.current || selection.renaming) return;
  selection.renaming = true;
  selection.renameSession += 1;
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
