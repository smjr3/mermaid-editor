<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { messages, type MessageKey } from '$/i18n/messages';
  import type { DetailField, DetailValues } from '$/util/diagramDetails';
  import { displayName } from '$/util/displayName';
  import { selection } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import AddIcon from '~icons/material-symbols/add-rounded';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';

  // Local: what the selected object holds beyond its name, each a one-line row: its
  // properties (a gantt task's start, length and status, a pie slice's value, a chart's
  // values: `model.fields`) and its members (a class's attributes and methods, an
  // entity's attributes: `model.members`). A choice applies at once; a typed value on
  // Enter or when the field is left (diagramDetails.ts, through the selection model).
  let selectedMember = $state('');
  $effect(() => {
    void selection.current;
    selectedMember = '';
  });
  const member = $derived(
    model.members?.find(({ id }) => id === selectedMember) ?? model.members?.[0]
  );

  const optionText = (label: MessageKey, option: string) => {
    const key = `${label}.${option}`;
    return key in messages.en ? t(key as MessageKey) : option;
  };
  // A short label where the field's own one would not fit in the row (it stays the tooltip).
  const labelOf = (field: DetailField) => {
    const key = `insp.field.${field.key}`;
    return key in messages.en ? t(key as MessageKey) : t(field.label);
  };

  const applyField = (key: string, value: string) => {
    const current = model.fields?.find((field) => field.key === key)?.value;
    if (current === value) return;
    void model.setFields({ [key]: value } satisfies DetailValues);
  };
  const applyMember = (key: string, value: string) => {
    if (!member) return;
    const current = member.fields.find((field) => field.key === key)?.value;
    if (current === value) return;
    void model.setMember(member, { [key]: value });
  };
  const selectClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs text-foreground';
  const inputClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground';
</script>

{#snippet fieldRow(
  field: DetailField,
  apply: (key: string, value: string) => void,
  key: string,
  testID: string
)}
  <div class="contents" title={t(field.label)}>
    <FieldRow label={labelOf(field)}>
      {#if field.kind === 'choice'}
        <select
          class={selectClass}
          value={field.value}
          aria-label={t(field.label)}
          data-testid={testID}
          data-key={key}
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
          data-key={key}
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
          data-key={key}
          onkeydown={(event) => {
            // Leaving the field applies it (the change event), once.
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onchange={(event) => apply(field.key, event.currentTarget.value)} />
      {/if}
    </FieldRow>
  </div>
{/snippet}

{#if model.fields && model.fields.length > 0}
  {#each model.fields as field (field.key)}
    {@render fieldRow(field, applyField, field.key, TID.inspField)}
  {/each}
{/if}

{#if model.members && model.kind}
  {@const membersLabel = t(`edit.members.${model.kind}` as MessageKey)}
  <FieldRow label={membersLabel}>
    {#if model.members.length === 0}
      <span class="truncate text-xs text-muted-foreground" title={t('edit.membersNone')}
        >{t('edit.membersNone')}</span>
    {:else}
      <select
        class={selectClass}
        value={member?.id ?? ''}
        aria-label={membersLabel}
        data-testid={TID.inspMember}
        onchange={(event) => (selectedMember = event.currentTarget.value)}>
        {#each model.members as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    {/if}
    <Button
      size="sm"
      variant="ghost"
      class="size-7 shrink-0 p-0"
      title={t('insp.memberAdd')}
      aria-label={t('insp.memberAdd')}
      data-testid={TID.inspMemberAdd}
      onclick={() => void model.addMember()}><AddIcon /></Button>
    {#if member}
      <Button
        size="sm"
        variant="ghost"
        class="size-7 shrink-0 p-0 text-destructive"
        title={t('insp.memberDelete', { name: member.label })}
        aria-label={t('insp.memberDelete', { name: member.label })}
        data-testid={TID.inspMemberDelete}
        onclick={() => void model.setMember(member, undefined)}><DeleteIcon /></Button>
    {/if}
  </FieldRow>
  {#if member}
    {#key member.id}
      {#each member.fields as field (field.key)}
        {@render fieldRow(field, applyMember, `member-${field.key}`, TID.inspField)}
      {/each}
    {/key}
  {/if}
{/if}
