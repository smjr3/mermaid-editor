<script lang="ts">
  import { t } from '$/i18n';
  import CanvasPane from '$/components/canvas/CanvasPane.svelte';
  import ExportDialog from '$/components/dialogs/ExportDialog.svelte';
  import NewDiagramDialog from '$/components/dialogs/NewDiagramDialog.svelte';
  import ShareDialog from '$/components/dialogs/ShareDialog.svelte';
  import CodePane from '$/components/editor/CodePane.svelte';
  import PaneRail from '$/components/editor/PaneRail.svelte';
  import History from '$/components/History/History.svelte';
  import { startAutoSave } from '$/components/History/historyState.svelte';
  import Inspector from '$/components/inspector/Inspector.svelte';
  import McWrapper from '$/components/McWrapper.svelte';
  import MermaidChartIcon from '$/components/MermaidChartIcon.svelte';
  import EditorChooserModal from '$/components/migration/EditorChooserModal.svelte';
  import Navbar from '$/components/Navbar.svelte';
  import { Button } from '$/components/ui/button';
  import * as Resizable from '$/components/ui/resizable';
  import { TID } from '$/constants';
  import { editorUi } from '$/util/editorUi.svelte';
  import {
    CODE_MIN,
    editorCodeCollapsed,
    editorInspectorCollapsed,
    INSPECTOR_MAX,
    INSPECTOR_MIN,
    paneSizesFor,
    rememberPaneSizes
  } from '$/util/editorLayout.svelte';
  import { env } from '$/util/env';
  import { shouldShowEditorChooser } from '$/util/migration/domainMigration';
  import { inputState, urls } from '$/util/state.svelte';
  import { logEvent, logMermaidChartClick } from '$/util/stats';
  import { codeHistory } from '$/util/undoStack.svelte';
  import { getContactSalesUrl, initHandler } from '$/util/util';
  import { onMount, untrack } from 'svelte';
  import CodeIcon from '~icons/custom/code';
  import InspectorIcon from '~icons/material-symbols/tune-rounded';

  // Local: the editor is three columns (PC only): code | diagram | inspector. The code
  // pane and the inspector fold to a thin rail each; their widths and whether they are
  // folded are remembered (editorLayout.svelte.ts). The header's 新規, 共有 and 書き出す
  // open dialogs (editorUi.svelte.ts); the history is a sheet over the inspector side.
  let showEditorChooser = $state(false);
  let isHistoryOpen = $state(false);

  // The widths, in % of the window, from the stored ones or 270px / 300px.
  const initialSizes = paneSizesFor(globalThis.window?.innerWidth ?? 1280);

  let codePane: Resizable.Pane | undefined = $state();
  let inspectorPane: Resizable.Pane | undefined = $state();
  let isCodeCollapsed = $state(untrack(() => editorCodeCollapsed.value));
  let isInspectorCollapsed = $state(untrack(() => editorInspectorCollapsed.value));

  editorUi.inspectorCollapsed = untrack(() => isInspectorCollapsed);
  // Only once the stored layout is applied does a pane's size say what the user chose:
  // paneforge reports the default sizes first.
  let layoutReady = false;
  const setCodeCollapsed = (collapsed: boolean) => {
    isCodeCollapsed = collapsed;
    if (layoutReady && editorCodeCollapsed.value !== collapsed) {
      editorCodeCollapsed.value = collapsed;
    }
  };
  const setInspectorCollapsed = (collapsed: boolean) => {
    isInspectorCollapsed = collapsed;
    editorUi.inspectorCollapsed = collapsed;
    if (layoutReady && editorInspectorCollapsed.value !== collapsed) {
      editorInspectorCollapsed.value = collapsed;
    }
  };

  // Lays the panes out as stored: after the first render, and again once the
  // migrations (initHandler) may have seeded the widths from the previous layout.
  const applyStoredLayout = () => {
    const sizes = paneSizesFor(window.innerWidth);
    for (const [pane, size, collapsed] of [
      [codePane, sizes.code, editorCodeCollapsed.value],
      [inspectorPane, sizes.inspector, editorInspectorCollapsed.value]
    ] as const) {
      if (!pane) continue;
      if (collapsed) {
        if (!pane.isCollapsed()) pane.collapse();
      } else {
        if (pane.isCollapsed()) pane.expand();
        if (Math.abs(pane.getSize() - size) > 0.5) pane.resize(size);
      }
    }
  };

  // The inspector is asked to focus a control (the right-click menu): show it first.
  $effect(() => {
    if (!editorUi.focus) return;
    untrack(() => {
      if (inspectorPane?.isCollapsed()) inspectorPane.expand();
    });
  });

  // A drag that ends remembers the widths the panes were left at.
  const onDragging = (dragging: boolean) => {
    if (dragging) return;
    rememberPaneSizes({ code: codePane?.getSize(), inspector: inspectorPane?.getSize() });
  };

  onMount(async () => {
    showEditorChooser = shouldShowEditorChooser();
    setTimeout(applyStoredLayout);
    await initHandler();
    applyStoredLayout();
    layoutReady = true;
    // Local: the loaded diagram is where undo starts; what the URL replaced is not a step back.
    codeHistory.reset(inputState.code);
    window.addEventListener('appinstalled', () => {
      logEvent('pwaInstalled', { isMobile: false });
    });
  });

  // Record the Timeline for the whole session, not just while the panel is open.
  onMount(() => startAutoSave());
</script>

<div class="h-full overflow-x-auto overflow-y-hidden">
  <div class="flex h-full min-w-[1024px] flex-col overflow-hidden">
    <Navbar bind:historyOpen={isHistoryOpen}>
      {#if env.isEnabledMermaidChartLinks}
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

    <div class="relative flex min-h-0 flex-1 overflow-hidden">
      {#if isCodeCollapsed}
        <PaneRail
          side="left"
          icon={CodeIcon}
          testID={TID.wsCodeRail}
          expandTestID={TID.wsCodeExpand}
          expandLabel={t('ws.codeExpand')}
          onexpand={() => codePane?.expand()} />
      {/if}
      <Resizable.PaneGroup direction="horizontal" class="min-w-0 flex-1">
        <Resizable.Pane
          bind:this={codePane}
          id="pane-code"
          order={1}
          defaultSize={initialSizes.code}
          minSize={CODE_MIN}
          collapsible
          collapsedSize={0}
          onResize={(size) => setCodeCollapsed(size === 0)}>
          <div class="h-full" data-testid={TID.wsCodePane}>
            <CodePane oncollapse={() => codePane?.collapse()} />
          </div>
        </Resizable.Pane>
        <Resizable.Handle withHandle onDraggingChange={onDragging} />
        <Resizable.Pane id="pane-view" order={2} minSize={20} class="flex h-full flex-col">
          <div class="h-full min-h-0" data-testid={TID.wsCanvasPane}>
            <CanvasPane sheetOpen={isHistoryOpen} />
          </div>
        </Resizable.Pane>
        <Resizable.Handle withHandle onDraggingChange={onDragging} />
        <Resizable.Pane
          bind:this={inspectorPane}
          id="pane-inspector"
          order={3}
          defaultSize={initialSizes.inspector}
          minSize={INSPECTOR_MIN}
          maxSize={INSPECTOR_MAX}
          collapsible
          collapsedSize={0}
          onResize={(size) => setInspectorCollapsed(size === 0)}>
          <div class="h-full" data-testid={TID.wsInspectorPane}>
            <Inspector oncollapse={() => inspectorPane?.collapse()} />
          </div>
        </Resizable.Pane>
      </Resizable.PaneGroup>
      {#if isInspectorCollapsed}
        <PaneRail
          side="right"
          icon={InspectorIcon}
          testID={TID.wsInspectorRail}
          expandTestID={TID.wsInspectorExpand}
          expandLabel={t('ws.inspectorExpand')}
          onexpand={() => inspectorPane?.expand()} />
      {/if}
      {#if isHistoryOpen}
        <!-- The history is a sheet over the inspector side rather than a fourth pane, so
             the diagram keeps its width. -->
        <aside
          class="absolute inset-y-0 right-0 z-30 flex w-96 max-w-[45%] flex-col border-l border-border bg-card shadow-xl [&_.card]:rounded-none [&_.card]:border-0"
          aria-label={t('editor.historyToggle')}
          data-testid={TID.historyPanel}>
          <History />
        </aside>
      {/if}
    </div>
  </div>
</div>

<NewDiagramDialog />
<ExportDialog />
<ShareDialog />
<EditorChooserModal bind:open={showEditorChooser} />
