<script lang="ts">
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { locale, t } from '$/i18n';
  import { parse } from '$/util/mermaid';
  import { isReplaceable } from '$/util/newDiagram';
  import { notify } from '$/util/notify';
  import { inputState, updateCode } from '$/util/state.svelte';
  import {
    addRow,
    defaultValues,
    generate,
    isTemplateCode,
    labelOf,
    templateForms,
    type Column,
    type FormValues,
    type ListField,
    type Option,
    type Row,
    type TemplateForm
  } from '$/util/templateForms';
  import { templateNotice } from '$/util/templateNotice.svelte';
  import { thumbnail } from '$/util/templateThumbnails';
  import { tick } from 'svelte';
  import TemplateIcon from '~icons/material-symbols/dynamic-form-outline-rounded';
  import BackIcon from '~icons/material-symbols/arrow-back-rounded';
  import AddIcon from '~icons/material-symbols/add-rounded';
  import RemoveIcon from '~icons/material-symbols/close-rounded';

  // Local: "Create from a template" in the Samples card — pick one of the business
  // templates, fill in its form (templateForms.ts) and get the diagram, then carry on
  // in the Add card. Asks first unless the code is a sample, a starter or a template.
  let { samples }: { samples: string[] } = $props();

  let open = $state(false);
  let chosen = $state<TemplateForm | undefined>();
  let values = $state<FormValues>({});
  let thumbs = $state<Record<string, string>>({});

  const label = (value: { en: string; ja: string }) => labelOf(value, locale);
  const selectClass =
    'h-9 min-w-0 w-full rounded-md border border-input bg-background px-1 text-sm text-foreground';

  const currentTheme = (): string | undefined => {
    try {
      const theme = (JSON.parse(inputState.mermaid) as { theme?: unknown }).theme;
      return typeof theme === 'string' ? theme : undefined;
    } catch {
      return undefined;
    }
  };

  // Previews: each template's default diagram, rendered once (templateThumbnails.ts).
  $effect(() => {
    if (!open) return;
    const theme = currentTheme();
    for (const template of templateForms) {
      if (thumbs[template.id] !== undefined) continue;
      void thumbnail(template.id, generate(template, defaultValues(template)), theme).then(
        (svg) => (thumbs[template.id] = svg)
      );
    }
  });

  const rowsOf = (key: string): Row[] => {
    const rows = values[key];
    return Array.isArray(rows) ? rows : [];
  };
  const textOf = (key: string): string => {
    const value = values[key];
    return typeof value === 'string' ? value : '';
  };

  const choices = (column: Column): Option[] => {
    if (!column.source) return column.options ?? [];
    const source = chosen?.fields.find((field) => field.key === column.source);
    const shownKey = source?.kind === 'list' ? source.columns[0]?.key : undefined;
    const rows = rowsOf(column.source).filter((row) => shownKey && row[shownKey]?.trim());
    return [
      ...(column.extra ?? []),
      ...rows.map((row) => ({
        label: { en: row[shownKey ?? ''], ja: row[shownKey ?? ''] },
        value: row._id
      }))
    ];
  };

  const choose = (template: TemplateForm) => {
    chosen = template;
    values = defaultValues(template);
  };

  const removeRow = (field: ListField, id: string) => {
    values[field.key] = rowsOf(field.key).filter((row) => row._id !== id);
  };

  // The Add card's header, as the tools rail opens it: click it unless it is open already.
  const openAddCard = () => {
    const header = document.querySelector<HTMLElement>(`[data-testid="${TID.addCard}"]`);
    if (!header) return;
    if (!header.closest('.card')?.classList.contains('isOpen')) header.click();
    header.scrollIntoView({ block: 'nearest' });
  };

  const create = async () => {
    if (!chosen) return;
    const code = inputState.code;
    if (
      !isReplaceable(code, samples) &&
      !isTemplateCode(code) &&
      !window.confirm(t('template.confirm'))
    )
      return;
    const next = generate(chosen, $state.snapshot(values));
    // Local (error recovery): a template must never write code that does not parse.
    try {
      await parse(next);
    } catch {
      notify(t('template.breaks'));
      return;
    }
    updateCode(next, {
      resetPanZoom: true,
      updateDiagram: true
    });
    templateNotice.message = t('template.done', { name: label(chosen.name) });
    open = false;
    chosen = undefined;
    await tick();
    openAddCard();
  };
</script>

<Button
  size="sm"
  variant="outline"
  class="self-start"
  data-testid={TID.templateFormsButton}
  onclick={() => {
    open = true;
    templateNotice.message = '';
  }}>
  <TemplateIcon />
  {t('template.button')}
</Button>

<Dialog.Root bind:open>
  <Dialog.Content
    class="flex max-h-[90vh] flex-col sm:max-w-3xl"
    data-testid={TID.templateFormsDialog}>
    <Dialog.Header>
      <Dialog.Title>{chosen ? label(chosen.name) : t('template.title')}</Dialog.Title>
      <Dialog.Description>
        {chosen ? label(chosen.description) : t('template.intro')}
      </Dialog.Description>
    </Dialog.Header>

    {#if !chosen}
      <div class="grid min-h-0 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-3">
        {#each templateForms as template (template.id)}
          <button
            type="button"
            class="flex flex-col gap-1 rounded-md border border-border p-2 text-left text-sm hover:bg-muted"
            data-testid={`${TID.templateFormsItem}-${template.id}`}
            onclick={() => choose(template)}>
            <div
              class="flex h-20 items-center justify-center overflow-hidden rounded bg-background [&>svg]:h-full [&>svg]:max-w-full"
              aria-hidden="true">
              {#if thumbs[template.id]}
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- rendered by mermaid from the editor's own template code -->
                {@html thumbs[template.id]}
              {/if}
            </div>
            <span class="font-medium">{label(template.name)}</span>
            <span class="text-xs text-muted-foreground">{label(template.description)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <div class="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 text-sm">
        {#each chosen.fields as field (field.key)}
          {#if field.kind === 'text'}
            <label class="flex flex-col gap-1">
              <span class="font-semibold">{label(field.label)}</span>
              <Input
                class="h-9"
                value={textOf(field.key)}
                placeholder={field.pattern ? label(field.pattern) : undefined}
                data-testid={`${TID.templateFormsField}-${field.key}`}
                oninput={(event) => (values[field.key] = event.currentTarget.value)} />
            </label>
          {:else}
            <fieldset class="flex flex-col gap-1">
              <legend class="mb-1 font-semibold">{label(field.label)}</legend>
              {#each rowsOf(field.key) as row, index (row._id)}
                <div
                  class="flex flex-wrap items-end gap-2 rounded-md border border-border p-2"
                  data-testid={`${TID.templateFormsField}-${field.key}-${index}`}>
                  {#each field.columns as column (column.key)}
                    {#if !column.when || column.when(row)}
                      <label class="flex min-w-28 flex-1 flex-col gap-0.5">
                        <span class="text-xs text-muted-foreground">{label(column.label)}</span>
                        {#if column.kind === 'choice'}
                          <select
                            class={selectClass}
                            value={row[column.key]}
                            data-testid={`${TID.templateFormsField}-${field.key}-${index}-${column.key}`}
                            onchange={(event) => (row[column.key] = event.currentTarget.value)}>
                            {#each choices(column) as choice (choice.value)}
                              <option value={choice.value}>{label(choice.label)}</option>
                            {/each}
                          </select>
                        {:else}
                          <Input
                            class="h-9"
                            value={row[column.key]}
                            placeholder={column.pattern ? label(column.pattern) : undefined}
                            data-testid={`${TID.templateFormsField}-${field.key}-${index}-${column.key}`}
                            oninput={(event) => (row[column.key] = event.currentTarget.value)} />
                        {/if}
                      </label>
                    {/if}
                  {/each}
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-9 shrink-0"
                    title={t('template.removeRow')}
                    aria-label={t('template.removeRow')}
                    data-testid={`${TID.templateFormsRemoveRow}-${field.key}-${index}`}
                    onclick={() => removeRow(field, row._id)}>
                    <RemoveIcon />
                  </Button>
                </div>
              {:else}
                <p class="text-xs text-muted-foreground">{t('template.noRows')}</p>
              {/each}
              <Button
                size="sm"
                variant="outline"
                class="self-start"
                data-testid={`${TID.templateFormsAddRow}-${field.key}`}
                onclick={() => addRow(values, field)}>
                <AddIcon />
                {t('template.addRow')}
              </Button>
            </fieldset>
          {/if}
        {/each}
        <p class="text-xs text-muted-foreground">{t('template.emptyRows')}</p>
      </div>
      <Dialog.Footer class="gap-2">
        <Button
          variant="outline"
          size="sm"
          data-testid={TID.templateFormsBack}
          onclick={() => (chosen = undefined)}>
          <BackIcon />
          {t('template.back')}
        </Button>
        <Button size="sm" data-testid={TID.templateFormsCreate} onclick={create}
          >{t('template.create')}</Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
