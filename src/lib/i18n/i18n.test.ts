import { describe, expect, it } from 'vitest';
import { locale, t } from './index';
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

  it('leaves placeholders it was given no value for', () => {
    expect(t('external.unsupported', { other: 'x' })).toContain('{domain}');
  });
});
