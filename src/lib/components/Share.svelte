<script lang="ts">
  import { t } from '$/i18n';
  import CopyButton from '$/components/CopyButton.svelte';
  import FieldRow from '$/components/form/FieldRow.svelte';
  import Segmented from '$/components/form/Segmented.svelte';
  import { Input } from '$/components/ui/input';
  import { Switch } from '$/components/ui/switch';
  import { MERMAID_LOOKS, MERMAID_THEMES, TID } from '$/constants';
  import { isDarkTheme, type EmbedMode } from '$/util/embed';
  import { EMBED_IFRAME_SANDBOX, buildEmbedSnippets, buildEmbedUrls } from '$/util/embedCode';
  import { silentlySanitizeConfig } from '$/util/sanitize';
  import { validatedState } from '$/util/state.svelte';
  import { copyToClipboard } from '$/util/util';
  import { base } from '$app/paths';

  // Local: the embed code of the header's 共有 dialog (ShareDialog.svelte), as one-line
  // rows: the format (iframe / Web コンポーネント), the size and the grid, the diagram theme
  // and look, the widget frame (light/dark, controls) with a live preview, and the code to
  // copy. Upstream's dialog, its live-editor link and its trigger are gone; the links are
  // the dialog's own rows.

  const sanitizedConfig = $derived(silentlySanitizeConfig(validatedState.current.mermaid));
  // Deliberate initial-value capture: the embed form seeds from the config at
  // mount time and then owns its values.
  // svelte-ignore state_referenced_locally
  const initialConfig = sanitizedConfig;
  const initialTheme = (initialConfig.theme as string | undefined) ?? 'default';
  let theme = $state(initialTheme);
  let look = $state((initialConfig.look as string | undefined) ?? 'classic');
  // Strings, for the segmented controls; only their own values are ever set.
  let mode = $state<string>(isDarkTheme(initialTheme) ? 'dark' : 'light');
  let controls = $state(true);
  let grid = $state(true);
  let width = $state('100%');
  let height = $state('480');
  let format = $state<string>('iframe');
  let showPreview = $state(false);

  // The expensive half (config sanitize + pako serialize) is independent of
  // width/height, so typing in the size inputs only re-runs the snippet strings.
  const embedUrls = $derived(
    buildEmbedUrls({
      code: validatedState.current.code,
      config: sanitizedConfig,
      controls,
      grid,
      host: window.location.origin + base,
      look,
      mode: mode as EmbedMode,
      theme
    })
  );
  const snippets = $derived(buildEmbedSnippets(embedUrls, { height, width }));
  const snippet = $derived(format === 'wc' ? snippets.webComponent : snippets.iframe);

  const selectClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs text-foreground';
</script>

<div class="flex flex-col gap-1.5">
  <p class="text-xs text-muted-foreground">{t('share.embedDescription')}</p>
  <FieldRow label={t('shareDlg.embedFormat')}>
    <Segmented
      bind:value={format}
      full
      ariaLabel={t('shareDlg.embedFormat')}
      testID={TID.shareDlgEmbedMode}
      options={[
        { label: t('share.iframe'), value: 'iframe' },
        { label: t('share.webComponent'), value: 'wc' }
      ]} />
  </FieldRow>
  <FieldRow label={t('shareDlg.size')}>
    <Input
      bind:value={width}
      class="h-7 w-20 px-2 text-xs"
      aria-label={t('share.width')}
      title={t('share.width')}
      data-testid={TID.shareDlgWidth} />
    <span class="text-xs text-muted-foreground">×</span>
    <Input
      bind:value={height}
      class="h-7 w-20 px-2 text-xs"
      aria-label={t('share.height')}
      title={t('share.height')}
      data-testid={TID.shareDlgHeight} />
    <span class="flex-1"></span>
    <label class="flex items-center gap-1.5 text-xs">
      <Switch bind:checked={grid} data-testid={TID.shareDlgGrid} />
      {t('share.grid')}
    </label>
  </FieldRow>
  <FieldRow label={t('share.theme')}>
    <select
      bind:value={theme}
      class={selectClass}
      aria-label={t('share.theme')}
      data-testid={TID.shareDlgTheme}>
      {#each MERMAID_THEMES as themeName (themeName)}
        <option value={themeName}>{themeName}</option>
      {/each}
    </select>
    <select
      bind:value={look}
      class={selectClass}
      aria-label={t('share.look')}
      title={t('share.look')}
      data-testid={TID.shareDlgLook}>
      {#each MERMAID_LOOKS as lookName (lookName)}
        <option value={lookName}>{lookName}</option>
      {/each}
    </select>
  </FieldRow>
  <FieldRow label={t('shareDlg.chrome')}>
    <Segmented
      bind:value={mode}
      ariaLabel={t('shareDlg.chrome')}
      testID={TID.shareDlgChrome}
      options={[
        { label: t('share.themeLight'), value: 'light' },
        { label: t('share.themeDark'), value: 'dark' }
      ]} />
    <span class="flex-1"></span>
    <label class="flex items-center gap-1.5 text-xs whitespace-nowrap">
      <Switch bind:checked={controls} data-testid={TID.shareDlgControls} />
      {t('share.controls')}
    </label>
    <label class="flex items-center gap-1.5 text-xs whitespace-nowrap">
      <Switch bind:checked={showPreview} data-testid={TID.shareDlgPreview} />
      {t('share.preview')}
    </label>
  </FieldRow>
  <FieldRow label={t('shareDlg.code')}>
    <textarea
      data-testid={TID.shareDlgSnippet}
      readonly
      rows="2"
      aria-label={t('shareDlg.code')}
      class="min-w-0 flex-1 resize-none rounded-md border border-input bg-background px-2 py-1 font-mono text-[11px] leading-snug text-foreground"
      value={snippet}></textarea>
    <CopyButton
      onclick={() => copyToClipboard(snippet)}
      size="sm"
      variant="outline"
      testID={TID.shareDlgSnippetCopy} />
  </FieldRow>
  {#if showPreview}
    <iframe
      data-testid={TID.embedPreview}
      src={embedUrls.url}
      title={t('share.embedPreview')}
      class="h-52 w-full rounded-lg border"
      sandbox={EMBED_IFRAME_SANDBOX}></iframe>
  {/if}
</div>
