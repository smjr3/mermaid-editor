import { env } from './env';

/**
 * Local: with MERMAID_OFFLINE, only `data:`/`blob:` URLs and this site's own
 * files may be fetched (the `?code=` and `?config=` loaders, gists, hosted icon
 * packs); anything else is refused before a request is made.
 *
 * A module of its own so the icon loaders (customIcons.ts, imported by mermaid.ts)
 * can use it without importing util.ts, which imports the state and so mermaid.ts.
 */
export const assertFetchAllowed = (url: string): void => {
  if (!env.isOffline) return;
  const target = new URL(url, document.baseURI);
  if (target.protocol === 'data:' || target.protocol === 'blob:') return;
  if (target.origin === location.origin) return;
  throw new Error(`Loading from ${target.origin} is disabled on this site (MERMAID_OFFLINE)`);
};

// What fetch's redirect handling treats as a redirect (outside a browser, where
// `redirect: 'manual'` hands the 3xx answer back rather than an opaque one).
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

/**
 * Local (N03): the one fetch every app-initiated request goes through (the URL and
 * gist loaders in util.ts, the hosted icon packs in customIcons.ts).
 *
 * With MERMAID_OFFLINE the URL is checked by `assertFetchAllowed`, and no redirect
 * is followed: the request is made with `redirect: 'manual'`, so a 3xx answer comes
 * back as itself (an opaque redirect in a browser) and is refused here, before the
 * browser asks the redirect's target for anything. Checking `response.url` after a
 * default fetch would be too late — the other origin would already have been asked.
 * A redirect within the site is refused too: a browser hides a redirect's
 * `Location` from scripts, so it cannot be told apart from one that leaves the site
 * (docs-dev/FEATURE-FLAGS.md). Without MERMAID_OFFLINE, fetch behaves as usual.
 */
export const fetchAllowed = async (url: string | URL, init?: RequestInit): Promise<Response> => {
  const href = String(url);
  if (!env.isOffline) return fetch(href, init);
  assertFetchAllowed(href);
  const target = new URL(href, document.baseURI);
  if (target.protocol === 'data:' || target.protocol === 'blob:') return fetch(target, init);
  const response = await fetch(target, { ...init, redirect: 'manual' });
  if (
    response.type === 'opaqueredirect' ||
    response.redirected ||
    redirectStatuses.has(response.status)
  ) {
    throw new Error(
      `Loading ${target.href} was answered with a redirect, which this site does not follow (MERMAID_OFFLINE)`
    );
  }
  return response;
};
