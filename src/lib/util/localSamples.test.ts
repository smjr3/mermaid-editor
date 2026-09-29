import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { localSamples } from './localSamples';
import { getSampleDiagrams } from './mermaid';

describe('localSamples', () => {
  const examples = Object.values(localSamples).flat();

  it.each(examples.map((example) => [example.title, example.code]))(
    '%s parses as a swimlane diagram',
    async (_title, code) => {
      await expect(mermaid.parse(code)).resolves.toMatchObject({ diagramType: 'swimlane' });
    }
  );

  it('has exactly one default per diagram', () => {
    for (const [name, list] of Object.entries(localSamples)) {
      expect(
        list.filter((example) => example.isDefault),
        name
      ).toHaveLength(1);
    }
  });

  it('does not shadow an upstream sample', () => {
    // If upstream starts shipping one, the local entry should be dropped rather than win.
    const upstream = getSampleDiagrams();
    for (const name of Object.keys(localSamples)) {
      expect(upstream, name).not.toHaveProperty(name);
    }
  });
});
