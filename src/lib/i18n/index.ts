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
 *
 * `params` fills `{name}` placeholders. Interpolation rather than string
 * concatenation at the call site is what lets a translation put the value
 * where its own grammar wants it: "not supported in {domain}" becomes
 * 「この図の種類は {domain} ではサポートされていません」.
 */
export function t(key: MessageKey, params?: Record<string, string>): string {
  const template: string = messages[locale][key] ?? messages[fallbackLocale][key];
  if (!params) {
    return template;
  }
  return template.replaceAll(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}

export type { Locale, MessageKey };
