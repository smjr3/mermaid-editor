<script lang="ts">
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { displayName } from '$/util/displayName';
  import {
    availableCommands,
    commandLabel,
    MIXED,
    type CommandChoice,
    type CommandKey,
    type SelectionCommand
  } from '$/util/selectionCommands';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { onMount, tick } from 'svelte';

  // Local: the right-click menu over the diagram (SelectionLayer.svelte). Its rows are
  // the command registry's (selectionCommands.ts), the same operations with the same
  // words as the add bar and the inspector, and every one completes in place: an
  // `action` is one row (label, its key on the right, 削除 in red at the end); a
  // `choice` is a row 「ラベル ▸」 whose submenu lists the values one per line with the
  // current one checked (「まちまち」 in its header when the selected items differ). The
  // three colour commands share one submenu 「色 ▸」 with a line of swatch dots each
  // (塗り / 枠 / 文字, 「テーマ標準」 first). On several items the header shows the count
  // and every row acts on them all (the registry hides what needs a single item). On
  // the empty canvas: add a node, fit the diagram to the view. Arrow keys move, Enter
  // or Space choose, ArrowRight opens a submenu (hover does too), ArrowLeft closes it,
  // Escape closes the menu. A submenu flips to the left near the right edge and is
  // clamped to the host, so nothing is cut off. The space before a key belongs to the
  // label and is written only with a key, so a row without one ends on its label, not
  // on whitespace.
  let {
    x,
    y,
    target,
    hostWidth,
    hostHeight,
    onclose
  }: {
    x: number;
    y: number;
    target: 'selection' | 'canvas';
    hostWidth: number;
    hostHeight: number;
    onclose: () => void;
  } = $props();

  let menu: HTMLDivElement | undefined = $state();
  let width = $state(0);
  let height = $state(0);
  const left = $derived(Math.max(4, Math.min(x, hostWidth - width - 4)));
  const top = $derived(Math.max(4, Math.min(y, hostHeight - height - 4)));

  const run = (action: () => unknown) => {
    onclose();
    void action();
  };
  const fit = () => {
    document.querySelector<HTMLElement>(`[data-testid="${TID.resetViewButton}"]`)?.click();
  };

  // The test ids the rows had before the registry, kept for the specs that use them.
  const legacyKey: Partial<Record<CommandKey, string>> = {
    addNext: 'add-after',
    connectFrom: 'connect'
  };
  const colourKeys = new Set<CommandKey>(['fillColor', 'strokeColor', 'textColor']);

  type Row =
    | { kind: 'action'; key: string; command: SelectionCommand }
    | { kind: 'sub'; key: string; label: string; commands: SelectionCommand[] };

  // Read from the model alone (never from the props): a row's command runs after the
  // menu has closed, when the props it was opened with are gone.
  const commands = $derived(availableCommands(model));
  const rows = $derived.by((): Row[] => {
    const list: Row[] = [];
    let colours: Row | undefined;
    for (const command of commands) {
      if (command.key === 'delete') continue;
      if (colourKeys.has(command.key)) {
        if (!colours) {
          colours = { commands: [], key: 'color', kind: 'sub', label: t('sel.color') };
          list.push(colours);
        }
        if (colours.kind === 'sub') colours.commands.push(command);
      } else if (command.kind === 'choice') {
        list.push({
          commands: [command],
          key: command.key,
          kind: 'sub',
          label: commandLabel(command, model)
        });
      } else {
        list.push({ command, key: legacyKey[command.key] ?? command.key, kind: 'action' });
      }
    }
    return list;
  });
  const deleteCommand = $derived(commands.find((command) => command.key === 'delete'));
  const header = $derived.by(() => {
    if (target !== 'selection') return '';
    if (model.multiple) return t('sel.cmd.count', { count: String(model.targets.length) });
    if (model.edge) return `${t('sel.edge')} ${model.edge.title}`;
    if (model.object) {
      return displayName(model.object.label, model.object.id, model.objects?.items ?? []);
    }
    return '';
  });

  const choiceLabel = (choice: CommandChoice) =>
    choice.label ? t(choice.label) : (choice.text ?? choice.value);
  const current = (command: SelectionCommand) => command.current?.(model);

  // The open submenu, placed beside its row: to the right, or to the left near the
  // host's right edge, and moved up when it would run past the bottom.
  let openSub = $state<string | undefined>();
  let subPanel = $state<HTMLDivElement | undefined>();
  let subTop = $state(0);
  let subLeftSide = $state(false);
  $effect(() => {
    const panel = subPanel;
    const key = openSub;
    if (!panel || !key || !menu) return;
    const row = menu.querySelector<HTMLElement>(`[data-sub="${key}"]`);
    const rowTop = (row?.offsetTop ?? 0) - 4;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    subLeftSide = left + width + panelWidth + 4 > hostWidth && left - panelWidth >= 4;
    subTop = Math.max(4 - top, Math.min(rowTop, hostHeight - top - panelHeight - 4));
  });
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  const hoverRow = (key?: string) => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => (openSub = key), key ? 80 : 160);
  };
  const keepSub = () => clearTimeout(hoverTimer);
  const openAndFocus = (key: string) => {
    clearTimeout(hoverTimer);
    openSub = key;
    void tick().then(() => subItems()[0]?.focus());
  };
  const closeSub = () => {
    const key = openSub;
    openSub = undefined;
    if (key) menu?.querySelector<HTMLElement>(`[data-sub="${key}"]`)?.focus();
  };

  const topItems = () =>
    [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].filter(
      (element) => !subPanel?.contains(element)
    );
  const subItems = () => [
    ...(subPanel?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])
  ];
  onMount(() => {
    void tick().then(() => topItems()[0]?.focus());
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !menu?.contains(event.target)) onclose();
    };
    // A wheel zooms the diagram under the menu, which would then point at nothing.
    const wheel = (event: WheelEvent) => {
      if (!(event.target instanceof Node) || !menu?.contains(event.target)) onclose();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('wheel', wheel, { capture: true, passive: true });
    return () => {
      clearTimeout(hoverTimer);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('wheel', wheel, { capture: true });
    };
  });
  const onkeydown = (event: KeyboardEvent) => {
    const active = document.activeElement as HTMLElement | null;
    const inSub = !!active && !!subPanel?.contains(active);
    const list = inSub ? subItems() : topItems();
    const at = list.indexOf(active as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onclose();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    } else if (event.key === 'ArrowRight' && !inSub) {
      const key = active?.dataset.sub;
      if (key) {
        event.preventDefault();
        openAndFocus(key);
      }
    } else if (event.key === 'ArrowLeft' && inSub) {
      event.preventDefault();
      closeSub();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      list.at(event.key === 'Home' ? 0 : -1)?.focus();
    }
  };
  const item =
    'flex w-full items-center gap-4 rounded px-2 py-1.5 text-left text-sm whitespace-nowrap hover:bg-muted focus:bg-muted focus:outline-none';
  const choiceItem =
    'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm whitespace-nowrap hover:bg-muted focus:bg-muted focus:outline-none';
  const dot =
    'size-4 shrink-0 rounded-full border-2 outline-offset-1 hover:outline-2 hover:outline-muted-foreground focus:outline-2 focus:outline-foreground focus:outline-none';
</script>

<div
  bind:this={menu}
  class="absolute z-30 flex w-60 flex-col rounded-lg border bg-card p-1 shadow-lg"
  style:left={`${left}px`}
  style:top={`${top}px`}
  role="menu"
  tabindex="-1"
  aria-label={t('sel.menu')}
  data-selection-ui
  data-testid={TID.contextMenu}
  bind:offsetWidth={width}
  bind:offsetHeight={height}
  {onkeydown}>
  {#snippet entry(key: string, label: string, action: () => unknown, shortcut = '', danger = false)}
    <button
      type="button"
      role="menuitem"
      class={[item, danger && 'text-destructive']}
      data-testid={`${TID.contextMenuItem}-${key}`}
      onpointerenter={() => hoverRow()}
      onclick={() => run(action)}>
      <span class="flex-1 truncate">{label}{shortcut ? ' ' : ''}</span>{#if shortcut}<kbd
          class="font-sans text-xs text-muted-foreground">{shortcut}</kbd
        >{/if}
    </button>
  {/snippet}
  {#snippet check(on: boolean)}
    <span class="w-3 shrink-0 text-xs" aria-hidden="true">{on ? '✓' : ''}</span>
  {/snippet}
  {#if target === 'canvas'}
    {#if model.kind}
      {@render entry('add-node', t('sel.addNode'), model.addNode)}
    {/if}
    {@render entry('fit', t('sel.fit'), fit)}
  {:else}
    {#if header}
      <div
        class="truncate px-2 py-1 text-xs text-muted-foreground"
        data-testid={`${TID.contextMenu}-name`}>
        {header}
      </div>
    {/if}
    {#each rows as row (row.key)}
      {#if row.kind === 'action'}
        {@const checked = current(row.command) === 'true'}
        <button
          type="button"
          role="menuitem"
          class={item}
          data-checked={row.command.current ? checked : undefined}
          data-testid={`${TID.contextMenuItem}-${row.key}`}
          onpointerenter={() => hoverRow()}
          onclick={() => run(() => row.command.run(model))}
          ><span class="flex-1 truncate"
            >{commandLabel(row.command, model)}{row.command.shortcut ? ' ' : ''}</span
          >{#if row.command.current && checked}<span class="shrink-0 text-xs" aria-hidden="true"
              >✓</span
            >{/if}{#if row.command.shortcut}<kbd class="font-sans text-xs text-muted-foreground"
              >{row.command.shortcut}</kbd
            >{/if}
        </button>
      {:else}
        <button
          type="button"
          role="menuitem"
          class={[item, openSub === row.key && 'bg-muted']}
          aria-haspopup="menu"
          aria-expanded={openSub === row.key}
          data-sub={row.key}
          data-testid={`${TID.contextMenuSub}-${row.key}`}
          onpointerenter={() => hoverRow(row.key)}
          onclick={() => (openSub === row.key ? closeSub() : openAndFocus(row.key))}>
          <span class="flex-1 truncate">{row.label}</span>
          <span class="text-xs text-muted-foreground" aria-hidden="true">▸</span>
        </button>
      {/if}
    {/each}
    {#if deleteCommand}
      {@const command = deleteCommand}
      <div class="my-1 h-px bg-border"></div>
      {@render entry(
        'delete',
        commandLabel(command, model),
        () => command.run(model),
        command.shortcut,
        true
      )}
    {/if}
    {#each rows as row (row.key)}
      {#if row.kind === 'sub' && openSub === row.key}
        <div
          bind:this={subPanel}
          class="absolute z-40 flex min-w-40 flex-col overflow-y-auto rounded-lg border bg-card p-1 shadow-lg"
          style:top={`${subTop}px`}
          style:left={subLeftSide ? undefined : '100%'}
          style:right={subLeftSide ? '100%' : undefined}
          style:max-height={`${Math.max(hostHeight - 8, 40)}px`}
          role="menu"
          tabindex="-1"
          aria-label={row.label}
          data-testid={`${TID.contextMenuSub}-${row.key}-panel`}
          data-side={subLeftSide ? 'left' : 'right'}
          onpointerenter={keepSub}>
          {#if row.key === 'color'}
            {#each row.commands as command (command.key)}
              {@const value = current(command)}
              <div class="flex items-center gap-[3px] px-2 py-1 whitespace-nowrap">
                <span class="min-w-8 shrink-0 text-sm">{commandLabel(command, model)}</span>
                {#if value === MIXED}
                  <span class="mr-1 text-xs text-muted-foreground">{t('sel.cmd.mixed')}</span>
                {/if}
                {#each command.choices?.(model) ?? [] as choice (choice.value)}
                  {#if choice.swatch}
                    <button
                      type="button"
                      role="menuitemradio"
                      class={[dot, value === choice.value && 'outline-2 outline-foreground']}
                      style:background-color={choice.swatch.fill ?? choice.swatch.stroke}
                      style:border-color={choice.swatch.stroke}
                      title={choiceLabel(choice)}
                      aria-label={choiceLabel(choice)}
                      aria-checked={value === choice.value}
                      data-testid={`${TID.contextMenuChoice}-${command.key}-${choice.value}`}
                      onclick={() => run(() => command.run(model, choice.value))}></button>
                  {:else}
                    <button
                      type="button"
                      role="menuitemradio"
                      class={[
                        'mr-1 shrink-0 rounded border border-dashed px-1 text-xs hover:bg-muted focus:bg-muted focus:outline-none',
                        value === choice.value && 'border-foreground'
                      ]}
                      aria-checked={value === choice.value}
                      data-testid={`${TID.contextMenuChoice}-${command.key}-${choice.value}`}
                      onclick={() => run(() => command.run(model, choice.value))}>
                      {choiceLabel(choice)}
                    </button>
                  {/if}
                {/each}
              </div>
            {/each}
          {:else}
            {#each row.commands as command (command.key)}
              {@const value = current(command)}
              {#if value === MIXED}
                <div class="px-2 py-1 text-xs text-muted-foreground">{t('sel.cmd.mixed')}</div>
              {/if}
              {#each command.choices?.(model) ?? [] as choice (choice.value)}
                <button
                  type="button"
                  role="menuitemradio"
                  class={choiceItem}
                  aria-checked={value === choice.value}
                  data-testid={`${TID.contextMenuChoice}-${command.key}-${choice.value}`}
                  onclick={() => run(() => command.run(model, choice.value))}>
                  {@render check(value === choice.value)}
                  <span class="flex-1 truncate">{choiceLabel(choice)}</span>
                </button>
              {/each}
            {/each}
          {/if}
        </div>
      {/if}
    {/each}
  {/if}
</div>
