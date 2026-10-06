// Local: the input state as it is read at start-up and from a link, when what is
// stored or linked is not a well-formed state (see stateGuard.ts).
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pakoSerde } from './serde';

// A fresh module graph loads mermaid again, which takes a while on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

const freshState = async () => {
  vi.resetModules();
  return await import('./state.svelte');
};

const linkTo = (value: unknown) => `pako:${pakoSerde.serialize(JSON.stringify(value))}`;

afterEach(() => {
  window.localStorage.removeItem('codeStore');
});

describe('start-up from localStorage', () => {
  it.each([
    ['a state without rough', JSON.stringify({ code: 'graph TD\n  A-->', mermaid: '{}' })],
    ['an empty object', '{}'],
    ['a number', '42'],
    ['a null code', JSON.stringify({ code: null, mermaid: '{}' })],
    ['a null config', JSON.stringify({ code: 'graph TD\n  A', mermaid: null })],
    ['text that is not JSON', '{not json']
  ])('opens with a usable state from %s', async (_name, stored) => {
    window.localStorage.setItem('codeStore', stored);
    const { inputState } = await freshState();
    expect(typeof inputState.code).toBe('string');
    expect(typeof inputState.mermaid).toBe('string');
    expect(typeof inputState.rough).toBe('boolean');
    expect(typeof inputState.updateDiagram).toBe('boolean');
  });

  it('keeps the stored code when only other fields are missing', async () => {
    window.localStorage.setItem('codeStore', JSON.stringify({ code: 'graph TD\n  Kept' }));
    const { inputState } = await freshState();
    expect(inputState.code).toBe('graph TD\n  Kept');
    expect(inputState.mermaid).toBe('{}');
  });
});

describe('loadState from a link', () => {
  it.each([
    ['a number for the code', { code: 42, mermaid: '{}' }],
    ['null', null],
    ['an array', [1, 2]]
  ])('shows the "link could not be read" diagram for %s', async (_name, value) => {
    const { inputState, loadState } = await freshState();
    loadState(linkTo(value));
    flushSync();
    expect(typeof inputState.code).toBe('string');
    expect(inputState.code).toMatch(/^flowchart TD/);
    expect(inputState.code).not.toBe('42');
  });

  it('fills in the fields a linked state leaves out', async () => {
    const { inputState, loadState } = await freshState();
    loadState(linkTo({ code: 'graph TD\n  Linked' }));
    flushSync();
    expect(inputState.code).toBe('graph TD\n  Linked');
    expect(typeof inputState.mermaid).toBe('string');
    expect(typeof inputState.rough).toBe('boolean');
  });

  it('keeps the linked diagram when its config is not JSON, with the default config', async () => {
    const { inputState, loadState } = await freshState();
    loadState(linkTo({ code: 'graph TD\n  KeepMe', mermaid: '{bad json' }));
    flushSync();
    expect(inputState.code).toBe('graph TD\n  KeepMe');
    expect(inputState.mermaid).toBe('{}');
  });
});

describe('replaceInputState with a stored history entry', () => {
  it('takes only a well-formed state', async () => {
    const { inputState, replaceInputState } = await freshState();
    replaceInputState({ code: 'graph TD\n  H', mermaid: '{}' } as never);
    flushSync();
    expect(inputState.code).toBe('graph TD\n  H');
    expect(typeof inputState.rough).toBe('boolean');
  });
});
