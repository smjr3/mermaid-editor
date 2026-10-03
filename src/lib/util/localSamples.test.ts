import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { localSamples } from './localSamples';
import { getSampleDiagrams } from './mermaid';

describe('localSamples', () => {
  const expectedType: Record<string, string> = {
    'Cloud Architecture': 'architecture',
    Swimlane: 'swimlane'
  };
  const examples = Object.entries(localSamples).flatMap(([name, list]) =>
    list.map((example) => [name, example.title, example.code] as const)
  );

  it('lists the expected local entries', () => {
    expect(Object.keys(localSamples).sort()).toEqual(Object.keys(expectedType).sort());
  });

  it.each(examples)('%s: %s parses as its diagram type', async (name, _title, code) => {
    await expect(mermaid.parse(code)).resolves.toMatchObject({
      diagramType: expectedType[name]
    });
  });

  it('names only icons the bundled packs provide', async () => {
    const { iconPacks } = await import('./iconPacks');
    const packs = Object.fromEntries(
      await Promise.all(iconPacks.map(async ({ name, loader }) => [name, await loader()] as const))
    );
    for (const [, , code] of examples) {
      for (const [, prefix, icon] of code.matchAll(/\(([\w-]+):([\w-]+)\)/g)) {
        expect(packs[prefix]?.icons, `${prefix}:${icon}`).toHaveProperty(icon);
      }
    }
  });

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
