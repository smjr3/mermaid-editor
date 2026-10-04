<script lang="ts">
  import { t } from '$/i18n';
  import Actions from '$/components/Actions.svelte';
  import Card from '$/components/Card/Card.svelte';
  import DiagramDocButton from '$/components/DiagramDocumentationButton.svelte';
  import Editor from '$/components/Editor.svelte';
  import EditorPaneToggle from '$/components/EditorPaneToggle.svelte';
  import EditorRail, { type RailTarget } from '$/components/EditorRail.svelte';
  import EnhancedEditsButton from '$/components/EnhancedEditsButton.svelte';
  import History from '$/components/History/History.svelte';
  import IconPacks from '$/components/IconPacks.svelte';
  import LayoutControls from '$/components/LayoutControls.svelte';
  import { startAutoSave } from '$/components/History/historyState.svelte';
  import McWrapper from '$/components/McWrapper.svelte';
  import MermaidChartIcon from '$/components/MermaidChartIcon.svelte';
  import EditorChooserModal from '$/components/migration/EditorChooserModal.svelte';
  import Navbar from '$/components/Navbar.svelte';
  import PanZoomToolbar from '$/components/PanZoomToolbar.svelte';
  import Preset from '$/components/Preset.svelte';
  import ResetConfigButton from '$/components/ResetConfigButton.svelte';
  import Share from '$/components/Share.svelte';
  import { TID } from '$/constants';
  import ToolsBar from '$/components/ToolsBar.svelte';
  import SyncRoughToolbar from '$/components/SyncRoughToolbar.svelte';
  import { Button } from '$/components/ui/button';
  import { Separator } from '$/components/ui/separator';
  import * as Resizable from '$/components/ui/resizable';
  import { Switch } from '$/components/ui/switch';
  import { Toggle } from '$/components/ui/toggle';
  import VersionSecurityToolbar from '$/components/VersionSecurityToolbar.svelte';
  import View from '$/components/View.svelte';
  import type { EditorMode, Tab } from '$/types';
  import { shouldShowEditorChooser } from '$/util/migration/domainMigration';
  import { editorFocus } from '$/util/editorFocus.svelte';
  import { PanZoomState } from '$/util/panZoom';
  import { env } from '$/util/env';
  import { validatedState, updateCodeStore, urls } from '$/util/state.svelte';
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

  let width = $state(0);
  let isMobile = $derived(width < 640);
  let isViewMode = $state(true);
  let showEditorChooser = $state(false);

  onMount(async () => {
    showEditorChooser = shouldShowEditorChooser();
    await initHandler();
    window.addEventListener('appinstalled', () => {
      logEvent('pwaInstalled', { isMobile });
    });
  });

  // Record the Timeline for the whole session, not just while the panel is open.
  onMount(() => startAutoSave());

  let isHistoryOpen = $state(false);

  let editorPane: Resizable.Pane | undefined;
  // Local: the editor column collapses to an icon rail (EditorPaneToggle, EditorRail).
  let isEditorCollapsed = $state(false);
  const railCards: Partial<Record<RailTarget, string>> = {
    actions: TID.actionsCard,
    icons: TID.iconPacksCard,
    layout: TID.layoutCard,
    samples: TID.sampleDiagramsCard
  };
  const openFromRail = async (target: RailTarget) => {
    editorPane?.expand();
    if (target === 'code' || target === 'config') {
      updateCodeStore({ editorMode: target });
      return;
    }
    const card = railCards[target];
    if (!card) return;
    editorFocus.value = false;
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
      {#if isEditorCollapsed && !isMobile}
        <EditorRail onopen={openFromRail} />
      {/if}
      <!-- Local: on desktop the editor column and the view are fixed panes split by a
           visible divider, with flat sections instead of floating cards. -->
      <Resizable.PaneGroup
        direction="horizontal"
        autoSaveId="liveEditor"
        class="min-w-0 flex-1 gap-4 p-2 pt-0 sm:gap-0 sm:border-t sm:p-0">
        <Resizable.Pane
          bind:this={editorPane}
          defaultSize={30}
          minSize={15}
          collapsible={!isMobile}
          collapsedSize={0}
          onCollapse={() => (isEditorCollapsed = true)}
          onExpand={() => (isEditorCollapsed = false)}>
          <div
            class="flex h-full flex-col gap-4 sm:gap-0 sm:bg-card sm:[&_.card]:rounded-none sm:[&_.card]:border-0 sm:[&_.card]:border-b sm:[&_.card]:border-border">
            <Card
              onselect={tabSelectHandler}
              isOpen
              tabs={editorTabs}
              activeTabID={validatedState.current.editorMode}
              isClosable={false}>
              {#snippet actions()}
                <ResetConfigButton />
                <DiagramDocButton />
                {#if !isMobile}
                  <EditorPaneToggle collapsed={false} ontoggle={() => editorPane?.collapse()} />
                {/if}
              {/snippet}
              <Editor {isMobile} />
            </Card>

            <ToolsBar />
            <div
              class={[
                // The tools scroll rather than squeeze the editor away.
                'group flex flex-wrap justify-between gap-4 sm:max-h-[55%] sm:shrink-0 sm:flex-col sm:flex-nowrap sm:gap-0 sm:overflow-y-auto',
                editorFocus.value && 'hidden'
              ]}>
              <LayoutControls />
              <IconPacks />
              <Preset />
              <Actions />
            </div>
          </div>
        </Resizable.Pane>
        <Resizable.Handle withHandle class="hidden sm:flex" />
        <Resizable.Pane minSize={15} class="relative flex h-full flex-1 flex-col overflow-hidden">
          <View {panZoomState} shouldShowGrid={validatedState.current.grid} />
          {#if env.isEnabledAiFeatures}<div class="absolute top-0 left-5 hidden md:block">
              <EnhancedEditsButton />
            </div>{/if}
          <div class="absolute top-0 right-0">
            <PanZoomToolbar {panZoomState} fullScreenHref={urls.current.view} />
          </div>
          <div class="absolute right-0 bottom-0"><VersionSecurityToolbar /></div>
          <div class="absolute bottom-0 left-0 sm:left-5"><SyncRoughToolbar /></div>
        </Resizable.Pane>
        {#if isHistoryOpen}
          <Resizable.Handle withHandle class="hidden sm:flex" />
          <Resizable.Pane
            minSize={15}
            defaultSize={30}
            class="hidden h-full grow flex-col sm:flex sm:bg-card sm:[&_.card]:rounded-none sm:[&_.card]:border-0">
            <History />
          </Resizable.Pane>
        {/if}
      </Resizable.PaneGroup>
    </div>
  </div>
</div>

<EditorChooserModal bind:open={showEditorChooser} />
