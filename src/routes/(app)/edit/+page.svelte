<script lang="ts">
  import { t } from '$/i18n';
  import Actions from '$/components/Actions.svelte';
  import AddControls from '$/components/AddControls.svelte';
  import AiTools from '$/components/AiTools.svelte';
  import Card from '$/components/Card/Card.svelte';
  import CodeErrorNotice from '$/components/CodeErrorNotice.svelte';
  import DiagramToolbar from '$/components/DiagramToolbar.svelte';
  import DiagramDocButton from '$/components/DiagramDocumentationButton.svelte';
  import Editor from '$/components/Editor.svelte';
  import EditorPaneToggle from '$/components/EditorPaneToggle.svelte';
  import EditorRail, { type RailTarget } from '$/components/EditorRail.svelte';
  import EnhancedEditsButton from '$/components/EnhancedEditsButton.svelte';
  import History from '$/components/History/History.svelte';
  import IconPacks from '$/components/IconPacks.svelte';
  import ColorControls from '$/components/ColorControls.svelte';
  import EditControls from '$/components/EditControls.svelte';
  import LayoutControls from '$/components/LayoutControls.svelte';
  import { startAutoSave } from '$/components/History/historyState.svelte';
  import McWrapper from '$/components/McWrapper.svelte';
  import MermaidChartIcon from '$/components/MermaidChartIcon.svelte';
  import EditorChooserModal from '$/components/migration/EditorChooserModal.svelte';
  import Navbar from '$/components/Navbar.svelte';
  import StyleCodeIcon from '$/components/StyleCodeIcon.svelte';
  import Preset from '$/components/Preset.svelte';
  import ResetConfigButton from '$/components/ResetConfigButton.svelte';
  import SelectionLayer from '$/components/SelectionLayer.svelte';
  import { TID } from '$/constants';
  import ToolsBar from '$/components/ToolsBar.svelte';
  import ToolsTabs from '$/components/ToolsTabs.svelte';
  import UndoRedoButtons from '$/components/UndoRedoButtons.svelte';
  import { Button } from '$/components/ui/button';
  import { Separator } from '$/components/ui/separator';
  import * as Resizable from '$/components/ui/resizable';
  import { Switch } from '$/components/ui/switch';
  import { Toggle } from '$/components/ui/toggle';
  import View from '$/components/View.svelte';
  import type { EditorMode, Tab } from '$/types';
  import { shouldShowEditorChooser } from '$/util/migration/domainMigration';
  import { PanZoomState } from '$/util/panZoom';
  import { env } from '$/util/env';
  import { inputState, validatedState, updateCodeStore, urls } from '$/util/state.svelte';
  import { codeHistory } from '$/util/undoStack.svelte';
  import { logEvent, logMermaidChartClick } from '$/util/stats';
  import { openSection, paneOrder, toolsAccordion } from '$/util/toolsPane.svelte';
  import { getContactSalesUrl, initHandler } from '$/util/util';
  import { onMount } from 'svelte';
  import CodeIcon from '~icons/custom/code';
  import HistoryIcon from '~icons/material-symbols/history';

  const panZoomState = new PanZoomState();

  const tabSelectHandler = (tab: Tab) => {
    const editorMode: EditorMode = tab.id === 'code' ? 'code' : 'config';
    updateCodeStore({ editorMode });
  };

  const editorTabs: Tab[] = [
    {
      icon: CodeIcon,
      id: 'code',
      title: t('editor.textTab')
    },
    {
      icon: StyleCodeIcon,
      id: 'config',
      title: t('editor.configTab'),
      tooltip: t('editor.configTabTooltip')
    }
  ];

  // Local: start from the window's width so the desktop panes are laid out on the first
  // render instead of mounting the tools pane a frame later.
  let width = $state(globalThis.window?.innerWidth ?? 0);
  let isMobile = $derived(width < 640);
  let isViewMode = $state(true);
  let showEditorChooser = $state(false);

  onMount(async () => {
    showEditorChooser = shouldShowEditorChooser();
    await initHandler();
    // Local: the loaded diagram is where undo starts; what the URL replaced is not a step back.
    codeHistory.reset(inputState.code);
    window.addEventListener('appinstalled', () => {
      logEvent('pwaInstalled', { isMobile });
    });
  });

  // Record the Timeline for the whole session, not just while the panel is open.
  onMount(() => startAutoSave());

  let isHistoryOpen = $state(false);
  let viewHost: HTMLDivElement | undefined = $state();

  // Local: three desktop panes — by default tools (left), diagram (centre), code (right);
  // the "swap panes" setting (toolsPane.svelte.ts) puts the code on the left as on
  // mermaid.live. Each side pane collapses to an icon rail (EditorRail) on its own side
  // whose icons reopen it on that section. A phone keeps upstream's code | diagram.
  let editorPane: Resizable.Pane | undefined = $state();
  let toolsPane: Resizable.Pane | undefined = $state();
  let isEditorCollapsed = $state(false);
  let isToolsCollapsed = $state(false);
  const codeLeft = $derived(isMobile || paneOrder.value === 'code-left');
  const codeSide = $derived(codeLeft ? 'left' : 'right');
  const toolsSide = $derived(codeLeft ? 'right' : 'left');
  // The tools get about a third of a wide window, where its forms go two columns.
  const toolsSize = $derived(width >= 1280 ? 32 : 25);
  const codeSize = $derived(isMobile ? 50 : width >= 1280 ? 27 : 25);
  // The tool cards are an accordion only in the desktop tools pane.
  $effect.pre(() => {
    toolsAccordion.enabled = !isMobile;
  });
  const railCards: Partial<Record<RailTarget, string>> = {
    actions: TID.actionsCard,
    add: TID.addCard,
    ai: TID.aiCard,
    colors: TID.colorsCard,
    edit: TID.editCard,
    icons: TID.iconPacksCard,
    layout: TID.layoutCard,
    samples: TID.sampleDiagramsCard
  };
  const openCodeFromRail = (target: RailTarget) => {
    editorPane?.expand();
    if (target === 'code' || target === 'config') {
      updateCodeStore({ editorMode: target });
    }
  };
  const openToolsFromRail = (target: RailTarget) => {
    toolsPane?.expand();
    const card = railCards[target];
    if (card) openSection(card);
  };
  $effect(() => {
    if (isMobile) {
      editorPane?.resize(50);
    }
  });
</script>

<div class="flex h-full flex-col overflow-hidden">
  {#snippet mobileToggle()}
    <div class="flex items-center gap-2">
      {t('editor.mobileEdit')}
      <Switch
        id="editorMode"
        class="data-[state=checked]:bg-accent"
        bind:checked={isViewMode}
        onclick={() => {
          logEvent('mobileViewToggle');
        }} />
      {t('editor.mobileView')}
    </div>
  {/snippet}

  <Navbar mobileToggle={isMobile ? mobileToggle : undefined}>
    <Toggle
      bind:pressed={isHistoryOpen}
      size="sm"
      title={t('editor.historyToggle')}
      aria-label={t('editor.historyToggle')}>
      <HistoryIcon />
    </Toggle>
    {#if env.isEnabledMermaidChartLinks}
      <Separator orientation="vertical" />
      <McWrapper labelPrefix="Opens ">
        <Button
          size="sm"
          href={getContactSalesUrl()}
          target="_blank"
          onclick={() => logMermaidChartClick('contactSales')}>
          <MermaidChartIcon />
          Contact sales
        </Button>
      </McWrapper>
      <McWrapper>
        <Button
          variant="accent"
          size="sm"
          href={urls.current.mermaidChart({ medium: 'save_diagram' }).save}
          target="_blank"
          onclick={() => logMermaidChartClick('saveDiagram')}>
          <MermaidChartIcon />
          Save diagram
        </Button>
      </McWrapper>
    {/if}
  </Navbar>

  <div class="relative flex flex-1 flex-col overflow-hidden" bind:clientWidth={width}>
    <div
      class={[
        'flex size-full',
        isMobile && ['w-[200%] duration-300', isViewMode && '-translate-x-1/2']
      ]}>
      {#snippet tools()}
        <LayoutControls />
        <AddControls />
        <EditControls />
        <ColorControls />
        <IconPacks />
        <Preset />
        <Actions />
        <AiTools />
      {/snippet}
      {#snippet codePane(order: number)}
        <Resizable.Pane
          bind:this={editorPane}
          id="pane-code"
          {order}
          defaultSize={codeSize}
          minSize={15}
          collapsible={!isMobile}
          collapsedSize={0}
          onResize={(size) => (isEditorCollapsed = !isMobile && size === 0)}>
          <div
            class={[
              'flex h-full flex-col gap-4 sm:gap-0 sm:bg-card sm:[&_.card]:rounded-none sm:[&_.card]:border-0 sm:[&_.card]:border-b sm:[&_.card]:border-border',
              isMobile ? 'overflow-y-auto [&>.card:first-child]:shrink-0' : 'code-pane'
            ]}
            data-side={codeSide}>
            <Card
              onselect={tabSelectHandler}
              isOpen
              tabs={editorTabs}
              activeTabID={validatedState.current.editorMode}
              isClosable={false}>
              {#snippet actions()}
                <UndoRedoButtons />
                <ResetConfigButton />
                <DiagramDocButton />
                {#if !isMobile}
                  <EditorPaneToggle
                    collapsed={false}
                    side={codeSide}
                    ontoggle={() => editorPane?.collapse()} />
                {/if}
              {/snippet}
              {#if isMobile}
                <!-- Local: on a phone the tool cards follow the editor in one scrolling
                     column; the editor keeps a usable height however many cards there are. -->
                <div class="h-full min-h-[40vh]"><Editor {isMobile} /></div>
              {:else}
                <Editor {isMobile} />
              {/if}
            </Card>

            {#if isMobile}
              <CodeErrorNotice testID={TID.toolsErrorNotice} />
              <div class="group flex flex-wrap justify-between gap-4">
                {@render tools()}
              </div>
            {/if}
          </div>
        </Resizable.Pane>
      {/snippet}
      {#snippet toolsColumn(order: number)}
        <Resizable.Pane
          bind:this={toolsPane}
          id="pane-tools"
          {order}
          defaultSize={toolsSize}
          minSize={15}
          collapsible
          collapsedSize={0}
          onResize={(size) => (isToolsCollapsed = size === 0)}>
          <div
            class="tools-pane flex h-full flex-col bg-card [&_.card]:rounded-none [&_.card]:border-0 [&_.card]:border-b [&_.card]:border-border"
            data-side={toolsSide}
            data-testid={TID.toolsPane}>
            <ToolsBar side={toolsSide} oncollapse={() => toolsPane?.collapse()} />
            <!-- Three tabs (作る / 直す / 出す), each an accordion of sections: one open at
                 a time, taking the rest of the pane and the only thing that scrolls. -->
            <ToolsTabs />
          </div>
        </Resizable.Pane>
      {/snippet}
      {#if !isMobile && (codeLeft ? isEditorCollapsed : isToolsCollapsed)}
        <EditorRail
          kind={codeLeft ? 'code' : 'tools'}
          side="left"
          onopen={codeLeft ? openCodeFromRail : openToolsFromRail} />
      {/if}
      <!-- Local: on desktop the tools, the diagram and the code are fixed panes split by
           visible dividers, with flat sections instead of floating cards. On mobile the
           tools stay under the editor, swiped against the diagram. Each order saves its
           own sizes, so swapping never applies one order's widths to the other. -->
      {#key codeLeft}
        <Resizable.PaneGroup
          direction="horizontal"
          autoSaveId={codeLeft ? 'liveEditor' : 'liveEditorToolsLeft'}
          class="min-w-0 flex-1 gap-4 p-2 pt-0 sm:gap-0 sm:border-t sm:p-0">
          {#if codeLeft}
            {@render codePane(1)}
            <Resizable.Handle withHandle class="hidden sm:flex" />
          {:else}
            {@render toolsColumn(1)}
            <Resizable.Handle withHandle />
          {/if}
          <Resizable.Pane
            id="pane-view"
            order={2}
            minSize={15}
            class="flex h-full flex-1 flex-col overflow-hidden">
            <DiagramToolbar {panZoomState} fullScreenHref={urls.current.view} />
            <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden" bind:this={viewHost}>
              <View {panZoomState} shouldShowGrid={validatedState.current.grid} />
              <!-- Local: click the diagram to select, then change it (SelectionLayer). -->
              <SelectionLayer host={viewHost} />
              <!-- Local: what is wrong with the code and the way back (codeHealth.svelte.ts). -->
              <div class="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-center">
                <!-- data-selection-avoid: the mini toolbar keeps clear of it. -->
                <div class="pointer-events-auto w-full max-w-xl" data-selection-avoid>
                  <CodeErrorNotice testID={TID.diagramErrorNotice} />
                </div>
              </div>
              {#if env.isEnabledAiFeatures}<div class="absolute top-0 left-5 hidden md:block">
                  <EnhancedEditsButton />
                </div>{/if}
            </div>
          </Resizable.Pane>
          {#if !codeLeft}
            <Resizable.Handle withHandle />
            {@render codePane(4)}
          {:else if !isMobile}
            <Resizable.Handle withHandle />
            {@render toolsColumn(4)}
          {/if}
        </Resizable.PaneGroup>
      {/key}
      {#if !isMobile && (codeLeft ? isToolsCollapsed : isEditorCollapsed)}
        <EditorRail
          kind={codeLeft ? 'tools' : 'code'}
          side="right"
          onopen={codeLeft ? openToolsFromRail : openCodeFromRail} />
      {/if}
    </div>
    {#if isHistoryOpen && !isMobile}
      <!-- Local: the history is a sheet over the code pane rather than a fourth pane, so
           the diagram keeps its width (a pane squeezed it to a sliver at 1280px). -->
      <aside
        class={[
          'absolute inset-y-0 z-30 flex w-96 max-w-[45%] flex-col border-border bg-card shadow-xl sm:border-t [&_.card]:rounded-none [&_.card]:border-0',
          codeSide === 'right' ? 'right-0 border-l' : 'left-0 border-r'
        ]}
        aria-label={t('editor.historyToggle')}
        data-testid={TID.historyPanel}>
        <History />
      </aside>
    {/if}
  </div>
</div>

<EditorChooserModal bind:open={showEditorChooser} />

<style>
  /* Local: a narrow code pane shows the editor header's buttons (tabs, undo/redo,
     reset, docs) as icons only, so the collapse button at its end stays in view. */
  .code-pane {
    container: code-pane / inline-size;
  }
  @container code-pane (max-width: 30rem) {
    .code-pane :global(.card > [role='toolbar'] :is(button, a)) {
      font-size: 0;
      gap: 0;
      padding-inline: 0.5rem;
    }
  }
  @container code-pane (max-width: 20rem) {
    .code-pane :global(.card > [role='toolbar'] :is(button, a)) {
      padding-inline: 0.25rem;
    }
    .code-pane :global(.card > [role='toolbar'] :is(div, ul)) {
      gap: 0.125rem;
    }
  }
  /* Local: the tool cards' forms in the desktop tools pane. Written against the cards'
     existing markup, so the cards themselves (also stacked under the editor on a phone)
     keep their own classes: controls at one height (h-9), a gap of 0.5rem in a section,
     a little more space above each section title. */
  .tools-pane :global(.card .min-w-fit) {
    min-width: 0;
  }
  .tools-pane :global(.card :is(button, a, select).h-8) {
    height: 2.25rem;
  }
  .tools-pane :global(.card .flex-col:has(> span.font-semibold:first-child)),
  .tools-pane :global(.card .flex.items-center.gap-1) {
    gap: 0.5rem;
  }
  .tools-pane :global(.card .flex-col:has(> span.font-semibold:first-child):not(:first-child)) {
    margin-top: 0.375rem;
  }
  /* A wide pane (about a third of a 1280px window) puts the label-and-control rows of a
     section side by side, two to a row, each label above its control. */
  @container (min-width: 25rem) {
    .tools-pane
      :global(
        .card
          .flex-col:has(
            > :is(label, div).items-center
              > span.shrink-0:first-child
              + :is(select, input):last-child
          )
      ) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .tools-pane
      :global(
        .card
          .flex-col:has(
            > :is(label, div).items-center
              > span.shrink-0:first-child
              + :is(select, input):last-child
          )
          > *
      ) {
      grid-column: 1 / -1;
    }
    .tools-pane
      :global(
        .card
          .flex-col
          > :is(label, div).items-center:has(
            > span.shrink-0:first-child + :is(select, input):last-child
          )
      ) {
      grid-column: auto;
      flex-direction: column;
      align-items: stretch;
      gap: 0.125rem;
    }
    .tools-pane
      :global(
        .card
          .flex-col
          > :is(label, div).items-center:has(
            > span.shrink-0:first-child + :is(select, input):last-child
          )
          > :is(select, input)
      ) {
      flex: none;
    }
    .tools-pane
      :global(
        .card
          .flex-col
          > :is(label, div).items-center:has(
            > span.shrink-0:first-child + :is(select, input):last-child
          )
          > span.shrink-0
      ) {
      width: auto;
    }
  }
</style>
