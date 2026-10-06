import type { State } from '$/types';
import { describe, expect, it } from 'vitest';
import { isStateLike, normalizeState, storedState } from './stateGuard';

const base: State = {
  code: 'flowchart TD\n  A --> B',
  grid: true,
  mermaid: '{}',
  panZoom: true,
  rough: false,
  updateDiagram: true
};

describe('normalizeState', () => {
  it('fills in what an old or partial state leaves out', () => {
    const state = normalizeState({ code: 'graph TD\n  X', mermaid: '{}' }, base);
    expect(state).toEqual({ ...base, code: 'graph TD\n  X' });
    expect(typeof state.rough).toBe('boolean');
  });

  it('keeps the fields that have the right type', () => {
    const state = normalizeState(
      {
        code: 'pie\n  "a" : 1',
        editorMode: 'config',
        grid: false,
        mermaid: '{"theme":"forest"}',
        pan: { x: 1, y: 2 },
        panZoom: false,
        rough: true,
        zoom: 1.5
      },
      base
    );
    expect(state).toMatchObject({
      code: 'pie\n  "a" : 1',
      editorMode: 'config',
      grid: false,
      mermaid: '{"theme":"forest"}',
      pan: { x: 1, y: 2 },
      panZoom: false,
      rough: true,
      zoom: 1.5
    });
  });

  it('drops fields of the wrong type', () => {
    const state = normalizeState(
      {
        editorMode: 'other',
        grid: 'yes',
        pan: { x: 'a' },
        rough: 'true',
        updateDiagram: 1,
        zoom: Number.NaN
      },
      { ...base, pan: { x: 1, y: 1 }, zoom: 2 }
    );
    expect(state).toEqual(base);
  });

  it('writes out a config given as an object', () => {
    expect(JSON.parse(normalizeState({ mermaid: { theme: 'dark' } }, base).mermaid)).toEqual({
      theme: 'dark'
    });
  });

  it('takes a null config as no config', () => {
    expect(normalizeState({ code: 'graph TD', mermaid: null }, base)).toEqual({
      ...base,
      code: 'graph TD'
    });
  });

  it.each([null, 42, 'text', [1, 2], { code: 42 }, { code: null }, { mermaid: 7 }])(
    'refuses %j, which is not a state',
    (raw) => {
      expect(isStateLike(raw)).toBe(false);
      expect(() => normalizeState(raw, base)).toThrow();
    }
  );
});

describe('storedState', () => {
  it('falls back to the base for anything that is not a state', () => {
    for (const raw of [null, 42, 'x', [], { code: 1 }]) {
      expect(storedState(raw, base)).toEqual(base);
    }
  });

  it('never hands back the base object itself', () => {
    expect(storedState(null, base)).not.toBe(base);
  });
});
