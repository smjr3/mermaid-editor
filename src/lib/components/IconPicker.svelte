<script lang="ts" module>
  import type { SearchablePack as Pack } from '$/util/iconSearch';

  // Loaded packs, shared by the card's picker and the large one; not reactive state.
  const cache: Record<string, Promise<Pack | undefined> | undefined> = {};
</script>

<script lang="ts">
  import Self from '$/components/IconPicker.svelte';
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { remoteIconPacks } from '$/util/customIcons';
  import { listIconPacks } from '$/util/customIconStore';
  import { env } from '$/util/env';
  import { iconPacks } from '$/util/iconPacks';
  import {
    iconSvg,
    insertIntoEditor,
    searchIcons,
    type IconMatch,
    type SearchablePack
  } from '$/util/iconSearch';
  import type { AsyncIconLoader } from 'mermaid';
  import { onMount } from 'svelte';
  import EnlargeIcon from '~icons/material-symbols/open-in-full-rounded';

  // Local: search the icon packs and click an icon to insert its `prefix:name`.
  // The card shows a small grid; "Enlarge" opens the same picker in a large
  // dialog, with names under the icons, sharing the query and the pack.
  let {
    large = false,
    pack = $bindable('all'),
    query = $bindable(''),
    onchosen
  }: {
    large?: boolean;
    pack?: string;
    query?: string;
    onchosen?: () => void;
  } = $props();
  let isLargeOpen = $state(false);
  const loaders: AsyncIconLoader[] = [...iconPacks, ...remoteIconPacks(env.iconPacks)];
  let imported = $state<SearchablePack[]>([]);
  const names = $derived([...loaders.map(({ name }) => name), ...imported.map((p) => p.prefix)]);

  let results = $state<IconMatch[]>([]);
  let loading = $state(false);
  let message = $state('');

  onMount(async () => {
    try {
      imported = await listIconPacks();
    } catch {
      imported = [];
    }
  });

  const load = (name: string): Promise<SearchablePack | undefined> => {
    const own = imported.find((candidate) => candidate.prefix === name);
    if (own) return Promise.resolve(own);
    let cached = cache[name];
    if (!cached) {
      const loader = loaders.find((candidate) => candidate.name === name);
      cached = loader
        ? loader.loader().then(
            (json) => ({ ...json, prefix: name }) as SearchablePack,
            () => undefined
          )
        : Promise.resolve(undefined);
      cache[name] = cached;
    }
    return cached;
  };

  let searchId = 0;
  const search = async (text: string, chosen: string) => {
    const id = ++searchId;
    if (text.trim().length < 2) {
      results = [];
      return;
    }
    loading = true;
    const packs = await Promise.all((chosen === 'all' ? names : [chosen]).map(load));
    if (id !== searchId) return;
    results = searchIcons(
      packs.filter((candidate) => candidate !== undefined),
      text,
      large ? 300 : 60
    );
    loading = false;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const text = query;
    const chosen = pack;
    clearTimeout(timer);
    timer = setTimeout(() => void search(text, chosen), 250);
    return () => clearTimeout(timer);
  });

  const choose = async (id: string) => {
    if (insertIntoEditor(id)) {
      message = t('icons.pickInserted', { id });
      onchosen?.();
      return;
    }
    try {
      await navigator.clipboard.writeText(id);
      message = t('icons.pickCopied', { id });
    } catch {
      message = id;
    }
  };
</script>

<div class={['flex flex-col gap-2', large && 'min-h-0 flex-1']}>
  {#if !large}<span class="font-semibold">{t('icons.pickTitle')}</span>{/if}
  <div class="flex gap-1">
    <select
      bind:value={pack}
      aria-label={t('icons.pickPack')}
      data-testid={large ? TID.iconPickerLargePack : TID.iconPickerPack}
      class="h-9 max-w-[40%] rounded-md border border-input bg-background px-1 text-sm text-foreground">
      <option value="all">{t('icons.pickAll')}</option>
      {#each names as name (name)}
        <option value={name}>{name}</option>
      {/each}
    </select>
    <Input
      bind:value={query}
      placeholder={t('icons.pickPlaceholder')}
      aria-label={t('icons.pickPlaceholder')}
      data-testid={large ? TID.iconPickerLargeSearch : TID.iconPickerSearch} />
    {#if !large}
      <Button
        variant="outline"
        size="icon"
        class="shrink-0"
        title={t('icons.pickEnlarge')}
        aria-label={t('icons.pickEnlarge')}
        data-testid={TID.iconPickerEnlarge}
        onclick={() => (isLargeOpen = true)}>
        <EnlargeIcon />
      </Button>
    {/if}
  </div>
  {#if loading}
    <p class="text-muted-foreground">{t('icons.pickLoading')}</p>
  {:else if query.trim().length >= 2 && results.length === 0}
    <p class="text-muted-foreground">{t('icons.pickNone')}</p>
  {:else if large && query.trim().length < 2}
    <p class="text-muted-foreground">{t('icons.pickLargeEmpty')}</p>
  {/if}
  {#if results.length > 0}
    <div
      class={large
        ? 'grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2 overflow-y-auto'
        : 'grid max-h-56 grid-cols-6 gap-1 overflow-y-auto'}
      data-testid={large ? TID.iconPickerLargeResults : TID.iconPickerResults}>
      {#each results as result (result.id)}
        <button
          type="button"
          class={[
            'flex flex-col items-center justify-center rounded-md border border-transparent hover:border-border hover:bg-muted',
            large ? 'gap-1 p-2' : 'aspect-square p-1.5'
          ]}
          title={result.id}
          aria-label={result.id}
          onclick={() => choose(result.id)}>
          <span class={large ? 'size-12' : 'size-full'}>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- bundled packs, or packs sanitised when loaded -->
            {@html iconSvg(result.icon)}
          </span>
          {#if large}
            <span class="w-full truncate text-center text-xs"
              >{result.id.slice(result.id.indexOf(':') + 1)}</span>
            <span class="w-full truncate text-center text-[10px] text-muted-foreground"
              >{result.id.slice(0, result.id.indexOf(':'))}</span>
          {/if}
        </button>
      {/each}
    </div>
    <p class="text-muted-foreground">{t('icons.pickHint')}</p>
  {/if}
  {#if message && !large}
    <p role="status" data-testid={TID.iconPickerMessage}>{message}</p>
  {/if}
</div>

{#if !large}
  <Dialog.Root bind:open={isLargeOpen}>
    <Dialog.Content class="flex h-[85vh] flex-col sm:max-w-5xl">
      <Dialog.Header>
        <Dialog.Title>{t('icons.pickTitle')}</Dialog.Title>
      </Dialog.Header>
      <Self large bind:query bind:pack onchosen={() => (isLargeOpen = false)} />
    </Dialog.Content>
  </Dialog.Root>
{/if}
