import { messages, type Locale, type MessageKey } from './messages';

/**
 * The pure half of the i18n module: no `import.meta.env`, so the app
 * (`./index.ts`) and the Playwright helpers (`tests/test.ts`) share one
 * implementation instead of each keeping a copy that can drift.
 */

/** Used when MERMAID_LOCALE is unset and the viewer has chosen nothing — the default. */
export const defaultLocale: Locale = 'ja';

/** Used when MERMAID_LOCALE names no catalogue, and for keys a locale lacks. */
export const fallbackLocale: Locale = 'en';

/** Every locale with a catalogue, in catalogue order. */
export const locales = Object.keys(messages) as Locale[];

export function isLocale(value: unknown): value is Locale {
  // Object.hasOwn, not `in`: `in` also matches inherited keys such as "toString".
  return typeof value === 'string' && Object.hasOwn(messages, value);
}

export function resolveLocale(configured: string | undefined): Locale {
  const requested = configured ?? defaultLocale;
  return isLocale(requested) ? requested : fallbackLocale;
}

/**
 * The locale to render: the viewer's own choice (the language toggle) when it
 * names a catalogue, otherwise the build's. A stale or tampered stored value is
 * ignored rather than falling back to English, so it cannot override the build.
 */
export function pickLocale(
  chosen: string | null | undefined,
  configured: string | undefined
): Locale {
  return isLocale(chosen) ? chosen : resolveLocale(configured);
}

/** The locale the language toggle switches to from `current`. */
export function nextLocale(current: Locale): Locale {
  return locales[(locales.indexOf(current) + 1) % locales.length];
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
