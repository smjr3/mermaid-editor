import { describe, expect, it } from 'vitest';
import { buildAiPrompt, curatedIcons } from './aiPrompt';
import { loadPack } from './iconCatalog';

describe('curatedIcons', () => {
  it('names only icons the bundled packs really have', { timeout: 60_000 }, async () => {
    for (const { id } of curatedIcons) {
      const colon = id.indexOf(':');
      const pack = await loadPack(colon === -1 ? 'mermaid' : id.slice(0, colon));
      const name = id.slice(colon + 1);
      expect(pack && (name in pack.icons || name in (pack.aliases ?? {})), id).toBe(true);
    }
  });

  it('covers the usual parts of a system in both languages', () => {
    expect(curatedIcons.length).toBeGreaterThan(40);
    for (const icon of curatedIcons) {
      expect(icon.ja, icon.id).not.toBe('');
      expect(icon.en, icon.id).not.toBe('');
    }
  });
});

describe('buildAiPrompt', () => {
  const packs = ['mermaid', 'tabler', 'logos'];

  it('explains the syntax, the packs and the curated icons in Japanese', () => {
    const text = buildAiPrompt({ collected: [], locale: 'ja', packs });
    expect(text).toContain('architecture-beta');
    expect(text).toContain('service web(tabler:server)');
    expect(text).toContain('tabler, logos');
    expect(text).toContain('tabler:server');
    expect(text).toContain('サーバー');
    // The rules an AI gets wrong most: ids, the first letters, Font Awesome.
    expect(text).toMatch(/R|L|T|B/);
    expect(text).not.toContain('{collected}');
  });

  it('adds the icons the user collected, first', () => {
    const text = buildAiPrompt({
      collected: ['logos:aws-lambda', 'logos:aws-s3'],
      locale: 'en',
      packs
    });
    expect(text.indexOf('- logos:aws-lambda')).toBeLessThan(text.indexOf('- tabler:server —'));
    expect(text).toContain('logos:aws-s3');
  });

  it('mentions extra packs a deployment or the user added, and not the logo sets when absent', () => {
    const text = buildAiPrompt({
      collected: [],
      locale: 'en',
      packs: ['mermaid', 'tabler', 'corp']
    });
    expect(text).toContain('corp');
    expect(text).not.toContain('logos:aws-lambda');
  });
});
