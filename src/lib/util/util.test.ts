import { describe, expect, it, vi } from 'vitest';

vi.mock('./env', () => ({ MCBaseURL: 'https://example.com', env: { isOffline: true } }));

const { assertFetchAllowed, fetchText } = await import('./util');

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
