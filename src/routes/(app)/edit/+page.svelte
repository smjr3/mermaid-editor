<script lang="ts">
  import { t } from '$/i18n';
  import Actions from '$/components/Actions.svelte';
  import AddControls from '$/components/AddControls.svelte';
  import Card from '$/components/Card/Card.svelte';
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
  import Preset from '$/components/Preset.svelte';
  import ResetConfigButton from '$/components/ResetConfigButton.svelte';
  import Share from '$/components/Share.svelte';
  import { TID } from '$/constants';
  import ToolsBar from '$/components/ToolsBar.svelte';
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
  import { getContactSalesUrl, initHandler } from '$/util/util';
  import { onMount, tick } from 'svelte';
  import CodeIcon from '~icons/custom/code';
  import HistoryIcon from '~icons/material-symbols/history';
  import GearIcon from '~icons/material-symbols/settings-outline-rounded';

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
      icon: GearIcon,
      id: 'config',
      title: t('editor.configTab')
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

  // Local: three desktop panes — code (left), diagram (centre), tools (right). Each side
  // pane collapses to an icon rail (EditorRail) whose icons reopen it on that section.
  let editorPane: Resizable.Pane | undefined;
  let toolsPane: Resizable.Pane | undefined = $state();
  let isEditorCollapsed = $state(false);
  let isToolsCollapsed = $state(false);
  const railCards: Partial<Record<RailTarget, string>> = {
    actions: TID.actionsCard,
    add: TID.addCard,
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
  const openToolsFromRail = async (target: RailTarget) => {
    toolsPane?.expand();
    const card = railCards[target];
    if (!card) return;
    await tick();
    const header = document.querySelector<HTMLElement>(`[data-testid="${card}"]`);
    if (header && !header.closest('.card')?.classList.contains('isOpen')) header.click();
    header?.scrollIntoView({ block: 'nearest' });
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
    <Share />
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

  <div class="flex flex-1 flex-col overflow-hidden" bind:clientWidth={width}>
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
      {/snippet}
      {#if isEditorCollapsed && !isMobile}
        <EditorRail side="left" onopen={openCodeFromRail} />
      {/if}
      <!-- Local: on desktop the code, the diagram and the tools are fixed panes split by
           visible dividers, with flat sections instead of floating cards. On mobile the
           tools stay under the editor, swiped against the diagram. -->
      <Resizable.PaneGroup
        direction="horizontal"
        autoSaveId="liveEditor"
        class="min-w-0 flex-1 gap-4 p-2 pt-0 sm:gap-0 sm:border-t sm:p-0">
        <Resizable.Pane
          bind:this={editorPane}
          id="pane-code"
          order={1}
          defaultSize={isMobile ? 50 : 25}
          minSize={15}
          collapsible={!isMobile}
          collapsedSize={0}
          onResize={(size) => (isEditorCollapsed = !isMobile && size === 0)}>
          <div
            class={[
              'flex h-full flex-col gap-4 sm:gap-0 sm:bg-card sm:[&_.card]:rounded-none sm:[&_.card]:border-0 sm:[&_.card]:border-b sm:[&_.card]:border-border',
              !isMobile && 'code-pane'
            ]}>
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
                  <EditorPaneToggle collapsed={false} ontoggle={() => editorPane?.collapse()} />
                {/if}
              {/snippet}
              <Editor {isMobile} />
            </Card>

            {#if isMobile}
              <div class="group flex flex-wrap justify-between gap-4">
                {@render tools()}
              </div>
            {/if}
          </div>
        </Resizable.Pane>
        <Resizable.Handle withHandle class="hidden sm:flex" />
        <Resizable.Pane
          id="pane-view"
          order={2}
          minSize={15}
          class="flex h-full flex-1 flex-col overflow-hidden">
          <DiagramToolbar {panZoomState} fullScreenHref={urls.current.view} />
          <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <View {panZoomState} shouldShowGrid={validatedState.current.grid} />
            {#if env.isEnabledAiFeatures}<div class="absolute top-0 left-5 hidden md:block">
                <EnhancedEditsButton />
              </div>{/if}
          </div>
        </Resizable.Pane>
        {#if isHistoryOpen}
          <Resizable.Handle withHandle class="hidden sm:flex" />
          <Resizable.Pane
            id="pane-history"
            order={3}
            minSize={15}
            defaultSize={30}
            class="hidden h-full grow flex-col sm:flex sm:bg-card sm:[&_.card]:rounded-none sm:[&_.card]:border-0">
            <History />
          </Resizable.Pane>
        {/if}
        {#if !isMobile}
          <Resizable.Handle withHandle />
          <Resizable.Pane
            bind:this={toolsPane}
            id="pane-tools"
            order={4}
            defaultSize={25}
            minSize={15}
            collapsible
            collapsedSize={0}
            onResize={(size) => (isToolsCollapsed = size === 0)}>
            <div
              class="flex h-full flex-col bg-card [&_.card]:rounded-none [&_.card]:border-0 [&_.card]:border-b [&_.card]:border-border"
              data-testid={TID.toolsPane}>
              <ToolsBar oncollapse={() => toolsPane?.collapse()} />
              <!-- The cards scroll in their own column, independent of the code. -->
              <div class="group flex min-h-0 flex-1 flex-col overflow-y-auto">
                {@render tools()}
              </div>
            </div>
          </Resizable.Pane>
        {/if}
      </Resizable.PaneGroup>
      {#if isToolsCollapsed && !isMobile}
        <EditorRail side="right" onopen={openToolsFromRail} />
      {/if}
    </div>
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
</style>
