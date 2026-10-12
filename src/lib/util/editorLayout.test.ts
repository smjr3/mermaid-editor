import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultPaneSizes,
  editorCodeCollapsed,
  editorPaneSizes,
  migrateEditorLayout,
  paneSizesFor,
  rememberPaneSizes
} from './editorLayout.svelte';

describe('editorLayout', () => {
  beforeEach(() => {
    editorPaneSizes.value = {};
    editorCodeCollapsed.value = false;
    window.localStorage.clear();
  });

  it('defaults to 270px and 300px within the limits', () => {
    expect(defaultPaneSizes(1500)).toEqual({ code: 18, inspector: 20 });
    expect(defaultPaneSizes(1000)).toEqual({ code: 27, inspector: 30 });
    expect(defaultPaneSizes(3000)).toEqual({ code: 15, inspector: 18 });
  });

  it('remembers clamped widths and ignores a folded pane', () => {
    rememberPaneSizes({ code: 55, inspector: 0 });
    expect(editorPaneSizes.value).toEqual({ code: 40 });
    expect(JSON.parse(window.localStorage.getItem('editorPaneSizes') ?? '{}')).toEqual({
      code: 40
    });
    expect(paneSizesFor(1500)).toEqual({ code: 40, inspector: 20 });
  });

  it('seeds the layout from the old editor and removes its keys', () => {
    const store = window.localStorage;
    store.setItem('toolsPaneWidths', JSON.stringify({ fix: 45, normal: 30 }));
    store.setItem('paneOrder', JSON.stringify('tools-left'));
    store.setItem('foldCodeWhileFixing', 'true');
    store.setItem('codeFoldedForFix', 'true');
    store.setItem(
      'paneforge:liveEditorToolsLeft',
      JSON.stringify({ key: { expandToSizes: { 'pane-code': 22 }, layout: [30, 70, 0] } })
    );
    store.setItem('paneforge:liveEditor', JSON.stringify({ key: { layout: [33, 37, 30] } }));
    store.setItem('locale', 'en');
    editorCodeCollapsed.value = true;

    migrateEditorLayout();

    expect(editorPaneSizes.value).toEqual({ code: 22, inspector: 40 });
    expect(editorCodeCollapsed.value).toBe(false);
    for (const key of [
      'toolsPaneWidths',
      'paneOrder',
      'foldCodeWhileFixing',
      'codeFoldedForFix',
      'paneforge:liveEditor',
      'paneforge:liveEditorToolsLeft',
      'locale'
    ]) {
      expect(store.getItem(key)).toBeNull();
    }
  });

  it('reads the code-left order first when it was in use', () => {
    window.localStorage.setItem('paneOrder', JSON.stringify('code-left'));
    window.localStorage.setItem(
      'paneforge:liveEditor',
      JSON.stringify({ key: { layout: [12, 58, 30] } })
    );
    window.localStorage.setItem('toolsPaneWidths', JSON.stringify({ normal: 10 }));
    migrateEditorLayout();
    expect(editorPaneSizes.value).toEqual({ code: 15, inspector: 18 });
  });

  it('leaves a fresh install alone', () => {
    migrateEditorLayout();
    expect(editorPaneSizes.value).toEqual({});
    expect(window.localStorage.getItem('editorPaneSizes')).toBeNull();
  });
});
