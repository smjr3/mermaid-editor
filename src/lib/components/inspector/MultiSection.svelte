<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import PanelGroup from '$/components/form/PanelGroup.svelte';
  import Segmented from '$/components/form/Segmented.svelte';
  import ColorRow from '$/components/inspector/ColorRow.svelte';
  import SelectSameRow from '$/components/inspector/SelectSameRow.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { Swatch } from '$/util/colors';
  import {
    fillSwatch,
    fillValue,
    lineCurrent,
    rowCommands,
    rowControl
  } from '$/util/inspectorMulti';
  import { clearSelection, selection } from '$/util/selection.svelte';
  import {
    availableCommands,
    commandByKey,
    commandLabel,
    type CommandChoice,
    type SelectionCommand
  } from '$/util/selectionCommands';
  import { isMixed, selectionModel as model } from '$/util/selectionModel.svelte';
  import CloseIcon from '~icons/material-symbols/close-rounded';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';

  // Local: the inspector for several selected items at once. The first row counts them
  // (✕ clears); then one row for every value the registry (selectionCommands.ts) can set
  // on all of them — 塗り / 枠 / 文字 as swatch rows, 形, 文字の大きさ, 太字, 線の種類,
  // 矢じり, 長さ, レーンへ移動 — showing the value they agree on, or 「まちまち」 when they
  // differ; a choice applies to every item in one undo step (`applyToAll`). Then
  // 「同じものを選ぶ」 (SelectSameRow) and 削除. No name, id or icon: those belong to one
  // object. `blocked`: the code does not parse, so the rows that write it are disabled;
  // the count and 「同じものを選ぶ」 still work on the last valid lists.
  let { blocked = false }: { blocked?: boolean } = $props();

  const count = $derived(selection.items.length);
  const available = $derived(availableCommands(model));
  const rows = $derived(rowCommands(available));
  const canDelete = $derived(available.some(({ key }) => key === 'delete'));

  const run = (command: SelectionCommand, value?: string) => void command.run(model, value);
  const choiceLabel = (choice: CommandChoice) => (choice.label ? t(choice.label) : choice.text);
  // A fill outside the built-in palette (a deployment's presets, ＋好きな色, a recent
  // colour) is a value of the registry's too (`fillValueOf`), so every fill goes one way.
  const pickFill = (command: SelectionCommand, swatch: Swatch | undefined) =>
    run(command, fillValue(swatch));
  const label = (command: SelectionCommand) => commandLabel(command, model);
  const controlId = (command: SelectionCommand) => `${TID.inspMultiControl}-${command.key}`;
  const selectClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs text-foreground';
  const mixedClass = 'shrink-0 text-xs text-muted-foreground';
</script>

<div data-testid={TID.inspMulti}>
  <PanelGroup>
    <div class="flex min-h-7 items-center gap-1 text-sm">
      <span
        class="min-w-0 flex-1 truncate text-xs font-semibold"
        title={t('insp.multiHint')}
        data-count={count}
        data-testid={TID.inspMultiCount}>{t('sel.cmd.count', { count: String(count) })}</span>
      <Button
        size="sm"
        variant="ghost"
        class="size-7 shrink-0 p-0"
        title={t('insp.multiClear')}
        aria-label={t('insp.multiClear')}
        data-testid={TID.inspMultiClear}
        onclick={clearSelection}><CloseIcon /></Button>
    </div>
  </PanelGroup>

  <fieldset disabled={blocked} class="contents">
    {#if rows.length > 0}
      <PanelGroup>
        {#each rows as command (command.key)}
          {@const current = command.current?.(model)}
          {@const mixed = isMixed(current)}
          {@const value = mixed ? undefined : (current as string | undefined)}
          {@const control = rowControl(command.key)}
          {@const choices = command.choices?.(model) ?? []}
          <div class="contents" data-key={command.key} data-testid={TID.inspMultiRow}>
            <FieldRow label={label(command)}>
              {#if control === 'fill'}
                <ColorRow
                  mode="fill"
                  current={mixed ? { fill: 'mixed', stroke: 'mixed' } : fillSwatch(value)}
                  label={label(command)}
                  testID={controlId(command)}
                  onpick={(swatch) => pickFill(command, swatch)} />
              {:else if control === 'line'}
                <ColorRow
                  mode="line"
                  current={lineCurrent(value, mixed)}
                  label={label(command)}
                  noneLabel={command.key === 'textColor' ? t('colors.textColorDefault') : undefined}
                  testID={controlId(command)}
                  onpick={(color) => run(command, color ?? 'none')} />
              {:else if control === 'select'}
                {@const known = choices.some((choice) => choice.value === value)}
                <select
                  class={selectClass}
                  value={mixed ? 'mixed' : known ? value : 'other'}
                  aria-label={label(command)}
                  data-insp-focus={command.key === 'shape' ? 'shape' : undefined}
                  data-testid={controlId(command)}
                  onchange={(event) => run(command, event.currentTarget.value)}>
                  {#if mixed}
                    <option value="mixed" disabled>{t('sel.cmd.mixed')}</option>
                  {:else if !known}
                    <option value="other" disabled
                      >{command.key === 'shape' ? t('edit.shapeOther') : (value ?? '')}</option>
                  {/if}
                  {#if command.key === 'shape'}
                    <!-- The Add card's five first, then every other mermaid shape (as the 形 row does). -->
                    {#each choices.slice(0, 5) as choice (choice.value)}
                      <option value={choice.value}>{choiceLabel(choice)}</option>
                    {/each}
                    <optgroup label={t('insp.shapeMore')}>
                      {#each choices.slice(5) as choice (choice.value)}
                        <option value={choice.value}>{choiceLabel(choice)}</option>
                      {/each}
                    </optgroup>
                  {:else}
                    {#each choices as choice (choice.value)}
                      <option value={choice.value}>{choiceLabel(choice)}</option>
                    {/each}
                  {/if}
                </select>
              {:else if control === 'segmented'}
                <Segmented
                  value={value ?? ''}
                  dense={command.key === 'lineStyle'}
                  full
                  ariaLabel={label(command)}
                  testID={controlId(command)}
                  options={choices.map((choice) => ({
                    label: choiceLabel(choice) ?? choice.value,
                    value: choice.value
                  }))}
                  onchange={(next) => run(command, next)} />
                {#if mixed}
                  <span class={mixedClass} data-testid={TID.inspMultiMixed}
                    >{t('sel.cmd.mixed')}</span>
                {/if}
              {:else if control === 'toggle'}
                <button
                  type="button"
                  class={[
                    'flex size-7 shrink-0 items-center justify-center rounded-md border border-input text-sm font-bold',
                    value === 'true'
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  ]}
                  title={label(command)}
                  aria-label={label(command)}
                  aria-pressed={value === 'true'}
                  data-testid={controlId(command)}
                  onclick={() => run(command)}>B</button>
                {#if mixed}
                  <span class={mixedClass} data-testid={TID.inspMultiMixed}
                    >{t('sel.cmd.mixed')}</span>
                {/if}
              {/if}
            </FieldRow>
          </div>
        {/each}
      </PanelGroup>
    {/if}
  </fieldset>

  <PanelGroup>
    <SelectSameRow />
    {#if canDelete}
      <fieldset disabled={blocked} class="contents">
        <div class="flex items-center gap-1">
          <span class="flex-1"></span>
          <Button
            size="sm"
            variant="outline"
            class="h-7 px-2 text-xs text-destructive"
            title={`${t('sel.delete')} (Delete)`}
            data-testid={TID.inspMultiDelete}
            onclick={() => run(commandByKey('delete'))}><DeleteIcon />{t('sel.delete')}</Button>
        </div>
      </fieldset>
    {/if}
  </PanelGroup>
</div>
