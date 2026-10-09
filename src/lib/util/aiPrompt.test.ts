import { describe, expect, it } from 'vitest';
import { aiKind, buildAiPrompt, curatedIcons } from './aiPrompt';
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

  it('covers the usual parts of a system, described in English only', () => {
    expect(curatedIcons.length).toBeGreaterThan(40);
    for (const icon of curatedIcons) {
      expect(icon.en, icon.id).not.toMatch(/[\u3040-\u30ff\u4e00-\u9fff]/);
      expect(icon.en, icon.id).not.toBe('');
    }
  });
});

describe('buildAiPrompt', () => {
  const packs = ['mermaid', 'tabler', 'logos'];

  it('defaults to a flowchart example with the icon-node syntax, in Japanese', () => {
    const text = buildAiPrompt({ collected: [], locale: 'ja', packs });
    expect(text).toContain('flowchart LR');
    expect(text).toContain('@{ icon: "tabler:server"');
    expect(text).not.toContain('architecture-beta\n');
    expect(text).not.toContain('service web(');
    expect(text).toContain('tabler, logos');
    expect(text).toContain('tabler:server');
    expect(text).toContain('- tabler:server-2 — server rack');
    expect(text).not.toContain('サーバーラック');
    // Standard (prefix-less) icons exist in architecture diagrams only.
    expect(text).not.toContain('- server —');
    expect(text).not.toContain('{collected}');
  });

  it('treats every flowchart flavour as a flowchart', () => {
    for (const type of ['flowchart', 'flowchart-v2', 'flowchart-elk', 'graph', undefined]) {
      expect(aiKind(type), String(type)).toBe('flowchart');
    }
  });

  it('shows the architecture example and its syntax for architecture diagrams', () => {
    const text = buildAiPrompt({ collected: [], diagramType: 'architecture', locale: 'ja', packs });
    expect(text).toContain('architecture-beta');
    expect(text).toContain('service web(tabler:server)');
    expect(text).toContain('- server —');
    expect(text).not.toContain('flowchart LR');
    // The rules an AI gets wrong most: ids, the first letters, Font Awesome.
    expect(text).toMatch(/R, L, T, B/);
    expect(text).toContain('Font Awesome');
  });

  it('gives types without icons a plain example and no icon lists', () => {
    for (const locale of ['en', 'ja'] as const) {
      const text = buildAiPrompt({
        collected: ['logos:aws-s3'],
        diagramType: 'sequence',
        locale,
        packs
      });
      expect(text).toContain('sequenceDiagram');
      expect(text).not.toContain('tabler:server');
      expect(text).not.toContain('logos:aws-s3');
      expect(text).not.toContain('@{ icon');
    }
  });

  it('keeps the type of a diagram it has no example for', () => {
    const text = buildAiPrompt({ collected: [], diagramType: 'gantt', locale: 'en', packs });
    expect(text).toContain('(gantt)');
    expect(text).not.toContain('tabler:server');
    expect(text).not.toContain('flowchart LR');
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
