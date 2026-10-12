<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { resetConfig, validatedState } from '$/util/state.svelte';
  import ResetIcon from '~icons/material-symbols/restart-alt-rounded';

  const onclick = () => {
    if (confirm(t('editor.resetConfigConfirm'))) {
      resetConfig();
    }
  };
</script>

<!-- Only on the config tab: it is the config that can leave every render failing. -->
{#if validatedState.current.editorMode === 'config'}
  <Button
    variant="ghost"
    size="sm"
    class="h-7 shrink-0 gap-1 px-2 text-xs whitespace-nowrap"
    data-testid={TID.resetConfigButton}
    title={t('editor.resetConfig')}
    aria-label={t('editor.resetConfig')}
    {onclick}>
    <ResetIcon />
    <!-- The code pane's header is a size container: a narrow column shows the icon only. -->
    <span class="hidden @[19rem]:inline">{t('editor.resetConfig')}</span>
  </Button>
{/if}
