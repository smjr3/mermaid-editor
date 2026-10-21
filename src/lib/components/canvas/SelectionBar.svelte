<script lang="ts">
  import * as Popover from '$/components/ui/popover';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import { codeHealth } from '$/util/codeHealth.svelte';
  import { clearSelection, selection } from '$/util/selection.svelte';
  import {
    availableCommands,
    commandLabel,
    MIXED,
    type CommandChoice,
    type CommandKey,
    type SelectionCommand
  } from '$/util/selectionCommands';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { untrack } from 'svelte';
  import MoreIcon from '~icons/material-symbols/expand-more-rounded';

  // Local: the bar over the diagram while something is selected (InsertBar.svelte shows
  // it in place of the add buttons). Its buttons are the command registry's
  // (selectionCommands.ts, `availableCommands`), so the bar, the right-click menu and the
  // inspector offer the same operations with the same words; a `choice` opens a popover
  // (a menu of values, or rows of them: 色 has 塗り / 枠 / 文字, 線 has 線の種類 / 矢じり /
  // 長さ, 文字 has the size and 太字). On the left, how many items are selected and ✕.
  // With several items selected a choice marks 「まちまち」 where they differ and applies
  // to all of them. Everything stays on one row: the bar measures its buttons (an
  // invisible copy of each label, `probe`) against its own width and moves the ones
  // that do not fit, from the right, under その他 ▾; a choice chosen there shows its
  // popover's content in place of the menu, as the add bar's forms do. While the code is
  // broken the buttons look disabled but still run: every command refuses through the
  // model, which says why over the diagram (`recover.blocked`).

  /** The three popovers that gather several choice commands under one button. */
  interface Group {
    key: 'color' | 'line' | 'text';
    label: MessageKey;
    members: CommandKey[];
  }
  const groups: Group[] = [
    { key: 'color', label: 'sel.color', members: ['fillColor', 'strokeColor', 'textColor'] },
    { key: 'line', label: 'sel.line', members: ['lineStyle', 'arrowHead', 'edgeLength'] },
    { key: 'text', label: 'sel.text', members: ['textSize', 'bold'] }
  ];
  /** The bar's order; a command the registry does not offer for the selection is left out. */
  const order: (CommandKey | Group['key'])[] = [
    'addNext',
    'addBranch',
    'color',
    'shape',
    'line',
    'text',
    'selectSame',
    'moveLeft',
    'moveRight',
    'reverse',
    'connectFrom',
    'delete'
  ];
  const colourCommands = new Set<CommandKey>(['fillColor', 'strokeColor', 'textColor']);

  interface BarItem {
    key: string;
    label: string;
    title: string;
    /** A button that runs; a menu of one command's values; rows of several commands' values. */
    kind: 'action' | 'menu' | 'rows';
    command?: SelectionCommand;
    rows?: SelectionCommand[];
    danger?: boolean;
    pressed?: boolean;
  }

  const items = $derived.by((): BarItem[] => {
    const byKey = new Map(availableCommands(model).map((command) => [command.key, command]));
    const out: BarItem[] = [];
    for (const key of order) {
      const group = groups.find((candidate) => candidate.key === key);
      if (group) {
        const rows = group.members.flatMap((member) => byKey.get(member) ?? []);
        if (rows.length > 0) {
          out.push({ key, kind: 'rows', label: t(group.label), rows, title: t(group.label) });
        }
        continue;
      }
      const command = byKey.get(key as CommandKey);
      if (!command) continue;
      const label = commandLabel(command, model);
      out.push({
        command,
        danger: key === 'delete',
        key,
        kind: command.kind === 'choice' ? 'menu' : 'action',
        label,
        title: command.shortcut ? `${label} (${command.shortcut})` : label
      });
    }
    return out;
  });

  const count = $derived(selection.items.length);
  const blocked = $derived(codeHealth.broken);

  // ---- One row: what fits stays, the rest goes under その他 ▾ ----

  let barWidth = $state(0);
  let probe: HTMLDivElement | undefined = $state();
  let visible = $state(0);
  $effect(() => {
    // Measured again when the buttons or the width change.
    void items;
    const width = barWidth;
    const spans = probe ? ([...probe.children] as HTMLElement[]) : [];
    untrack(() => {
      if (spans.length < 2) return;
      const gap = 2;
      const widths = spans.map((span) => span.offsetWidth);
      const chip = widths[0];
      const more = widths.at(-1) ?? 0;
      const buttons = widths.slice(1, -1);
      const all = buttons.reduce((sum, w) => sum + gap + w, chip);
      if (all <= width) {
        visible = buttons.length;
        return;
      }
      const limit = width - more - gap;
      let used = chip;
      let n = 0;
      for (const w of buttons) {
        if (used + gap + w > limit) break;
        used += gap + w;
        n += 1;
      }
      visible = n;
    });
  });
  const shown = $derived(items.slice(0, visible));
  const overflow = $derived(items.slice(visible));

  // ---- Popovers: one open at a time; その他 may show one item's content ----

  let open = $state<string | undefined>();
  let moreItem = $state<BarItem | undefined>();
  const setOpen = (key: string, isOpen: boolean) => {
    if (isOpen) open = key;
    else if (open === key) open = undefined;
    if (key === 'more' && isOpen) moreItem = undefined;
  };
  // Not modal (as the add bar's forms): focus may leave for the inspector or the code.
  let closedOutside = false;
  const keepFocus = {
    trapFocus: false,
    onCloseAutoFocus: (event: Event) => {
      if (closedOutside) event.preventDefault();
      closedOutside = false;
    },
    onInteractOutside: () => {
      closedOutside = true;
    }
  };

  const run = (command: SelectionCommand, value?: string) => {
    void command.run(model, value);
  };
  const act = (item: BarItem) => {
    open = undefined;
    moreItem = undefined;
    if (item.command) run(item.command);
  };
  /** A menu's value: chosen, the menu closes. */
  const pick = (command: SelectionCommand, value: string) => {
    open = undefined;
    moreItem = undefined;
    run(command, value);
  };
  const fromMore = (item: BarItem) => {
    if (item.kind === 'action') act(item);
    else moreItem = item;
  };

  const currentOf = (command: SelectionCommand) => command.current?.(model);
  const choiceText = (choice: CommandChoice) =>
    choice.text ?? (choice.label ? t(choice.label) : choice.value);
  const rowLabel = (command: SelectionCommand) => commandLabel(command, model);

  const item =
    'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-sm whitespace-nowrap text-foreground hover:bg-muted aria-expanded:bg-muted aria-pressed:bg-accent/20 aria-pressed:text-accent aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';
  const menuItem =
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm whitespace-nowrap hover:bg-muted focus:bg-muted focus:outline-none aria-disabled:opacity-50';
  const dot =
    'size-4 shrink-0 rounded-full border-2 outline-foreground outline-offset-1 aria-pressed:outline-2';
  const seg =
    'rounded px-1.5 py-0.5 text-xs whitespace-nowrap hover:bg-muted aria-pressed:bg-accent/20 aria-pressed:text-accent';
</script>

{#snippet mixed()}
  <span class="text-xs text-muted-foreground" data-testid={TID.selectionBarMixed}
    >{t('sel.cmd.mixed')}</span>
{/snippet}

<!-- A choice command's values as a menu (形, 同じものを選ぶ). -->
{#snippet menu(command: SelectionCommand)}
  {@const current = currentOf(command)}
  <div
    role="menu"
    aria-label={rowLabel(command)}
    data-testid={TID.selectionBarMenu}
    data-cmd={command.key}
    data-current={current === MIXED ? 'mixed' : current}>
    {#if current === MIXED}
      <div class="px-2 py-1">{@render mixed()}</div>
    {/if}
    {#each command.choices?.(model) ?? [] as choice (choice.value)}
      <button
        type="button"
        role="menuitemradio"
        class={menuItem}
        aria-checked={current === choice.value}
        aria-disabled={blocked || undefined}
        data-testid={TID.selectionBarChoice}
        data-value={choice.value}
        onclick={() => pick(command, choice.value)}>
        <span class="w-3 shrink-0 text-xs" aria-hidden="true"
          >{current === choice.value ? '✓' : ''}</span>
        <span class="truncate">{choiceText(choice)}</span>
      </button>
    {/each}
  </div>
{/snippet}

<!-- One row of a group's popover: the label, then the values (swatch dots for a colour). -->
{#snippet row(command: SelectionCommand)}
  {@const current = currentOf(command)}
  {@const colour = colourCommands.has(command.key)}
  <div
    class="flex min-w-0 items-center gap-2"
    role="group"
    aria-label={rowLabel(command)}
    data-testid={TID.selectionBarRow}
    data-cmd={command.key}
    data-current={current === MIXED ? 'mixed' : current}>
    <span class="w-14 shrink-0 truncate text-xs text-muted-foreground">{rowLabel(command)}</span>
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-[3px]">
      {#if command.key === 'bold'}
        <button
          type="button"
          class={seg}
          aria-pressed={current === 'true'}
          aria-disabled={blocked || undefined}
          title={rowLabel(command)}
          data-testid={TID.selectionBarChoice}
          data-value="bold"
          onclick={() => run(command)}>{rowLabel(command)}</button>
      {:else}
        {#each command.choices?.(model) ?? [] as choice (choice.value)}
          {#if colour}
            <button
              type="button"
              class={[
                dot,
                choice.value === 'none' &&
                  'border-dashed border-border bg-[linear-gradient(135deg,transparent_45%,var(--color-border)_45%,var(--color-border)_55%,transparent_55%)]'
              ]}
              style:background-color={choice.value === 'none'
                ? undefined
                : (choice.swatch?.fill ?? choice.swatch?.stroke)}
              style:border-color={choice.value === 'none' ? undefined : choice.swatch?.stroke}
              title={choiceText(choice)}
              aria-label={choiceText(choice)}
              aria-pressed={current === choice.value}
              aria-disabled={blocked || undefined}
              data-testid={TID.selectionBarChoice}
              data-value={choice.value}
              onclick={() => run(command, choice.value)}></button>
          {:else}
            <button
              type="button"
              class={seg}
              aria-pressed={current === choice.value}
              aria-disabled={blocked || undefined}
              data-testid={TID.selectionBarChoice}
              data-value={choice.value}
              onclick={() => run(command, choice.value)}>{choiceText(choice)}</button>
          {/if}
        {/each}
      {/if}
      {#if current === MIXED}{@render mixed()}{/if}
    </div>
  </div>
{/snippet}

{#snippet content(entry: BarItem)}
  {#if entry.kind === 'menu' && entry.command}
    {@render menu(entry.command)}
  {:else if entry.kind === 'rows'}
    <div class="flex flex-col gap-1.5" data-testid={TID.selectionBarMenu} data-cmd={entry.key}>
      {#each entry.rows ?? [] as command (command.key)}
        {@render row(command)}
      {/each}
    </div>
  {/if}
{/snippet}

{#snippet caption(entry: BarItem)}
  <span class="truncate">{entry.label}</span>
  {#if entry.kind !== 'action'}<MoreIcon aria-hidden="true" />{/if}
{/snippet}

<div
  class="relative flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-hidden"
  role="toolbar"
  aria-label={t('sel.cmd.bar')}
  data-testid={TID.selectionBar}
  data-blocked={blocked || undefined}
  bind:clientWidth={barWidth}>
  <!-- The invisible copy the measuring reads: the count chip, every button, その他. -->
  <div
    bind:this={probe}
    class="pointer-events-none invisible absolute top-0 left-0 flex items-center gap-0.5 whitespace-nowrap"
    aria-hidden="true">
    <span class="inline-flex h-7 items-center gap-1 pr-1 pl-2 text-xs"
      >{t('sel.cmd.count', { count: String(count) })}<span class="size-5"></span></span>
    {#each items as entry (entry.key)}
      <span class={item}>{@render caption(entry)}</span>
    {/each}
    <span class={item}>{t('canvas.more')}<MoreIcon /></span>
  </div>

  <span class="inline-flex h-7 shrink-0 items-center gap-1 pr-1 pl-2 text-xs text-muted-foreground">
    <span data-testid={TID.selectionBarCount}>{t('sel.cmd.count', { count: String(count) })}</span>
    <button
      type="button"
      class="inline-flex size-5 items-center justify-center rounded text-sm text-foreground hover:bg-muted"
      title={t('insp.close')}
      aria-label={t('insp.close')}
      data-testid={TID.selectionBarClear}
      onclick={clearSelection}>✕</button>
  </span>

  {#each shown as entry (entry.key)}
    {#if entry.kind === 'action'}
      <button
        type="button"
        class={[item, entry.danger && 'text-destructive hover:text-destructive']}
        title={entry.title}
        aria-disabled={blocked || undefined}
        data-testid={TID.selectionBarItem}
        data-cmd={entry.key}
        onclick={() => act(entry)}>
        {@render caption(entry)}
      </button>
    {:else}
      <Popover.Root open={open === entry.key} onOpenChange={(isOpen) => setOpen(entry.key, isOpen)}>
        <Popover.Trigger
          class={item}
          title={entry.title}
          aria-disabled={blocked || undefined}
          data-testid={TID.selectionBarItem}
          data-cmd={entry.key}>
          {@render caption(entry)}
        </Popover.Trigger>
        <Popover.Content
          align="start"
          class={entry.kind === 'rows' ? 'w-80 p-3' : 'max-h-96 w-64 overflow-y-auto p-1'}
          data-selection-ui
          {...keepFocus}>
          {@render content(entry)}
        </Popover.Content>
      </Popover.Root>
    {/if}
  {/each}

  {#if overflow.length > 0}
    <Popover.Root open={open === 'more'} onOpenChange={(isOpen) => setOpen('more', isOpen)}>
      <Popover.Trigger class={item} title={t('canvas.more')} data-testid={TID.selectionBarMore}>
        <span>{t('canvas.more')}</span><MoreIcon aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Content
        align="start"
        class={moreItem?.kind === 'rows'
          ? 'w-80 p-3'
          : moreItem
            ? 'max-h-96 w-64 overflow-y-auto p-1'
            : 'w-64 p-1'}
        data-selection-ui
        {...keepFocus}>
        {#if moreItem}
          {@render content(moreItem)}
        {:else}
          <div
            role="menu"
            aria-label={t('canvas.more')}
            data-testid={TID.selectionBarMenu}
            data-cmd="more">
            {#each overflow as entry (entry.key)}
              <button
                type="button"
                role="menuitem"
                class={[menuItem, entry.danger && 'text-destructive']}
                title={entry.title}
                aria-disabled={blocked || undefined}
                data-testid={TID.selectionBarItem}
                data-cmd={entry.key}
                onclick={() => fromMore(entry)}>
                <span class="flex-1 truncate">{entry.label}</span>
                {#if entry.kind !== 'action'}<MoreIcon class="-rotate-90" aria-hidden="true" />{/if}
                {#if entry.command?.shortcut}<kbd class="font-sans text-xs text-muted-foreground"
                    >{entry.command.shortcut}</kbd
                  >{/if}
              </button>
            {/each}
          </div>
        {/if}
      </Popover.Content>
    </Popover.Root>
  {/if}
</div>
