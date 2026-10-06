import mermaid from 'mermaid';
import { describe, expect, it, vi } from 'vitest';
import { businessTemplatesName, localExamples, localSamples } from './localSamples';
import { getSampleDiagrams } from './mermaid';

describe('localSamples', () => {
  // The business templates, in the order the card offers them, with their diagram types.
  const businessTypes: [title: string, type: string][] = [
    ['スイムレーン業務フロー', 'swimlane'],
    ['稟議・承認フロー', 'flowchart-v2'],
    ['問い合わせ対応フロー', 'swimlane'],
    ['採用プロセス', 'timeline'],
    ['システム構成図', 'architecture'],
    ['プロジェクト工程表', 'gantt'],
    ['組織図', 'flowchart-v2'],
    ['月次決算フロー', 'sequence'],
    ['業務分担表', 'kanban']
  ];
  // The diagram type of every entry, by group (one type) or by title (mixed group).
  const expectedType: Record<string, string | Record<string, string>> = {
    'System Architecture': 'architecture',
    Swimlane: 'swimlane',
    [businessTemplatesName]: Object.fromEntries(businessTypes)
  };
  const examples = Object.entries(localSamples).flatMap(([name, list]) =>
    list.map((example) => [name, example.title, example.code] as const)
  );

  it('lists the expected local entries', () => {
    expect(Object.keys(localSamples).sort()).toEqual(Object.keys(expectedType).sort());
  });

  it('offers every business template, in the order of the task list', () => {
    expect(localSamples[businessTemplatesName].map(({ title }) => title)).toEqual(
      businessTypes.map(([title]) => title)
    );
  });

  it.each(examples)('%s: %s parses as its diagram type', async (name, title, code) => {
    const expected = expectedType[name];
    await expect(mermaid.parse(code)).resolves.toMatchObject({
      diagramType: typeof expected === 'string' ? expected : expected[title]
    });
  });

  it('keeps the business templates small enough to read at a glance', () => {
    for (const { code, title } of localSamples[businessTemplatesName]) {
      // Node ids / statements are ASCII; the text shown is Japanese.
      expect(code, title).toMatch(/[\u3040-\u30ff\u4e00-\u9fff]/);
      expect(code.split('\n').length, title).toBeLessThanOrEqual(24);
    }
  });

  it('names only icons the bundled packs provide', async () => {
    const { iconPacks } = await import('./iconPacks');
    const used = examples.flatMap(([, , code]) => [...code.matchAll(/\(([\w-]+):([\w-]+)\)/g)]);
    const prefixes = new Set(used.map(([, prefix]) => prefix));
    const packs = Object.fromEntries(
      await Promise.all(
        iconPacks
          .filter(({ name }) => prefixes.has(name))
          .map(async ({ name, loader }) => [name, await loader()] as const)
      )
    );
    for (const [, prefix, icon] of used) {
      expect(packs[prefix]?.icons, `${prefix}:${icon}`).toHaveProperty(icon);
    }
  }, 30_000);

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

describe('localExamples', () => {
  const expected: Record<string, string> = {
    Git: 'gitGraph',
    Packet: 'packet',
    Quadrant: 'quadrantChart',
    'User Journey': 'journey',
    XY: 'xychart',
    ZenUML: 'zenuml'
  };

  it('adds a Japanese example to groups the card already has', () => {
    expect(Object.keys(localExamples).sort()).toEqual(Object.keys(expected).sort());
    // Every group but ZenUML (added by the card itself) comes from @mermaid-js/examples.
    const groups = Object.keys(getSampleDiagrams());
    for (const name of Object.keys(localExamples).filter((key) => key !== 'ZenUML'))
      expect(groups, name).toContain(name);
  });

  it.each(Object.entries(localExamples))(
    '%s parses as its type, in Japanese',
    async (name, list) => {
      for (const { code, title } of list) {
        await expect(mermaid.parse(code), title).resolves.toMatchObject({
          diagramType: expected[name]
        });
        expect(code, title).toMatch(/[぀-ヿ一-鿿]/);
      }
    }
  );
});

describe('localSamples without logos', () => {
  it('leaves out the logo example when MERMAID_BUNDLE_LOGOS is false', async () => {
    vi.stubEnv('MERMAID_BUNDLE_LOGOS', 'false');
    vi.resetModules();
    try {
      const { localSamples: withoutLogos } = await import('./localSamples');
      const codes = withoutLogos['System Architecture'].map(({ code }) => code);
      expect(codes.length).toBeGreaterThan(0);
      expect(codes.join('\n')).not.toContain('logos:');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
