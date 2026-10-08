<script lang="ts">
  import Actions from '$/components/Actions.svelte';
  import AddControls from '$/components/AddControls.svelte';
  import AiTools from '$/components/AiTools.svelte';
  import CodeErrorNotice from '$/components/CodeErrorNotice.svelte';
  import ColorControls from '$/components/ColorControls.svelte';
  import EditControls from '$/components/EditControls.svelte';
  import IconPacks from '$/components/IconPacks.svelte';
  import LayoutControls from '$/components/LayoutControls.svelte';
  import Preset from '$/components/Preset.svelte';
  import SelectionPanel from '$/components/SelectionPanel.svelte';
  import ShareLinks from '$/components/ShareLinks.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { showTab, toolsAccordion, toolsTabs, type ToolsTab } from '$/util/toolsPane.svelte';
  import type { Component } from 'svelte';
  import FixIcon from '~icons/material-symbols/build-outline-rounded';
  import MakeIcon from '~icons/material-symbols/draw-outline-rounded';
  import OutIcon from '~icons/material-symbols/ios-share-rounded';

  // Local: the desktop tools pane's three tabs — 作る (templates and new diagrams; AI
  // briefing and unknown icons), 直す (the selection, then add, layout, edit, colours,
  // icons) and 出す (export; share links) — each an accordion of
  // sections (Card.svelte, toolsPane.svelte.ts), one open at a time.
  //
  // The panels sit side by side in a strip that scrolls sideways, the active one in
  // view. Every section header stays in the page, so a header in another tab can be
  // reached (by the keyboard, the command palette or a test) and clicking it shows
  // its tab; focus moving into another panel shows that panel's tab too.
  const icons: Record<ToolsTab, Component> = { fix: FixIcon, make: MakeIcon, out: OutIcon };
  const index = $derived(toolsTabs.findIndex(({ id }) => id === toolsAccordion.tab));

  let strip: HTMLDivElement | undefined = $state();
  let width = $state(0);
  // Where each panel starts in the strip. A gap between the panels keeps a sliver of
  // the next one out of view when the pane's width is not a whole number of pixels.
  const panelLeft = (at: number) => (strip?.children[at] as HTMLElement | undefined)?.offsetLeft;
  // Keep the active panel in view (also after the pane is resized).
  $effect(() => {
    void width;
    const left = panelLeft(index);
    if (strip && left !== undefined && Math.abs(strip.scrollLeft - left) > 1) {
      strip.scrollLeft = left;
    }
  });
  // Something scrolled another panel into view (a header was scrolled to): show its tab.
  const onscroll = () => {
    if (!strip) return;
    const scrolled = strip.scrollLeft;
    const at = toolsTabs.findIndex((_, i) => Math.abs((panelLeft(i) ?? -99) - scrolled) < 2);
    if (at !== -1 && at !== index) toolsAccordion.tab = toolsTabs[at].id;
  };
  const onfocusin = (tab: ToolsTab) => {
    if (toolsAccordion.tab !== tab) toolsAccordion.tab = tab;
  };
  const onkeydown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = toolsTabs[(index + step + toolsTabs.length) % toolsTabs.length].id;
    showTab(next);
    document.querySelector<HTMLElement>(`[data-testid="${TID.toolsTab}-${next}"]`)?.focus();
  };
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div
    class="flex shrink-0 gap-1 border-b border-border px-2 pt-1"
    role="tablist"
    aria-label={t('tools.tabs')}
    tabindex="-1"
    {onkeydown}>
    {#each toolsTabs as tab (tab.id)}
      {@const Icon = icons[tab.id]}
      {@const active = toolsAccordion.tab === tab.id}
      <button
        type="button"
        role="tab"
        id={`tools-tab-${tab.id}`}
        aria-selected={active}
        aria-controls={`tools-panel-${tab.id}`}
        tabindex={active ? 0 : -1}
        class={[
          '-mb-px flex flex-1 items-center justify-center gap-1.5 rounded-t-md border border-b-0 px-2 py-1.5 text-sm font-semibold',
          active
            ? 'border-border bg-card text-foreground'
            : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
        ]}
        data-testid={`${TID.toolsTab}-${tab.id}`}
        onclick={() => showTab(tab.id)}>
        <Icon class="size-4" />{t(`tools.tab.${tab.id}`)}
      </button>
    {/each}
  </div>
  <!-- Local: a code error and the way back, above whichever tab is open (codeHealth.svelte.ts). -->
  <CodeErrorNotice testID={TID.toolsErrorNotice} compact />
  <div
    bind:this={strip}
    bind:clientWidth={width}
    class="relative flex min-h-0 flex-1 gap-8 overflow-hidden"
    {onscroll}>
    {#each toolsTabs as tab (tab.id)}
      <div
        id={`tools-panel-${tab.id}`}
        role="tabpanel"
        aria-labelledby={`tools-tab-${tab.id}`}
        class="@container flex h-full w-full min-w-full shrink-0 flex-col overflow-hidden"
        data-testid={`${TID.toolsTabPanel}-${tab.id}`}
        data-active={toolsAccordion.tab === tab.id}
        onfocusin={() => onfocusin(tab.id)}>
        {#if tab.id === 'make'}
          <Preset />
          <AiTools />
        {:else if tab.id === 'fix'}
          <SelectionPanel />
          <AddControls />
          <LayoutControls />
          <EditControls />
          <ColorControls />
          <IconPacks />
        {:else}
          <Actions />
          <ShareLinks />
        {/if}
      </div>
    {/each}
  </div>
</div>
