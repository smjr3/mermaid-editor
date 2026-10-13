import { messages } from '$/i18n/messages';
import { describe, expect, it } from 'vitest';
import { getSampleDiagrams } from './mermaid';
import { sampleCatalog } from './sampleCatalog';
import { sampleNameKeys, sampleTitle, sampleTitlesJa } from './sampleNames';

describe('sampleNameKeys', () => {
  it('gives the common sample groups a Japanese name and keeps the English one', () => {
    for (const [group, key] of Object.entries(sampleNameKeys)) {
      expect(messages.ja[key], group).toMatch(/[぀-ヿ一-鿿]|^Git|^XY|^ER/);
      if (group !== 'Entity Relationship' && group !== 'Packet' && group !== 'XY')
        expect(messages.en[key], group).toBe(group);
    }
  });

  it('gives every sample a Japanese name, keeping its title as the key', () => {
    const japanese = /[぀-ヿ一-鿿]/;
    for (const [group, list] of Object.entries(sampleCatalog())) {
      for (const { title } of list) {
        expect(sampleTitle(title, 'ja'), `${group}: ${title}`).toMatch(japanese);
        expect(sampleTitle(title, 'en')).toBe(title);
      }
    }
    // No translation for a title the catalogue no longer has.
    const titles = new Set(
      Object.values(sampleCatalog()).flatMap((list) => list.map(({ title }) => title))
    );
    for (const title of Object.keys(sampleTitlesJa)) expect(titles, title).toContain(title);
  });

  it('names the groups the card lists', () => {
    const groups = Object.keys(getSampleDiagrams());
    for (const common of ['Flowchart', 'Sequence', 'Class', 'State', 'Gantt', 'Pie', 'Git', 'XY'])
      expect(groups).toContain(common);
    for (const group of groups.filter((name) => !['C4', 'Cynefin Framework'].includes(name)))
      expect(Object.keys(sampleNameKeys), group).toContain(group);
  });
});
