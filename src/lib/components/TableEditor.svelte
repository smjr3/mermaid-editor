<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { newChartRow } from '$/util/chartEdit';
  import { displayName } from '$/util/displayName';
  import { checkEdit } from '$/util/diagramModify';
  import { editsBlocked } from '$/util/codeHealth.svelte';
  import { inputState, updateCode } from '$/util/state.svelte';
  import { settledState } from '$/util/settledState.svelte';
  import {
    addRow,
    deleteRow,
    moveRow,
    pasteRows,
    readTable,
    setCell,
    tableKind,
    tableModel,
    type TableKind,
    type TableModel,
    type TableOption
  } from '$/util/tableEdit';
  import ArrowDownIcon from '~icons/material-symbols/arrow-downward-rounded';
  import ArrowUpIcon from '~icons/material-symbols/arrow-upward-rounded';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';

  // Local: the list-like diagram types as a table (tableEdit.ts) — gantt tasks,
  // kanban cards, timeline periods, pie slices, an ER entity's attributes. A cell
  // applies on blur or Enter, and only if mermaid still parses the result.
  const kind = $derived(tableKind(inputState.code));
  let entity = $state<string | undefined>();
  let model = $state<TableModel | undefined>();
  let message = $state('');

  // The table comes from the last valid code, through mermaid's parse.
  $effect(() => {
    const { code, error } = settledState.current;
    const chosen = entity;
    if (!tableKind(code)) {
      model = undefined;
      return;
    }
    if (error) return;
    let stale = false;
    void tableModel(code, chosen).then((found) => {
      if (stale) return;
      model = found;
      if (found?.entity !== undefined && found.entity !== entity) entity = found.entity;
    });
    return () => {
      stale = true;
    };
  });

  /** Applies the change if mermaid still accepts it; false when it was refused. */
  const apply = async (next: string | undefined, done: string): Promise<boolean> => {
    // Local: the table is the last valid code's; the broken code cannot be checked.
    if (editsBlocked()) {
      message = t('recover.blocked');
      return false;
    }
    const code = inputState.code;
    if (next === undefined || next === code || !(await checkEdit(code, next))) {
      message = t('edit.breaks');
      return false;
    }
    updateCode(next, { updateDiagram: true });
    message = done;
    return true;
  };

  const commit = async (
    row: number,
    key: string,
    element: HTMLInputElement | HTMLSelectElement
  ) => {
    const before = model?.rows[row]?.cells[key];
    const value = element.value;
    if (before === undefined || value === before) return;
    const ok = await apply(
      setCell(inputState.code, row, key, value, model?.entity),
      t('table.updated')
    );
    // A refused change shows what is still in the code.
    if (!ok) element.value = before;
  };

  const newRow: Record<TableKind, () => Record<string, string>> = {
    er: () => ({ name: t('table.newAttribute') }),
    gantt: () => ({ task: t('table.newTask') }),
    journey: () => newChartRow('journey'),
    kanban: () => ({ card: t('table.newCard') }),
    packet: () => newChartRow('packet'),
    pie: () => ({ label: t('table.newSlice') }),
    quadrant: () => newChartRow('quadrant'),
    sankey: () => newChartRow('sankey'),
    timeline: () => ({ period: t('table.newPeriod') }),
    xychart: () => newChartRow('xychart')
  };
  const onAdd = () => {
    if (!kind) return;
    void apply(addRow(inputState.code, newRow[kind](), model?.entity), t('table.updated'));
  };
  const onDelete = (row: number) =>
    void apply(deleteRow(inputState.code, row, model?.entity), t('table.updated'));
  const onMove = (row: number, by: -1 | 1) =>
    void apply(moveRow(inputState.code, row, by, model?.entity), t('table.updated'));

  // Rows copied from Excel arrive as tab-separated text; a single value pastes into the cell.
  const onPaste = (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!/[\t\n]/.test(text.trim())) return;
    event.preventDefault();
    const code = inputState.code;
    const next = pasteRows(code, text, model?.entity);
    const count =
      next === undefined
        ? 0
        : (readTable(next, model?.entity)?.rows.length ?? 0) -
          (readTable(code, model?.entity)?.rows.length ?? 0);
    void apply(next, t('table.pasted', { count: String(count) }));
  };

  const optionText = (option: TableOption) =>
    option.key ? t(option.key) : (option.text ?? option.value);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.isComposing && event.currentTarget instanceof HTMLElement)
      event.currentTarget.blur();
  };
  const cellClass =
    'h-8 w-full rounded-md border border-input bg-background px-1 text-xs text-foreground';
  const minWidth: Record<string, string> = {
    date: 'min-w-[8.5rem]',
    number: 'min-w-[3.5rem]',
    text: 'min-w-[6rem]'
  };
</script>

{#if kind && model}
  <div class="flex flex-col gap-2 border-t p-2 text-sm" data-testid={TID.tableEditor}>
    <span class="font-semibold">{t('table.title')}</span>
    {#if model.entities}
      <label class="flex items-center gap-1">
        <span class="w-20 shrink-0 text-xs text-muted-foreground">{t('table.entity')}</span>
        <select
          class={cellClass}
          value={model.entity ?? ''}
          data-testid={TID.tableEntity}
          onchange={(event) => (entity = event.currentTarget.value)}>
          {#each model.entities as option (option.id)}
            <option value={option.id}
              >{displayName(option.label, option.id, model.entities)}</option>
          {/each}
        </select>
      </label>
    {/if}
    {#if model.columns.length > 0}
      <!-- Focusable so rows can be pasted into an empty table. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="overflow-x-auto rounded-md border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        tabindex="0"
        role="region"
        aria-label={t('table.title')}
        onpaste={onPaste}>
        <table class="w-full border-collapse text-xs">
          <thead>
            <tr class="bg-muted/50">
              {#each model.columns as column (column.key)}
                <th class="px-1 py-1 text-left font-medium whitespace-nowrap">{t(column.label)}</th>
              {/each}
              <th class="px-1 py-1"><span class="sr-only">{t('table.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {#each model.rows as row, index (`${row.line}:${index}`)}
              <tr class="border-t" data-testid={TID.tableRow}>
                {#each model.columns as column (column.key)}
                  <td class="p-0.5">
                    {#if column.kind === 'choice'}
                      <select
                        class="{cellClass} min-w-[5.5rem]"
                        value={row.cells[column.key] ?? ''}
                        aria-label={`${t(column.label)} ${index + 1}`}
                        data-testid={`${TID.tableCell}-${column.key}`}
                        onchange={(event) => void commit(index, column.key, event.currentTarget)}>
                        {#each column.options ?? [] as option (option.value)}
                          <option value={option.value}>{optionText(option)}</option>
                        {/each}
                      </select>
                    {:else}
                      <input
                        class="{cellClass} {minWidth[column.kind] ?? ''}"
                        type={column.kind}
                        min={column.kind === 'number' ? 0 : undefined}
                        value={row.cells[column.key] ?? ''}
                        aria-label={`${t(column.label)} ${index + 1}`}
                        data-testid={`${TID.tableCell}-${column.key}`}
                        onblur={(event) => void commit(index, column.key, event.currentTarget)}
                        onkeydown={onKey} />
                    {/if}
                  </td>
                {/each}
                <td class="p-0.5 whitespace-nowrap">
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-7"
                    disabled={index === 0}
                    title={t('table.moveUp')}
                    aria-label={t('table.moveUp')}
                    data-testid={TID.tableMoveUp}
                    onclick={() => onMove(index, -1)}><ArrowUpIcon /></Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-7"
                    disabled={index === model.rows.length - 1}
                    title={t('table.moveDown')}
                    aria-label={t('table.moveDown')}
                    data-testid={TID.tableMoveDown}
                    onclick={() => onMove(index, 1)}><ArrowDownIcon /></Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-7"
                    title={t('table.delete')}
                    aria-label={t('table.delete')}
                    data-testid={TID.tableDeleteRow}
                    onclick={() => onDelete(index)}><DeleteIcon /></Button>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan={model.columns.length + 1} class="p-2 text-muted-foreground"
                  >{t('table.empty')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div>
        <Button size="sm" variant="outline" data-testid={TID.tableAddRow} onclick={onAdd}
          >{t('table.addRow')}</Button>
      </div>
      <p class="text-xs text-muted-foreground">{t('table.hint')}</p>
    {/if}
    {#if message}
      <p role="status" class="text-xs text-muted-foreground" data-testid={TID.tableMessage}>
        {message}
      </p>
    {/if}
  </div>
{/if}
