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
    data-testid={TID.resetConfigButton}
    title={t('editor.resetConfig')}
    {onclick}>
    <ResetIcon />
    {t('editor.resetConfig')}
  </Button>
{/if}
