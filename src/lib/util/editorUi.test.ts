import { describe, expect, it } from 'vitest';
import { closeDialog, editorUi, focusInspector, openDialog } from './editorUi.svelte';

describe('editorUi', () => {
  it('opens and closes the dialogs', () => {
    openDialog('export');
    expect(editorUi.dialog).toBe('export');
    openDialog('new', 'sample');
    expect(editorUi.dialog).toBe('new');
    expect(editorUi.newTab).toBe('sample');
    openDialog('new');
    expect(editorUi.newTab).toBe('sample');
    closeDialog();
    expect(editorUi.dialog).toBeUndefined();
  });

  it('bumps the focus request each time', () => {
    focusInspector('color');
    const first = editorUi.focus?.seq ?? 0;
    focusInspector('color');
    expect(editorUi.focus).toEqual({ seq: first + 1, target: 'color' });
  });
});
