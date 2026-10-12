/**
 * Local: every export of the 書き出す dialog (ExportDialog.svelte) — PNG, SVG, .drawio,
 * .vsdx, HTML (a file or an <img> tag), the Markdown export for GitLab (an SVG file and
 * Markdown that shows it) and the image copy. Moved here from the export card
 * (Actions.svelte, HtmlExport.svelte) unchanged in what the files hold:
 *
 * - PNG, the image copy and the Visio picture are drawn from the diagram on screen with
 *   pan/zoom paused (`createPanZoomPause`), so the file is the whole diagram, not the
 *   zoomed view. The SVG and the .drawio come from the same view.
 * - HTML and Markdown render the diagram afresh from one snapshot of the state
 *   (`takeExportSnapshot`), so edits made while it renders do not end up in part of it.
 * - Files are saved under the name typed in the dialog (`anchorDownload`); there is no
 *   second "名前を付けて保存" step (user decision, 2026-10-12).
 *
 * The background, the scale and the format tables are pure and unit-tested.
 */
import type { State } from '$/types';
import { version as FAVersion } from '@fortawesome/fontawesome-free/package.json';
import { toBase64 } from 'js-base64';
import type { MermaidConfig } from 'mermaid';
import { untrack } from 'svelte';
import { waitForRender } from './autoSync';
import { buildDrawio } from './drawioExport';
import { env } from './env';
import {
  buildGitLabExport,
  buildStandaloneHtml,
  takeExportSnapshot,
  toImgTag,
  toXmlSvg,
  type ExportSnapshot
} from './htmlExport';
import { canvasToBlob, copyImageBlob, createPanZoomPause, loadImage } from './imageExport';
import { render } from './mermaid';
import { anchorDownload, defaultFileBase, fileNameFromInput, withExtension } from './saveFile';
import { inputState, updateCodeStore, validatedState } from './state.svelte';
import { logEvent } from './stats';
import { parseColour, svgToDrawio } from './svgToDrawio';
import { presetBackground } from './themePresets';
import { buildVsdx } from './vsdxExport';

// ---------------------------------------------------------------------------
// Options (pure)

export type ExportBackground = 'theme' | 'transparent' | 'white';
export type ExportScale = 1 | 2 | 3;
export type ExportFormat = 'copy' | 'drawio' | 'html' | 'md' | 'png' | 'svg' | 'vsdx';
export type HtmlMode = 'file' | 'tag';

export const EXPORT_BACKGROUNDS: ExportBackground[] = ['white', 'transparent', 'theme'];
export const EXPORT_SCALES: ExportScale[] = [1, 2, 3];
/** In the order the dialog shows them. */
export const EXPORT_FORMATS: ExportFormat[] = [
  'png',
  'svg',
  'drawio',
  'vsdx',
  'html',
  'md',
  'copy'
];
export const HTML_MODES: HtmlMode[] = ['file', 'tag'];

/** A new user's background: transparent, so the picture sits on any page or slide. */
export const DEFAULT_BACKGROUND: ExportBackground = 'transparent';
export const DEFAULT_SCALE: ExportScale = 2;

export const isExportBackground = (value: unknown): value is ExportBackground =>
  EXPORT_BACKGROUNDS.includes(value as ExportBackground);
export const isExportScale = (value: unknown): value is ExportScale =>
  EXPORT_SCALES.includes(value as ExportScale);
export const isExportFormat = (value: unknown): value is ExportFormat =>
  EXPORT_FORMATS.includes(value as ExportFormat);
export const isHtmlMode = (value: unknown): value is HtmlMode =>
  HTML_MODES.includes(value as HtmlMode);

/** The file each format writes: extension and type. The image copy writes none. */
export const FORMAT_FILES: Record<
  Exclude<ExportFormat, 'copy'>,
  { extension: string; mime: string }
> = {
  drawio: { extension: 'drawio', mime: 'application/vnd.jgraph.mxfile' },
  html: { extension: 'html', mime: 'text/html' },
  md: { extension: 'svg', mime: 'image/svg+xml' },
  png: { extension: 'png', mime: 'image/png' },
  svg: { extension: 'svg', mime: 'image/svg+xml' },
  vsdx: { extension: 'vsdx', mime: 'application/vnd.ms-visio.drawing.main+xml' }
};

/** Whether the format offers 解像度 (the PNG and the copy are drawn at a scale). */
export const formatUsesScale = (format: ExportFormat): boolean =>
  format === 'png' || format === 'copy';

/** Whether the format offers 背景 (the others keep the page's or the file's own). */
export const formatUsesBackground = (format: ExportFormat): boolean =>
  format === 'png' || format === 'svg' || format === 'copy' || format === 'md';

/** True when the action only copies (no file, so no file name and the button says コピー). */
export const isCopyOnly = (format: ExportFormat, htmlMode: HtmlMode): boolean =>
  format === 'copy' || (format === 'html' && htmlMode === 'tag');

/** The extension a format's file gets, or undefined for a copy. */
export const formatExtension = (format: ExportFormat, htmlMode: HtmlMode): string | undefined =>
  format === 'copy' || isCopyOnly(format, htmlMode) ? undefined : FORMAT_FILES[format].extension;

/**
 * The name a file is saved under: what was typed (made safe for every file system, with
 * the extension added), else the diagram's title, else `diagram`.
 */
export const exportFileName = (typed: string, code: string, extension: string): string =>
  fileNameFromInput(typed, extension) ?? withExtension(defaultFileBase(code), extension);

/**
 * The fill for the canvas or the SVG backdrop: a CSS colour, or `null` for
 * transparent (nothing is drawn, so the PNG keeps its alpha channel).
 */
export const backgroundFill = (
  background: ExportBackground,
  themeColour: string
): null | string => {
  if (background === 'transparent') return null;
  if (background === 'white') return '#ffffff';
  return themeColour.trim() || '#ffffff';
};

/**
 * The backdrop of an export. A theme preset's own background (themePresets.ts) replaces
 * white or the theme colour, so a dark design is not framed in white; "transparent"
 * drops it as well (as `transparent`, which overrides the preset's painted one).
 */
export const exportBackdrop = (
  background: ExportBackground,
  themeColour: string,
  diagramFill: string | undefined
): null | string => {
  if (background === 'transparent') return diagramFill ? 'transparent' : null;
  return diagramFill ?? backgroundFill(background, themeColour);
};

export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ExportLayout {
  /** Draw rectangle for the diagram, in canvas pixels. */
  draw: Rect;
  /** Canvas size in pixels (the scale applied). */
  height: number;
  width: number;
}

/** Canvas size for a diagram of `width` x `height`: the diagram itself times the scale. */
export const computeExportLayout = (
  diagram: { height: number; width: number },
  scale: number
): ExportLayout => {
  const width = Math.max(1, Math.round(Math.max(diagram.width, 1) * scale));
  const height = Math.max(1, Math.round(Math.max(diagram.height, 1) * scale));
  return { draw: { height, width, x: 0, y: 0 }, height, width };
};

// ---------------------------------------------------------------------------
// The diagram on screen

const XLINK = 'http://www.w3.org/1999/xlink';
const FONT_AWESOME_URL = `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/${FAVersion}/css/all.min.css`;

/** The site's background colour (the 「テーマの色」 background). */
export const themeColour = (): string =>
  window.getComputedStyle(document.body).getPropertyValue('--background');

const diagramFill = (): string | undefined => presetBackground(untrack(() => inputState.mermaid));

/** The backdrop for `background`, for the diagram as it is now. */
export const currentBackdrop = (background: ExportBackground): null | string =>
  exportBackdrop(background, themeColour(), diagramFill());

const viewSvg = (): HTMLElement | null => document.querySelector<HTMLElement>('#container svg');

/** Size of the rendered diagram: its viewBox, or its box (rough mode has width/height 100%). */
export const getContentSize = (svg: Element): { height: number; width: number } => {
  const box = svg.getBoundingClientRect();
  const viewBox = (svg as unknown as SVGSVGElement).viewBox?.baseVal;
  return {
    height: viewBox && viewBox.height > 0 ? viewBox.height : box.height,
    width: viewBox && viewBox.width > 0 ? viewBox.width : box.width
  };
};

/**
 * Fix text clipping in exported SVG for hand-drawn (rough) mode.
 * svg2roughjs copies foreignObject elements but their height is often insufficient,
 * causing text bottom edges to be cut off regardless of language.
 */
export const fixForeignObjectClipping = (svg: Element): void => {
  for (const foreignObject of svg.querySelectorAll('foreignObject')) {
    const currentHeight = Number.parseFloat(foreignObject.getAttribute('height') || '0');
    if (currentHeight <= 0) continue;

    const currentY = Number.parseFloat(foreignObject.getAttribute('y') || '0');
    const newHeight = currentHeight * 1.5;
    const heightDiff = newHeight - currentHeight;

    foreignObject.setAttribute('height', newHeight.toString());
    foreignObject.setAttribute('y', (currentY - heightDiff / 2).toString());

    // Ensure inner HTML elements are vertically centered within the expanded area
    for (const element of foreignObject.querySelectorAll<HTMLElement>('div, span, p')) {
      element.style.display = 'flex';
      element.style.alignItems = 'center';
      element.style.justifyContent = 'center';
      element.style.height = '100%';
    }
  }
};

/**
 * The diagram as an SVG file's text. `fill`: the backdrop CSS colour, or null for none.
 * `width`/`height` set the picture's size in pixels (the PNG canvas). The SVG is
 * well-formed XML (`&nbsp;` or kanban's `xlink:href` made the image fail to load), and an
 * offline build writes no stylesheet reference, so the file never asks a viewer to fetch
 * from a CDN (Font Awesome icons then need the bundled CSS).
 */
export const serializeSvg = (
  source: Element,
  {
    fill,
    height,
    offline = env.isOffline,
    rough = false,
    width
  }: { fill: null | string; height?: number; offline?: boolean; rough?: boolean; width?: number }
): string => {
  // Prevents the SVG size of the interface from being changed
  const svg = source.cloneNode(true) as SVGSVGElement;
  svg.setAttribute('xmlns:xlink', XLINK);
  if (height) svg.setAttribute('height', `${height}px`);
  if (width) svg.setAttribute('width', `${width}px`);
  if (rough) fixForeignObjectClipping(svg);
  svg.style.backgroundColor = fill ?? '';
  const stylesheet = offline
    ? ''
    : `<?xml-stylesheet href="${FONT_AWESOME_URL}" type="text/css"?>\n`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${stylesheet}${toXmlSvg(svg.outerHTML)}`;
};

const isRough = () => !!untrack(() => validatedState.current.rough);

// One pause for every capture: pan/zoom goes back to what it was in every case,
// including no diagram and no canvas.
const pausePanZoom = createPanZoomPause(
  () => untrack(() => inputState.panZoom),
  (panZoom) => updateCodeStore({ panZoom })
);

/**
 * Runs `work` on the diagram on screen with pan/zoom paused. With pan/zoom on, the view's
 * SVG has no viewBox (svg-pan-zoom takes it), so the view is re-rendered without it first.
 */
const withDiagram = <T>(work: (svg: HTMLElement) => Promise<T>): Promise<T> =>
  pausePanZoom(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await waitForRender();
    const svg = viewSvg();
    if (!svg) throw new Error('svg not found');
    return work(svg);
  });

/** The diagram drawn on a canvas `scale` times its size, on `background`; a PNG blob. */
const renderPngBlob = (
  background: ExportBackground,
  scale: number
): Promise<{ blob: Blob; size: { height: number; width: number } }> =>
  withDiagram(async (svg) => {
    const size = getContentSize(svg);
    const layout = computeExportLayout(size, scale);
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('context not found');

    // Transparent: nothing is filled, so the PNG keeps its alpha channel.
    const fill = currentBackdrop(background);
    if (fill) {
      context.fillStyle = fill;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const text = serializeSvg(svg, {
      fill: diagramFill() ? fill : null,
      height: layout.draw.height,
      rough: isRough(),
      width: layout.draw.width
    });
    const image = await loadImage(`data:image/svg+xml;base64,${toBase64(text)}`);
    context.drawImage(image, layout.draw.x, layout.draw.y, layout.draw.width, layout.draw.height);
    return { blob: await canvasToBlob(canvas), size };
  });

export interface ImageOptions {
  background: ExportBackground;
  scale: ExportScale;
}

/** Saves the PNG under `name` (with its extension). */
export const savePng = async (name: string, { background, scale }: ImageOptions): Promise<void> => {
  const { blob } = await renderPngBlob(background, scale);
  anchorDownload(blob, name);
  logEvent('download', { type: 'png' });
};

/** Puts the PNG on the clipboard; settles once the browser has (or has refused). */
export const copyPng = async ({ background, scale }: ImageOptions): Promise<void> => {
  const { blob } = await renderPngBlob(background, scale);
  await copyImageBlob(blob);
  logEvent('copyClipboard');
};

/** Whether this browser can put an image on the clipboard. */
export const canCopyImage = (): boolean =>
  typeof window !== 'undefined' && Object.prototype.hasOwnProperty.call(window, 'ClipboardItem');

/** Saves the SVG of the diagram on screen. */
export const saveSvg = async (
  name: string,
  { background }: Pick<ImageOptions, 'background'>
): Promise<void> => {
  const svg = viewSvg();
  if (!svg) throw new Error('svg not found');
  const text = serializeSvg(svg, { fill: currentBackdrop(background), rough: isRough() });
  anchorDownload(new Blob([text], { type: FORMAT_FILES.svg.mime }), name);
  logEvent('download', { type: 'svg' });
};

/** The config as an object for the .drawio's Mermaid data, if it is one. */
const diagramConfig = (): Record<string, unknown> | undefined => {
  try {
    const config: unknown = JSON.parse(untrack(() => inputState.mermaid));
    return config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

const stem = (name: string, extension: string) =>
  name.replace(new RegExp(`\\.${extension}$`, 'i'), '');

/** Saves a .drawio with every element as its own draw.io cell (docs-dev/EXPORTS.md). */
export const saveDrawio = async (
  name: string,
  { background }: Pick<ImageOptions, 'background'>
): Promise<void> => {
  const code = untrack(() => inputState.code);
  const blob = await withDiagram((svg) => {
    // Every element as its own draw.io cell, read from the diagram on screen.
    const page = svgToDrawio(svg as unknown as SVGSVGElement);
    const content = getContentSize(svg);
    const fill = parseColour(currentBackdrop(background) ?? undefined);
    const xml = buildDrawio({
      background: fill.colour === 'none' ? undefined : fill.colour,
      cells: page.cells,
      code,
      config: diagramConfig(),
      height: page.height || content.height,
      name: stem(name, 'drawio'),
      width: page.width || content.width
    });
    return Promise.resolve(new Blob([xml], { type: FORMAT_FILES.drawio.mime }));
  });
  anchorDownload(blob, name);
  logEvent('download', { type: 'drawio' });
};

// The diagram as a PNG at twice its size, for the Visio picture.
const VSDX_PNG_SCALE = 2;

/** Saves a Visio package with the diagram as one PNG picture. */
export const saveVsdx = async (
  name: string,
  { background }: Pick<ImageOptions, 'background'>
): Promise<void> => {
  const code = untrack(() => inputState.code);
  const { blob, size } = await renderPngBlob(background, VSDX_PNG_SCALE);
  const file = buildVsdx({
    code,
    height: size.height,
    png: new Uint8Array(await blob.arrayBuffer()),
    title: stem(name, 'vsdx'),
    width: size.width
  });
  anchorDownload(
    new Blob([file as Uint8Array<ArrayBuffer>], { type: FORMAT_FILES.vsdx.mime }),
    name
  );
  logEvent('download', { type: 'vsdx' });
};

// HTML and Markdown: rendered afresh rather than taken from the view, so pan and zoom do
// not leak into the file.
let probe = 0;
const renderSvg = async (config: MermaidConfig, code: string): Promise<string> => {
  probe++;
  const { svg } = await render(config, code, `html-export-${probe}`);
  return svg;
};

/**
 * The snapshot an HTML or Markdown export starts from. `state` is a plain copy of the
 * input state (`$state.snapshot(inputState)`, taken by the caller: runes only run in
 * Svelte files).
 */
const snapshot = (state: State): ExportSnapshot =>
  untrack(() => {
    const validated = validatedState.current;
    return takeExportSnapshot(
      state,
      validated.code === state.code ? validated.diagramType : undefined
    );
  });

/** Saves a standalone HTML page (offline, with the source). Rejects for a broken diagram. */
export const saveHtml = async (name: string, state: State): Promise<void> => {
  const html = await buildStandaloneHtml(snapshot(state), {
    background: themeColour(),
    render: renderSvg
  });
  anchorDownload(new Blob([html], { type: FORMAT_FILES.html.mime }), name);
  logEvent('download', { type: 'html' });
};

/** Copies one self-contained <img> tag. Rejects for a broken diagram. */
export const copyHtmlTag = async (state: State): Promise<void> => {
  const { code, config, title } = snapshot(state);
  await navigator.clipboard.writeText(toImgTag(await renderSvg(config, code), title));
};

/**
 * GitLab (or GitHub): saves the SVG to commit next to the page and copies the Markdown
 * that shows it, links back here and keeps the source. Resolves to whether the Markdown
 * reached the clipboard; rejects (nothing saved) for a broken diagram.
 */
export const saveMarkdown = async (
  name: string,
  state: State,
  {
    background,
    editBase,
    labels
  }: {
    background: ExportBackground;
    /** The editor's absolute URL, without the hash. */
    editBase: string;
    labels: { edit: string; source: string };
  }
): Promise<{ copied: boolean }> => {
  const { markdown, svg } = await buildGitLabExport(snapshot(state), {
    background: currentBackdrop(background),
    editBase,
    fileName: name,
    labels,
    render: renderSvg
  });
  anchorDownload(new Blob([svg], { type: FORMAT_FILES.md.mime }), name);
  logEvent('download', { type: 'md' });
  try {
    await navigator.clipboard.writeText(markdown);
    return { copied: true };
  } catch {
    return { copied: false };
  }
};

// ---------------------------------------------------------------------------
// Preview

/**
 * A copy of the diagram on screen for the dialog's preview, as the files will show it:
 * without the pan/zoom transform, framed by its own drawing (svg-pan-zoom takes the
 * viewBox away, so it is measured back from the drawing). Undefined when there is none.
 */
export const previewSvg = (): SVGSVGElement | undefined => {
  const live = viewSvg() as unknown as SVGSVGElement | null;
  if (!live) return undefined;
  const copy = live.cloneNode(true) as SVGSVGElement;
  const viewport = live.querySelector<SVGGraphicsElement>(':scope > .svg-pan-zoom_viewport');
  if (viewport && !live.getAttribute('viewBox')) {
    try {
      const box = viewport.getBBox();
      const pad = 8;
      copy.setAttribute(
        'viewBox',
        `${box.x - pad} ${box.y - pad} ${box.width + 2 * pad} ${box.height + 2 * pad}`
      );
    } catch {
      // Not laid out (hidden); the copy keeps the view's size.
    }
    const copiedViewport = copy.querySelector(':scope > .svg-pan-zoom_viewport');
    copiedViewport?.removeAttribute('transform');
    copiedViewport?.removeAttribute('style');
  }
  // Its natural size from the viewBox, shrunk to the preview by CSS (aspect kept).
  const [, , width, height] = (copy.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (width > 0 && height > 0) {
    copy.setAttribute('width', String(width));
    copy.setAttribute('height', String(height));
  } else {
    copy.removeAttribute('width');
    copy.removeAttribute('height');
  }
  copy.style.maxWidth = '100%';
  copy.style.maxHeight = '400px';
  copy.style.width = '';
  copy.style.height = 'auto';
  copy.style.backgroundColor = '';
  copy.setAttribute('aria-hidden', 'true');
  return copy;
};
