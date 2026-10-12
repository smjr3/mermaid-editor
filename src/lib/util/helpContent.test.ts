import { messages } from '$/i18n/messages';
import { describe, expect, it } from 'vitest';
import { helpContent } from './helpContent';

describe('helpContent', () => {
  it('names no owner and links no repository in the version section', () => {
    for (const sections of Object.values(helpContent)) {
      const about = sections.find(({ id }) => id === 'about');
      expect(about?.items.join(' ')).not.toMatch(/github|smjr3/i);
    }
  });

  it('has every language, with the same sections and as many points in each', () => {
    const languages = Object.keys(messages);
    expect(Object.keys(helpContent).sort()).toEqual(languages.sort());
    const shape = (locale: keyof typeof helpContent) =>
      helpContent[locale].map(({ id, items }) => [id, items.length]);
    for (const locale of languages as (keyof typeof helpContent)[]) {
      expect(shape(locale)).toEqual(shape('en'));
    }
  });

  // The inspector layout dropped the command search, the language button, the Make / Fix /
  // Export tabs, swapping the sides, the diagram-only tab, PNG sizes in px and the Gist
  // loader; the guide must not send anyone looking for them.
  it('mentions none of the removed features', () => {
    const removed = {
      en: [/ctrl\+k|⌘k/i, /language/i, /\bMake\b|\bFix\b|Export tab/, /⇄|swap/i, /gist/i, /\bpx\b/],
      ja: [/ctrl\+k|⌘k/i, /言語/, /「作る」|「直す」|「出す」/, /⇄|入れ替/, /gist/i, /\bpx\b/]
    };
    for (const [locale, patterns] of Object.entries(removed)) {
      const text = helpContent[locale as keyof typeof helpContent]
        .flatMap(({ items, title }) => [title, ...items])
        .join('\n');
      for (const pattern of patterns) expect(text, `${locale} ${pattern}`).not.toMatch(pattern);
      expect(text).not.toMatch(/別タブで図だけ|diagram-only tab/i);
    }
  });

  it('describes the header, the add bar and the settings panel', () => {
    const ja = helpContent.ja.flatMap(({ items }) => items).join('\n');
    for (const words of ['新規', '共有', '書き出す', '追加バー', '設定パネル', '設定 JSON']) {
      expect(ja).toContain(words);
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
      'licenses',
      'tips',
      'about'
    ]);
  });
});
