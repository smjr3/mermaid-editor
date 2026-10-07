import { defaultState } from '$/constants';
import type { State } from '$/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEditUrl, resolveEmbedSettings, serializeEmbedState, toggleMode } from './embed';
import { deserializeState, pakoSerde, serializeState } from './serde';

const embedUrl = (state?: Partial<State>, params?: Record<string, string>): URL => {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const hash = state ? `#${serializeState({ ...defaultState, ...state })}` : '';
  return new URL(`https://mermaid.live/embed${query}${hash}`);
};

beforeEach(() => {
  // The embed resolver must never fall back to the interactive confirm dialog.
  vi.stubGlobal('confirm', () => {
    throw new Error('resolveEmbedSettings must not call confirm()');
  });
});

describe('resolveEmbedSettings', () => {
  it('should return defaults for a bare /embed URL', () => {
    const { error, settings } = resolveEmbedSettings(embedUrl());
    expect(error).toBeUndefined();
    expect(settings).toBeDefined();
    expect(settings?.code).toBe(defaultState.code);
    expect(settings?.theme).toBe('default');
    expect(settings?.look).toBe('classic');
    expect(settings?.mode).toBe('light');
    expect(settings?.controls).toBe(true);
    expect(settings?.grid).toBe(true);
    expect(settings?.rough).toBe(false);
    expect(settings?.config.securityLevel).toBe('strict');
  });

  it('should load code and config from the hash state', () => {
    const { settings } = resolveEmbedSettings(
      embedUrl({
        code: 'graph TD\n  A-->B',
        grid: false,
        mermaid: JSON.stringify({ theme: 'dark' }),
        pan: { x: 5, y: 6 },
        rough: true,
        zoom: 1.5
      })
    );
    expect(settings?.code).toBe('graph TD\n  A-->B');
    expect(settings?.theme).toBe('dark');
    expect(settings?.mode).toBe('dark');
    expect(settings?.grid).toBe(false);
    expect(settings?.rough).toBe(true);
    expect(settings?.pan).toEqual({ x: 5, y: 6 });
    expect(settings?.zoom).toBe(1.5);
  });

  it('should let query params override the hash state', () => {
    const { settings } = resolveEmbedSettings(
      embedUrl(
        { code: 'graph TD\n  A-->B', mermaid: JSON.stringify({ theme: 'dark' }) },
        {
          look: 'handDrawn',
          pan: '1,2',
          theme: 'forest',
          zoom: '2'
        }
      )
    );
    expect(settings?.code).toBe('graph TD\n  A-->B');
    expect(settings?.theme).toBe('forest');
    expect(settings?.look).toBe('handDrawn');
    expect(settings?.mode).toBe('light');
    expect(settings?.pan).toEqual({ x: 1, y: 2 });
    expect(settings?.zoom).toBe(2);
    expect(settings?.config.theme).toBe('forest');
    expect(settings?.config.look).toBe('handDrawn');
  });

  it('should merge ?config= over the hash config', () => {
    const { settings } = resolveEmbedSettings(
      embedUrl(
        { mermaid: JSON.stringify({ fontSize: 12, theme: 'dark' }) },
        { config: JSON.stringify({ theme: 'neutral' }) }
      )
    );
    expect(settings?.config.fontSize).toBe(12);
    expect(settings?.theme).toBe('neutral');
  });

  it('should let an explicit ?mode= override the theme inference', () => {
    const { settings } = resolveEmbedSettings(
      embedUrl(undefined, { mode: 'light', theme: 'redux-dark' })
    );
    expect(settings?.theme).toBe('redux-dark');
    expect(settings?.mode).toBe('light');
  });

  it('should infer dark mode from a dark theme name', () => {
    const { settings } = resolveEmbedSettings(embedUrl(undefined, { theme: 'neo-dark' }));
    expect(settings?.mode).toBe('dark');
  });

  it('should disable controls and grid with =0', () => {
    const { settings } = resolveEmbedSettings(embedUrl(undefined, { controls: '0', grid: '0' }));
    expect(settings?.controls).toBe(false);
    expect(settings?.grid).toBe(false);
  });

  it('should ignore malformed pan values', () => {
    const { settings } = resolveEmbedSettings(embedUrl({ pan: { x: 3, y: 4 } }, { pan: 'a,b' }));
    expect(settings?.pan).toEqual({ x: 3, y: 4 });
  });

  it('should report an error for a malformed hash', () => {
    const { error, settings } = resolveEmbedSettings(
      new URL('https://mermaid.live/embed#pako:garbage')
    );
    expect(error).toBeDefined();
    expect(settings).toBeUndefined();
  });

  it('should load diagram source from a #code: hash (web component body path)', () => {
    const { error, settings } = resolveEmbedSettings(
      new URL('https://mermaid.live/embed?theme=forest#code:graph%20TD%0A%20%20A--%3EB')
    );
    expect(error).toBeUndefined();
    expect(settings?.code).toBe('graph TD\n  A-->B');
    expect(settings?.theme).toBe('forest');
  });

  it('should ignore a leftover ?code= query param', () => {
    const { settings } = resolveEmbedSettings(
      new URL(
        'https://mermaid.live/embed?code=pie%0A%20%20%22a%22%3A%201#code:graph%20TD%0A%20%20A--%3EB'
      )
    );
    expect(settings?.code).toBe('graph TD\n  A-->B');
  });

  it('should silently strip unsafe config from the hash', () => {
    const { settings } = resolveEmbedSettings(
      embedUrl({
        mermaid: JSON.stringify({
          securityLevel: 'loose',
          theme: 'dark',
          themeVariables: { nodeBorder: '<script>alert(1)</script>' }
        })
      })
    );
    expect(settings?.config.securityLevel).toBe('strict');
    expect(settings?.config.themeVariables).toEqual({});
    expect(settings?.config.theme).toBe('dark');
  });
});

// R06: a config whose JSON root is not an object counts as no config.
describe('resolveEmbedSettings with a config that is not an object', () => {
  const roots: [string, string][] = [
    ['null', 'null'],
    ['a number', '42'],
    ['a string', '"forest"'],
    ['an array', '[{"theme":"dark"}]']
  ];
  const only = { look: 'classic', securityLevel: 'strict', theme: 'default' };

  it.each(roots)('keeps the diagram when the hash config is %s', (_name, mermaid) => {
    const { error, settings } = resolveEmbedSettings(
      embedUrl({ code: 'graph TD\n  Kept-->B', mermaid })
    );
    expect(error).toBeUndefined();
    expect(settings?.code).toBe('graph TD\n  Kept-->B');
    expect(settings?.config).toEqual(only);
  });

  it.each(roots)('ignores a ?config= of %s', (_name, config) => {
    const { error, settings } = resolveEmbedSettings(
      embedUrl({ code: 'graph TD\n  Kept-->B' }, { config })
    );
    expect(error).toBeUndefined();
    expect(settings?.code).toBe('graph TD\n  Kept-->B');
    expect(settings?.config).toEqual(only);
  });
});

// Local: a hash holds whatever JSON it was given; the embed takes only a real
// state from it, field by field, as the editor does (stateGuard.ts).
describe('resolveEmbedSettings with a hash that is not a well-formed state', () => {
  const rawHash = (value: unknown) =>
    new URL(`https://mermaid.live/embed#pako:${pakoSerde.serialize(JSON.stringify(value))}`);

  it.each([
    ['null', null],
    ['an array', [1, 2]],
    ['a number', 42],
    ['a code that is not text', { code: 42, mermaid: '{}' }],
    ['a config that is neither text nor an object', { code: 'graph TD\n  A', mermaid: 7 }]
  ])('reports %s as a link that could not be read', (_name, value) => {
    const { error, settings } = resolveEmbedSettings(rawHash(value));
    expect(error).toBeDefined();
    expect(settings).toBeUndefined();
  });

  it('drops a pan, zoom, rough or grid of the wrong type and keeps the diagram', () => {
    const { error, settings } = resolveEmbedSettings(
      rawHash({
        code: 'graph TD\n  Kept',
        grid: 'no',
        mermaid: '{}',
        pan: { x: 'left', y: 2 },
        rough: 'yes',
        zoom: -3
      })
    );
    expect(error).toBeUndefined();
    expect(settings?.code).toBe('graph TD\n  Kept');
    expect(settings?.pan).toBeUndefined();
    expect(settings?.zoom).toBeUndefined();
    expect(settings?.rough).toBe(false);
    expect(settings?.grid).toBe(true);
  });

  it('keeps a well-formed pan and zoom from the hash', () => {
    const { settings } = resolveEmbedSettings(
      rawHash({ code: 'graph TD\n  A', pan: { x: 3, y: 4 }, rough: true, zoom: 1.5 })
    );
    expect(settings).toMatchObject({ pan: { x: 3, y: 4 }, rough: true, zoom: 1.5 });
  });

  it.each(['0', '-2', 'Infinity', 'big'])('ignores ?zoom=%s', (zoom) => {
    const { settings } = resolveEmbedSettings(embedUrl({ zoom: 2 }, { zoom }));
    expect(settings?.zoom).toBe(2);
  });
});

describe('toggleMode', () => {
  it('should flip only the chrome mode', () => {
    const { settings } = resolveEmbedSettings(embedUrl(undefined, { theme: 'dark' }));
    expect(settings).toBeDefined();
    if (!settings) {
      return;
    }
    const toggled = toggleMode(settings);
    expect(toggled.mode).toBe('light');
    expect(toggled.theme).toBe('dark');
  });
});

describe('buildEditUrl', () => {
  it('should carry the resolved state to the editor', () => {
    const { settings } = resolveEmbedSettings(
      embedUrl({ code: 'graph TD\n  A-->B' }, { theme: 'forest' })
    );
    expect(settings).toBeDefined();
    if (!settings) {
      return;
    }
    const url = buildEditUrl(serializeEmbedState(settings), 'https://mermaid.live/edit');
    expect(url).toMatch(/^https:\/\/mermaid\.live\/edit#pako:/);
    const state = deserializeState(url.split('#')[1]);
    expect(state.code).toBe('graph TD\n  A-->B');
    expect(state.panZoom).toBe(true);
    expect(JSON.parse(state.mermaid)).toMatchObject({ securityLevel: 'strict', theme: 'forest' });
  });
});
