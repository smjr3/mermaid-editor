<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import DetailFieldRow from '$/components/inspector/DetailFieldRow.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { messages, type MessageKey } from '$/i18n/messages';
  import type { DetailField, DetailValues } from '$/util/diagramDetails';
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
  // Short labels that fit the row and tell a member's name from the object's own 名前
  // (QA 2026-10-13); the field's full label stays the tooltip.
  const shortOf = (key: string) => (key in messages.en ? t(key as MessageKey) : undefined);
  const memberLabel = (field: DetailField) =>
    shortOf(
      `insp.member.${model.kind}.${field.label === 'add.class.returns' ? 'returns' : field.key}`
    );
  const selectClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs text-foreground';
</script>

{#if model.fields && model.fields.length > 0}
  {#each model.fields as field (field.key)}
    <DetailFieldRow {field} apply={applyField} dataKey={field.key} testID={TID.inspField} />
  {/each}
{/if}

{#if model.members && model.kind}
  {@const membersLabel =
    shortOf(`insp.members.${model.kind}`) ?? t(`edit.members.${model.kind}` as MessageKey)}
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
        <DetailFieldRow
          {field}
          short={memberLabel(field)}
          apply={applyMember}
          dataKey={`member-${field.key}`}
          testID={TID.inspField} />
      {/each}
    {/key}
  {/if}
{/if}
