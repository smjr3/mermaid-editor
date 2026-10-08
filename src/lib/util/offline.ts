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
