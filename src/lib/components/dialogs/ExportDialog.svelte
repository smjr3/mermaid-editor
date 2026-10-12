<script lang="ts">
  import CopyInput from '$/components/CopyInput.svelte';
  import ExternalLinkWrapper from '$/components/ExternalLinkWrapper.svelte';
  import FieldRow from '$/components/form/FieldRow.svelte';
  import Segmented from '$/components/form/Segmented.svelte';
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import type { State } from '$/types';
  import { waitForRender } from '$/util/autoSync';
  import { closeDialog, editorUi } from '$/util/editorUi.svelte';
  import {
    canCopyImage,
    copyHtmlTag,
    copyPng,
    currentBackdrop,
    DEFAULT_BACKGROUND,
    DEFAULT_SCALE,
    EXPORT_BACKGROUNDS,
    EXPORT_FORMATS,
    EXPORT_SCALES,
    exportFileName,
    formatExtension,
    formatUsesBackground,
    formatUsesScale,
    isCopyOnly,
    isExportBackground,
    isExportScale,
    previewSvg,
    saveDrawio,
    saveHtml,
    saveMarkdown,
    savePng,
    saveSvg,
    saveVsdx,
    themeColour,
    type ExportBackground,
    type ExportFormat,
    type ExportScale,
    type HtmlMode
  } from '$/util/exportDiagram';
  import { notify } from '$/util/notify';
  import { persisted } from '$/util/persist.svelte';
  import { defaultFileBase } from '$/util/saveFile';
  import { inputState, urls, validatedState } from '$/util/state.svelte';
  import { presetBackground } from '$/util/themePresets';
  import { getDomain } from '$/util/util';
  import { browser } from '$app/environment';
  import { resolve } from '$app/paths';
  import { untrack } from 'svelte';
  import CheckIcon from '~icons/material-symbols/check-rounded';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import ExternalLinkIcon from '~icons/material-symbols/open-in-new-rounded';

  // Local: the header's 書き出す dialog. On the left a preview of the diagram on the chosen
  // background (a checkerboard for transparent); on the right the formats as cards, the
  // options the chosen format takes (解像度 for PNG and the copy; 背景 for PNG, SVG, the copy
  // and Markdown; how for HTML; a note for each), and at the bottom the file name with
  // its extension and 保存 / コピー. The file is saved under that name at once: there is
  // no second name dialog and no PNG width/height in pixels (user decisions,
  // 2026-10-12). The exports themselves are in exportDiagram.ts.

  // The background and the scale are remembered per browser; a new user starts transparent.
  const backgroundStore = persisted<ExportBackground>('exportBackground', DEFAULT_BACKGROUND);
  const scaleStore = persisted<ExportScale>('exportScale', DEFAULT_SCALE);
  const background = $derived(
    isExportBackground(backgroundStore.value) ? backgroundStore.value : DEFAULT_BACKGROUND
  );
  const scale = $derived(isExportScale(scaleStore.value) ? scaleStore.value : DEFAULT_SCALE);

  const FORMAT_LABELS: Record<ExportFormat, { hint: MessageKey; name: MessageKey }> = {
    copy: { hint: 'exportDlg.fmtCopyHint', name: 'exportDlg.fmtCopy' },
    drawio: { hint: 'exportDlg.fmtDrawioHint', name: 'exportDlg.fmtDrawio' },
    html: { hint: 'exportDlg.fmtHtmlHint', name: 'exportDlg.fmtHtml' },
    md: { hint: 'exportDlg.fmtMdHint', name: 'exportDlg.fmtMd' },
    png: { hint: 'exportDlg.fmtPngHint', name: 'exportDlg.fmtPng' },
    svg: { hint: 'exportDlg.fmtSvgHint', name: 'exportDlg.fmtSvg' },
    vsdx: { hint: 'exportDlg.fmtVsdxHint', name: 'exportDlg.fmtVsdx' }
  };
  const BACKGROUND_LABELS: Record<ExportBackground, MessageKey> = {
    theme: 'exportDlg.bgTheme',
    transparent: 'exportDlg.bgTransparent',
    white: 'exportDlg.bgWhite'
  };
  const BACKGROUND_NOTES: Record<ExportBackground, MessageKey> = {
    theme: 'exportDlg.noteTheme',
    transparent: 'exportDlg.noteTransparent',
    white: 'exportDlg.noteWhite'
  };
  const SCALE_LABELS: Record<ExportScale, MessageKey> = {
    1: 'exportDlg.scale1',
    2: 'exportDlg.scale2',
    3: 'exportDlg.scale3'
  };

  // The image copy needs ClipboardItem; without it the card is not offered.
  const formats = EXPORT_FORMATS.filter((value) => value !== 'copy' || canCopyImage());
  let format = $state<ExportFormat>('png');
  let htmlMode = $state<HtmlMode>('file');
  let fileBase = $state('');
  let message = $state('');
  let status = $state<'busy' | 'done' | 'failed' | 'idle'>('idle');
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const open = $derived(editorUi.dialog === 'export');
  const extension = $derived(formatExtension(format, htmlMode));
  const copyOnly = $derived(isCopyOnly(format, htmlMode));
  const diagramFill = $derived(presetBackground(inputState.mermaid));

  // Each time the dialog opens: the name from the diagram's title, no old message.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      fileBase = defaultFileBase(inputState.code);
      message = '';
      status = 'idle';
    });
  });

  // The note under the options: what the file will be.
  const backgroundNote = $derived(
    t(
      diagramFill && background !== 'transparent'
        ? 'actions.noteDiagramBackground'
        : BACKGROUND_NOTES[background]
    )
  );
  const note = $derived.by(() => {
    switch (format) {
      case 'copy':
      case 'png': {
        return t('actions.note', {
          background: backgroundNote,
          scale: String(scale),
          size: t('actions.noteAsIs')
        });
      }
      case 'drawio': {
        return t('saveAs.drawioHint');
      }
      case 'html': {
        return t(htmlMode === 'file' ? 'actions.htmlHint' : 'exportDlg.noteHtmlTag');
      }
      case 'md': {
        return `${t('actions.gitlabHint')} / ${backgroundNote}`;
      }
      case 'svg': {
        return t('actions.noteSvg', { background: backgroundNote, size: t('actions.noteAsIs') });
      }
      case 'vsdx': {
        return t('saveAs.vsdxHint');
      }
    }
  });

  // The preview: the diagram on screen without pan/zoom, taken again when it changes.
  let previewHost = $state<HTMLElement | null>(null);
  let hasPreview = $state(true);
  $effect(() => {
    const host = previewHost;
    if (!host || !open) return;
    void validatedState.current.serialized;
    let cancelled = false;
    void waitForRender()
      .then(() => new Promise((done) => setTimeout(done, 50)))
      .then(() => {
        if (cancelled) return;
        const svg = previewSvg();
        hasPreview = !!svg;
        host.replaceChildren(...(svg ? [svg] : []));
      });
    return () => {
      cancelled = true;
    };
  });
  // The preview's paper: the backdrop the file gets (the HTML page has the site's colour).
  const paper = $derived.by((): null | string => {
    void diagramFill;
    if (format === 'html') return themeColour().trim() || '#ffffff';
    const fill = currentBackdrop(background);
    return fill === 'transparent' ? null : fill;
  });

  const FAILURES: Partial<Record<ExportFormat, MessageKey>> = {
    copy: 'notify.copyFailed',
    drawio: 'saveAs.failed',
    png: 'actions.pngFailed',
    svg: 'saveAs.failed',
    vsdx: 'saveAs.failed'
  };

  const showFor = (next: 'done' | 'failed') => {
    status = next;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      status = 'idle';
    }, 1500);
  };

  const exportNow = async (chosen: ExportFormat, name: string) => {
    const options = { background, scale };
    const state = untrack(() => $state.snapshot(inputState) as State);
    switch (chosen) {
      case 'copy': {
        await copyPng(options);
        break;
      }
      case 'drawio': {
        await saveDrawio(name, options);
        break;
      }
      case 'html': {
        await (htmlMode === 'tag' ? copyHtmlTag(state) : saveHtml(name, state));
        break;
      }
      case 'md': {
        const { copied } = await saveMarkdown(name, state, {
          background,
          editBase: `${window.location.origin}${resolve('/edit', {})}`,
          labels: { edit: t('actions.gitlabEdit'), source: t('actions.gitlabSource') }
        });
        message = t(copied ? 'actions.gitlabDone' : 'actions.gitlabCopyFailed', { file: name });
        break;
      }
      case 'png': {
        await savePng(name, options);
        break;
      }
      case 'svg': {
        await saveSvg(name, options);
        break;
      }
      case 'vsdx': {
        await saveVsdx(name, options);
        break;
      }
    }
  };

  const run = async () => {
    if (status === 'busy') return;
    const chosen = format;
    const name = extension
      ? exportFileName(
          fileBase,
          untrack(() => inputState.code),
          extension
        )
      : '';
    clearTimeout(resetTimer);
    message = '';
    status = 'busy';
    try {
      await exportNow(chosen, name);
      showFor('done');
    } catch (error) {
      console.error(`${chosen} export failed`, error);
      showFor('failed');
      const failure = FAILURES[chosen];
      // HTML and Markdown render the diagram afresh: a syntax error is reported here.
      if (failure) notify(t(failure));
      else message = t('actions.exportFailed');
    }
  };

  const isNetlify = browser && window.location.host.includes('netlify');
  const hasExternal = $derived(
    !!(urls.current.png || urls.current.svg || urls.current.kroki || urls.current.mdCode)
  );
</script>

{#snippet externalLink(url: string, label: string)}
  <ExternalLinkWrapper domain={getDomain(url)}>
    <Button variant="outline" size="sm" href={url} target="_blank" rel="noreferrer noopener">
      <ExternalLinkIcon />
      {label}
    </Button>
  </ExternalLinkWrapper>
{/snippet}

<Dialog.Root
  {open}
  onOpenChange={(value) => {
    if (!value) closeDialog();
  }}>
  <Dialog.Content
    class="flex h-[min(560px,92vh)] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[880px]"
    data-testid={TID.exportDlg}>
    <Dialog.Header class="flex h-11 shrink-0 justify-center border-b px-4">
      <Dialog.Title class="text-base">{t('exportDlg.title')}</Dialog.Title>
      <Dialog.Description class="sr-only">{note}</Dialog.Description>
    </Dialog.Header>
    <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_330px]">
      <div
        class="flex min-h-0 min-w-0 items-center justify-center border-r bg-muted/40 p-5"
        aria-label={t('exportDlg.preview')}>
        <div
          class={[
            'flex max-h-full max-w-full min-w-0 rounded p-2.5 shadow',
            paper === null && 'export-checker'
          ]}
          style:background-color={paper ?? undefined}
          data-testid={TID.exportDlgPreview}
          data-background={paper === null ? 'transparent' : paper}>
          <div
            bind:this={previewHost}
            class="flex max-h-[400px] max-w-full min-w-0 items-center justify-center [&>svg]:max-h-[400px]">
          </div>
          {#if !hasPreview}
            <span class="text-sm text-muted-foreground">{t('exportDlg.previewEmpty')}</span>
          {/if}
        </div>
      </div>
      <div class="flex min-h-0 min-w-0 flex-col">
        <div class="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-3">
          <div
            class="grid w-full grid-cols-2 gap-1.5"
            role="group"
            aria-label={t('exportDlg.format')}
            data-testid={TID.exportDlgFormat}>
            {#each formats as value (value)}
              <button
                type="button"
                class={[
                  'flex min-w-0 flex-col items-start gap-px rounded-md border px-2 py-1.5 text-left',
                  value === format
                    ? 'border-accent bg-accent/10 ring-1 ring-accent'
                    : 'border-border bg-background hover:border-muted-foreground'
                ]}
                aria-pressed={value === format}
                data-testid="{TID.exportDlgFormat}-{value}"
                onclick={() => {
                  format = value;
                  message = '';
                }}>
                <b class="truncate text-xs">{t(FORMAT_LABELS[value].name)}</b>
                <small class="text-[11px] leading-tight text-muted-foreground">
                  {t(FORMAT_LABELS[value].hint)}
                </small>
              </button>
            {/each}
          </div>
          {#if formatUsesScale(format)}
            <FieldRow label={t('exportDlg.scale')}>
              <Segmented
                value={String(scale)}
                full
                ariaLabel={t('exportDlg.scale')}
                testID={TID.exportDlgScale}
                onchange={(value) => (scaleStore.value = Number(value) as ExportScale)}
                options={EXPORT_SCALES.map((value) => ({
                  label: t(SCALE_LABELS[value]),
                  title: t('exportDlg.scaleHint', { scale: String(value) }),
                  value: String(value)
                }))} />
            </FieldRow>
          {/if}
          {#if formatUsesBackground(format)}
            <FieldRow label={t('exportDlg.background')}>
              <Segmented
                value={background}
                full
                ariaLabel={t('exportDlg.background')}
                testID={TID.exportDlgBackground}
                onchange={(value) => (backgroundStore.value = value as ExportBackground)}
                options={EXPORT_BACKGROUNDS.map((value) => ({
                  label: t(BACKGROUND_LABELS[value]),
                  value
                }))} />
            </FieldRow>
          {/if}
          {#if format === 'html'}
            <FieldRow label={t('exportDlg.htmlMode')}>
              <Segmented
                value={htmlMode}
                full
                ariaLabel={t('exportDlg.htmlMode')}
                testID={TID.exportDlgHtmlMode}
                onchange={(value) => {
                  htmlMode = value as HtmlMode;
                  message = '';
                }}
                options={[
                  { label: t('exportDlg.htmlFile'), value: 'file' },
                  { label: t('exportDlg.htmlTag'), value: 'tag' }
                ]} />
            </FieldRow>
          {/if}
          <p
            class="rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground"
            data-testid={TID.exportDlgNote}>
            {note}
          </p>
          {#if hasExternal}
            <!-- Only when an external renderer is configured (off by default, .env). -->
            <div class="flex flex-col gap-1.5" data-testid={TID.exportDlgExternal}>
              <FieldRow label={t('exportDlg.external')}>
                <div class="flex flex-wrap gap-1">
                  {#if urls.current.png}
                    {@render externalLink(urls.current.png, t('exportDlg.openPng'))}
                  {/if}
                  {#if urls.current.svg}
                    {@render externalLink(urls.current.svg, t('exportDlg.openSvg'))}
                  {/if}
                  {#if urls.current.kroki}
                    {@render externalLink(urls.current.kroki, t('exportDlg.openKroki'))}
                  {/if}
                </div>
              </FieldRow>
              {#if urls.current.mdCode}
                <ExternalLinkWrapper
                  labelPrefix={t('external.thumbnailBy')}
                  domain={getDomain(urls.current.png)}>
                  <CopyInput
                    compact
                    value={urls.current.mdCode}
                    label={t('actions.copyMarkdown')}
                    testID={TID.copyMarkdown} />
                </ExternalLinkWrapper>
              {/if}
            </div>
          {/if}
          {#if message}
            <p
              role="status"
              class="text-xs text-muted-foreground"
              data-testid={TID.exportDlgMessage}>
              {message}
            </p>
          {/if}
        </div>
        <form
          class="flex shrink-0 flex-col gap-2 border-t px-3.5 py-2.5"
          onsubmit={(event) => {
            event.preventDefault();
            void run();
          }}>
          {#if !copyOnly}
            <div class="flex items-center gap-1">
              <Input
                bind:value={fileBase}
                class="h-8 min-w-0 flex-1 px-2 text-sm"
                aria-label={t('exportDlg.fileName')}
                placeholder={t('exportDlg.fileName')}
                data-testid={TID.exportDlgFileName} />
              <span class="text-sm text-muted-foreground" data-testid={TID.exportDlgExtension}
                >.{extension}</span>
            </div>
          {/if}
          <div class="flex items-center justify-end gap-2">
            {#if isNetlify}
              <a class="mr-auto text-xs text-muted-foreground underline" href="https://netlify.com">
                This site is powered by Netlify
              </a>
            {/if}
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid={TID.exportDlgCancel}
              onclick={closeDialog}>
              {t('exportDlg.cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="accent"
              aria-busy={status === 'busy'}
              disabled={status === 'busy'}
              data-export-state={status}
              data-testid={TID.exportDlgSave}>
              {#if status === 'done'}
                <CheckIcon class="size-4" />
              {:else if status === 'failed'}
                <ErrorIcon class="size-4" />
              {/if}
              {t(copyOnly ? 'exportDlg.copy' : 'exportDlg.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>

<style>
  .export-checker {
    background: conic-gradient(#e6e6e6 0 25%, #fff 0 50%, #e6e6e6 0 75%, #fff 0) 0 0 / 16px 16px;
  }
</style>
