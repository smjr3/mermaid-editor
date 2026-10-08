import type { MermaidConfig } from 'mermaid';

/**
 * Local: the dark themes draw edges in #ccc (redux-dark) or lightgrey (dark),
 * which reads poorly on the white view. Unless the user set a line colour of
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
