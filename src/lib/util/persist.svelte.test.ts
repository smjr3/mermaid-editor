import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const notified = vi.hoisted(() => [] as string[]);
vi.mock('./notify', () => ({
  notify: (message: string) => notified.push(message),
  prompt: () => true
}));

const { persisted, readJSON, writeJSON } = await import('./persist.svelte');

beforeEach(() => {
  window.localStorage.clear();
});

describe('readJSON', () => {
  it('returns the fallback when the key is missing', () => {
    expect(readJSON('missing', 'fallback')).toBe('fallback');
  });

  it('returns the parsed value when present', () => {
    window.localStorage.setItem('key', '{"a":1}');
    expect(readJSON<{ a: number }>('key', { a: 0 })).toEqual({ a: 1 });
  });

  it('returns the fallback when the stored value is corrupt', () => {
    window.localStorage.setItem('corrupt', '{oops');
    expect(readJSON('corrupt', 'fallback')).toBe('fallback');
    // The previous persistence layer could write the literal string "undefined".
    window.localStorage.setItem('legacy', 'undefined');
    expect(readJSON('legacy', 'fallback')).toBe('fallback');
  });

  it('returns the fallback when the stored value parses to null', () => {
    // The pre-runes persistence layer treated a stored null as absent.
    window.localStorage.setItem('legacy-null', 'null');
    expect(readJSON('legacy-null', 'fallback')).toBe('fallback');
  });
});

describe('writeJSON', () => {
  it('round-trips values through localStorage as JSON', () => {
    writeJSON('key', { nested: { value: 2 } });
    expect(window.localStorage.getItem('key')).toBe('{"nested":{"value":2}}');
    expect(readJSON('key', {})).toEqual({ nested: { value: 2 } });
  });
});

describe('persisted', () => {
  it('initialises from storage when a value exists', () => {
    window.localStorage.setItem('counter', '5');
    const counter = persisted('counter', 0);
    expect(counter.value).toBe(5);
  });

  it('uses the initial value when storage is empty, without writing it', () => {
    const counter = persisted('counter', 7);
    expect(counter.value).toBe(7);
    expect(window.localStorage.getItem('counter')).toBeNull();
  });

  it('persists on assignment and exposes the new value', () => {
    const counter = persisted('counter', 0);
    counter.value = 42;
    expect(counter.value).toBe(42);
    expect(window.localStorage.getItem('counter')).toBe('42');
  });

  it('uses the initial value when storage holds a literal null', () => {
    window.localStorage.setItem('settings', 'null');
    const settings = persisted('settings', { theme: 'default' });
    expect(settings.value).toEqual({ theme: 'default' });
  });
});

// R03: storage that throws (blocked site data makes the `localStorage` getter itself
// throw; a full quota or a refusal makes setItem throw) must never stop the editor.
describe('storage that refuses', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  const blockGetter = () =>
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      }
    });
  const refuseWrites = () =>
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });

  beforeEach(() => {
    notified.length = 0;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (original) Object.defineProperty(window, 'localStorage', original);
  });

  it('reads the fallback when the localStorage getter throws', () => {
    blockGetter();
    expect(readJSON('key', 'fallback')).toBe('fallback');
  });

  it('does not throw when the localStorage getter throws on write', () => {
    blockGetter();
    expect(() => writeJSON('key', { a: 1 })).not.toThrow();
    expect(writeJSON('key', { a: 1 })).toBe(false);
  });

  it('does not throw when setItem refuses, and says so once per page', async () => {
    // A fresh module: the notice is shown once per page load.
    vi.resetModules();
    const fresh = await import('./persist.svelte');
    refuseWrites();
    expect(fresh.writeJSON('key', { a: 1 })).toBe(false);
    expect(fresh.writeJSON('key', { a: 2 })).toBe(false);
    expect(notified).toHaveLength(1);
    vi.restoreAllMocks();
    expect(fresh.writeJSON('key', { a: 3 })).toBe(true);
  });

  it('keeps a persisted value in memory when it cannot be saved', () => {
    refuseWrites();
    const counter = persisted('counter', 0);
    counter.value = 3;
    expect(counter.value).toBe(3);
  });

  it('counts the in-memory stand-in for blocked storage as not saving', async () => {
    vi.resetModules();
    const fresh = await import('./persist.svelte');
    const memory = window.localStorage;
    (window as { __memoryStorage?: unknown }).__memoryStorage = memory;
    try {
      expect(fresh.writeJSON('key', 1)).toBe(false);
      expect(fresh.readJSON('key', 0)).toBe(1);
      expect(notified).toHaveLength(1);
    } finally {
      delete (window as { __memoryStorage?: unknown }).__memoryStorage;
    }
  });

  it('reports a successful write', () => {
    expect(writeJSON('key', 1)).toBe(true);
  });
});
