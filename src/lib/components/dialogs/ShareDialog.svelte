<script lang="ts">
  import CopyInput from '$/components/CopyInput.svelte';
  import FieldRow from '$/components/form/FieldRow.svelte';
  import Share from '$/components/Share.svelte';
  import * as Dialog from '$/components/ui/dialog';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { closeDialog, editorUi } from '$/util/editorUi.svelte';
  import { urls, validatedState } from '$/util/state.svelte';
  import { resolve } from '$app/paths';

  // Local: the header's 共有 dialog. The link that opens this diagram in the editor, the
  // view-only link, each with a copy button, and the embed code (Share.svelte). The links
  // carry the diagram in their hash, so nothing is sent anywhere (share.linkDescription).
  // There is no "open the view page" button (user decision, 2026-10-12).
  const origin = globalThis.location?.origin ?? '';
  const editLink = $derived(
    `${origin}${resolve('/edit', {})}#${validatedState.current.serialized}`
  );
  const viewLink = $derived(`${origin}${urls.current.view}`);
</script>

<Dialog.Root
  open={editorUi.dialog === 'share'}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}>
  <Dialog.Content
    class="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]"
    data-testid={TID.shareDlg}>
    <Dialog.Header class="flex h-11 shrink-0 justify-center border-b px-4">
      <Dialog.Title class="text-base">{t('shareDlg.title')}</Dialog.Title>
    </Dialog.Header>
    <div class="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-4 py-3">
      <FieldRow label={t('shareDlg.editLink')}>
        <CopyInput
          compact
          value={editLink}
          title={t('share.editLinkHint')}
          testID={TID.shareDlgEditLink}
          copyTestID={TID.shareDlgEditCopy} />
      </FieldRow>
      <FieldRow label={t('shareDlg.viewLink')}>
        <CopyInput
          compact
          value={viewLink}
          title={t('share.viewLinkHint')}
          testID={TID.shareDlgViewLink}
          copyTestID={TID.shareDlgViewCopy} />
      </FieldRow>
      <Dialog.Description class="text-xs">{t('share.linkDescription')}</Dialog.Description>
      <h3 class="mt-2 text-xs font-semibold text-muted-foreground">
        {t('share.embedHeading')}
      </h3>
      <Share />
    </div>
  </Dialog.Content>
</Dialog.Root>
