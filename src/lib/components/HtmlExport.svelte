<script lang="ts">
  import CopyButton from '$/components/CopyButton.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { toImgTag, toStandaloneHtml } from '$/util/htmlExport';
  import { render } from '$/util/mermaid';
  import { inputState, validatedState } from '$/util/state.svelte';
  import type { MermaidConfig } from 'mermaid';
  import dayjs from 'dayjs';
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

  const onDownload = async () => {
    const html = toStandaloneHtml({
      background: getComputedStyle(document.body).getPropertyValue('--background'),
      code: inputState.code,
      svg: await renderSvg(),
      title: title()
    });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const link = document.createElement('a');
    link.download = `mermaid-diagram-${dayjs().format('YYYY-MM-DD-HHmmss')}.html`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

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
