<script lang="ts">
  import CopyButton from '$/components/CopyButton.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import {
    buildGitLabExport,
    buildStandaloneHtml,
    takeExportSnapshot,
    toImgTag,
    type ExportSnapshot
  } from '$/util/htmlExport';
  import { render } from '$/util/mermaid';
  import { inputState, validatedState } from '$/util/state.svelte';
  import type { State } from '$/types';
  import type { MermaidConfig } from 'mermaid';
  import { untrack } from 'svelte';
  import { base } from '$app/paths';
  import { askFileName } from '$/util/saveAsPrompt.svelte';
  import { defaultFileBase, pickSaveTarget, type SaveTarget } from '$/util/saveFile';
  import GitLabIcon from '~icons/material-symbols/upload-file-outline-rounded';
  import CodeIcon from '~icons/material-symbols/code-rounded';

  // Local: export the diagram as a standalone HTML page, or copy it as one
  // self-contained <img> tag (htmlExport.ts). Rendered afresh rather than taken
  // from the view, so pan and zoom do not leak into the file. Each export starts
  // from one snapshot of the diagram (`takeExportSnapshot`), so edits made while
  // it renders do not end up in only part of it.
  let probe = 0;
  const renderSvg = async (config: MermaidConfig, code: string): Promise<string> => {
    probe++;
    const { svg } = await render(config, code, `html-export-${probe}`);
    return svg;
  };

  const snapshot = (): ExportSnapshot =>
    untrack(() => {
      const state = $state.snapshot(inputState) as State;
      const validated = validatedState.current;
      return takeExportSnapshot(
        state,
        validated.code === state.code ? validated.diagramType : undefined
      );
    });

  const background = () => getComputedStyle(document.body).getPropertyValue('--background');
  let message = $state('');

  // Local: "名前を付けて保存" (saveFile.ts); the name defaults to the diagram's title.
  const chooseTarget = (extension: 'html' | 'svg', mime: string): Promise<SaveTarget | undefined> =>
    pickSaveTarget(
      `${defaultFileBase(untrack(() => inputState.code))}.${extension}`,
      {
        description: t(extension === 'html' ? 'saveAs.typeHtml' : 'saveAs.typeSvg'),
        extension,
        mime
      },
      { askName: askFileName }
    );
  const save = (target: SaveTarget, content: string, type: string) =>
    target.write(new Blob([content], { type }));

  // GitLab: the SVG to commit next to the page, and the Markdown that shows it,
  // links back here and keeps the source (htmlExport.ts).
  // A diagram that does not render (a syntax error) is reported, not exported.
  const guarded = (run: () => Promise<void>) => async () => {
    message = '';
    try {
      await run();
    } catch {
      message = t('actions.exportFailed');
    }
  };

  const onGitLab = guarded(async () => {
    const target = await chooseTarget('svg', 'image/svg+xml');
    if (!target) return;
    const fileName = target.name;
    const { markdown, svg } = await buildGitLabExport(snapshot(), {
      background: background(),
      editBase: `${window.location.origin}${base}/edit`,
      fileName,
      labels: { edit: t('actions.gitlabEdit'), source: t('actions.gitlabSource') },
      render: renderSvg
    });
    await save(target, svg, 'image/svg+xml');
    try {
      await navigator.clipboard.writeText(markdown);
      message = t('actions.gitlabDone', { file: fileName });
    } catch {
      message = t('actions.gitlabCopyFailed', { file: fileName });
    }
  });

  const onDownload = guarded(async () => {
    const target = await chooseTarget('html', 'text/html');
    if (!target) return;
    const html = await buildStandaloneHtml(snapshot(), {
      background: background(),
      render: renderSvg
    });
    await save(target, html, 'text/html');
  });

  const onCopyTag = async () => {
    const { code, config, title } = snapshot();
    await navigator.clipboard.writeText(toImgTag(await renderSvg(config, code), title));
  };
</script>

<div class="flex gap-2">
  <Button
    class="action-btn flex flex-grow items-center gap-2"
    data-testid={TID.downloadHTML}
    title={t('actions.htmlHint')}
    onclick={onDownload}>
    <CodeIcon /> HTML
  </Button>
  <CopyButton onclick={onCopyTag} label={t('actions.copyHtmlTag')} />
</div>
<Button
  class="action-btn flex w-full items-center gap-2"
  data-testid={TID.exportGitLab}
  title={t('actions.gitlabHint')}
  onclick={onGitLab}>
  <GitLabIcon />
  {t('actions.gitlab')}
</Button>
{#if message}
  <p role="status" class="text-sm text-muted-foreground" data-testid={TID.exportMessage}>
    {message}
  </p>
{/if}
