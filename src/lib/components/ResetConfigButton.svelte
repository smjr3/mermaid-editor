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
    class="gap-1 px-2"
    data-testid={TID.resetConfigButton}
    title={t('editor.resetConfig')}
    aria-label={t('editor.resetConfig')}
    {onclick}>
    <ResetIcon />
    <!-- Short label: the editor card header also holds the tabs and the Docs button. -->
    {t('editor.resetConfigShort')}
  </Button>
{/if}
