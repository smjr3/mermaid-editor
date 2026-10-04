<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import { initialValues, type Action, type AddSpec, type Values } from '$/util/addActions';
  import type { DiagramObject } from '$/util/mermaid';
  import { inputState, updateCode, validatedState } from '$/util/state.svelte';

  // Local: the Add card for the diagram types listed in addActions.ts — one form
  // per action, built from the action's fields.
  let { spec }: { spec: AddSpec } = $props();

  let parts = $state<Record<string, DiagramObject[]>>({});
  $effect(() => {
    const { code, error } = validatedState.current;
    if (error) return;
    let stale = false;
    void spec.parts(code).then((found) => {
      if (!stale) parts = found;
    });
    return () => {
      stale = true;
    };
  });

  // Each action's form keeps its values while the diagram type stays the same.
  let values = $derived<Record<string, Values>>(
    Object.fromEntries(spec.actions.map((action) => [action.id, initialValues(action)]))
  );
  let message = $state('');

  // Whole-object updates: a derived value is not deeply reactive.
  const set = (action: Action, key: string, value: string) => {
    values = {
      ...values,
      [action.id]: { ...(values[action.id] ?? initialValues(action)), [key]: value }
    };
  };

  const run = (action: Action) => {
    const current = values[action.id] ?? initialValues(action);
    const result = action.apply(inputState.code, current);
    if ('error' in result) {
      message = t(result.error);
      return;
    }
    updateCode(result.code, { updateDiagram: true });
    message = t('add.done', { name: result.name });
    // Clear what was typed; keep the choices, then apply what should follow.
    const cleared = Object.fromEntries(
      action.fields.map((field) => [
        field.key,
        field.kind === 'text' ? '' : (current[field.key] ?? '')
      ])
    );
    values = { ...values, [action.id]: cleared };
    for (const other of spec.actions) {
      for (const [key, value] of Object.entries(result.follow ?? {})) {
        if (other.fields.some((field) => field.key === key)) set(other, key, value);
      }
    }
  };

  const testID = (action: Action, key: string) => `${TID.addAction}-${action.id}-${key}`;
  const optionLabel = (label: MessageKey, option: string) => t(`${label}.${option}` as MessageKey);
  const selectClass =
    'h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-sm text-foreground';
  const name = (part: DiagramObject) =>
    part.label.trim() === part.id ? part.label : `${part.label} (${part.id})`;
</script>

{#each spec.actions as action (action.id)}
  {@const current = values[action.id] ?? initialValues(action)}
  <div class="flex flex-col gap-1">
    <span class="font-semibold">{t(action.title)}</span>
    {#each action.fields as field (field.key)}
      <label class="flex items-center gap-1">
        <span class="w-24 shrink-0 text-xs text-muted-foreground">{t(field.label)}</span>
        {#if field.kind === 'choice'}
          <select
            class={selectClass}
            value={current[field.key]}
            data-testid={testID(action, field.key)}
            onchange={(event) => set(action, field.key, event.currentTarget.value)}>
            {#each field.options ?? [] as option (option)}
              <option value={option}>{optionLabel(field.label, option)}</option>
            {/each}
          </select>
        {:else if field.kind === 'item'}
          <select
            class={selectClass}
            value={current[field.key]}
            data-testid={testID(action, field.key)}
            onchange={(event) => set(action, field.key, event.currentTarget.value)}>
            <option value="">{field.optional ? t('add.none') : ''}</option>
            {#each parts[field.source ?? ''] ?? [] as part (part.id)}
              <option value={part.id}>{name(part)}</option>
            {/each}
          </select>
        {:else}
          <Input
            class="h-9"
            type={field.kind === 'text' ? 'text' : field.kind}
            value={current[field.key]}
            data-testid={testID(action, field.key)}
            oninput={(event) => set(action, field.key, event.currentTarget.value)}
            onkeydown={(event) => event.key === 'Enter' && run(action)} />
        {/if}
      </label>
    {/each}
    <div>
      <Button size="sm" data-testid={testID(action, 'button')} onclick={() => run(action)}
        >{t(action.button)}</Button>
    </div>
  </div>
{/each}

{#if message}
  <p role="status" class="text-muted-foreground" data-testid={TID.addMessage}>{message}</p>
{/if}
