import { beforeEach, describe, expect, it } from 'vitest';
import {
  cancelConnect,
  clearSelection,
  endRename,
  requestRename,
  sameSelection,
  select,
  selection,
  startConnect
} from './selection.svelte';

describe('selection', () => {
  beforeEach(() => clearSelection());

  it('holds one node or one edge', () => {
    select({ id: 'A', type: 'node' });
    expect(selection.current).toEqual({ id: 'A', type: 'node' });
    select({ index: 2, type: 'edge' });
    expect(selection.current).toEqual({ index: 2, type: 'edge' });
    clearSelection();
    expect(selection.current).toBeUndefined();
  });

  it('compares selections', () => {
    expect(sameSelection({ id: 'A', type: 'node' }, { id: 'A', type: 'node' })).toBe(true);
    expect(sameSelection({ id: 'A', type: 'node' }, { id: 'B', type: 'node' })).toBe(false);
    expect(sameSelection({ index: 1, type: 'edge' }, { index: 1, type: 'edge' })).toBe(true);
    expect(sameSelection({ index: 1, type: 'edge' }, { id: '1', type: 'node' })).toBe(false);
    expect(sameSelection(undefined, undefined)).toBe(true);
    expect(sameSelection(undefined, { id: 'A', type: 'node' })).toBe(false);
  });

  it('keeps the same object when selected again', () => {
    select({ id: 'A', type: 'node' });
    const first = selection.current;
    select({ id: 'A', type: 'node' });
    expect(selection.current).toBe(first);
  });

  it('connects from the selected node until another selection or a cancel', () => {
    select({ id: 'A', type: 'node' });
    startConnect();
    expect(selection.connectFrom).toBe('A');
    cancelConnect();
    expect(selection.connectFrom).toBeUndefined();
    startConnect();
    select({ id: 'B', type: 'node' });
    expect(selection.connectFrom).toBeUndefined();
    select({ index: 0, type: 'edge' });
    startConnect();
    expect(selection.connectFrom).toBeUndefined();
  });

  it('opens the rename of the selection until it ends or another is selected', () => {
    requestRename();
    expect(selection.renaming).toBe(false);
    select({ id: 'A', type: 'node' });
    requestRename();
    expect(selection.renaming).toBe(true);
    select({ id: 'B', type: 'node' });
    expect(selection.renaming).toBe(false);
    requestRename();
    endRename();
    expect(selection.renaming).toBe(false);
  });
});
