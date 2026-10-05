<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { checkIcons, replaceIconRef, type UnknownIcon } from '$/util/iconCatalog';
  import { inputState, updateCode, validatedState } from '$/util/state.svelte';

  // Local: the icon names in the code that no pack provides (an AI's guess,
  // a typo), each with a choice of existing names and a button to swap it in.
  let unknown = $state<UnknownIcon[]>([]);
  let choice = $state<Record<string, string>>({});

  $effect(() => {
    const { code } = validatedState.current;
    let stale = false;
    void checkIcons(code).then((found) => {
      if (stale) return;
      unknown = found;
      const next: Record<string, string> = {};
      for (const item of found) next[item.ref] = choice[item.ref] ?? item.candidates[0] ?? '';
      choice = next;
    });
    return () => {
      stale = true;
    };
  });

  const replace = (ref: string) => {
    const to = choice[ref];
    if (!to) return;
    updateCode(replaceIconRef(inputState.code, ref, to), { updateDiagram: true });
  };

  const selectClass =
    'h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-sm text-foreground';
</script>

{#if unknown.length > 0}
  <div class="flex flex-col gap-1" data-testid={TID.unknownIcons}>
    <span class="font-semibold">{t('icons.unknownTitle')}</span>
    <p class="text-xs text-muted-foreground">{t('icons.unknownHint')}</p>
    <ul class="flex flex-col gap-1">
      {#each unknown as item (item.ref)}
        <li class="flex items-center gap-1">
          <code class="shrink-0 text-destructive">{item.ref}</code>
          <span class="text-muted-foreground">→</span>
          {#if item.candidates.length > 0}
            <select
              bind:value={choice[item.ref]}
              class={selectClass}
              aria-label={t('icons.unknownChoose', { id: item.ref })}
              data-testid={`${TID.unknownIconChoice}-${item.ref}`}>
              {#each item.candidates as candidate (candidate)}
                <option value={candidate}>{candidate}</option>
              {/each}
            </select>
            <Button
              size="sm"
              variant="outline"
              class="h-8"
              data-testid={`${TID.unknownIconReplace}-${item.ref}`}
              onclick={() => replace(item.ref)}>{t('icons.unknownReplace')}</Button>
          {:else}
            <span class="text-xs text-muted-foreground">{t('icons.unknownNone')}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
