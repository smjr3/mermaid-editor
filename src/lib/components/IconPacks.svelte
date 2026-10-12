<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { buildIconSet, sanitizeIconSet, toPrefix, type IconifyJSON } from '$/util/customIcons';
  import {
    deleteIconPack,
    listIconPacks,
    saveIconPack,
    storageErrorKind
  } from '$/util/customIconStore';
  import { iconPacks } from '$/util/iconPacks';
  import { onMount } from 'svelte';
  import DeleteIcon from '~icons/material-symbols/delete-outline';

  // Local: the icon packs — the bundled ones, and SVG / Iconify JSON packs imported into
  // this browser (customIconStore.ts) — as the content of the inspector's 「アイコン集」 dialog.
  const bundled = iconPacks.map(({ name }) => name);

  let packs = $state<IconifyJSON[]>([]);
  let prefix = $state('');
  let files = $state<FileList | undefined>();
  let message = $state('');
  let isError = $state(false);

  const refresh = async () => {
    try {
      packs = await listIconPacks();
    } catch {
      packs = [];
    }
  };

  onMount(refresh);

  const report = (text: string, error = false) => {
    message = text;
    isError = error;
  };

  // A write that did not reach storage: why, and that it can be tried again
  // (the chosen files stay selected).
  const storageError = (error: unknown): string => {
    const kind = storageErrorKind(error);
    if (kind === 'full') return t('icons.errorStorageFull');
    if (kind === 'blocked') return t('icons.errorStorageBlocked');
    return t('icons.errorStorage', {
      message: error instanceof Error ? error.message : String(error)
    });
  };

  const readPack = async (chosen: File[]): Promise<IconifyJSON> => {
    const name = toPrefix(prefix);
    const json = chosen.length === 1 && /\.json$/i.test(chosen[0].name) ? chosen[0] : undefined;
    if (json) {
      return sanitizeIconSet(JSON.parse(await json.text()) as unknown, name);
    }
    if (!chosen.every((file) => /\.svg$/i.test(file.name))) {
      throw new Error(t('icons.errorFiles'));
    }
    if (!name) {
      throw new Error(t('icons.errorPrefix'));
    }
    return buildIconSet(
      name,
      await Promise.all(chosen.map(async (file) => ({ name: file.name, text: await file.text() })))
    );
  };

  const importPack = async () => {
    const chosen = [...(files ?? [])];
    if (chosen.length === 0) {
      report(t('icons.errorFiles'), true);
      return;
    }
    let pack: IconifyJSON;
    try {
      pack = await readPack(chosen);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      report(t('icons.errorRead', { file: chosen[0].name, message: text }), true);
      return;
    }
    if (bundled.includes(pack.prefix)) {
      report(t('icons.errorPrefix'), true);
      return;
    }
    const count = Object.keys(pack.icons).length;
    if (count === 0) {
      report(t('icons.errorEmpty'), true);
      return;
    }
    // Local: shown as imported only once the pack is stored (saveIconPack waits for
    // the IndexedDB transaction to complete, and registers the pack after that).
    try {
      await saveIconPack(pack);
    } catch (error) {
      console.error('Icon pack not saved', error);
      report(storageError(error), true);
      return;
    }
    await refresh();
    report(t('icons.done', { count: String(count), prefix: pack.prefix }));
  };

  const remove = async (name: string) => {
    if (confirm(t('icons.deleteConfirm', { prefix: name }))) {
      try {
        await deleteIconPack(name);
      } catch (error) {
        console.error('Icon pack not deleted', error);
        report(storageError(error), true);
        return;
      }
      await refresh();
      report('');
    }
  };
</script>

<div class="flex flex-col gap-3 text-sm">
  <p class="text-muted-foreground">
    {t('icons.bundled', { packs: bundled.join(', ') })}
    <a
      class="text-accent underline"
      href="https://icon-sets.iconify.design/"
      target="_blank"
      rel="noopener noreferrer">{t('icons.browse')}</a>
  </p>

  <div class="flex flex-col gap-1">
    <span class="font-semibold">{t('icons.imported')}</span>
    <ul class="flex flex-col gap-1" data-testid={TID.iconPackList}>
      {#each packs as pack (pack.prefix)}
        <li class="flex items-center justify-between gap-2">
          <span>
            <code>{pack.prefix}</code>
            <span class="text-muted-foreground">
              {t('icons.count', { count: String(Object.keys(pack.icons).length) })}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            title={t('icons.delete', { prefix: pack.prefix })}
            aria-label={t('icons.delete', { prefix: pack.prefix })}
            onclick={() => remove(pack.prefix)}>
            <DeleteIcon />
          </Button>
        </li>
      {:else}
        <li class="text-muted-foreground">{t('icons.none')}</li>
      {/each}
    </ul>
  </div>

  <label class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2">
    <span class="text-xs text-muted-foreground">{t('icons.prefix')}</span>
    <Input
      bind:value={prefix}
      class="h-8"
      placeholder="corp-icons"
      data-testid={TID.iconPackPrefix} />
  </label>
  <label class="flex flex-col gap-1">
    <span class="text-xs text-muted-foreground">{t('icons.files')}</span>
    <input
      type="file"
      multiple
      accept=".svg,.json,image/svg+xml,application/json"
      bind:files
      data-testid={TID.iconPackFiles} />
  </label>
  <div>
    <Button size="sm" onclick={importPack} data-testid={TID.iconPackImport}>
      {t('icons.import')}
    </Button>
  </div>
  {#if message}
    <p class={isError ? 'text-destructive' : 'text-muted-foreground'} role="status">{message}</p>
  {/if}
</div>
