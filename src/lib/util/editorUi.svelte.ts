/**
 * Local: the editor shell's shared UI state (the inspector layout of /edit).
 *
 * - `dialog`: which of the header's dialogs is open (新規, 書き出す, 共有). The dialogs take no
 *   props: each opens when this names it and calls `closeDialog()` when it closes.
 * - `newTab`: the tab the 新規 dialog shows (形式 or サンプル).
 * - `focus`: a request for the inspector to focus one of its controls (the right-click
 *   menu's 色を変える / 形を変える, …). The inspector watches `seq`, so asking twice for the
 *   same control focuses it twice.
 * - `inspectorCollapsed`: whether the inspector is folded to its rail. The shell writes it
 *   (and keeps it in `editorLayout.svelte.ts`); everyone else only reads it.
 *
 * This API is frozen: the streams of the redesign build against it.
 */

export type EditorDialog = 'new' | 'export' | 'share';
export type NewDialogTab = 'type' | 'sample';
export type InspectorFocus = 'name' | 'color' | 'shape' | 'icon' | 'label';

export const editorUi = $state<{
  dialog: EditorDialog | undefined;
  newTab: NewDialogTab;
  focus: { target: InspectorFocus; seq: number } | undefined;
  inspectorCollapsed: boolean;
}>({
  dialog: undefined,
  focus: undefined,
  inspectorCollapsed: false,
  newTab: 'type'
});

/** Opens one of the header's dialogs; `tab` picks the 新規 dialog's tab. */
export const openDialog = (dialog: EditorDialog, tab?: NewDialogTab): void => {
  if (tab) editorUi.newTab = tab;
  editorUi.dialog = dialog;
};

export const closeDialog = (): void => {
  editorUi.dialog = undefined;
};

/** Asks the inspector to focus a control; the shell expands the inspector if it is folded. */
export const focusInspector = (target: InspectorFocus): void => {
  editorUi.focus = { seq: (editorUi.focus?.seq ?? 0) + 1, target };
};
