<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { aiCollection } from '$/util/aiCollection.svelte';
  import { iconLicense } from '$/util/iconLicenses';
  import { locale, t } from '$/i18n';
  import { listIconPacks } from '$/util/customIconStore';
  import { parse } from '$/util/mermaid';
  import { selectionModel } from '$/util/selectionModel.svelte';
  import { inputState, updateCode, validatedState } from '$/util/state.svelte';
  import { categoryName, iconCategories, iconLabel } from '$/util/iconCategories';
  import { loadPack, packNames } from '$/util/iconCatalog';
  import {
    iconMatch,
    iconPage,
    iconSvg,
    insertChecked,
    searchIcons,
    type IconMatch,
    type SearchablePack
  } from '$/util/iconSearch';
  import { iconReference, isStandardIcon, standardPrefix } from '$/util/standardIcons';
  import { onMount } from 'svelte';

  // Local: find an icon and click it to insert its `prefix:name` — the content of the
  // inspector's 「探して挿入」 dialog, a large grid with names under the icons. Two modes:
  // "search" by name, and "browse" — a hand-picked category (iconCategories.ts)
  // or a whole pack, a page at a time — for someone who does not know the names.
  // The mode, query, pack and list are bindable, so they survive the dialog closing.
  let {
    mode = $bindable('search'),
    pack = $bindable('all'),
    query = $bindable(''),
    source = $bindable('cat:servers'),
    page = $bindable(0),
    onchosen
  }: {
    mode?: 'search' | 'browse';
    pack?: string;
    query?: string;
    /** The browse list: `cat:<category id>` or `pack:<prefix>`. */
    source?: string;
    page?: number;
    /** An icon went into the code or onto the selection; says what happened. */
    onchosen?: (message: string) => void;
  } = $props();
  // Collect mode: a click adds the icon to the AI briefing list (AiIconPrompt.svelte).
  let collect = $state(false);
  let imported = $state<SearchablePack[]>([]);
  // mermaid's built-in icons first: they are the only ones every renderer knows.
  const names = $derived([...packNames(), ...imported.map((p) => p.prefix)]);
  // A category whose packs are all missing from this build (logo sets with
  // MERMAID_BUNDLE_LOGOS=false) is not offered.
  const categories = $derived(
    iconCategories.filter((category) =>
      category.icons.some(([id]) => names.includes(id.slice(0, id.indexOf(':'))))
    )
  );

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

  let searchId = 0;
  const search = async (text: string, chosen: string) => {
    const id = ++searchId;
    if (text.trim().length < 2) {
      // Also ends any search still loading, which will see it was superseded.
      results = [];
      loading = false;
      return;
    }
    loading = true;
    const packs = await Promise.all((chosen === 'all' ? names : [chosen]).map(loadPack));
    if (id !== searchId) return;
    const found = packs.filter((candidate) => candidate !== undefined);
    const limit = 300;
    // Standard matches lead, whatever their score against the other packs.
    results = [
      ...searchIcons(
        found.filter((candidate) => candidate.prefix === standardPrefix),
        text
      ),
      ...searchIcons(
        found.filter((candidate) => candidate.prefix !== standardPrefix),
        text,
        limit
      )
    ].slice(0, limit);
    loading = false;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    if (mode !== 'search') return;
    const text = query;
    const chosen = pack;
    clearTimeout(timer);
    timer = setTimeout(() => void search(text, chosen), 250);
    return () => clearTimeout(timer);
  });

  // Browse: the icons of the chosen list, each with a short caption.
  interface Tile {
    match: IconMatch;
    caption?: string;
  }
  // What the grid shows, all from one finished load, so the pager never mixes a new
  // list or page with the icons of the last one while the next is loading.
  interface BrowseView {
    source: string;
    page: number;
    pages: number;
    total: number;
    tiles: Tile[];
  }
  let view = $state<BrowseView>({ page: 0, pages: 1, source: '', tiles: [], total: 0 });
  let browsing = $state(false);
  let browseId = 0;
  const browse = async (chosen: string, wanted: number) => {
    const id = ++browseId;
    browsing = true;
    let next: BrowseView = { page: 0, pages: 1, source: chosen, tiles: [], total: 0 };
    if (chosen.startsWith('cat:')) {
      const category = iconCategories.find((candidate) => `cat:${candidate.id}` === chosen);
      const entries = category?.icons ?? [];
      const prefixes = [...new Set(entries.map(([icon]) => icon.slice(0, icon.indexOf(':'))))];
      const loaded = await Promise.all(
        prefixes.map(async (prefix) => [prefix, await loadPack(prefix)] as const)
      );
      const byPrefix = new Map(loaded);
      // Icons this build lacks (a logo set left out, a brand icon stripped) are skipped.
      const tiles = entries.flatMap((entry) => {
        const colon = entry[0].indexOf(':');
        const found = byPrefix.get(entry[0].slice(0, colon));
        const match = found && iconMatch(found, entry[0].slice(colon + 1));
        return match ? [{ caption: iconLabel(entry), match }] : [];
      });
      next = { ...next, tiles, total: tiles.length };
    } else {
      const found = await loadPack(chosen.slice('pack:'.length));
      if (found) {
        const shown = iconPage(found, wanted);
        next = {
          page: shown.page,
          pages: shown.pages,
          source: chosen,
          tiles: shown.icons.map((match) => ({ match })),
          total: shown.total
        };
      }
    }
    if (id !== browseId) return;
    view = next;
    browsing = false;
    if (!chosen.startsWith('cat:') && next.page !== wanted) page = next.page;
  };

  $effect(() => {
    if (mode !== 'browse') return;
    void browse(source, page);
  });

  const chooseSource = (next: string) => {
    source = next;
    page = 0;
  };

  const parses = async (code: string) => {
    try {
      await parse(code);
      return true;
    } catch {
      return false;
    }
  };

  const choose = async (choice: string) => {
    const id = iconReference(choice);
    if (collect) {
      aiCollection.add(choice);
      message = t('icons.aiCollected', { id });
      return;
    }
    // Standard icons render everywhere, but only architecture diagrams know them.
    const note = !isStandardIcon(choice)
      ? ` ${t('icons.pickExtendedNote')}`
      : validatedState.current.diagramType === 'architecture'
        ? ''
        : ` ${t('icons.pickStandardArchitectureOnly')}`;
    // A selected node or service takes the icon itself: someone who never writes code
    // clicks the shape in the diagram, then the icon.
    if (selectionModel.node || selectionModel.service) {
      await selectionModel.setIcon(id);
      message = t('icons.pickApplied', { id, name: selectionModel.label }) + note;
      onchosen?.(message);
      return;
    }
    // A name written at the cursor can break a diagram that was fine, so it is taken
    // back when it does — unless the code changed while that was being checked.
    const outcome = await insertChecked(id, {
      code: () => inputState.code,
      parses,
      restore: (code) => updateCode(code, { updateDiagram: true })
    });
    if (outcome === 'broke') {
      message = t('icons.pickBroke');
      return;
    }
    if (outcome !== 'none') {
      message = t('icons.pickInserted', { id }) + note;
      onchosen?.(message);
      return;
    }
    try {
      await navigator.clipboard.writeText(id);
      message = t('icons.pickCopied', { id }) + note;
    } catch {
      message = id;
    }
  };

  // The tooltip carries the licence facts (iconLicenses.ts) so they are at hand
  // without a visit to the licence dialog; unknown packs (vendor, imported) say nothing.
  const label = (id: string) => {
    const kind = isStandardIcon(id) ? t('icons.pickStandard') : t('icons.pickExtended');
    // The caption is the icon's own name, which the reference already carries.
    const named = iconReference(id);
    const terms = iconLicense(id);
    if (!terms) return `${named} — ${kind}`;
    const mark = terms.trademark ? ` · ™ ${t('icons.licensesTrademarkShort')}` : '';
    return `${named} — ${kind} · ${terms.title} (${terms.license})${mark}`;
  };
  const trademark = (id: string) => iconLicense(id)?.trademark ?? false;
  const packOf = (id: string) => id.slice(0, id.indexOf(':'));
  const nameOf = (id: string) => id.slice(id.indexOf(':') + 1);
  const isCategory = $derived(view.source.startsWith('cat:'));
  const firstShown = $derived(view.total === 0 ? 0 : view.page * 200 + 1);
  const lastShown = $derived(view.page * 200 + view.tiles.length);
</script>

{#snippet tile(match: IconMatch, caption?: string)}
  <button
    type="button"
    class={[
      'relative flex flex-col items-center justify-center gap-1 rounded-md border border-transparent p-2 hover:border-border hover:bg-muted'
    ]}
    title={label(match.id)}
    aria-label={label(match.id)}
    data-icon={match.id}
    data-standard={isStandardIcon(match.id)}
    onclick={() => choose(match.id)}>
    <span
      class={[
        'absolute top-1 right-1 size-2 rounded-full',
        isStandardIcon(match.id) ? 'bg-emerald-500' : 'bg-amber-500'
      ]}></span>
    <span class="size-12">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- bundled packs, or packs sanitised when loaded -->
      {@html iconSvg(match.icon)}
    </span>
    <span class="w-full truncate text-center text-xs" data-caption
      >{caption ?? nameOf(match.id)}{#if trademark(match.id)}<span class="text-muted-foreground"
          >™</span
        >{/if}</span>
    <span
      class={[
        'w-full truncate text-center text-[10px]',
        isStandardIcon(match.id)
          ? 'font-semibold text-emerald-600 dark:text-emerald-400'
          : 'text-muted-foreground'
      ]}>{isStandardIcon(match.id) ? t('icons.pickStandard') : packOf(match.id)}</span>
  </button>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col gap-2 text-sm">
  <div class="flex flex-wrap items-center gap-1" role="group">
    <Button
      variant={mode === 'search' ? 'secondary' : 'ghost'}
      size="sm"
      aria-pressed={mode === 'search'}
      data-testid={TID.iconPickerModeSearch}
      onclick={() => (mode = 'search')}>{t('icons.pickSearchMode')}</Button>
    <Button
      variant={mode === 'browse' ? 'secondary' : 'ghost'}
      size="sm"
      aria-pressed={mode === 'browse'}
      data-testid={TID.iconPickerModeBrowse}
      onclick={() => (mode = 'browse')}>{t('icons.pickBrowse')}</Button>
    <label class="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
      <input type="checkbox" bind:checked={collect} data-testid={TID.iconPickerCollect} />
      {t('icons.aiCollect')}
    </label>
  </div>
  {#if mode === 'search'}
    <div class="flex gap-1">
      <select
        bind:value={pack}
        aria-label={t('icons.pickPack')}
        data-testid={TID.iconPickerPack}
        class="h-9 max-w-[40%] rounded-md border border-input bg-background px-1 text-sm text-foreground">
        <option value="all">{t('icons.pickAll')}</option>
        {#each names as name (name)}
          <option value={name}
            >{name === standardPrefix ? t('icons.pickStandardPack') : name}</option>
        {/each}
      </select>
      <Input
        bind:value={query}
        placeholder={t('icons.pickPlaceholder')}
        aria-label={t('icons.pickPlaceholder')}
        data-testid={TID.iconPickerSearch} />
    </div>
  {:else}
    <select
      value={source}
      onchange={(event) => chooseSource(event.currentTarget.value)}
      aria-label={t('icons.pickBrowseList')}
      data-testid={TID.iconBrowseList}
      class="h-9 rounded-md border border-input bg-background px-1 text-sm text-foreground">
      <optgroup label={t('icons.pickBrowseCategories')}>
        {#each categories as category (category.id)}
          <option value={`cat:${category.id}`}>{categoryName(category, locale)}</option>
        {/each}
      </optgroup>
      <optgroup label={t('icons.pickBrowsePacks')}>
        {#each names.filter((name) => name !== standardPrefix) as name (name)}
          <option value={`pack:${name}`}>{t('icons.pickBrowsePack', { name })}</option>
        {/each}
      </optgroup>
    </select>
  {/if}
  <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
    <span class="flex items-center gap-1"
      ><span class="size-2 rounded-full bg-emerald-500"></span>{t(
        'icons.pickStandardLegend'
      )}</span>
    <span class="flex items-center gap-1"
      ><span class="size-2 rounded-full bg-amber-500"></span>{t('icons.pickExtendedLegend')}</span>
  </p>
  {#if mode === 'search'}
    {#if loading}
      <p class="text-muted-foreground">{t('icons.pickLoading')}</p>
    {:else if query.trim().length >= 2 && results.length === 0}
      <p class="text-muted-foreground">{t('icons.pickNone')}</p>
    {:else if query.trim().length < 2}
      <p class="text-muted-foreground">{t('icons.pickLargeEmpty')}</p>
    {/if}
    {#if results.length > 0}
      <div
        class="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2 overflow-y-auto"
        data-testid={TID.iconPickerResults}>
        {#each results as result (result.id)}
          {@render tile(result)}
        {/each}
      </div>
      <p class="text-muted-foreground">{t('icons.pickHint')}</p>
    {/if}
  {:else}
    {#if browsing}
      <p class="text-muted-foreground">{t('icons.pickLoading')}</p>
    {:else if view.tiles.length === 0}
      <p class="text-muted-foreground">{t('icons.pickBrowseEmpty')}</p>
    {/if}
    {#if view.source === source && !isCategory && view.total > 0}
      <div class="flex items-center gap-1 text-xs">
        <Button
          variant="outline"
          size="sm"
          disabled={browsing || page <= 0}
          data-testid={TID.iconBrowsePrev}
          onclick={() => (page = Math.max(0, page - 1))}>{t('icons.pickBrowsePrev')}</Button>
        <span class="flex-1 text-center text-muted-foreground" data-testid={TID.iconBrowseCount}
          >{t('icons.pickBrowseCount', {
            from: String(firstShown),
            to: String(lastShown),
            total: String(view.total)
          })}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={browsing || page >= view.pages - 1}
          data-testid={TID.iconBrowseNext}
          onclick={() => (page = page + 1)}>{t('icons.pickBrowseNext')}</Button>
      </div>
    {/if}
    {#if view.tiles.length > 0}
      <div
        class={[
          'grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2 overflow-y-auto',
          browsing && 'opacity-50'
        ]}
        data-testid={TID.iconBrowseGrid}>
        {#each view.tiles as { match, caption } (match.id)}
          {@render tile(match, caption)}
        {/each}
      </div>
      <p class="text-muted-foreground">{t('icons.pickHint')}</p>
    {/if}
  {/if}
  {#if message}
    <p role="status" data-testid={TID.iconPickerMessage}>{message}</p>
  {/if}
</div>
