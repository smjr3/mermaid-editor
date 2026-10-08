<script lang="ts">
  import type { State, ValidatedState } from '$/types';
  import { markViewCurrent, shouldRefreshView } from '$/util/autoSync';
  import { drawFailed, drawn } from '$/util/codeHealth.svelte';
  import { ICON_PACKS_CHANGED } from '$/util/customIconStore';
  import { PanZoomState } from '$/util/panZoom';
  import { createRenderScheduler } from '$/util/renderScheduler';
  import { renderAndPlaceDiagram } from '$/util/renderView';
  import { inputState, updateCodeStore, validatedState } from '$/util/state.svelte';
  import { saveStatistics } from '$/util/stats';
  import FontAwesome, { mayContainFontAwesome } from '$lib/components/FontAwesome.svelte';
  import debounce from 'lodash-es/debounce';
  import uniqueID from 'lodash-es/uniqueId';
  import type { MermaidConfig } from 'mermaid';
  import { onMount } from 'svelte';

  let {
    panZoomState = new PanZoomState(),
    shouldShowGrid = true
  }: { panZoomState?: PanZoomState; shouldShowGrid?: boolean } = $props();
  let code = '';
  let config = '';
  let container: HTMLDivElement | undefined = $state();
  let rough: boolean;
  let view: HTMLDivElement | undefined = $state();
  let error = $state(false);
  let panZoom = true;
  let manualUpdate = true;
  let waitForFontAwesomeToLoad: FontAwesome['waitForFontAwesomeToLoad'] | undefined = $state();
  // Local: how many pictures this view has placed (the performance e2e spec reads it).
  let renderCount = $state(0);

  // Set up panZoom state observer to update the store when pan/zoom changes
  // Local: a drag or a wheel fires this many times a second, and every store update
  // is persisted, serialised and re-validated; the store only needs where it ended.
  // A button, a fit or a newly placed picture is one change: stored at once, so the
  // store never lags behind what is shown.
  let unstored: Pick<State, 'pan' | 'zoom'> | undefined;
  const store = debounce((pan: State['pan'], zoom: number) => {
    unstored = undefined;
    updateCodeStore({ pan, zoom });
  }, 200);
  const setupPanZoomObserver = () => {
    panZoomState.onPanZoomChange = (pan, zoom) => {
      unstored = { pan, zoom };
      store(pan, zoom);
    };
    panZoomState.onPanZoomSettled = () => store.flush();
    return () => store.flush();
  };

  const handlePanZoom = (state: State, graphDiv: SVGSVGElement) => {
    try {
      // A gesture not stored yet is where the user left the view, not the state's.
      panZoomState.updateElement(graphDiv, unstored ?? state);
    } catch (error) {
      console.error('PanZoom error:', error);
    }
    store.flush();
  };

  const handleStateChange = async (state: ValidatedState, token = 0) => {
    const startTime = Date.now();
    if (state.error !== undefined) {
      error = true;
      return;
    }
    error = false;
    let diagramType: string | undefined;
    try {
      if (container) {
        manualUpdate = true;
        // Do not render if there is no change in Code/Config/PanZoom
        if (
          code === state.code &&
          config === state.mermaid &&
          rough === state.rough &&
          panZoom === state.panZoom
        ) {
          markViewCurrent();
          return;
        }

        code = state.code;
        config = state.mermaid;
        rough = state.rough;
        panZoom = state.panZoom ?? true;

        if (mayContainFontAwesome(code)) {
          await waitForFontAwesomeToLoad?.();
        }

        const scroll = view?.parentElement?.scrollTop;
        const {
          diagramType: detectedDiagramType,
          graphDiv,
          stale
        } = await renderAndPlaceDiagram({
          code,
          config: JSON.parse(state.mermaid) as MermaidConfig,
          container,
          rough: state.rough,
          // Not placed when a newer state is waiting or the code has changed since (its
          // validation is on the way and is drawn next), nor over a newer picture.
          shouldPlace: () =>
            scheduler.isLatest(token) && inputState.code === state.code && scheduler.isNewer(token),
          viewId: uniqueID('graph-')
        });
        if (stale) {
          // Superseded: not placed; the next render must not be skipped as unchanged.
          code = '';
          return;
        }
        renderCount += 1;
        diagramType = detectedDiagramType;
        if (graphDiv && state.panZoom) {
          handlePanZoom(state, graphDiv);
        }
        if (view?.parentElement && scroll) {
          view.parentElement.scrollTop = scroll;
        }
        error = false;
        // Local: what "revert" goes back to when a later diagram cannot be drawn.
        drawn(code);
      } else if (manualUpdate) {
        manualUpdate = false;
      }
    } catch (error_) {
      console.error('view fail', error_);
      error = true;
      // Local: say so (CodeErrorNotice) instead of leaving a faded picture unexplained.
      drawFailed();
    }
    const renderTime = Date.now() - startTime;
    saveStatistics({ code, diagramType, isRough: state.rough, renderTime });
  };

  onMount(() => setupPanZoomObserver());

  // Local: renders never overlap and only the newest state is drawn, after a short
  // pause in typing (renderScheduler.ts). Upstream queued every state in turn and
  // deferred the next render by a second after a slow one.
  const scheduler = createRenderScheduler<ValidatedState>({ render: handleStateChange });
  let requested: Pick<State, 'code' | 'mermaid' | 'rough' | 'panZoom'> | undefined;
  let hasRequested = false;
  $effect(() => {
    const state = validatedState.current;
    // The state read from storage before the first validation: on a shared link it is
    // the previous diagram, which used to be drawn (in full) before the linked one.
    if (state.diagramType === undefined && state.error === undefined) return;
    const next = {
      code: state.code,
      mermaid: state.mermaid,
      panZoom: state.panZoom ?? true,
      rough: state.rough
    };
    // Pan, zoom, selection, the editor mode: nothing to draw.
    if (
      !state.error &&
      requested &&
      requested.code === next.code &&
      requested.mermaid === next.mermaid &&
      requested.rough === next.rough &&
      requested.panZoom === next.panZoom
    ) {
      return;
    }
    const first = !hasRequested;
    const typed = !state.error && requested?.code !== next.code && !state.updateDiagram;
    hasRequested = true;
    // After an error the next valid state is always drawn, even one equal to the last.
    requested = state.error ? undefined : next;
    shouldRefreshView();
    scheduler.schedule(state, { immediate: first || !typed });
    void scheduler.idle().then(markViewCurrent);
  });
  $effect(() => () => scheduler.dispose());

  // Local: an imported or removed icon pack changes the picture but not the code, which
  // the comparisons above would otherwise treat as nothing to draw.
  const redraw = () => {
    const state = validatedState.current;
    if (state.error || !hasRequested) return;
    code = '';
    shouldRefreshView();
    scheduler.schedule(state, { immediate: true });
    void scheduler.idle().then(markViewCurrent);
  };
  onMount(() => {
    window.addEventListener(ICON_PACKS_CHANGED, redraw);
    return () => window.removeEventListener(ICON_PACKS_CHANGED, redraw);
  });
</script>

<FontAwesome bind:waitForFontAwesomeToLoad />

<div
  id="view"
  bind:this={view}
  data-render-count={renderCount}
  class={['view-bg h-full w-full', shouldShowGrid && 'grid-bg', error && 'opacity-50']}>
  <div id="container" bind:this={container} class="h-full overflow-auto"></div>
</div>

<style>
  /* The picture looks the same in the site's light and dark mode, so the view behind it
     is white in both (only the app chrome follows the mode). */
  .view-bg {
    background-color: #fff;
  }

  .grid-bg {
    background-size: 30px 30px;
    background-image: radial-gradient(circle, #e4e4e48c 2px, #0000 2px);
  }
</style>
