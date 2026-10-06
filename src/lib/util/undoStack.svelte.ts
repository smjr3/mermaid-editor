import { updateCode } from './state.svelte';

/**
 * Local: the undo / redo buttons in the editor header (UndoRedoButtons.svelte).
 *
 * A history of the diagram code as it passes through the input state, so one
 * undo works the same for Monaco (desktop), CodeMirror (mobile) and the cards
 * that rewrite the code (Add, Colours, Layout) — none of which share an undo
 * stack of their own. Rapid changes (typing) settle into one entry after a
 * pause; applying an entry goes through `apply` and is not recorded, because
 * it is the entry the history already stands on.
 */
export interface CodeHistoryOptions {
  /** Puts an entry back into the input state. */
  apply: (code: string) => void;
  /** Pause after which pending changes become an entry (ms). */
  delay?: number;
  /** Entries kept; the oldest are forgotten. */
  limit?: number;
}

export const createCodeHistory = ({ apply, delay = 500, limit = 100 }: CodeHistoryOptions) => {
  // entries[index] is the code the history stands on.
  let entries = $state.raw<string[]>([]);
  let index = $state(-1);
  // The latest code not yet committed; a new entry once typing pauses.
  let pending = $state.raw<string | undefined>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearPending = () => {
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };

  const commit = (code: string) => {
    clearPending();
    if (index >= 0 && entries[index] === code) {
      return;
    }
    const next = [...entries.slice(0, index + 1), code];
    const overflow = Math.max(0, next.length - limit);
    entries = next.slice(overflow);
    index = entries.length - 1;
  };

  const flush = () => {
    if (pending !== undefined) {
      commit(pending);
    }
  };

  const step = (offset: number) => {
    flush();
    const target = index + offset;
    if (target < 0 || target >= entries.length) {
      return;
    }
    index = target;
    apply(entries[index]);
  };

  return {
    get canRedo() {
      return pending === undefined && index < entries.length - 1;
    },
    get canUndo() {
      return index > 0 || pending !== undefined;
    },
    /**
     * Called with the input state's code whenever it changes. `immediate` marks a
     * change made in one go by a tool (a card, the selection toolbar, the table):
     * it becomes its own step at once, after any typing still pending, so two tool
     * edits in quick succession are undone one at a time.
     */
    record(code: string, { immediate = false }: { immediate?: boolean } = {}) {
      if (index < 0) {
        commit(code);
        return;
      }
      if (immediate) {
        flush();
        commit(code);
        return;
      }
      if (entries[index] === code) {
        clearPending();
        return;
      }
      pending = code;
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    redo: () => step(1),
    /** Forgets everything; `code` becomes the only entry (after a load). */
    reset(code: string) {
      clearPending();
      entries = [code];
      index = 0;
    },
    undo: () => step(-1)
  };
};

export const codeHistory = createCodeHistory({
  apply: (code) => updateCode(code, { updateDiagram: true })
});
