<script lang="ts">
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { PanZoomState } from '$/util/panZoom';
  import { defaultState, inputState, updateCodeStore } from '$/util/state.svelte';
  import GridIcon from '~icons/material-symbols/grid-4x4-rounded';
  import MinusIcon from '~icons/material-symbols/remove-rounded';
  import PlusIcon from '~icons/material-symbols/add-rounded';

  // Local: the view controls at the bottom right of the diagram: − / the zoom level / ＋ /
  // 全体 (fit the diagram to the view) | the background grid. They replace the bar that
  // ran across the top of the diagram (zoom, fit, "open in a new tab", hand-drawn, grid);
  // the hand-drawn look moved to the inspector, and the new-tab view was dropped.
  let { panZoomState }: { panZoomState: PanZoomState } = $props();

  if (inputState.grid === undefined) {
    // Handle cases where old states were saved without grid option
    updateCodeStore({ grid: defaultState.grid });
  }

  // svg-pan-zoom's zoom is relative to the fitted diagram: 100% is 全体.
  const percent = $derived(`${Math.round((inputState.zoom ?? 1) * 100)}%`);
  const grid = $derived(inputState.grid ?? defaultState.grid);

  const button =
    'flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-sm text-foreground hover:bg-muted aria-pressed:bg-accent/20 aria-pressed:text-accent [&_svg]:size-4';
</script>

<div
  class="absolute right-2 bottom-2 z-20 flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm"
  role="toolbar"
  aria-label={t('toolbar.label')}
  data-selection-ui>
  <button
    type="button"
    class={button}
    title={t('panzoom.zoomOut')}
    aria-label={t('panzoom.zoomOut')}
    data-testid={TID.zoomOutButton}
    onclick={() => panZoomState.zoomOut()}><MinusIcon /></button>
  <span
    class="min-w-11 px-1 text-center text-xs text-muted-foreground tabular-nums"
    title={t('canvas.zoom')}
    data-testid={TID.canvasZoomLevel}>{percent}</span>
  <button
    type="button"
    class={button}
    title={t('panzoom.zoomIn')}
    aria-label={t('panzoom.zoomIn')}
    data-testid={TID.zoomInButton}
    onclick={() => panZoomState.zoomIn()}><PlusIcon /></button>
  <button
    type="button"
    class={[button, 'px-2']}
    title={t('panzoom.resetView')}
    aria-label={t('panzoom.resetView')}
    data-testid={TID.resetViewButton}
    onclick={() => panZoomState.reset()}>{t('canvas.fit')}</button>
  <span class="mx-0.5 h-5 w-px bg-border" aria-hidden="true"></span>
  <button
    type="button"
    class={button}
    title={t('toolbar.backgroundGrid')}
    aria-label={t('toolbar.backgroundGrid')}
    aria-pressed={grid}
    data-testid={TID.gridToggle}
    onclick={() => updateCodeStore({ grid: !grid })}><GridIcon /></button>
</div>
