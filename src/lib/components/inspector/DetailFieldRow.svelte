<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import { t } from '$/i18n';
  import { messages, type MessageKey } from '$/i18n/messages';
  import type { DetailField } from '$/util/diagramDetails';
  import { displayName } from '$/util/displayName';

  // Local: one property of the selection as a one-line row (ObjectFields, EdgeSection):
  // a choice as a select (each option labelled by `<label>.<value>` when that message
  // exists), an item of the diagram, or a typed value applied on Enter or when the field
  // is left. `testID` and `data-key` let tests pick a row without its text.
  let {
    apply,
    dataKey,
    field,
    testID
  }: {
    apply: (key: string, value: string) => void;
    dataKey: string;
    field: DetailField;
    testID: string;
  } = $props();

  const optionText = (label: MessageKey, option: string) => {
    const key = `${label}.${option}`;
    return key in messages.en ? t(key as MessageKey) : option;
  };
  // A short label where the field's own one would not fit in the row (it stays the tooltip).
  const labelOf = (detail: DetailField) => {
    const key = `insp.field.${detail.key}`;
    return key in messages.en ? t(key as MessageKey) : t(detail.label);
  };
  const selectClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs text-foreground';
  const inputClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground';
</script>

<div class="contents" title={t(field.label)}>
  <FieldRow label={labelOf(field)}>
    {#if field.kind === 'choice'}
      <select
        class={selectClass}
        value={field.value}
        aria-label={t(field.label)}
        data-testid={testID}
        data-key={dataKey}
        onchange={(event) => apply(field.key, event.currentTarget.value)}>
        {#each field.options ?? [] as option (option)}
          <option value={option}>{optionText(field.label, option)}</option>
        {/each}
      </select>
    {:else if field.kind === 'item'}
      <select
        class={selectClass}
        value={field.value}
        aria-label={t(field.label)}
        data-testid={testID}
        data-key={dataKey}
        onchange={(event) => apply(field.key, event.currentTarget.value)}>
        <option value="">{t('add.none')}</option>
        {#each field.choices ?? [] as choice (choice.id)}
          <option value={choice.id}>{displayName(choice.label, choice.id, field.choices)}</option>
        {/each}
      </select>
    {:else}
      <input
        class={inputClass}
        type={field.kind === 'text' ? 'text' : field.kind}
        value={field.value}
        aria-label={t(field.label)}
        data-testid={testID}
        data-key={dataKey}
        onkeydown={(event) => {
          // Leaving the field applies it (the change event), once.
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        onchange={(event) => apply(field.key, event.currentTarget.value)} />
    {/if}
  </FieldRow>
</div>
