import { describe, expect, it } from 'vitest';
import {
  addDarkSiteBackdrop,
  darkLineColor,
  darkSiteBackdrop,
  withVisibleLines
} from './darkLines';

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

describe('addDarkSiteBackdrop', () => {
  const svg = '<svg id="d1" xmlns="http://www.w3.org/2000/svg"><g></g></svg>';

  it.each(['white', '#ffffff', '#fff', '#f4f4f4', 'rgb(250, 250, 250)'])(
    'gives a light-themed diagram (%s) a light grey background while the site is dark',
    (background) => {
      expect(addDarkSiteBackdrop(svg, 'd1', background)).toBe(
        `<svg id="d1" xmlns="http://www.w3.org/2000/svg"><style>.dark #d1{background-color:${darkSiteBackdrop};--background:${darkSiteBackdrop};}</style><g></g></svg>`
      );
    }
  );

  it.each(['#333', 'transparent', 'red;}</style>', ''])('leaves %j alone', (background) => {
    expect(addDarkSiteBackdrop(svg, 'd1', background)).toBe(svg);
  });
});
