<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { Separator } from '$/components/ui/separator';
  import { Toggle } from '$/components/ui/toggle';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { PanZoomState } from '$/util/panZoom';
  import { defaultState, inputState, updateCodeStore } from '$/util/state.svelte';
  import RoughIcon from '~icons/material-symbols/draw-outline-rounded';
  import BackgroundIcon from '~icons/material-symbols/grid-4x4-rounded';
  // Local: "open in new" rather than open-in-full, whose diagonal arrows read as
  // "fit to screen" next to the reset-view button.
  import ExpandIcon from '~icons/material-symbols/open-in-new-rounded';
  import ArrowsToCircleIcon from '~icons/material-symbols/screenshot-frame-2';
  import MagnifyingGlassPlusIcon from '~icons/material-symbols/zoom-in';
  import MagnifyingGlassMinusIcon from '~icons/material-symbols/zoom-out';

  // Local: one bar across the top of the diagram pane, replacing upstream's three
  // floating toolbars (PanZoomToolbar, SyncRoughToolbar, VersionSecurityToolbar):
  // view controls, then drawing toggles. Theme and language live in the header.
  // PanZoomToolbar stays for the embed page.
  let {
    fullScreenHref,
    panZoomState
  }: {
    fullScreenHref: string;
    panZoomState: PanZoomState;
  } = $props();

  if (inputState.grid === undefined) {
    // Handle cases where old states were saved without grid option
    updateCodeStore({ grid: defaultState.grid });
  }
</script>

<div
  class="flex shrink-0 flex-wrap items-center gap-1 border-b bg-card px-2 py-1 [&_svg]:size-5"
  role="toolbar"
  aria-label={t('toolbar.label')}
  data-testid={TID.diagramToolbar}>
  <!-- Pinch zoom covers phones, as upstream's floating toolbar assumed. -->
  <Button
    variant="ghost"
    size="icon"
    class="hidden size-8 sm:inline-flex"
    title={t('panzoom.zoomOut')}
    aria-label={t('panzoom.zoomOut')}
    data-testid={TID.zoomOutButton}
    onclick={() => panZoomState.zoomOut()}>
    <MagnifyingGlassMinusIcon />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    class="hidden size-8 sm:inline-flex"
    title={t('panzoom.zoomIn')}
    aria-label={t('panzoom.zoomIn')}
    data-testid={TID.zoomInButton}
    onclick={() => panZoomState.zoomIn()}>
    <MagnifyingGlassPlusIcon />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    class="size-8"
    title={t('panzoom.resetView')}
    aria-label={t('panzoom.resetView')}
    data-testid={TID.resetViewButton}
    onclick={() => panZoomState.reset()}>
    <ArrowsToCircleIcon />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    class="size-8"
    title={t('panzoom.fullScreen')}
    aria-label={t('panzoom.fullScreen')}
    data-testid={TID.fullScreenButton}
    href={fullScreenHref}
    target="_blank">
    <ExpandIcon />
  </Button>
  <Separator orientation="vertical" class="mx-1" />
  <Toggle
    bind:pressed={() => inputState.rough, (rough) => updateCodeStore({ rough })}
    size="sm"
    class="[&_svg]:size-5"
    title={t('toolbar.handDrawn')}
    aria-label={t('toolbar.handDrawn')}
    data-testid={TID.roughToggle}>
    <RoughIcon />
  </Toggle>
  <Toggle
    bind:pressed={() => inputState.grid ?? defaultState.grid, (grid) => updateCodeStore({ grid })}
    size="sm"
    class="[&_svg]:size-5"
    title={t('toolbar.backgroundGrid')}
    aria-label={t('toolbar.backgroundGrid')}
    data-testid={TID.gridToggle}>
    <BackgroundIcon />
  </Toggle>
</div>
