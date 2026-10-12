<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import { requestRename, selection } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { tick, untrack } from 'svelte';

  // Local: the inspector's 名前 (or an arrow's ラベル) row, which is also the inline
  // rename of the selection: F2, a double click, the right-click menu and a node just
  // added open it (`selection.renaming`), and so does a click into the field. While it
  // is open the text being typed lives in the selection model's draft
  // (selectionModel.svelte.ts), so a click on the diagram still applies it to the object
  // it was typed for. Enter or leaving the field applies it; Escape drops it.
  // `data-selection-ui`: a click here does not count as a click outside the selection.
  let { focusKey, label, testID }: { focusKey: 'name' | 'label'; label: string; testID: string } =
    $props();

  let input: HTMLInputElement | undefined = $state();
  const active = $derived(
    selection.renaming && (model.draftLabel !== undefined || !model.object?.noRename)
  );

  // Opened (again): start the draft, focus the field and select its text.
  $effect(() => {
    void selection.renameSession;
    if (!active || !input) return;
    const field = input;
    untrack(() => {
      model.startDraft();
      field.value = model.draft?.name ?? '';
      field.focus();
      // Select after the new value reached the field: setting it moves the caret to
      // the end, and typing a new name would then be appended to the old one.
      void tick().then(() => field.select());
    });
  });
  // Closed: the field shows the current name.
  $effect(() => {
    const name = model.label;
    if (!active && input) input.value = name;
  });

  const onfocus = () => {
    if (!selection.renaming) requestRename();
  };
  const onblur = () => {
    if (active) void model.commitDraft();
  };
  const onkeydown = (event: KeyboardEvent) => {
    // The Enter that confirms an IME conversion is not the one that applies the name.
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      void model.commitDraft();
      input?.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      model.cancelDraft();
      input?.blur();
    }
  };
</script>

<FieldRow {label}>
  <input
    bind:this={input}
    class="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
    aria-label={label}
    data-selection-ui
    data-insp-focus={focusKey}
    data-testid={testID}
    {onfocus}
    {onblur}
    {onkeydown}
    oninput={(event) => {
      if (model.draft) model.draft.name = event.currentTarget.value;
    }} />
</FieldRow>
