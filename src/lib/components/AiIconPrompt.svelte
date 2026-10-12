<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { locale, t } from '$/i18n';
  import { aiCollection } from '$/util/aiCollection.svelte';
  import { buildAiPrompt } from '$/util/aiPrompt';
  import { importedPacks, packNames } from '$/util/iconCatalog';
  import { iconReference } from '$/util/standardIcons';
  import { validatedState } from '$/util/state.svelte';
  import CopyIcon from '~icons/material-symbols/content-copy-outline';
  import RemoveIcon from '~icons/material-symbols/close-rounded';

  // Local: "Copy a briefing for an AI" — the syntax, the packs, a curated icon
  // list and the icons collected in the picker, for the clipboard (aiPrompt.ts).
  let message = $state('');

  const copy = async () => {
    const packs = [...packNames(), ...(await importedPacks()).map(({ prefix }) => prefix)];
    const text = buildAiPrompt({
      collected: aiCollection.ids.map(iconReference),
      diagramType: validatedState.current.diagramType,
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
  <FieldRow label={t('insp.ai')}>
    <Button
      size="sm"
      variant="outline"
      class="h-7 px-2 text-xs"
      title={t('icons.aiHint')}
      data-testid={TID.inspAiCopy}
      onclick={copy}>
      <CopyIcon />
      {t('insp.aiCopy')}
    </Button>
    {#if aiCollection.ids.length > 0}
      <Button
        size="sm"
        variant="ghost"
        class="h-7 px-2 text-xs"
        data-testid={TID.aiClearButton}
        onclick={() => aiCollection.clear()}>{t('icons.aiClear')}</Button>
    {/if}
  </FieldRow>
  {#if aiCollection.ids.length > 0}
    <FieldRow label="">
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
    </FieldRow>
  {/if}
  {#if message}
    <p role="status" class="text-xs text-muted-foreground" data-testid={TID.aiMessage}>
      {message}
    </p>
  {/if}
</div>
