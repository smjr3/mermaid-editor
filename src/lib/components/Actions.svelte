<script lang="ts">
  import { t } from '$/i18n';
  import Card from '$/components/Card/Card.svelte';
  import CopyButton from '$/components/CopyButton.svelte';
  import CopyInput from '$/components/CopyInput.svelte';
  import ExternalLinkWrapper from '$/components/ExternalLinkWrapper.svelte';
  import HtmlExport from '$/components/HtmlExport.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { Separator } from '$/components/ui/separator';
  import * as ToggleGroup from '$/components/ui/toggle-group';
  import { TID } from '$/constants';
  import { env } from '$/util/env';
  import { notify } from '$/util/notify';
  import { getDomain } from '$/util/util';
  import { browser } from '$app/environment';
  import { waitForRender } from '$lib/util/autoSync';
  import { inputState, updateCodeStore, urls, validatedState } from '$lib/util/state.svelte';
  import { logEvent } from '$lib/util/stats';
  import { version as FAVersion } from '@fortawesome/fontawesome-free/package.json';
  import dayjs from 'dayjs';
  import { untrack } from 'svelte';
  import { toXmlSvg } from '$/util/htmlExport';
  import {
    backgroundFill,
    computeExportLayout,
    computeSvgLayout,
    EXPORT_BACKGROUNDS,
    EXPORT_PRESETS,
    EXPORT_SCALES,
    isExportBackground,
    isExportPreset,
    isExportScale,
    PRESET_SIZES,
    type ExportBackground,
    type ExportPreset,
    type ExportScale,
    type Rect
  } from '$/util/exportPresets';
  import { persisted } from '$/util/persist.svelte';
  import { presetBackground } from '$/util/themePresets';
  import { canvasToBlob, copyImageBlob, createPanZoomPause, loadImage } from '$/util/imageExport';
  import { toBase64 } from 'js-base64';
  import DownloadIcon from '~icons/material-symbols/download';
  import ExternalLinkIcon from '~icons/material-symbols/open-in-new-rounded';
  import WidthIcon from '~icons/material-symbols/width-rounded';

  const FONT_AWESOME_URL = `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/${FAVersion}/css/all.min.css`;

  // Local: settles when the file is saved or the image is on the clipboard (imageExport.ts).
  type Exporter = (
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    draw: Rect
  ) => Promise<void>;

  // Local: office export presets, remembered per browser.
  const presetStore = persisted<ExportPreset>('exportPreset', 'asis');
  const backgroundStore = persisted<ExportBackground>('exportBackground', 'white');
  const scaleStore = persisted<ExportScale>('exportScale', 2);
  const preset = $derived(isExportPreset(presetStore.value) ? presetStore.value : 'asis');
  const background = $derived(
    isExportBackground(backgroundStore.value) ? backgroundStore.value : 'white'
  );
  const scale = $derived(isExportScale(scaleStore.value) ? scaleStore.value : 2);

  const PRESET_LABELS = {
    a4landscape: 'actions.presetA4Landscape',
    a4portrait: 'actions.presetA4Portrait',
    asis: 'actions.presetAsIs',
    ppt169: 'actions.presetPpt169',
    ppt43: 'actions.presetPpt43',
    square: 'actions.presetSquare'
  } as const;
  const BACKGROUND_LABELS = {
    theme: 'actions.backgroundTheme',
    transparent: 'actions.backgroundTransparent',
    white: 'actions.backgroundWhite'
  } as const;
  const NOTE_BACKGROUNDS = {
    theme: 'actions.noteTheme',
    transparent: 'actions.noteTransparent',
    white: 'actions.noteWhite'
  } as const;

  const themeColour = () => window.getComputedStyle(document.body).getPropertyValue('--background');
  // Local: a theme preset's own background (themePresets.ts) replaces white or the site
  // colour, so a dark design is not framed in white; "transparent" drops it as well.
  const diagramFill = $derived(presetBackground(inputState.mermaid));
  const exportFill = (): null | string => {
    if (background === 'transparent') return diagramFill ? 'transparent' : null;
    return diagramFill ?? backgroundFill(background, themeColour());
  };

  /** Size of the rendered diagram: its viewBox, or its box (rough mode has width/height 100%). */
  const getContentSize = (svg: Element) => {
    const box = svg.getBoundingClientRect();
    const viewBox = (svg as unknown as SVGSVGElement).viewBox?.baseVal;
    return {
      height: viewBox && viewBox.height > 0 ? viewBox.height : box.height,
      width: viewBox && viewBox.width > 0 ? viewBox.width : box.width
    };
  };

  const getFileName = (extension: string) =>
    `mermaid-diagram-${dayjs().format('YYYY-MM-DD-HHmmss')}.${extension}`;

  /**
   * Fix text clipping in exported SVG for hand-drawn (rough) mode.
   * svg2roughjs copies foreignObject elements but their height is often insufficient,
   * causing text bottom edges to be cut off regardless of language.
   */
  const fixForeignObjectClipping = (svg: HTMLElement) => {
    const foreignObjects = svg.querySelectorAll('foreignObject');
    foreignObjects.forEach((foreignObj) => {
      const currentHeight = parseFloat(foreignObj.getAttribute('height') || '0');
      if (currentHeight <= 0) return;

      const currentY = parseFloat(foreignObj.getAttribute('y') || '0');
      const newHeight = currentHeight * 1.5;
      const heightDiff = newHeight - currentHeight;

      foreignObj.setAttribute('height', newHeight.toString());
      foreignObj.setAttribute('y', (currentY - heightDiff / 2).toString());

      // Ensure inner HTML elements are vertically centered within the expanded area
      const htmlElements = foreignObj.querySelectorAll('div, span, p');
      htmlElements.forEach((htmlEl) => {
        const el = htmlEl as HTMLElement;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.height = '100%';
      });
    });
  };

  const getSvgElement = () => {
    const svgElement = document.querySelector('#container svg')?.cloneNode(true) as HTMLElement;
    svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    return svgElement;
  };

  /**
   * `fill`: the backdrop CSS colour, or null for none. `undefined` keeps the
   * upstream behaviour (the site background). `wrap` puts the diagram in an
   * outer SVG of the preset's size (the SVG export of a preset).
   */
  const getBase64SVG = (
    svg?: HTMLElement,
    width?: number,
    height?: number,
    fill?: null | string,
    wrap?: { draw: Rect; height: number; width: number }
  ): string => {
    if (svg) {
      // Prevents the SVG size of the interface from being changed
      svg = svg.cloneNode(true) as HTMLElement;
    }
    if (height) {
      svg?.setAttribute('height', `${height}px`);
    }
    if (width) {
      svg?.setAttribute('width', `${width}px`);
    }
    // Workaround https://stackoverflow.com/questions/28690643/firefox-error-rendering-an-svg-image-to-html5-canvas-with-drawimage

    if (!svg) {
      svg = getSvgElement();
    }

    if (validatedState.current.rough) {
      fixForeignObjectClipping(svg);
    }

    const backdrop = fill === undefined ? themeColour() : fill;
    if (wrap) {
      const ns = 'http://www.w3.org/2000/svg';
      const outer = document.createElementNS(ns, 'svg');
      outer.setAttribute('xmlns', ns);
      outer.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      outer.setAttribute('viewBox', `0 0 ${wrap.width} ${wrap.height}`);
      outer.setAttribute('width', `${wrap.width}`);
      outer.setAttribute('height', `${wrap.height}`);
      if (backdrop) {
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('width', `${wrap.width}`);
        rect.setAttribute('height', `${wrap.height}`);
        rect.setAttribute('fill', backdrop);
        outer.append(rect);
      }
      if (!svg.getAttribute('viewBox')) {
        svg.setAttribute('viewBox', `0 0 ${wrap.draw.width} ${wrap.draw.height}`);
      }
      svg.style.maxWidth = '';
      svg.style.backgroundColor = '';
      svg.setAttribute('x', `${wrap.draw.x}`);
      svg.setAttribute('y', `${wrap.draw.y}`);
      svg.setAttribute('width', `${wrap.draw.width}`);
      svg.setAttribute('height', `${wrap.draw.height}`);
      outer.append(svg);
      svg = outer as unknown as HTMLElement;
    } else if (backdrop) {
      svg.style.backgroundColor = backdrop;
    } else {
      svg.style.backgroundColor = '';
    }

    // Local: well-formed XML; `&nbsp;` or kanban's `xlink:href` made the image fail to load.
    const svgString = toXmlSvg(svg.outerHTML);

    // Local: an offline build writes no stylesheet reference, so the file never
    // asks a viewer to fetch from a CDN (Font Awesome icons then need the bundled CSS).
    const stylesheet = env.isOffline
      ? ''
      : `<?xml-stylesheet href="${FONT_AWESOME_URL}" type="text/css"?>\n`;
    return toBase64(`<?xml version="1.0" encoding="UTF-8"?>
${stylesheet}${svgString}`);
  };

  const simulateDownload = (download: string, href: string): void => {
    const a = document.createElement('a');
    a.download = download;
    a.href = href;
    a.click();
    a.remove();
  };

  // Local: one promise from the start of the capture to the saved file or the
  // clipboard write, so the copy button reports the real outcome. Pan/zoom is set
  // back to what it was in every case, including no diagram and no canvas.
  const pausePanZoom = createPanZoomPause(
    () => untrack(() => inputState.panZoom),
    (panZoom) => updateCodeStore({ panZoom })
  );
  const exportImage = (exporter: Exporter): Promise<void> =>
    pausePanZoom(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await waitForRender();
      const canvas = document.createElement('canvas');
      const svg = document.querySelector<HTMLElement>('#container svg');
      if (!svg) {
        throw new Error('svg not found');
      }

      const content = getContentSize(svg);

      let layout = computeExportLayout(content, preset, scale);
      if (preset === 'asis' && imageSizeMode !== 'auto') {
        const width =
          imageSizeMode === 'width' ? imageSize : (imageSize * content.width) / content.height;
        const height =
          imageSizeMode === 'height' ? imageSize : (imageSize * content.height) / content.width;
        layout = { draw: { height, width, x: 0, y: 0 }, height, width };
      }
      canvas.width = layout.width;
      canvas.height = layout.height;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('context not found');
      }

      // Transparent: nothing is filled, so the PNG keeps its alpha channel.
      const fill = exportFill();
      if (fill) {
        context.fillStyle = fill;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      const image = await loadImage(
        `data:image/svg+xml;base64,${getBase64SVG(svg, layout.draw.width, layout.draw.height, diagramFill ? fill : null)}`
      );
      await exporter(context, image, layout.draw);
    });

  const downloadImage: Exporter = (context, image, draw) => {
    const { canvas } = context;
    context.drawImage(image, draw.x, draw.y, draw.width, draw.height);
    simulateDownload(
      getFileName('png'),
      canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream')
    );
    return Promise.resolve();
  };

  const isClipboardAvailable = (): boolean => {
    return Object.prototype.hasOwnProperty.call(window, 'ClipboardItem');
  };

  const clipboardCopy: Exporter = async (context, image, draw) => {
    const { canvas } = context;
    context.drawImage(image, draw.x, draw.y, draw.width, draw.height);
    await copyImageBlob(await canvasToBlob(canvas));
  };

  // A failure is passed on: CopyButton shows it.
  const onCopyClipboard = async (event?: Event) => {
    if (!event) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    await exportImage(clipboardCopy);
    logEvent('copyClipboard');
  };

  const onDownloadPNG = async (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
    try {
      await exportImage(downloadImage);
    } catch (error) {
      console.error('PNG export failed', error);
      notify(t('actions.pngFailed'));
      return;
    }
    logEvent('download', {
      type: 'png'
    });
  };

  const onDownloadSVG = () => {
    const fill = exportFill();
    let wrap: Parameters<typeof getBase64SVG>[4];
    if (preset !== 'asis') {
      const svg = document.querySelector<HTMLElement>('#container svg');
      if (svg) {
        wrap = computeSvgLayout(getContentSize(svg), preset);
      }
    }
    simulateDownload(
      getFileName('svg'),
      `data:image/svg+xml;base64,${getBase64SVG(undefined, undefined, undefined, fill, wrap)}`
    );
    logEvent('download', {
      type: 'svg'
    });
  };

  let gistURL = $state('');
  $effect(() => {
    const { loader } = validatedState.current;
    if (loader?.type === 'gist') {
      gistURL = loader.config.url;
    }
  });

  const loadGist = () => {
    if (!gistURL) {
      return alert(t('actions.gistRequired'));
    }
    window.location.href = `${window.location.pathname}?gist=${gistURL}`;
    logEvent('loadGist');
  };

  let imageSizeMode: 'auto' | 'width' | 'height' = $state('auto');

  $effect(() => {
    if (!imageSizeMode) {
      imageSizeMode = 'auto';
    }
  });

  let imageSize = $state(1080);

  // The one-line note under the buttons: what the files will be.
  const presetSizeText = (value: Exclude<ExportPreset, 'asis'>, factor = 1) =>
    `${PRESET_SIZES[value].width * factor}×${PRESET_SIZES[value].height * factor}`;
  const noteBackground = $derived(
    t(
      diagramFill && background !== 'transparent'
        ? 'actions.noteDiagramBackground'
        : NOTE_BACKGROUNDS[background]
    )
  );
  const pngNote = $derived.by(() => {
    let size: string;
    if (preset !== 'asis') {
      size = presetSizeText(preset, scale);
    } else if (imageSizeMode === 'width') {
      size = t('actions.noteWidth', { n: String(imageSize) });
    } else if (imageSizeMode === 'height') {
      size = t('actions.noteHeight', { n: String(imageSize) });
    } else {
      size = t('actions.noteAsIs');
    }
    return t('actions.note', { background: noteBackground, scale: String(scale), size });
  });
  const svgNote = $derived(
    t('actions.noteSvg', {
      background: noteBackground,
      size: preset === 'asis' ? t('actions.noteAsIs') : presetSizeText(preset)
    })
  );

  const isNetlify = browser && window.location.host.includes('netlify');
</script>

{#snippet dualActionButton(text: string, download: (event: Event) => unknown, url?: string)}
  <div class="flex flex-grow gap-0.5">
    <Button
      class={['flex-grow', url && 'rounded-r-none']}
      onclick={download}
      data-testid="download-{text}">
      <DownloadIcon />
      {text}
    </Button>
    <ExternalLinkWrapper domain={getDomain(url)} isVisible={!!url}>
      <Button class="rounded-l-none" href={url} target="_blank" rel="noreferrer noopener">
        <ExternalLinkIcon />
      </Button>
    </ExternalLinkWrapper>
  </div>
{/snippet}

<Card
  title={t('actions.title')}
  testID={TID.actionsCard}
  isStackable
  icon={{ component: DownloadIcon, class: 'rotate-180' }}>
  <div class="flex min-w-fit flex-col gap-2 p-2">
    <div class="flex w-full flex-wrap items-center gap-2 py-2 whitespace-nowrap">
      {t('actions.pngSize')}
      <ToggleGroup.Root type="single" variant="outline" bind:value={imageSizeMode}>
        <ToggleGroup.Item value="auto">{t('actions.sizeAuto')}</ToggleGroup.Item>
        <ToggleGroup.Item value="width">{t('actions.sizeWidth')}</ToggleGroup.Item>
        <ToggleGroup.Item value="height">{t('actions.sizeHeight')}</ToggleGroup.Item>
      </ToggleGroup.Root>
      {#if imageSizeMode !== 'auto'}
        <WidthIcon
          class={['size-6 shrink-0 transition-all', imageSizeMode === 'width' && 'rotate-90']} />
      {/if}
      <Input
        type="number"
        min="3"
        max="10000"
        disabled={imageSizeMode === 'auto' || preset !== 'asis'}
        bind:value={imageSize} />
    </div>
    <div class="flex flex-col gap-1">
      <span class="text-sm">{t('actions.preset')}</span>
      <ToggleGroup.Root
        type="single"
        variant="outline"
        class="flex-wrap justify-start"
        value={preset}
        onValueChange={(v) => v && (presetStore.value = v as ExportPreset)}>
        {#each EXPORT_PRESETS as value (value)}
          <ToggleGroup.Item {value} data-testid="{TID.exportPreset}-{value}">
            {t(PRESET_LABELS[value])}
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap">
      <div class="flex items-center gap-2">
        {t('actions.background')}
        <ToggleGroup.Root
          type="single"
          variant="outline"
          value={background}
          onValueChange={(v) => v && (backgroundStore.value = v as ExportBackground)}>
          {#each EXPORT_BACKGROUNDS as value (value)}
            <ToggleGroup.Item {value} data-testid="{TID.exportBackground}-{value}">
              {t(BACKGROUND_LABELS[value])}
            </ToggleGroup.Item>
          {/each}
        </ToggleGroup.Root>
      </div>
      <div class="flex items-center gap-2">
        {t('actions.scale')}
        <ToggleGroup.Root
          type="single"
          variant="outline"
          value={String(scale)}
          onValueChange={(v) => v && (scaleStore.value = Number(v) as ExportScale)}>
          {#each EXPORT_SCALES as value (value)}
            <ToggleGroup.Item value={String(value)} data-testid="{TID.exportScale}-{value}">
              {value}x
            </ToggleGroup.Item>
          {/each}
        </ToggleGroup.Root>
      </div>
    </div>
    <div class="flex gap-2">
      {@render dualActionButton('PNG', onDownloadPNG, urls.current.png)}
      {@render dualActionButton('SVG', onDownloadSVG, urls.current.svg)}
      <ExternalLinkWrapper domain={getDomain(urls.current.kroki)} isVisible={!!urls.current.kroki}>
        <a target="_blank" rel="noreferrer" class="flex-grow" href={urls.current.kroki}>
          <Button class="action-btn flex w-full items-center gap-2">
            <ExternalLinkIcon /> Kroki
          </Button>
        </a>
      </ExternalLinkWrapper>
    </div>
    <p class="text-xs text-muted-foreground" data-testid={TID.exportNote}>
      {pngNote} / {svgNote}
    </p>
    <!-- Local: HTML page / <img> tag export. -->
    <HtmlExport />
    <Separator />
    {#if isClipboardAvailable()}
      <CopyButton onclick={onCopyClipboard} label={t('actions.copyImage')} />
    {/if}
    <ExternalLinkWrapper
      labelPrefix={t('external.thumbnailBy')}
      domain={getDomain(urls.current.png)}
      isVisible={!!urls.current.mdCode}>
      <CopyInput
        value={urls.current.mdCode}
        label={t('actions.copyMarkdown')}
        testID={TID.copyMarkdown} />
    </ExternalLinkWrapper>
    {#if !env.isOffline}
      <div class="flex w-full items-center gap-2">
        <Input type="url" bind:value={gistURL} placeholder={t('actions.gistPlaceholder')} />
        <Button onclick={loadGist}>{t('actions.loadGist')}</Button>
      </div>
    {/if}
    {#if isNetlify}
      <div class="flex w-full items-center justify-center">
        <a class="link text-sm text-gray-500 underline" href="https://netlify.com">
          This site is powered by Netlify
        </a>
      </div>
    {/if}
  </div>
</Card>
