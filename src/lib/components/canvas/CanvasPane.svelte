<script lang="ts">
  import CodeErrorNotice from '$/components/CodeErrorNotice.svelte';
  import DiagramToolbar from '$/components/DiagramToolbar.svelte';
  import EnhancedEditsButton from '$/components/EnhancedEditsButton.svelte';
  import SelectionLayer from '$/components/SelectionLayer.svelte';
  import View from '$/components/View.svelte';
  import { TID } from '$/constants';
  import { env } from '$/util/env';
  import { PanZoomState } from '$/util/panZoom';
  import { validatedState } from '$/util/state.svelte';

  // Local: the diagram column of /edit (W0 stub): today's diagram toolbar, the view, the
  // selection layer (click to select, keys, right-click menu) and the code-error notice.
  // It owns the pan/zoom state; `#view` and `#container svg` stay as they are.
  const panZoomState = new PanZoomState();
  let viewHost: HTMLDivElement | undefined = $state();
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
  <DiagramToolbar {panZoomState} />
  <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden" bind:this={viewHost}>
    <View {panZoomState} shouldShowGrid={validatedState.current.grid} />
    <!-- Click the diagram to select, then change it (SelectionLayer). -->
    <SelectionLayer host={viewHost} />
    <!-- What is wrong with the code and the way back (codeHealth.svelte.ts). -->
    <div class="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-center">
      <!-- data-selection-avoid: the mini toolbar keeps clear of it. -->
      <div class="pointer-events-auto w-full max-w-xl" data-selection-avoid>
        <CodeErrorNotice testID={TID.diagramErrorNotice} />
      </div>
    </div>
    {#if env.isEnabledAiFeatures}<div class="absolute top-0 left-5">
        <EnhancedEditsButton />
      </div>{/if}
  </div>
</div>
