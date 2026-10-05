/**
 * Local: what a key does to the diagram's selection (selection.svelte.ts), when
 * the keyboard is not busy in an input, the code editor or a dialog.
 *
 * - Enter: add a node after the selected one (and select it); on an arrow, edit its label
 * - Tab: add a branch — another node from where the selected one comes from
 * - Delete / Backspace: delete it
 * - F2: rename it (an arrow: its label)
 * - Escape: clear the selection (or stop "ここから矢印")
 * - arrow keys: move along the arrows (→ ↓ to the next node, ← ↑ to the previous)
 */
import type { Selected } from './selection.svelte';

export type KeyCommand =
  'addAfter' | 'addBranch' | 'clear' | 'delete' | 'next' | 'previous' | 'rename';

export interface KeyInput {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
}

/** The command for a key press, or undefined when the key is not the selection's. */
export const keyCommand = (
  event: KeyInput,
  selected: Selected | undefined,
  typing: boolean
): KeyCommand | undefined => {
  if (!selected || typing || event.isComposing) return undefined;
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  const node = selected.type === 'node';
  switch (event.key) {
    case 'Escape':
      return 'clear';
    case 'Delete':
    case 'Backspace':
      return 'delete';
    case 'F2':
      return 'rename';
    case 'Enter':
      return event.shiftKey ? undefined : node ? 'addAfter' : 'rename';
    case 'Tab':
      return node && !event.shiftKey ? 'addBranch' : undefined;
    case 'ArrowRight':
    case 'ArrowDown':
      return node ? 'next' : undefined;
    case 'ArrowLeft':
    case 'ArrowUp':
      return node ? 'previous' : undefined;
    default:
      return undefined;
  }
};

interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

/** Whether a key press there belongs to what has focus: a field, the code editor, a dialog or a menu. */
export const isTypingTarget = (target: TargetLike | null | undefined): boolean => {
  if (!target) return false;
  const tag = (target.tagName ?? '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return !!target.closest?.(
    '.monaco-editor, .cm-editor, [role="dialog"], [role="menu"], [role="listbox"], [contenteditable="true"]'
  );
};
