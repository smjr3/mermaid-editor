import { describe, expect, it } from 'vitest';
import { categoryName, iconCategories, iconLabel } from './iconCategories';
import { loadPack } from './iconCatalog';
import { standardPrefix } from './standardIcons';

describe('iconCategories', () => {
  it('has about a dozen named groups, each with icons', () => {
    expect(iconCategories.length).toBeGreaterThanOrEqual(12);
    const ids = new Set(iconCategories.map((category) => category.id));
    expect(ids.size).toBe(iconCategories.length);
    for (const category of iconCategories) {
      expect(category.ja, category.id).not.toBe('');
      expect(category.en, category.id).not.toBe('');
      expect(category.icons.length, category.id).toBeGreaterThan(0);
      expect(category.icons.length, category.id).toBeLessThanOrEqual(40);
      // Only mermaid's own group is small: it has five icons in all.
      if (category.id !== 'standard') {
        expect(category.icons.length, category.id).toBeGreaterThanOrEqual(15);
      }
      for (const [id, ja, en] of category.icons) {
        expect(ja, id).not.toBe('');
        expect(en, id).not.toBe('');
      }
      const inGroup = category.icons.map(([id]) => id);
      expect(new Set(inGroup).size, category.id).toBe(inGroup.length);
    }
  });

  it('covers the groups the owner asked for', () => {
    expect(iconCategories.map((category) => category.id)).toEqual(
      expect.arrayContaining([
        'standard',
        'servers',
        'network',
        'security',
        'cloud',
        'm365',
        'hyperscalers',
        'database',
        'devices',
        'people',
        'business',
        'devops'
      ])
    );
  });

  it('names only icons the bundled packs really have', { timeout: 120_000 }, async () => {
    for (const category of iconCategories) {
      for (const [id] of category.icons) {
        const colon = id.indexOf(':');
        expect(colon, id).toBeGreaterThan(0);
        const pack = await loadPack(id.slice(0, colon));
        const name = id.slice(colon + 1);
        expect(pack && (name in pack.icons || name in (pack.aliases ?? {})), id).toBe(true);
      }
    }
  });

  it('keeps the standard group to the standard icons', () => {
    const standard = iconCategories.find((category) => category.id === 'standard');
    expect(standard?.icons.map(([id]) => id)).toEqual(
      ['server', 'database', 'disk', 'internet', 'cloud'].map((name) => `${standardPrefix}:${name}`)
    );
  });

  it('labels in either language', () => {
    const [first] = iconCategories;
    expect(categoryName(first, 'ja')).toBe(first.ja);
    expect(categoryName(first, 'en')).toBe(first.en);
    expect(iconLabel(first.icons[0], 'ja')).toBe(first.icons[0][1]);
    expect(iconLabel(first.icons[0], 'en')).toBe(first.icons[0][2]);
  });
});
