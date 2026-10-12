<script lang="ts">
  import ShareLinks from '$/components/ShareLinks.svelte';
  import * as Dialog from '$/components/ui/dialog';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { closeDialog, editorUi } from '$/util/editorUi.svelte';

  // Local: the header's 共有 dialog (W0 stub): today's share links (edit link, view link,
  // embed code), open, until the real dialog lands.
</script>

<Dialog.Root
  open={editorUi.dialog === 'share'}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}>
  <Dialog.Content class="flex max-h-[90vh] flex-col gap-3 sm:max-w-xl" data-testid={TID.shareDlg}>
    <Dialog.Header>
      <Dialog.Title>{t('ws.shareTitle')}</Dialog.Title>
    </Dialog.Header>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <ShareLinks isOpen />
    </div>
  </Dialog.Content>
</Dialog.Root>
