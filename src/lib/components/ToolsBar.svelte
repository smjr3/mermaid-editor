<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import CloseIcon from '~icons/material-symbols/right-panel-close-outline-rounded';

  // Local: the header of the tools pane (desktop): its title and the button that
  // collapses the pane to the right-hand icon rail (EditorRail side="right").
  let { oncollapse }: { oncollapse: () => void } = $props();
</script>

<div class="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1">
  <span class="text-sm font-semibold">{t('tools.title')}</span>
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
