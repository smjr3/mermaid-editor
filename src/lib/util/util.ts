import { C } from '$/constants';
import { t } from '$/i18n';
import { env, MCBaseURL } from './env';
import { loadDataFromUrl } from './fileLoaders/loader';
import { initLoading } from './loading.svelte';
import { isOnMermaidAI } from './migration/domainMigration';
import { applyMigrations } from './migrations.svelte';
import { notify } from './notify';
import { initURLSubscription, loadState, updateCodeStore, verifyState } from './state.svelte';
import { getAnalyticsSafeUrl, initAnalytics, plausible } from './stats';

export const getDomain = (url?: string): string => {
  if (!url) return '';
  const domain = new URL(url).hostname;
  return domain;
};

export const loadStateFromURL = (): void => {
  loadState(window.location.hash.slice(1));
};

export const syncDiagram = (): void => {
  updateCodeStore({
    updateDiagram: true
  });
};

export const initHandler = async (): Promise<void> => {
  applyMigrations();
  loadStateFromURL();
  // Local: a ?code= / ?config= URL that fails (an HTTP error, an empty file) is
  // reported; the diagram already on screen is kept.
  await initLoading(
    'Loading Gist...',
    loadDataFromUrl().catch((error: unknown) => {
      console.error(error);
      notify(
        t('error.loadFromUrlFailed', {
          message: error instanceof Error ? error.message : String(error)
        })
      );
    })
  );
  syncDiagram();
  initURLSubscription();
  await initAnalytics();
  plausible?.trackPageview({
    url: getAnalyticsSafeUrl()
  });
  verifyState();
};

export const isMac = navigator.platform.toUpperCase().includes('MAC');
export const cmdKey = isMac ? 'Cmd' : 'Ctrl';
export { MCBaseURL };

const buildUtmParams = ({
  utmCampaign,
  utmMedium
}: {
  utmCampaign: string;
  utmMedium: string;
}): URLSearchParams =>
  new URLSearchParams({
    utm_campaign: utmCampaign,
    utm_medium: utmMedium,
    utm_source: getUTMSource()
  });

export const getCheckoutUrl = (utm: { utmCampaign: string; utmMedium: string }): string => {
  const params = buildUtmParams(utm);
  params.set('coupon', 'arDfyFT8');
  params.set('tier', 'plus');
  return `${MCBaseURL}/app/user/billing/checkout?${params.toString()}`;
};

export const getMermaidAiLiveUrl = (utm: { utmCampaign: string; utmMedium: string }): string => {
  return `${MCBaseURL}/live?${buildUtmParams(utm).toString()}`;
};

export const getContactSalesUrl = (): string => {
  const params = new URLSearchParams({
    contactSubject: 'contactSales',
    utm_campaign: 'contact_sales',
    utm_medium: 'button',
    utm_source: getUTMSource()
  });
  return `${MCBaseURL}/contact-us?${params.toString()}`;
};

let count = 0;
export const errorDebug = (limit = 1000) => {
  count += 1;
  if (count > limit) {
    console.log(count, limit);
    // eslint-disable-next-line no-debugger
    debugger;
  }
};

export const formatJSON = (data: unknown): string => JSON.stringify(data, undefined, 2);
/**
 * Local: with MERMAID_OFFLINE, only `data:`/`blob:` URLs and this site's own
 * files may be fetched (the `?code=` and `?config=` loaders, gists); anything
 * else is refused before a request is made.
 */
export const assertFetchAllowed = (url: string): void => {
  if (!env.isOffline) return;
  const target = new URL(url, document.baseURI);
  if (target.protocol === 'data:' || target.protocol === 'blob:') return;
  if (target.origin === location.origin) return;
  throw new Error(`Loading from ${target.origin} is disabled on this site (MERMAID_OFFLINE)`);
};
// Local: an HTTP error is refused rather than read — a 404 page is not a diagram.
const fetchOk = async (url: string): Promise<Response> => {
  assertFetchAllowed(url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Loading ${url} failed: HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`
    );
  }
  return res;
};
export const fetchJSON = async <T>(url: string): Promise<T> => {
  const res = await fetchOk(url);
  return res.json() as T;
};
export const fetchText = async (url: string): Promise<string> => {
  const res = await fetchOk(url);
  return res.text();
};

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    fallbackCopyToClipboard(text);
  }
};

function fallbackCopyToClipboard(text: string) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  // Make the textarea out of viewport
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.append(textArea);

  textArea.focus();
  textArea.select();

  try {
    // The deprecated but widely supported method
    document.execCommand('copy');
  } catch (error) {
    console.error('Failed to copy:', error);
    throw error;
  } finally {
    textArea.remove();
  }
}

export const getUTMSource = (): string => {
  if (typeof window !== 'undefined' && isOnMermaidAI()) {
    return C.aiLiveEditor;
  }
  return C.utmSource;
};
