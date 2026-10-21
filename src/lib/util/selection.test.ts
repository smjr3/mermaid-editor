import { beforeEach, describe, expect, it } from 'vitest';
import {
  cancelConnect,
  clearSelection,
  endRename,
  isSelected,
  requestRename,
  sameSelection,
  select,
  selection,
  selectionCount,
  selectionKey,
  selectMany,
  startConnect,
  toggleSelect
} from './selection.svelte';

const A = { id: 'A', type: 'node' } as const;
const B = { id: 'B', type: 'node' } as const;
const E0 = { index: 0, type: 'edge' } as const;

describe('selection', () => {
  beforeEach(() => {
    clearSelection();
    endRename();
  });

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

  it('select replaces the list with one item', () => {
    selectMany([A, B, E0]);
    select(A);
    expect(selection.items).toEqual([A]);
    expect(selection.current).toEqual(A);
    select(undefined);
    expect(selection.items).toEqual([]);
    expect(selection.current).toBeUndefined();
  });

  it('toggleSelect adds, makes the added item primary, and removes', () => {
    toggleSelect(A);
    toggleSelect(E0);
    toggleSelect(B);
    expect(selection.items).toEqual([A, E0, B]);
    expect(selection.current).toEqual(B);
    expect(selectionCount()).toBe(3);
    expect(isSelected(E0)).toBe(true);
    expect(isSelected({ index: 1, type: 'edge' })).toBe(false);
    // Removing the primary: the last one left is primary.
    toggleSelect(B);
    expect(selection.items).toEqual([A, E0]);
    expect(selection.current).toEqual(E0);
    // Removing another keeps the primary.
    toggleSelect(A);
    expect(selection.items).toEqual([E0]);
    expect(selection.current).toEqual(E0);
    toggleSelect(E0);
    expect(selection.items).toEqual([]);
    expect(selection.current).toBeUndefined();
  });

  it('selectMany replaces the list, drops duplicates and makes the last item primary', () => {
    select(A);
    selectMany([B, E0, B]);
    expect(selection.items).toEqual([B, E0]);
    expect(selection.current).toEqual(E0);
    selectMany([]);
    expect(selection.current).toBeUndefined();
    expect(isSelected(undefined)).toBe(false);
  });

  it('clearSelection empties the list', () => {
    selectMany([A, B]);
    clearSelection();
    expect(selection.items).toEqual([]);
    expect(selectionCount()).toBe(0);
  });

  it('keeps the primary identity and rename when an item is added beside it', () => {
    select(A);
    requestRename();
    const first = selection.current;
    toggleSelect(B);
    // B became primary: the rename of A closes.
    expect(selection.renaming).toBe(false);
    expect(selection.current).toEqual(B);
    select(B);
    requestRename();
    const primary = selection.current;
    selectMany([A, B]);
    expect(selection.current).toBe(primary);
    expect(selection.renaming).toBe(true);
    expect(selection.current).not.toBe(first);
  });

  it('cancels a pending connect on any change of the list', () => {
    select(A);
    startConnect();
    toggleSelect(B);
    expect(selection.connectFrom).toBeUndefined();
    select(A);
    startConnect();
    selectMany([A]);
    expect(selection.connectFrom).toBeUndefined();
  });

  it('names a selection', () => {
    expect(selectionKey(A)).toBe('A');
    expect(selectionKey(E0)).toBe('edge-0');
  });
});
