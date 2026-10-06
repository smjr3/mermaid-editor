import { describe, expect, it } from 'vitest';
import { historyCommand, isTypingTarget, keyCommand } from './selectionKeys';

const node = { id: 'A', type: 'node' } as const;
const edge = { index: 0, type: 'edge' } as const;

describe('keyCommand', () => {
  it('does nothing without a selection, while typing or composing, or with a modifier', () => {
    expect(keyCommand({ key: 'Delete' }, undefined, false)).toBeUndefined();
    expect(keyCommand({ key: 'Delete' }, node, true)).toBeUndefined();
    expect(keyCommand({ isComposing: true, key: 'Enter' }, node, false)).toBeUndefined();
    expect(keyCommand({ ctrlKey: true, key: 'Enter' }, node, false)).toBeUndefined();
    expect(keyCommand({ key: 'Delete', metaKey: true }, node, false)).toBeUndefined();
    expect(keyCommand({ altKey: true, key: 'F2' }, node, false)).toBeUndefined();
  });

  it('maps the keys on a node', () => {
    expect(keyCommand({ key: 'Enter' }, node, false)).toBe('addAfter');
    expect(keyCommand({ key: 'Tab' }, node, false)).toBe('addBranch');
    expect(keyCommand({ key: 'Tab', shiftKey: true }, node, false)).toBeUndefined();
    expect(keyCommand({ key: 'Delete' }, node, false)).toBe('delete');
    expect(keyCommand({ key: 'Backspace' }, node, false)).toBe('delete');
    expect(keyCommand({ key: 'F2' }, node, false)).toBe('rename');
    expect(keyCommand({ key: 'Escape' }, node, false)).toBe('clear');
    expect(keyCommand({ key: 'ArrowRight' }, node, false)).toBe('next');
    expect(keyCommand({ key: 'ArrowDown' }, node, false)).toBe('next');
    expect(keyCommand({ key: 'ArrowLeft' }, node, false)).toBe('previous');
    expect(keyCommand({ key: 'ArrowUp' }, node, false)).toBe('previous');
    expect(keyCommand({ key: 'a' }, node, false)).toBeUndefined();
  });

  it('maps the keys on an arrow', () => {
    expect(keyCommand({ key: 'Enter' }, edge, false)).toBe('rename');
    expect(keyCommand({ key: 'F2' }, edge, false)).toBe('rename');
    expect(keyCommand({ key: 'Delete' }, edge, false)).toBe('delete');
    expect(keyCommand({ key: 'Escape' }, edge, false)).toBe('clear');
    expect(keyCommand({ key: 'Tab' }, edge, false)).toBeUndefined();
    expect(keyCommand({ key: 'ArrowRight' }, edge, false)).toBeUndefined();
  });
});

describe('isTypingTarget', () => {
  it('knows fields, editors and dialogs', () => {
    const at = (tagName: string, inside = false) => ({
      closest: () => (inside ? {} : null),
      tagName
    });
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(at('INPUT'))).toBe(true);
    expect(isTypingTarget(at('TEXTAREA'))).toBe(true);
    expect(isTypingTarget(at('SELECT'))).toBe(true);
    expect(isTypingTarget({ isContentEditable: true, tagName: 'DIV' })).toBe(true);
    expect(isTypingTarget(at('DIV', true))).toBe(true);
    expect(isTypingTarget(at('BODY'))).toBe(false);
    expect(isTypingTarget(at('BUTTON'))).toBe(false);
  });

  it('works on real elements', () => {
    document.body.innerHTML =
      '<div class="monaco-editor"><span id="in"></span></div><div id="out"></div>';
    expect(isTypingTarget(document.querySelector('#in'))).toBe(true);
    expect(isTypingTarget(document.querySelector('#out'))).toBe(false);
  });
});

describe('historyCommand', () => {
  // Ctrl+Z after deleting with the Delete key must step back, wherever focus is
  // outside a text field (the code editor has its own undo).
  it('maps Ctrl/⌘+Z to undo and Ctrl+Y or Ctrl/⌘+Shift+Z to redo, with or without a selection', () => {
    expect(historyCommand({ ctrlKey: true, key: 'z' }, false)).toBe('undo');
    expect(historyCommand({ key: 'z', metaKey: true }, false)).toBe('undo');
    expect(historyCommand({ ctrlKey: true, key: 'Z', shiftKey: true }, false)).toBe('redo');
    expect(historyCommand({ key: 'z', metaKey: true, shiftKey: true }, false)).toBe('redo');
    expect(historyCommand({ ctrlKey: true, key: 'y' }, false)).toBe('redo');
  });

  it('leaves the keys to a field, the code editor, IME composition and other shortcuts', () => {
    expect(historyCommand({ ctrlKey: true, key: 'z' }, true)).toBeUndefined();
    expect(historyCommand({ ctrlKey: true, isComposing: true, key: 'z' }, false)).toBeUndefined();
    expect(historyCommand({ key: 'z' }, false)).toBeUndefined();
    expect(historyCommand({ altKey: true, ctrlKey: true, key: 'z' }, false)).toBeUndefined();
    expect(historyCommand({ ctrlKey: true, key: 'c' }, false)).toBeUndefined();
  });
});
