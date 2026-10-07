import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./env', () => ({ MCBaseURL: 'https://example.com', env: { isOffline: true } }));

const { assertFetchAllowed, fetchJSON, fetchText } = await import('./util');

describe('assertFetchAllowed (MERMAID_OFFLINE)', () => {
  it('lets data: URLs and this site through', () => {
    expect(() => assertFetchAllowed('data:text/plain,hello')).not.toThrow();
    expect(() => assertFetchAllowed('/icon-packs/azure.json')).not.toThrow();
    expect(() => assertFetchAllowed(`${location.origin}/x.mmd`)).not.toThrow();
  });

  it('refuses another origin before any request is made', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(() => assertFetchAllowed('https://gist.githubusercontent.com/a/raw/code.mmd')).toThrow(
      /MERMAID_OFFLINE/
    );
    await expect(fetchText('https://api.github.com/gists/1')).rejects.toThrow(/disabled/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// Local: an HTTP error page is not a diagram (or a gist).
describe('fetchText / fetchJSON', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (body: string, status: number, statusText = '') =>
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(body, { status, statusText })))
    );

  it('reject a non-2xx answer with a message naming the status', async () => {
    respond('<html>Not Found</html>', 404, 'Not Found');
    await expect(fetchText(`${location.origin}/missing.mmd`)).rejects.toThrow(/HTTP 404 Not Found/);
    respond('{"message":"Not Found"}', 404);
    await expect(fetchJSON(`${location.origin}/gist.json`)).rejects.toThrow(/HTTP 404/);
    respond('', 503);
    await expect(fetchText(`${location.origin}/x.mmd`)).rejects.toThrow(/HTTP 503/);
  });

  it('return the body of a 2xx answer', async () => {
    respond('graph TD', 200);
    await expect(fetchText(`${location.origin}/x.mmd`)).resolves.toBe('graph TD');
    respond('{"a":1}', 200);
    await expect(fetchJSON(`${location.origin}/x.json`)).resolves.toEqual({ a: 1 });
  });
});
