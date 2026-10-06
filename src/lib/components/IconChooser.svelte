<script lang="ts">
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { searchCatalog } from '$/util/iconCatalog';
  import { iconSvg, type IconMatch } from '$/util/iconSearch';
  import { iconReference } from '$/util/standardIcons';

  // Local: a small icon search for the Edit card — type part of a name, click
  // an icon to choose it (iconCatalog.ts searches every pack the editor knows).
  let { onpick, standard = false }: { onpick: (icon: string) => void; standard?: boolean } =
    $props();

  let query = $state('');
  let results = $state<IconMatch[]>([]);
  let loading = $state(false);
  let searchId = 0;

  $effect(() => {
    const text = query;
    const id = ++searchId;
    if (text.trim().length < 2) {
      results = [];
      loading = false;
      return;
    }
    loading = true;
    const timer = setTimeout(() => {
      void searchCatalog(text, { limit: 30, standard }).then((found) => {
        if (id !== searchId) return;
        results = found;
        loading = false;
      });
    }, 250);
    return () => clearTimeout(timer);
  });
</script>

<div class="flex flex-col gap-1">
  <Input
    bind:value={query}
    class="h-9"
    placeholder={t('edit.iconSearch')}
    aria-label={t('edit.iconSearch')}
    data-testid={TID.editIconSearch} />
  {#if loading}
    <p class="text-xs text-muted-foreground">{t('edit.iconLoading')}</p>
  {:else if query.trim().length >= 2 && results.length === 0}
    <p class="text-xs text-muted-foreground">{t('edit.iconNoMatch')}</p>
  {/if}
  {#if results.length > 0}
    <div
      class="grid max-h-36 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 overflow-y-auto sm:max-h-none sm:overflow-visible">
      {#each results as match (match.id)}
        <button
          type="button"
          class="flex aspect-square items-center justify-center rounded border border-transparent p-1 text-foreground hover:border-border hover:bg-muted"
          title={match.id}
          aria-label={match.id}
          data-testid={TID.editIconResult}
          data-icon={match.id}
          onclick={() => onpick(iconReference(match.id))}>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- bodies come from bundled or sanitised packs -->
          {@html iconSvg(match.icon)}
        </button>
      {/each}
    </div>
  {/if}
</div>
