import { messages, type Locale, type MessageKey } from './messages';

/**
 * The pure half of the i18n module: no `import.meta.env`, so the app
 * (`./index.ts`) and the Playwright helpers (`tests/test.ts`) share one
 * implementation instead of each keeping a copy that can drift.
 */

/** Used when MERMAID_LOCALE is unset — the organisational default. */
export const defaultLocale: Locale = 'ja';

/** Used when MERMAID_LOCALE names no catalogue, and for keys a locale lacks. */
export const fallbackLocale: Locale = 'en';

export function resolveLocale(configured: string | undefined): Locale {
  const requested = configured ?? defaultLocale;
  // Object.hasOwn, not `in`: `in` also matches inherited keys such as "toString".
  return Object.hasOwn(messages, requested) ? (requested as Locale) : fallbackLocale;
}

/**
 * Fill `{name}` placeholders. A callback replacement inserts each value
 * verbatim: a value containing `{…}` or `$&` is neither re-expanded nor
 * treated as a replacement pattern, which matters because some values quote
 * config loaded from a URL.
 */
export function interpolate(template: string, params?: Record<string, string>): string {
  if (!params) {
    return template;
  }
  return template.replaceAll(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}

export type Translate = (key: MessageKey, params?: Record<string, string>) => string;

export function createTranslator(locale: Locale): Translate {
  return (key, params) =>
    interpolate(messages[locale][key] ?? messages[fallbackLocale][key], params);
}
