<script lang="ts" module>
  import type { Component } from 'svelte';

  /**
   * One button of the add bar: `run` adds at once (a shape, a lane); `form` opens a
   * popover with that entry's form (InsertBar renders it through the `form` snippet).
   */
  export interface InsertEntry {
    form?: boolean;
    icon?: Component;
    key: string;
    label: string;
    pressed?: boolean;
    run?: () => void;
    title?: string;
  }
</script>

<script lang="ts">
  import * as Popover from '$/components/ui/popover';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { Snippet } from 'svelte';
  import MoreIcon from '~icons/material-symbols/expand-more-rounded';

  // Local: the add bar's buttons (InsertBar.svelte): the first `inline` entries on the
  // bar, the rest under その他▾ (`moreLabel` names that menu otherwise: 追加▾ while the bar
  // shows the selection's commands and every entry is in the menu). An entry with a form
  // opens it in a popover under its button (under その他 for the entries in that menu);
  // one popover is open at a time.
  let {
    entries,
    form,
    inline = 5,
    moreLabel = t('canvas.more')
  }: {
    entries: InsertEntry[];
    form: Snippet<[key: string]>;
    inline?: number;
    moreLabel?: string;
  } = $props();

  const shown = $derived(entries.slice(0, inline));
  const more = $derived(entries.slice(inline));

  // The open popover: an entry's key, or 'more'; `moreForm` is the menu entry whose
  // form replaced the menu.
  let open = $state<string | undefined>();
  let moreForm = $state<string | undefined>();

  const setOpen = (key: string, isOpen: boolean) => {
    if (isOpen) open = key;
    else if (open === key) open = undefined;
    // その他 opens on its menu. (Not reset on closing: the form fades out as it was.)
    if (key === 'more' && isOpen) moreForm = undefined;
  };
  // The forms are not modal: focus may leave them for the inspector or the code (no focus
  // trap, which pulled a click into the inspector's 名前 field back into the form), and a
  // popover closed by such a click leaves focus there instead of sending it back to the
  // bar's button; Escape still does.
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
  const choose = (entry: InsertEntry) => {
    if (entry.form) {
      moreForm = entry.key;
      return;
    }
    open = undefined;
    moreForm = undefined;
    entry.run?.();
  };

  const item =
    'inline-flex h-7 max-w-[10rem] shrink-0 items-center gap-1 rounded-md px-2 text-sm whitespace-nowrap text-foreground hover:bg-muted aria-expanded:bg-muted aria-pressed:bg-accent/20 aria-pressed:text-accent [&_svg]:size-4 [&_svg]:shrink-0';
  const menuItem =
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none [&_svg]:size-4 [&_svg]:shrink-0';
  const content = 'w-80 p-3';
</script>

{#snippet label(entry: InsertEntry)}
  {#if entry.icon}<entry.icon aria-hidden="true" />{/if}
  <span class="truncate">{entry.label}</span>
{/snippet}

{#each shown as entry (entry.key)}
  {#if entry.form}
    <Popover.Root open={open === entry.key} onOpenChange={(isOpen) => setOpen(entry.key, isOpen)}>
      <Popover.Trigger
        class={item}
        title={entry.title ?? entry.label}
        data-testid={TID.canvasInsertItem}
        data-insert={entry.key}>
        {@render label(entry)}
      </Popover.Trigger>
      <Popover.Content align="start" class={content} data-selection-ui {...keepFocus}>
        {@render form(entry.key)}
      </Popover.Content>
    </Popover.Root>
  {:else}
    <button
      type="button"
      class={item}
      title={entry.title ?? entry.label}
      aria-pressed={entry.pressed}
      data-testid={TID.canvasInsertItem}
      data-insert={entry.key}
      onclick={() => entry.run?.()}>
      {@render label(entry)}
    </button>
  {/if}
{/each}

{#if more.length > 0}
  <Popover.Root open={open === 'more'} onOpenChange={(isOpen) => setOpen('more', isOpen)}>
    <Popover.Trigger class={item} title={moreLabel} data-testid={TID.canvasInsertMore}>
      <span>{moreLabel}</span><MoreIcon aria-hidden="true" />
    </Popover.Trigger>
    <Popover.Content
      align="start"
      class={moreForm ? content : 'w-64 p-1'}
      data-selection-ui
      {...keepFocus}>
      {#if moreForm}
        {@render form(moreForm)}
      {:else}
        <div role="menu" aria-label={moreLabel} data-testid={TID.canvasInsertMenu}>
          {#each more as entry (entry.key)}
            <button
              type="button"
              role="menuitem"
              class={menuItem}
              title={entry.title ?? entry.label}
              data-testid={TID.canvasInsertItem}
              data-insert={entry.key}
              onclick={() => choose(entry)}>
              {@render label(entry)}
            </button>
          {/each}
        </div>
      {/if}
    </Popover.Content>
  </Popover.Root>
{/if}
