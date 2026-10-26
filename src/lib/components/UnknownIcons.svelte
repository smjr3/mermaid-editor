<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { checkIcons, replaceIconRef, type UnknownIcon } from '$/util/iconCatalog';
  import { applyToolEdit } from '$/util/codeHealth.svelte';
  import { inputState, validatedState } from '$/util/state.svelte';

  // Local: the icon names in the code that no pack provides (an AI's guess, a typo):
  // how many, a button that swaps every one for its chosen candidate, and under it each
  // name with a choice of existing names and a button to swap only that one. Nothing
  // shows while every name is known.
  let unknown = $state<UnknownIcon[]>([]);
  let choice = $state<Record<string, string>>({});

  // A pause before checking: typing changes the code many times a second, and
  // the first check loads icon packs, which must not get in the way of rendering.
  $effect(() => {
    const { code } = validatedState.current;
    let stale = false;
    const timer = setTimeout(() => {
      void checkIcons(code).then((found) => {
        if (stale) return;
        unknown = found;
        const next: Record<string, string> = {};
        for (const item of found) next[item.ref] = choice[item.ref] ?? item.candidates[0] ?? '';
        choice = next;
      });
    }, 800);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  });

  const replace = (ref: string) => {
    const to = choice[ref];
    if (!to) return;
    // Local: checked, and refused while the code has an error (codeHealth.svelte.ts).
    void applyToolEdit(replaceIconRef(inputState.code, ref, to));
  };
  // Every name that has a candidate, in one step (one undo).
  const replaceAll = () => {
    const next = unknown.reduce(
      (code, { ref }) => (choice[ref] ? replaceIconRef(code, ref, choice[ref]) : code),
      inputState.code
    );
    void applyToolEdit(next);
  };
  const replaceable = $derived(unknown.filter(({ ref }) => choice[ref]).length);

  const selectClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs text-foreground';
</script>

{#if unknown.length > 0}
  <FieldRow label={t('insp.unknown')}>
    <span
      class="truncate text-xs text-muted-foreground"
      title={t('icons.unknownHint')}
      data-testid={TID.inspUnknownCount}
      data-count={unknown.length}>{t('insp.unknownCount', { count: String(unknown.length) })}</span>
    <Button
      size="sm"
      variant="outline"
      class="ml-auto h-7 px-2 text-xs"
      disabled={replaceable === 0}
      data-testid={TID.inspUnknownReplace}
      onclick={replaceAll}>{t('insp.unknownReplace')}</Button>
  </FieldRow>
  <ul
    class="flex flex-col gap-1"
    aria-label={t('icons.unknownTitle')}
    data-testid={TID.unknownIcons}>
    {#each unknown as item (item.ref)}
      <li class="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-2">
        <code class="truncate text-xs text-destructive" title={item.ref}>{item.ref}</code>
        <span class="flex min-w-0 items-center gap-1">
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
              class="h-7 px-2 text-xs"
              data-testid={`${TID.unknownIconReplace}-${item.ref}`}
              onclick={() => replace(item.ref)}>{t('icons.unknownReplace')}</Button>
          {:else}
            <span class="text-xs text-muted-foreground">{t('icons.unknownNone')}</span>
          {/if}
        </span>
      </li>
    {/each}
  </ul>
{/if}
