<script lang="ts">
  import { t } from '$/i18n';
  import FloatingToolbar from '$/components/FloatingToolbar.svelte';
  import { Button } from '$/components/ui/button';
  import { Separator } from '$/components/ui/separator';
  import type { PanZoomState } from '$/util/panZoom';
  import ExpandIcon from '~icons/material-symbols/open-in-full-rounded';
  import ArrowsToCircleIcon from '~icons/material-symbols/screenshot-frame-2';
  import MagnifyingGlassPlusIcon from '~icons/material-symbols/zoom-in';
  import MagnifyingGlassMinusIcon from '~icons/material-symbols/zoom-out';

  let {
    /** Embed/narrow frames: keep zoom buttons visible below the `sm` breakpoint. */
    compact = false,
    fullScreenHref,
    panZoomState
  }: {
    compact?: boolean;
    /** When set, shows a "Full Screen" button linking here. Omit for store-free embeds. */
    fullScreenHref?: string;
    panZoomState: PanZoomState;
  } = $props();

  const zoomClass = $derived(compact ? undefined : 'hidden sm:block');
</script>

<FloatingToolbar>
  <Button
    variant="ghost"
    size="icon"
    title={t('panzoom.resetView')}
    onclick={() => panZoomState.reset()}>
    <ArrowsToCircleIcon />
  </Button>
  <Separator orientation="vertical" />
  <Button
    variant="ghost"
    size="icon"
    class={zoomClass}
    title={t('panzoom.zoomOut')}
    onclick={() => panZoomState.zoomOut()}>
    <MagnifyingGlassMinusIcon />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    class={zoomClass}
    title={t('panzoom.zoomIn')}
    onclick={() => panZoomState.zoomIn()}>
    <MagnifyingGlassPlusIcon />
  </Button>
  {#if fullScreenHref}
    <Separator orientation="vertical" class={zoomClass} />
    <Button
      variant="ghost"
      size="icon"
      title={t('panzoom.fullScreen')}
      href={fullScreenHref}
      target="_blank">
      <ExpandIcon />
    </Button>
  {/if}
</FloatingToolbar>
