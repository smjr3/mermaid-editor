<script lang="ts">
  import InsertBar from '$/components/canvas/InsertBar.svelte';
  import ViewModeSwitch, { type ViewMode } from '$/components/canvas/ViewModeSwitch.svelte';
  import ZoomControls from '$/components/canvas/ZoomControls.svelte';
  import CodeErrorNotice from '$/components/CodeErrorNotice.svelte';
  import EnhancedEditsButton from '$/components/EnhancedEditsButton.svelte';
  import SelectionLayer from '$/components/SelectionLayer.svelte';
  import TableEditor from '$/components/TableEditor.svelte';
  import View from '$/components/View.svelte';
  import { TID } from '$/constants';
  import { env } from '$/util/env';
  import { PanZoomState } from '$/util/panZoom';
  import { inputState, validatedState } from '$/util/state.svelte';
  import { tableKind } from '$/util/tableEdit';

  // Local: the diagram column of /edit. On top, the add bar (what it offers follows the
  // diagram's type) and, for the diagrams that are a list at heart, 図 / 表 / 並べる; below,
  // the diagram with the selection layer over it (click to select, keys, right-click
  // menu), the code-error notice and the zoom controls; the table editor under the diagram
  // or in its place. It owns the pan/zoom state; `#view` and `#container svg` stay as
  // they are (exports and the embed read them).
  const panZoomState = new PanZoomState();
  let viewHost: HTMLDivElement | undefined = $state();

  const table = $derived(tableKind(inputState.code) !== undefined);
  let mode = $state<ViewMode>('diagram');
  const shown = $derived(table ? mode : 'diagram');
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
  <div class="flex h-10 shrink-0 items-center gap-2 border-b bg-card px-2">
    <InsertBar />
    {#if table}
      <ViewModeSwitch bind:value={mode} />
    {/if}
  </div>
  <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden" bind:this={viewHost}>
      <View {panZoomState} shouldShowGrid={validatedState.current.grid} />
      <!-- Click the diagram to select, then change it (SelectionLayer). -->
      <SelectionLayer host={viewHost} />
      <!-- What is wrong with the code and the way back (codeHealth.svelte.ts): one place,
           over the diagram. -->
      <div class="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-center">
        <div class="pointer-events-auto w-full max-w-xl" data-selection-ui>
          <CodeErrorNotice testID={TID.diagramErrorNotice} />
        </div>
      </div>
      <ZoomControls {panZoomState} />
      {#if env.isEnabledAiFeatures}<div class="absolute top-0 left-5">
          <EnhancedEditsButton />
        </div>{/if}
    </div>
    {#if shown === 'both'}
      <div
        class="max-h-[45%] shrink-0 overflow-auto border-t bg-card"
        data-testid={TID.canvasTable}
        data-mode="both">
        <TableEditor />
      </div>
    {:else if shown === 'table'}
      <!-- Over the diagram rather than instead of it: the diagram stays laid out for the
           exports, which read the drawn picture. -->
      <div
        class="absolute inset-0 z-30 overflow-auto bg-card"
        data-testid={TID.canvasTable}
        data-mode="table">
        <TableEditor />
      </div>
    {/if}
  </div>
</div>
