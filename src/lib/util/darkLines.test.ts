import { describe, expect, it } from 'vitest';
import { darkLineColor, withVisibleLines } from './darkLines';

describe('withVisibleLines', () => {
  it.each(['redux-dark-color', 'redux-dark', 'dark'])('brightens the lines of %s', (theme) => {
    expect(withVisibleLines({ theme } as never)).toEqual({
      theme,
      themeVariables: { lineColor: darkLineColor }
    });
  });

  it('keeps the other theme variables', () => {
    expect(
      withVisibleLines({ theme: 'redux-dark', themeVariables: { fontSize: '18px' } } as never)
    ).toEqual({
      theme: 'redux-dark',
      themeVariables: { fontSize: '18px', lineColor: darkLineColor }
    });
  });

  it('leaves a line colour the user chose, and light themes, alone', () => {
    const chosen = { theme: 'dark', themeVariables: { lineColor: '#ff0000' } } as never;
    expect(withVisibleLines(chosen)).toBe(chosen);
    const light = { theme: 'redux-color' } as never;
    expect(withVisibleLines(light)).toBe(light);
    expect(withVisibleLines({})).toEqual({});
  });
});
