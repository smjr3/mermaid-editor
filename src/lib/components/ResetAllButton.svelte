<script lang="ts">
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { clearSelection } from '$/util/selection.svelte';
  import { defaultState, replaceInputState } from '$/util/state.svelte';
  import { codeHistory } from '$/util/undoStack.svelte';
  import ResetIcon from '~icons/material-symbols/restart-alt-rounded';

  // Local: "初期化" in the header — the diagram goes back to the starter and every
  // setting with it (config and theme, pan and zoom, selection, the stored codeStore).
  // History entries live under their own key and stay.
  let open = $state(false);

  const resetAll = () => {
    clearSelection();
    replaceInputState(structuredClone(defaultState));
    codeHistory.reset(defaultState.code);
    open = false;
  };
</script>

<Button
  variant="ghost"
  size="sm"
  class="gap-1 px-2"
  title={t('header.resetTooltip')}
  aria-label={t('header.resetTooltip')}
  data-testid={TID.resetAllButton}
  onclick={() => (open = true)}>
  <ResetIcon class="size-5" />
  <span class="hidden lg:inline">{t('header.reset')}</span>
</Button>

<Dialog.Root bind:open>
  <Dialog.Content data-testid={TID.resetAllDialog}>
    <Dialog.Header>
      <Dialog.Title>{t('header.resetTitle')}</Dialog.Title>
      <Dialog.Description>{t('header.resetBody')}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" data-testid={TID.resetAllCancel} onclick={() => (open = false)}>
        {t('header.resetCancel')}
      </Button>
      <Button variant="destructive" data-testid={TID.resetAllConfirm} onclick={resetAll}>
        {t('header.resetConfirm')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
