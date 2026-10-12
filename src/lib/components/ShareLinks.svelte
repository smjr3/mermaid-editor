<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import CopyInput from '$/components/CopyInput.svelte';
  import Share from '$/components/Share.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { urls, validatedState } from '$/util/state.svelte';
  import { resolve } from '$app/paths';
  import ShareIcon from '~icons/material-symbols/share';

  // Local: the 出す tab's "共有リンク" section, which replaces the header's 共有 button: the
  // link that opens this diagram in the editor, the view-only link (copy or open), and the
  // share dialog for the embed code. The links carry the diagram in their hash, so
  // nothing is sent anywhere (share.linkDescription).
  let { isOpen = false }: { isOpen?: boolean } = $props();
  const origin = globalThis.location?.origin ?? '';
  const editLink = $derived(
    `${origin}${resolve('/edit', {})}#${validatedState.current.serialized}`
  );
  const viewLink = $derived(`${origin}${urls.current.view}`);
</script>

<Card
  title={t('share.shareableLinks')}
  testID={TID.shareCard}
  {isOpen}
  isStackable
  icon={{ component: ShareIcon }}>
  <div class="flex flex-col gap-3 p-2 text-sm">
    <p class="text-xs text-muted-foreground">{t('share.linkDescription')}</p>
    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('share.editLink')}</span>
      <p class="text-xs text-muted-foreground">{t('share.editLinkHint')}</p>
      <CopyInput value={editLink} testID={TID.shareLinkInput} />
    </div>
    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('share.viewLink')}</span>
      <p class="text-xs text-muted-foreground">{t('share.viewLinkHint')}</p>
      <CopyInput value={viewLink} />
    </div>
    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('share.embedHeading')}</span>
      <p class="text-xs text-muted-foreground">{t('share.embedDescription')}</p>
      <div><Share label={t('share.embedOpen')} /></div>
    </div>
  </div>
</Card>
