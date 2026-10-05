import { messages } from '$/i18n/messages';
import { describe, expect, it } from 'vitest';
import { helpContent } from './helpContent';

describe('helpContent', () => {
  it('has every language, with the same sections and as many points in each', () => {
    const languages = Object.keys(messages);
    expect(Object.keys(helpContent).sort()).toEqual(languages.sort());
    const shape = (locale: keyof typeof helpContent) =>
      helpContent[locale].map(({ id, items }) => [id, items.length]);
    for (const locale of languages as (keyof typeof helpContent)[]) {
      expect(shape(locale)).toEqual(shape('en'));
    }
  });

  it('covers the editor’s tools', () => {
    expect(helpContent.ja.map(({ id }) => id)).toEqual([
      'basics',
      'start',
      'add',
      'edit',
      'layout',
      'colours',
      'icons',
      'export',
      'tips'
    ]);
  });
});
