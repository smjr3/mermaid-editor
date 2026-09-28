import { env } from '$/util/env';
import type { Locale, MessageKey } from './messages';
import { createTranslator, resolveLocale } from './translate';

/** The locale this build ships. Fixed at build time via MERMAID_LOCALE. */
export const locale: Locale = resolveLocale(env.locale);

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

export type { Locale, MessageKey };
