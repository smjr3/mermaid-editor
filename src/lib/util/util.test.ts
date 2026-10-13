import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./env', () => ({ MCBaseURL: 'https://example.com', env: { isOffline: true } }));

// vitest's jsdom environment exposes its JSDOM instance, used to move the page's origin.
declare const jsdom: { reconfigure: (options: { url: string }) => void };

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

// Local (N03): MERMAID_OFFLINE checks the URL it is given, so a same-origin URL that
// answers with a redirect to another origin must not be followed: the request to the
// other origin is refused before it is made, not judged from response.url afterwards.
describe('fetchText / fetchJSON (MERMAID_OFFLINE) and redirects', () => {
  const servers: Server[] = [];
  let site = '';
  let outside = '';
  let outsideHits = 0;
  const originalUrl = location.href;

  const listen = (handler: Parameters<typeof createServer>[1]) =>
    new Promise<string>((resolve) => {
      const server = createServer(handler);
      servers.push(server);
      server.listen(0, '127.0.0.1', () => {
        resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
      });
    });

  beforeAll(async () => {
    outside = await listen((_request, response) => {
      outsideHits += 1;
      response.end('graph TD\n  Outside');
    });
    site = await listen((request, response) => {
      const status = /^\/(\d{3})\//.exec(request.url ?? '')?.[1];
      if (status) {
        const target = request.url?.includes('/same/')
          ? `${site}/plain.mmd`
          : `${outside}/probe.mmd`;
        response.writeHead(Number(status), { location: target });
        response.end();
        return;
      }
      response.end('graph TD\n  Site');
    });
    jsdom.reconfigure({ url: `${site}/edit` });
  });

  afterAll(async () => {
    jsdom.reconfigure({ url: originalUrl });
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  });

  beforeEach(() => {
    outsideHits = 0;
  });

  it('loads a same-origin URL that answers directly', async () => {
    await expect(fetchText(`${site}/plain.mmd`)).resolves.toBe('graph TD\n  Site');
  });

  it.each([301, 302, 303, 307, 308])(
    'refuses a %i redirect to another origin without requesting it',
    async (status) => {
      await expect(fetchText(`${site}/${status}/code.mmd`)).rejects.toThrow(/redirect/);
      await expect(fetchJSON(`${site}/${status}/config.json`)).rejects.toThrow(/redirect/);
      expect(outsideHits).toBe(0);
    }
  );

  it('refuses a same-origin redirect too: offline follows no redirect', async () => {
    await expect(fetchText(`${site}/302/same/code.mmd`)).rejects.toThrow(/MERMAID_OFFLINE/);
    expect(outsideHits).toBe(0);
  });
});
