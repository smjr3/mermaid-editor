import { env } from '$/util/env';
import { messages, type Locale, type MessageKey } from './messages';

const fallbackLocale: Locale = 'en';

function resolveLocale(): Locale {
  const configured = env.locale;
  return configured in messages ? (configured as Locale) : fallbackLocale;
}

/** The locale this build ships. Fixed at build time via MERMAID_LOCALE. */
export const locale: Locale = resolveLocale();

/**
 * Look up a UI string.
 *
 * Keys are typed, so a typo or a message removed from the catalogue is a
 * compile error rather than a blank label. The English catalogue is the
 * fallback, which matters only if a locale is ever added without a full
 * translation.
 */
export function t(key: MessageKey): string {
  return messages[locale][key] ?? messages[fallbackLocale][key];
}

export type { Locale, MessageKey };
