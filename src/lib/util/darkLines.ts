import type { MermaidConfig } from 'mermaid';

/**
 * Local: the dark themes draw edges in #ccc (redux-dark) or lightgrey (dark),
 * which reads poorly on the dark view. Unless the user set a line colour of
 * their own, render dark themes with near-white lines. Applied when rendering
 * only (mermaid.ts), so the stored config is untouched.
 */
export const darkLineColor = '#f2f2f2';

const darkThemes = new Set(['dark', 'redux-dark', 'redux-dark-color']);

export const withVisibleLines = (config: MermaidConfig): MermaidConfig => {
  if (!config.theme || !darkThemes.has(config.theme) || config.themeVariables?.lineColor) {
    return config;
  }
  return {
    ...config,
    themeVariables: { ...config.themeVariables, lineColor: darkLineColor }
  };
};

// Red, green and blue (0–255) of a hex, rgb() or white colour; undefined otherwise.
const channels = (color: string): number[] | undefined => {
  const value = color.trim().toLowerCase();
  if (value === 'white') return [255, 255, 255];
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/.exec(value)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
    return [0, 2, 4].map((start) => Number.parseInt(full.slice(start, start + 2), 16));
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  return rgb ? rgb.slice(1, 4).map(Number) : undefined;
};

const isLight = (color: string): boolean => {
  const rgb = channels(color);
  return rgb !== undefined && (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.6;
};

/**
 * Local: a diagram in a light theme (one the user picked, or one rendered
 * before the managed theme caught up) draws dark lines that vanish on the
 * dark site. While the site is dark (`.dark` on the page), give such a diagram
 * its theme's own light background. Exported files carry no `.dark` ancestor,
 * so they are unaffected.
 */
export const addDarkSiteBackdrop = (svg: string, id: string, background: string): string => {
  if (!isLight(background)) return svg;
  // --background also feeds the label outline (architectureLabels.ts).
  const style = `<style>.dark #${id}{background-color:${background.trim()};--background:${background.trim()};}</style>`;
  return svg.replace(/<svg\b[^>]*>/, (open) => open + style);
};
