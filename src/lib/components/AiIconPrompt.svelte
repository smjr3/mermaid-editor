<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { locale, t } from '$/i18n';
  import { aiCollection } from '$/util/aiCollection.svelte';
  import { buildAiPrompt } from '$/util/aiPrompt';
  import { importedPacks, packNames } from '$/util/iconCatalog';
  import { iconReference } from '$/util/standardIcons';
  import CopyIcon from '~icons/material-symbols/content-copy-outline';
  import RemoveIcon from '~icons/material-symbols/close-rounded';

  // Local: "Copy a briefing for an AI" — the syntax, the packs, a curated icon
  // list and the icons collected in the picker, for the clipboard (aiPrompt.ts).
  let message = $state('');

  const copy = async () => {
    const packs = [...packNames(), ...(await importedPacks()).map(({ prefix }) => prefix)];
    const text = buildAiPrompt({
      collected: aiCollection.ids.map(iconReference),
      locale,
      packs
    });
    try {
      await navigator.clipboard.writeText(text);
      message = t('icons.aiCopied');
    } catch {
      message = t('icons.aiCopyFailed');
    }
  };
</script>

<div class="flex flex-col gap-1" data-testid={TID.aiPrompt}>
  <span class="font-semibold">{t('icons.aiTitle')}</span>
  <p class="text-xs text-muted-foreground">{t('icons.aiHint')}</p>
  {#if aiCollection.ids.length > 0}
    <ul class="flex flex-wrap gap-1" data-testid={TID.aiCollected}>
      {#each aiCollection.ids as id (id)}
        <li class="flex items-center gap-0.5 rounded-md border border-border px-1.5 text-xs">
          <code>{iconReference(id)}</code>
          <button
            type="button"
            class="rounded p-0.5 hover:bg-muted"
            title={t('icons.aiRemove', { id: iconReference(id) })}
            aria-label={t('icons.aiRemove', { id: iconReference(id) })}
            onclick={() => aiCollection.remove(id)}>
            <RemoveIcon class="size-3" />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="flex items-center gap-1">
    <Button size="sm" data-testid={TID.aiCopyButton} onclick={copy}>
      <CopyIcon />
      {t('icons.aiCopy')}
    </Button>
    {#if aiCollection.ids.length > 0}
      <Button
        size="sm"
        variant="ghost"
        data-testid={TID.aiClearButton}
        onclick={() => aiCollection.clear()}>{t('icons.aiClear')}</Button>
    {/if}
  </div>
  {#if message}
    <p role="status" class="text-muted-foreground" data-testid={TID.aiMessage}>{message}</p>
  {/if}
</div>
