// Local: loading a diagram from `?code=` / `?config=` URLs keeps the current
// diagram when what comes back is not a diagram (an HTTP error page, an empty file).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateCodeStore = vi.hoisted(() => vi.fn());
vi.mock('$lib/util/state.svelte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/util/state.svelte')>()),
  updateCodeStore
}));

const { loadDataFromUrl } = await import('./loader');

const respond = (body: string, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(body, { status })))
  );

const openWith = (search: string) => {
  history.replaceState(undefined, '', `/edit${search}`);
};

beforeEach(() => {
  updateCodeStore.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  history.replaceState(undefined, '', '/');
});

describe('loadDataFromUrl', () => {
  it('loads the code a ?code= URL returns', async () => {
    respond('graph TD\n  Loaded');
    openWith('?code=/diagram.mmd');
    await loadDataFromUrl();
    expect(updateCodeStore).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'graph TD\n  Loaded' })
    );
  });

  it('keeps the current diagram when the code URL answers 404, naming the status', async () => {
    respond('<html>Not Found</html>', 404);
    openWith('?code=/missing.mmd');
    await expect(loadDataFromUrl()).rejects.toThrow(/HTTP 404/);
    expect(updateCodeStore).not.toHaveBeenCalled();
  });

  it('keeps the current diagram when the config URL answers 500', async () => {
    respond('oops', 500);
    openWith('?code=/diagram.mmd&config=/config.json');
    await expect(loadDataFromUrl()).rejects.toThrow(/HTTP 500/);
    expect(updateCodeStore).not.toHaveBeenCalled();
  });

  it('keeps the current diagram when the code file is empty', async () => {
    respond('  \n');
    openWith('?code=/empty.mmd');
    await expect(loadDataFromUrl()).rejects.toThrow(/empty/);
    expect(updateCodeStore).not.toHaveBeenCalled();
  });
});
