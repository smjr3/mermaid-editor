import { describe, expect, it } from 'vitest';
import { fontStacks, getDiagramFont, setDiagramFont } from './diagramFont';
import { applyThemePreset, getThemePreset, presetOf } from './themePresets';

const parsed = (config: string) => JSON.parse(config) as Record<string, unknown>;

describe('getDiagramFont / setDiagramFont', () => {
  it('reads no font as the default and writes both places mermaid reads', () => {
    expect(getDiagramFont('{}')).toBe('default');
    const mincho = setDiagramFont('{"theme":"forest"}', 'mincho');
    expect(parsed(mincho)).toEqual({
      fontFamily: fontStacks.mincho,
      theme: 'forest',
      themeVariables: { fontFamily: fontStacks.mincho }
    });
    expect(getDiagramFont(mincho)).toBe('mincho');
  });

  it('removes the font again, keeping the other variables', () => {
    const withLine = '{"themeVariables":{"lineColor":"#d64545"}}';
    const gothic = setDiagramFont(withLine, 'gothic');
    expect(parsed(setDiagramFont(gothic, 'default'))).toEqual(parsed(withLine));
    expect(parsed(setDiagramFont(setDiagramFont('{}', 'mono'), 'default'))).toEqual({});
  });

  it('reports a hand-written font as custom', () => {
    expect(getDiagramFont('{"fontFamily":"Comic Sans MS"}')).toBe('custom');
    expect(getDiagramFont('{"themeVariables":{"fontFamily":"Arial"}}')).toBe('custom');
  });

  it('respects a preset: its own font is the default, and comes back after a choice', () => {
    const wa = applyThemePreset('{}', 'wa');
    const waFont = getThemePreset('wa').themeVariables?.fontFamily;
    expect(getDiagramFont(wa)).toBe('default');
    const gothic = setDiagramFont(wa, 'gothic');
    expect(presetOf(gothic)).toBe('wa');
    expect(getDiagramFont(gothic)).toBe('gothic');
    const back = setDiagramFont(gothic, 'default');
    expect(presetOf(back)).toBe('wa');
    expect((parsed(back).themeVariables as Record<string, unknown>).fontFamily).toBe(waFont);
    expect(parsed(back).fontFamily).toBeUndefined();
  });

  it('leaves a config that is not JSON alone', () => {
    expect(setDiagramFont('{oops', 'gothic')).toBe('{oops');
    expect(getDiagramFont('{oops')).toBe('default');
  });
});
