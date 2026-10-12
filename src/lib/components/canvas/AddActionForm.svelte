<script lang="ts">
  import AddFormFrame, {
    labelClass,
    rowClass,
    selectClass
  } from '$/components/canvas/AddFormFrame.svelte';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import type { Action, Values } from '$/util/addActions';
  import { displayName } from '$/util/displayName';
  import type { DiagramObject } from '$/util/mermaid';

  // Local: the form of one add action of addActions.ts / chartEdit.ts (a participant, a
  // message, a task, …), built from the action's fields, in a popover of the add bar.
  // The values live in SpecInsert.svelte, so they survive the popover closing.
  let {
    action,
    message,
    onchange,
    onsubmit,
    parts,
    values
  }: {
    action: Action;
    message: string;
    onchange: (key: string, value: string) => void;
    onsubmit: () => void;
    parts: Record<string, DiagramObject[]>;
    values: Values;
  } = $props();

  const optionLabel = (label: MessageKey, option: string) => t(`${label}.${option}` as MessageKey);
  // A line number is not a name worth showing (mindmap, kanban, timeline); an id only
  // tells apart two parts that show the same text (displayName.ts).
  const name = (part: DiagramObject, all: DiagramObject[]) =>
    /^L?\d+$/.test(part.id) ? part.label : displayName(part.label, part.id, all);
</script>

<AddFormFrame
  formKey={action.id}
  title={t(action.title)}
  submitLabel={t(action.button)}
  {message}
  {onsubmit}>
  {#each action.fields as field (field.key)}
    <label class={rowClass}>
      <span class={labelClass}>{t(field.label)}</span>
      {#if field.kind === 'choice'}
        <select
          class={selectClass}
          value={values[field.key]}
          data-testid={TID.canvasAddFormField}
          data-key={field.key}
          onchange={(event) => onchange(field.key, event.currentTarget.value)}>
          {#each field.options ?? [] as option (option)}
            <option value={option}>{optionLabel(field.label, option)}</option>
          {/each}
        </select>
      {:else if field.kind === 'item'}
        <!-- A choice that is needed says so: the add says what is missing if it is left. -->
        <select
          class={selectClass}
          value={values[field.key]}
          required={!field.optional}
          aria-required={!field.optional}
          data-testid={TID.canvasAddFormField}
          data-key={field.key}
          onchange={(event) => onchange(field.key, event.currentTarget.value)}>
          <option value="">{field.optional ? t('add.none') : t('add.choosePlaceholder')}</option>
          {#each parts[field.source ?? ''] ?? [] as part (part.id)}
            <option value={part.id}>{name(part, parts[field.source ?? ''] ?? [])}</option>
          {/each}
        </select>
      {:else}
        <Input
          class="h-8 min-w-0 flex-1"
          type={field.kind === 'text' ? 'text' : field.kind}
          value={values[field.key]}
          data-testid={TID.canvasAddFormField}
          data-key={field.key}
          oninput={(event) => onchange(field.key, event.currentTarget.value)} />
      {/if}
    </label>
  {/each}
</AddFormFrame>
