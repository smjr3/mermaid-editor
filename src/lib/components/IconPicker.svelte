<script lang="ts">
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

  // Local: search the icon packs and click an icon to insert its `prefix:name`.
  const loaders: AsyncIconLoader[] = [...iconPacks, ...remoteIconPacks(env.iconPacks)];
  let imported = $state<SearchablePack[]>([]);
  const names = $derived([...loaders.map(({ name }) => name), ...imported.map((p) => p.prefix)]);

  let pack = $state('all');
  let query = $state('');
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

  // Loaded packs, kept for the session; not reactive state.
  const cache: Record<string, Promise<SearchablePack | undefined> | undefined> = {};
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
      text
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

<div class="flex flex-col gap-2">
  <span class="font-semibold">{t('icons.pickTitle')}</span>
  <div class="flex gap-1">
    <select
      bind:value={pack}
      aria-label={t('icons.pickPack')}
      data-testid={TID.iconPickerPack}
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
      data-testid={TID.iconPickerSearch} />
  </div>
  {#if loading}
    <p class="text-muted-foreground">{t('icons.pickLoading')}</p>
  {:else if query.trim().length >= 2 && results.length === 0}
    <p class="text-muted-foreground">{t('icons.pickNone')}</p>
  {/if}
  {#if results.length > 0}
    <div
      class="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto"
      data-testid={TID.iconPickerResults}>
      {#each results as result (result.id)}
        <button
          type="button"
          class="flex aspect-square items-center justify-center rounded-md border border-transparent p-1.5 hover:border-border hover:bg-muted"
          title={result.id}
          aria-label={result.id}
          onclick={() => choose(result.id)}>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- bundled packs, or packs sanitised when loaded -->
          {@html iconSvg(result.icon)}
        </button>
      {/each}
    </div>
    <p class="text-muted-foreground">{t('icons.pickHint')}</p>
  {/if}
  {#if message}
    <p role="status" data-testid={TID.iconPickerMessage}>{message}</p>
  {/if}
</div>
