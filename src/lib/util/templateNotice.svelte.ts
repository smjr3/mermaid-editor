// Local: the confirmation after a template's form made a diagram in a new tab. The 新規 dialog
// (NewDiagramDialog.svelte) shows it, next to where the form was opened from.
export const templateNotice = $state({ message: '' });

// Local: which template's form is open (TemplateForms.svelte), if any. The 新規 dialog's
// サンプル tab opens it with the "enter lanes and steps" button of a sample that has one;
// the form has no list of its own, so there is one place to choose a template.
export const templateDialog = $state<{ id: string | undefined }>({ id: undefined });
