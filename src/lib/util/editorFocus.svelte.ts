import { persisted } from './persist.svelte';

/**
 * Local: "focus on code" hides the tool cards under the editor (samples,
 * layout, icons, actions) so the editor fills the column. Remembered per
 * browser; see EditorFocusButton.svelte.
 */
export const editorFocus = persisted('editorFocus', false);
