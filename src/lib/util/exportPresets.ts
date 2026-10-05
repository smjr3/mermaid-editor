/**
 * Local: export presets for pasting a diagram into PowerPoint, Word, Excel or an
 * e-mail. A preset fixes the canvas ratio (and size); the diagram is scaled to fit
 * inside it with a margin, centred, keeping its own aspect ratio. Pure geometry, so
 * the PNG canvas and the SVG wrapper share one calculation (Actions.svelte).
 */

export type ExportPreset = 'a4landscape' | 'a4portrait' | 'asis' | 'ppt43' | 'ppt169' | 'square';
export type ExportBackground = 'theme' | 'transparent' | 'white';
export type ExportScale = 1 | 2 | 3;

export const EXPORT_PRESETS: ExportPreset[] = [
  'asis',
  'ppt169',
  'ppt43',
  'a4landscape',
  'a4portrait',
  'square'
];
export const EXPORT_BACKGROUNDS: ExportBackground[] = ['white', 'transparent', 'theme'];
export const EXPORT_SCALES: ExportScale[] = [1, 2, 3];

/** Canvas size at 1x, in CSS pixels. `asis` has none: it follows the diagram. */
export const PRESET_SIZES: Record<
  Exclude<ExportPreset, 'asis'>,
  { height: number; width: number }
> = {
  a4landscape: { height: 794, width: 1123 },
  a4portrait: { height: 1123, width: 794 },
  ppt169: { height: 1080, width: 1920 },
  ppt43: { height: 1080, width: 1440 },
  square: { height: 1080, width: 1080 }
};

/** Margin as a share of the canvas's shorter side. */
export const MARGIN_RATIO = 0.04;

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

export const isExportPreset = (value: unknown): value is ExportPreset =>
  EXPORT_PRESETS.includes(value as ExportPreset);
export const isExportBackground = (value: unknown): value is ExportBackground =>
  EXPORT_BACKGROUNDS.includes(value as ExportBackground);
export const isExportScale = (value: unknown): value is ExportScale =>
  EXPORT_SCALES.includes(value as ExportScale);

/**
 * Canvas size and diagram rectangle for a diagram of `width` x `height`.
 * `asis` is the diagram itself times the scale, without margin.
 */
export const computeExportLayout = (
  diagram: { height: number; width: number },
  preset: ExportPreset,
  scale: ExportScale
): ExportLayout => {
  const dw = Math.max(diagram.width, 1);
  const dh = Math.max(diagram.height, 1);
  if (preset === 'asis') {
    const width = Math.max(1, Math.round(dw * scale));
    const height = Math.max(1, Math.round(dh * scale));
    return { draw: { height, width, x: 0, y: 0 }, height, width };
  }
  const base = PRESET_SIZES[preset];
  const width = base.width * scale;
  const height = base.height * scale;
  const margin = Math.min(width, height) * MARGIN_RATIO;
  const fit = Math.min((width - 2 * margin) / dw, (height - 2 * margin) / dh);
  const drawWidth = dw * fit;
  const drawHeight = dh * fit;
  return {
    draw: {
      height: drawHeight,
      width: drawWidth,
      x: (width - drawWidth) / 2,
      y: (height - drawHeight) / 2
    },
    height,
    width
  };
};

/**
 * The same layout at 1x, for the SVG export: the outer viewBox and the nested
 * diagram's x/y/width/height. Vector, so the scale does not matter.
 */
export const computeSvgLayout = (
  diagram: { height: number; width: number },
  preset: ExportPreset
): ExportLayout => computeExportLayout(diagram, preset, 1);

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
