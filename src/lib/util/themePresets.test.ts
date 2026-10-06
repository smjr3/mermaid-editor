import { describe, expect, it } from 'vitest';
import { messages } from '$/i18n/messages';
import { isManagedTheme } from './mermaid';
import { findUnsafeConfigPaths } from './sanitize';
import {
  applyThemePreset,
  getThemePreset,
  presetBackground,
  presetOf,
  themePresetIds,
  themePresets
} from './themePresets';

const parse = (config: string) => JSON.parse(config) as Record<string, unknown>;
const named = themePresets.filter(({ id }) => id !== 'standard');

describe('themePresets', () => {
  it('ships standard first and eleven named themes, each with names, a description and five swatches', () => {
    expect(themePresets.map(({ id }) => id)).toEqual([...themePresetIds]);
    expect(themePresets[0].id).toBe('standard');
    expect(named).toHaveLength(11);
    for (const preset of themePresets) {
      expect(messages.ja[preset.name], preset.id).toBeTruthy();
      expect(messages.en[preset.name], preset.id).toBeTruthy();
      expect(messages.ja[preset.description], preset.id).toBeTruthy();
      expect(preset.swatches, preset.id).toHaveLength(5);
    }
  });

  it('gives every named theme the base theme, its variables, its CSS and a background', () => {
    for (const preset of named) {
      expect(preset.themeVariables?.primaryColor, preset.id).toBeTruthy();
      expect(preset.themeVariables?.background, preset.id).toBe(preset.background);
      expect(preset.themeCSS, preset.id).toMatch(/^\/\* theme-preset: /);
    }
  });

  it('passes the config sanitiser: no unsafe value in any preset', () => {
    for (const id of themePresetIds) {
      const config = parse(applyThemePreset('{}', id));
      expect(findUnsafeConfigPaths(config), id).toEqual([]);
    }
  });

  it('is never an editor-managed theme', () => {
    for (const id of themePresetIds.filter((entry) => entry !== 'standard')) {
      expect(isManagedTheme(parse(applyThemePreset('{}', id)).theme), id).toBe(false);
    }
  });
});

describe('applyThemePreset / presetOf', () => {
  it('applies a preset and reads it back', () => {
    const neon = applyThemePreset('{}', 'neon');
    const config = parse(neon);
    expect(config.theme).toBe('base');
    expect(config.themeVariables).toEqual(getThemePreset('neon').themeVariables);
    expect(config.themeCSS).toBe(getThemePreset('neon').themeCSS);
    expect(presetOf(neon)).toBe('neon');
    expect(presetOf(config)).toBe('neon');
  });

  it('keeps the other config keys', () => {
    const start = JSON.stringify({ layout: 'dagre', look: 'handDrawn', theme: 'redux-color' });
    const config = parse(applyThemePreset(start, 'pastel'));
    expect(config.layout).toBe('dagre');
    expect(config.look).toBe('handDrawn');
    expect(config.theme).toBe('base');
  });

  it('replaces the previous preset entirely, leaving nothing of it behind', () => {
    const neon = applyThemePreset('{"look":"neo"}', 'neon');
    const withLine = JSON.stringify({
      ...parse(neon),
      themeVariables: { ...(parse(neon).themeVariables as object), extraOnlyInOld: '#123456' }
    });
    const wa = parse(applyThemePreset(withLine, 'wa'));
    expect(wa.themeVariables).toEqual(getThemePreset('wa').themeVariables);
    expect(wa.themeCSS).toBe(getThemePreset('wa').themeCSS);
    expect(wa.look).toBe('neo');
  });

  it('standard removes the theme, its variables and CSS, handing the theme back to the editor', () => {
    const neon = applyThemePreset('{"look":"neo","layout":"elk"}', 'neon');
    const standard = parse(applyThemePreset(neon, 'standard'));
    expect(standard).toEqual({ layout: 'elk', look: 'neo' });
    expect(isManagedTheme(standard.theme)).toBe(true);
    expect(presetOf(standard)).toBe('standard');
  });

  it('keeps the preset when the user changes the line colour', () => {
    const neon = parse(applyThemePreset('{}', 'neon'));
    neon.themeVariables = { ...(neon.themeVariables as object), lineColor: '#d64545' };
    expect(presetOf(neon)).toBe('neon');
  });

  it('reads anything else as standard', () => {
    expect(presetOf('{}')).toBe('standard');
    expect(presetOf('{"theme":"forest"}')).toBe('standard');
    expect(presetOf('{"theme":"base","themeCSS":".x{}"}')).toBe('standard');
    expect(presetOf('{"theme":"forest","themeCSS":"/* theme-preset: neon */"}')).toBe('standard');
    expect(presetOf('{"theme":"base","themeCSS":"/* theme-preset: nope */"}')).toBe('standard');
    expect(presetOf('{oops')).toBe('standard');
  });

  it('leaves an unparsable config alone', () => {
    expect(applyThemePreset('{oops', 'neon')).toBe('{oops');
  });

  it('reports the background of the preset in use', () => {
    expect(presetBackground(applyThemePreset('{}', 'neon'))).toBe('#07070d');
    expect(presetBackground('{}')).toBeUndefined();
  });
});
