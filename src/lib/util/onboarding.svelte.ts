import { C } from '$/constants';
import { readJSON, writeJSON } from './persist.svelte';

/**
 * Local: the state of the first-visit guide (GuideTour.svelte). `done` is kept
 * in localStorage, so closing the guide once means it never opens by itself again;
 * "show it again" in the How to use dialog calls `startGuide`.
 */
export const guide = $state({ open: false, step: 0 });

export const hasSeenGuide = (): boolean => readJSON<boolean>(C.guideDoneKey, false) === true;

export const startGuide = (): void => {
  guide.step = 0;
  guide.open = true;
};

/** Closes the guide for good (until it is started again by hand). */
export const finishGuide = (): void => {
  guide.open = false;
  try {
    writeJSON(C.guideDoneKey, true);
  } catch {
    // Storage can be blocked; the guide then shows again next visit, which is harmless.
  }
};
