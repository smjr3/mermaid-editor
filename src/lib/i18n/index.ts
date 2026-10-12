import { env } from '$/util/env';
import type { Locale, MessageKey } from './messages';
import { createTranslator, resolveLocale } from './translate';

/**
 * The locale this page renders: the build's MERMAID_LOCALE (default ja).
 *
 * Local: there is no language button any more, so a choice an earlier version stored
 * under `locale` is ignored rather than read. The migration that removes it
 * (`migrateEditorLayout`) runs only after this module has loaded, so reading it here
 * would still have rendered the old choice on the first visit after the update.
 */
export const locale: Locale = resolveLocale(env.locale);

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

export type { Locale, MessageKey };
