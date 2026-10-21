<script lang="ts">
  import { panMode, togglePanMode } from '$/components/canvas/panMode.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { PanZoomState } from '$/util/panZoom';
  import { defaultState, inputState, updateCodeStore } from '$/util/state.svelte';
  import GridIcon from '~icons/material-symbols/grid-4x4-rounded';
  import HandIcon from '~icons/material-symbols/pan-tool-outline-rounded';
  import MinusIcon from '~icons/material-symbols/remove-rounded';
  import PlusIcon from '~icons/material-symbols/add-rounded';

  // Local: the view controls at the bottom right of the diagram: − / the zoom level / ＋ /
  // 全体 (fit the diagram to the view) | 移動 (while pressed a plain drag moves the picture
  // instead of drawing the selection band; panMode.svelte.ts) | the background grid. They replace the bar that
  // ran across the top of the diagram (zoom, fit, "open in a new tab", hand-drawn, grid);
  // the hand-drawn look moved to the inspector, and the new-tab view was dropped.
  // Local (QA 2026-10-13): while the History sheet is open (`sheetOpen`) it floats over the
  // right of the editor and would cover them, so they step left of it.
  let { panZoomState, sheetOpen = false }: { panZoomState: PanZoomState; sheetOpen?: boolean } =
    $props();

  let toolbar: HTMLDivElement | undefined = $state();
  let shift = $state(0);
  $effect(() => {
    const host = toolbar?.offsetParent;
    if (!sheetOpen || !(host instanceof HTMLElement)) {
      shift = 0;
      return;
    }
    const sheet = document.querySelector(`[data-testid="${TID.historyPanel}"]`);
    const measure = () => {
      shift = sheet
        ? Math.max(0, host.getBoundingClientRect().right - sheet.getBoundingClientRect().left)
        : 0;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    if (sheet) observer.observe(sheet);
    return () => observer.disconnect();
  });

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
  bind:this={toolbar}
  style:right={`${8 + shift}px`}
  class="absolute bottom-2 z-20 flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm"
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
    class={[button, 'gap-1 px-1.5']}
    title={t('canvas.panHint')}
    aria-label={t('canvas.panHint')}
    aria-pressed={panMode.on}
    data-testid={TID.panToggle}
    onclick={togglePanMode}><HandIcon />{t('canvas.pan')}</button>
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
