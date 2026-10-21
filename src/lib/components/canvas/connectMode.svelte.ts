/**
 * Local: the add bar's 矢印 (InsertBar.svelte) with nothing selected — the next shape
 * clicked becomes the arrow's start, and then `selection.connectFrom` (selection.svelte.ts)
 * waits for the shape to connect to, as "ここから矢印を引く" does. SelectionLayer reads it on
 * a click; the banner over the diagram says which of the two clicks is next. While either
 * click is awaited (`connecting`), InsertBar keeps the add bar with 矢印 pressed instead of
 * switching to the selection's commands, whichever way the arrow was started.
 */
import { cancelConnect, selection, startConnect } from '$/util/selection.svelte';

export const connectMode = $state({ pickingStart: false });

/** Whether an arrow is being drawn: its start or its target is still to be clicked. */
export const connecting = (): boolean => connectMode.pickingStart || !!selection.connectFrom;

/** 矢印: from the selected node if it can be joined from, else from the next one clicked. */
export const beginConnect = (fromSelection: boolean): void => {
  if (fromSelection) {
    connectMode.pickingStart = false;
    startConnect();
    return;
  }
  cancelConnect();
  connectMode.pickingStart = true;
};

export const stopConnect = (): void => {
  connectMode.pickingStart = false;
  cancelConnect();
};
