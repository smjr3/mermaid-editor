// Local: the confirmation after "Create from a template". It is shown in the Add card, where
// the user lands (the accordion closes the Samples card, so a message there would be hidden).
export const templateNotice = $state({ message: '' });

// Local: which template's form is open (TemplateForms.svelte), if any. The template
// picker (Preset.svelte) opens it with the "fill in a form" button of a template that
// has one; the dialog has no list of its own, so there is one place to choose a template.
export const templateDialog = $state<{ id: string | undefined }>({ id: undefined });
