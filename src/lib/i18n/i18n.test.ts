import { afterEach, describe, expect, it, vi } from 'vitest';
import { locale, t } from './index';
import {
  defaultLocale,
  fallbackLocale,
  locales,
  nextLocale,
  pickLocale,
  resolveLocale
} from './translate';
import { messages, type MessageKey } from './messages';

const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();

describe('message catalogue', () => {
  it('defines the same keys in every locale', () => {
    const reference = Object.keys(messages.en).sort();
    for (const [name, catalogue] of Object.entries(messages)) {
      expect(Object.keys(catalogue).sort(), name).toEqual(reference);
    }
  });

  it('has no blank messages', () => {
    for (const [name, catalogue] of Object.entries(messages)) {
      for (const [key, value] of Object.entries(catalogue)) {
        expect(value.trim(), `${name}.${key}`).not.toBe('');
      }
    }
  });

  it('keeps the same placeholders in every translation', () => {
    for (const [name, catalogue] of Object.entries(messages)) {
      for (const [key, value] of Object.entries(catalogue)) {
        expect(placeholders(value), `${name}.${key}`).toEqual(
          placeholders(messages.en[key as MessageKey])
        );
      }
    }
  });
});

describe('t', () => {
  it('looks up the message for the configured locale', () => {
    expect(t('actions.title')).toBe(messages[locale]['actions.title']);
  });

  it('fills placeholders', () => {
    expect(t('external.unsupported', { domain: 'kroki.io' })).toContain('kroki.io');
    expect(t('external.unsupported', { domain: 'kroki.io' })).not.toContain('{domain}');
  });

  it('does not expand placeholders or replacement patterns inside a value', () => {
    // Values can carry untrusted text (the unsafe-config prompt quotes config
    // loaded from a URL), so they must be inserted verbatim.
    const value = '{paths} $& $1';
    expect(t('security.unsafeConfigConfirm', { paths: value })).toContain(value);
  });

  it('leaves placeholders it was given no value for', () => {
    expect(t('external.unsupported', { other: 'x' })).toContain('{domain}');
  });
});

describe('resolveLocale', () => {
  it('uses the organisational default when MERMAID_LOCALE is unset', () => {
    expect(resolveLocale(undefined)).toBe(defaultLocale);
  });

  it('accepts a locale that has a catalogue', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('ja')).toBe('ja');
  });

  it('falls back for unknown values, including inherited property names', () => {
    expect(resolveLocale('fr')).toBe(fallbackLocale);
    expect(resolveLocale('toString')).toBe(fallbackLocale);
  });
});

describe('pickLocale', () => {
  it('prefers the viewer’s stored choice over the build’s locale', () => {
    expect(pickLocale('en', 'ja')).toBe('en');
    expect(pickLocale('ja', 'en')).toBe('ja');
  });

  it('ignores a stored value that names no catalogue', () => {
    // Falling back to English here would let junk in storage override the build.
    for (const chosen of [null, undefined, '', 'fr', 'toString']) {
      expect(pickLocale(chosen, 'ja'), String(chosen)).toBe('ja');
    }
  });
});

describe('nextLocale', () => {
  it('cycles through every locale and back', () => {
    const visited = [locales[0]];
    while (visited.length < locales.length) {
      visited.push(nextLocale(visited.at(-1) ?? locales[0]));
    }
    expect(new Set(visited).size).toBe(locales.length);
    expect(nextLocale(visited.at(-1) ?? locales[0])).toBe(locales[0]);
  });
});

describe('the app locale', () => {
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('follows the choice the language toggle stored, and sets <html lang>', async () => {
    const other = nextLocale(locale);
    localStorage.setItem('locale', other);
    vi.resetModules();
    const fresh = await import('./index');
    expect(fresh.locale).toBe(other);
    expect(fresh.t('actions.title')).toBe(messages[other]['actions.title']);
    expect(document.documentElement.lang).toBe(other);
  });
});
