<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { swapPanes } from '$/util/toolsPane.svelte';
  import LeftCloseIcon from '~icons/material-symbols/left-panel-close-outline-rounded';
  import RightCloseIcon from '~icons/material-symbols/right-panel-close-outline-rounded';
  import SwapIcon from '~icons/material-symbols/swap-horiz-rounded';

  // Local: the header of the tools pane (desktop): its title, the button that swaps
  // the tools and the code to the other sides (toolsPane.svelte.ts), and the button
  // that collapses the pane to its icon rail (EditorRail kind="tools").
  let { oncollapse, side }: { oncollapse: () => void; side: 'left' | 'right' } = $props();
  const CloseIcon = $derived(side === 'left' ? LeftCloseIcon : RightCloseIcon);
</script>

<div class="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1">
  <span class="text-sm font-semibold">{t('tools.title')}</span>
  <div class="flex items-center gap-1">
    <Button
      variant="ghost"
      size="sm"
      data-testid={TID.swapPanesButton}
      title={t('tools.swapPanes')}
      aria-label={t('tools.swapPanes')}
      onclick={swapPanes}>
      <SwapIcon />
    </Button>
    <Button
      variant="ghost"
      size="sm"
      data-testid={TID.toolsPaneToggle}
      title={t('tools.hidePane')}
      aria-label={t('tools.hidePane')}
      onclick={oncollapse}>
      <CloseIcon />
    </Button>
  </div>
</div>
