<script lang="ts">
  import Actions from '$/components/Actions.svelte';
  import * as Dialog from '$/components/ui/dialog';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { closeDialog, editorUi } from '$/util/editorUi.svelte';

  // Local: the header's 書き出す dialog (W0 stub): today's export card, open, so every
  // export keeps working until the real dialog lands.
</script>

<Dialog.Root
  open={editorUi.dialog === 'export'}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}>
  <Dialog.Content class="flex max-h-[90vh] flex-col gap-3 sm:max-w-2xl" data-testid={TID.exportDlg}>
    <Dialog.Header>
      <Dialog.Title>{t('ws.exportTitle')}</Dialog.Title>
    </Dialog.Header>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <Actions isOpen />
    </div>
  </Dialog.Content>
</Dialog.Root>
