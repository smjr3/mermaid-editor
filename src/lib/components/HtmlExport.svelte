<script lang="ts">
  import CopyButton from '$/components/CopyButton.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { gitlabMarkdown, svgFile, toImgTag, toStandaloneHtml } from '$/util/htmlExport';
  import { render } from '$/util/mermaid';
  import { inputState, validatedState } from '$/util/state.svelte';
  import type { MermaidConfig } from 'mermaid';
  import { base } from '$app/paths';
  import dayjs from 'dayjs';
  import GitLabIcon from '~icons/material-symbols/upload-file-outline-rounded';
  import CodeIcon from '~icons/material-symbols/code-rounded';

  // Local: export the diagram as a standalone HTML page, or copy it as one
  // self-contained <img> tag (htmlExport.ts). Rendered afresh rather than taken
  // from the view, so pan and zoom do not leak into the file.
  let probe = 0;
  const renderSvg = async (): Promise<string> => {
    let config: MermaidConfig = {};
    try {
      config = JSON.parse(inputState.mermaid) as MermaidConfig;
    } catch {
      // An unparsable config renders with the defaults, like the view's last good render.
    }
    probe++;
    const { svg } = await render(config, inputState.code, `html-export-${probe}`);
    return svg;
  };

  const title = () => `${validatedState.current.diagramType ?? 'mermaid'} diagram`;

  const background = () => getComputedStyle(document.body).getPropertyValue('--background');
  const stamp = () => dayjs().format('YYYY-MM-DD-HHmmss');
  let message = $state('');

  const save = (content: string, type: string, fileName: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

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
    const fileName = `mermaid-diagram-${stamp()}.svg`;
    save(svgFile(await renderSvg(), background()), 'image/svg+xml', fileName);
    const markdown = gitlabMarkdown({
      alt: title(),
      code: inputState.code,
      editUrl: `${window.location.origin}${base}/edit#${validatedState.current.serialized}`,
      fileName,
      labels: { edit: t('actions.gitlabEdit'), source: t('actions.gitlabSource') }
    });
    try {
      await navigator.clipboard.writeText(markdown);
      message = t('actions.gitlabDone', { file: fileName });
    } catch {
      message = t('actions.gitlabCopyFailed', { file: fileName });
    }
  });

  const onDownload = guarded(async () => {
    const html = toStandaloneHtml({
      background: background(),
      code: inputState.code,
      svg: await renderSvg(),
      title: title()
    });
    save(html, 'text/html', `mermaid-diagram-${stamp()}.html`);
  });

  const onCopyTag = async () => {
    await navigator.clipboard.writeText(toImgTag(await renderSvg(), title()));
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
