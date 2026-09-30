import { env } from '$/util/env';
import type { Locale, MessageKey } from './messages';
import { createTranslator, pickLocale } from './translate';

const storageKey = 'locale';

function readChosenLocale(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    // Storage can be blocked (private windows, site-data settings); use the build's locale.
    return null;
  }
}

/**
 * The locale this page renders: the viewer's choice from the language toggle,
 * else the build's MERMAID_LOCALE. Fixed for the page's lifetime — switching
 * reloads (see `switchLocale`) rather than re-rendering every string in place.
 */
export const locale: Locale = pickLocale(readChosenLocale(), env.locale);

if (typeof document !== 'undefined') {
  document.documentElement.lang = locale;
}

/**
 * Look up a UI string.
 *
 * Keys are typed, so a typo or a message removed from the catalogue is a
 * compile error rather than a blank label. The English catalogue is the
 * fallback, which matters only if a locale is ever added without a full
 * translation.
 *
 * `params` fills `{name}` placeholders. Interpolation rather than string
 * concatenation at the call site is what lets a translation put the value
 * where its own grammar wants it: "not supported in {domain}" becomes
 * 「この図の種類は {domain} ではサポートされていません」.
 */
export const t = createTranslator(locale);

/**
 * Remember `next` for this browser and reload into it.
 *
 * A reload keeps the switch correct everywhere at once: many labels are
 * computed once at module or component setup, so re-rendering in place would
 * leave some in the old language. The diagram survives, because the editor
 * state is already persisted to localStorage and the URL.
 */
export function switchLocale(next: Locale): void {
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // Nothing would change after a reload, so do not reload.
    return;
  }
  location.reload();
}

export type { Locale, MessageKey };
