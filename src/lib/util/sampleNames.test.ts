import { messages } from '$/i18n/messages';
import { describe, expect, it } from 'vitest';
import { getSampleDiagrams } from './mermaid';
import { sampleNameKeys } from './sampleNames';

describe('sampleNameKeys', () => {
  it('gives the common sample groups a Japanese name and keeps the English one', () => {
    for (const [group, key] of Object.entries(sampleNameKeys)) {
      expect(messages.ja[key], group).toMatch(/[぀-ヿ一-鿿]|^Git|^XY|^ER/);
      if (group !== 'Entity Relationship' && group !== 'Packet' && group !== 'XY')
        expect(messages.en[key], group).toBe(group);
    }
  });

  it('names the groups the card lists', () => {
    const groups = Object.keys(getSampleDiagrams());
    for (const common of ['Flowchart', 'Sequence', 'Class', 'State', 'Gantt', 'Pie', 'Git', 'XY'])
      expect(groups).toContain(common);
    for (const group of groups.filter((name) => !['C4', 'Cynefin Framework'].includes(name)))
      expect(Object.keys(sampleNameKeys), group).toContain(group);
  });
});
