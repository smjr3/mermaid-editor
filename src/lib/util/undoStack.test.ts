import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCodeHistory } from './undoStack.svelte';

// The store only remembers code; applying an entry is the caller's job
// (undoStack.svelte.ts wires the default instance to updateCode).
describe('codeHistory', () => {
  const apply = vi.fn<(code: string) => void>();
  let history: ReturnType<typeof createCodeHistory>;

  beforeEach(() => {
    vi.useFakeTimers();
    apply.mockClear();
    history = createCodeHistory({ apply, delay: 500, limit: 5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with nothing to undo or redo', () => {
    history.record('a');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    history.undo();
    history.redo();
    expect(apply).not.toHaveBeenCalled();
  });

  it('undoes and redoes a change, applying the code it goes back to', () => {
    history.record('a');
    history.record('b');
    vi.advanceTimersByTime(500);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    history.undo();
    expect(apply).toHaveBeenLastCalledWith('a');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
    // The applied code comes back through record(): it is where we are, not a new entry.
    history.record('a');
    expect(history.canRedo).toBe(true);

    history.redo();
    expect(apply).toHaveBeenLastCalledWith('b');
    history.record('b');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('keeps each tool edit as its own step, however quickly they follow', () => {
    // A colour then bold from the mini toolbar, 100 ms apart: two steps, not one.
    history.record('a');
    history.record('a+colour', { immediate: true });
    vi.advanceTimersByTime(100);
    history.record('a+colour+bold', { immediate: true });
    expect(history.canRedo).toBe(false);
    history.undo();
    expect(apply).toHaveBeenLastCalledWith('a+colour');
    history.record('a+colour');
    history.undo();
    expect(apply).toHaveBeenLastCalledWith('a');
  });

  it('closes pending typing before a tool edit', () => {
    history.record('a');
    history.record('ab');
    history.record('ab+tool', { immediate: true });
    history.undo();
    expect(apply).toHaveBeenLastCalledWith('ab');
    history.record('ab');
    history.undo();
    expect(apply).toHaveBeenLastCalledWith('a');
  });

  it('coalesces rapid changes into one entry', () => {
    history.record('a');
    history.record('ab');
    vi.advanceTimersByTime(200);
    history.record('abc');
    vi.advanceTimersByTime(200);
    history.record('abcd');
    vi.advanceTimersByTime(500);

    history.undo();
    expect(apply).toHaveBeenLastCalledWith('a');
    expect(history.canUndo).toBe(false);
  });

  it('undoes typing that has not settled yet, as one step', () => {
    history.record('a');
    history.record('ab');
    expect(history.canUndo).toBe(true);
    history.undo();
    expect(apply).toHaveBeenLastCalledWith('a');
    history.redo();
    expect(apply).toHaveBeenLastCalledWith('ab');
  });

  it('drops the redo entries once a new change is made', () => {
    history.record('a');
    history.record('b');
    vi.advanceTimersByTime(500);
    history.undo();
    history.record('a');
    history.record('c');
    expect(history.canRedo).toBe(false);
    vi.advanceTimersByTime(500);
    expect(history.canRedo).toBe(false);
    history.undo();
    expect(apply).toHaveBeenLastCalledWith('a');
    history.redo();
    expect(apply).toHaveBeenLastCalledWith('c');
  });

  it('keeps at most `limit` entries, forgetting the oldest', () => {
    for (const code of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      history.record(code);
      vi.advanceTimersByTime(500);
    }
    let steps = 0;
    while (history.canUndo) {
      history.undo();
      steps++;
    }
    expect(steps).toBe(4);
    expect(apply).toHaveBeenLastCalledWith('c');
  });

  it('reset makes the given code the only entry', () => {
    history.record('a');
    history.record('b');
    history.reset('z');
    vi.advanceTimersByTime(500);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    history.record('z');
    expect(history.canUndo).toBe(false);
    history.record('y');
    vi.advanceTimersByTime(500);
    history.undo();
    expect(apply).toHaveBeenLastCalledWith('z');
  });

  it('ignores a value equal to the current entry', () => {
    history.record('a');
    history.record('b');
    history.record('a');
    vi.advanceTimersByTime(500);
    expect(history.canUndo).toBe(false);
  });
});
