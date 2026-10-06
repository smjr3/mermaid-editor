import { describe, expect, it } from 'vitest';
import {
  checkIcons,
  editDistance,
  iconRefsIn,
  loadPack,
  packNames,
  replaceIconRef,
  suggestIcons
} from './iconCatalog';

describe('editDistance', () => {
  it('counts insertions, deletions, substitutions and swaps of neighbours', () => {
    expect(editDistance('server', 'server')).toBe(0);
    expect(editDistance('servr', 'server')).toBe(1);
    expect(editDistance('sevrer', 'server')).toBe(1);
    expect(editDistance('srvr', 'server')).toBe(2);
    expect(editDistance('cloud', 'server')).toBeGreaterThan(2);
  });
});

describe('suggestIcons, misspelt names', () => {
  it('finds a near name in the same pack first', { timeout: 60_000 }, async () => {
    expect((await suggestIcons('tabler:servr'))[0]).toBe('tabler:server');
    expect((await suggestIcons('tabler:databse'))[0]).toBe('tabler:database');
  });
});

const arch = `architecture-beta
  group aws(logos:aws)[AWS]
  service web(tabler:server)[Web] in aws
  service db(database)[DB] in aws
  service fn(aws:lambda)[Fn]
  service q(logos:aws-sqs-typo)[Queue]
  web:R --> L:db`;

const flow = `flowchart LR
  A@{ icon: "tabler:user", form: "circle" } --> B@{ icon: 'mdi:no-such-icon-xyz' }
  C@{ icon: "fa:fa-car" }`;

describe('iconRefsIn', () => {
  it('finds the icons of an architecture diagram, standard ones included', () => {
    expect(iconRefsIn(arch)).toEqual([
      'logos:aws',
      'tabler:server',
      'database',
      'aws:lambda',
      'logos:aws-sqs-typo'
    ]);
  });

  it('finds flowchart icon nodes but not Font Awesome', () => {
    expect(iconRefsIn(flow)).toEqual(['tabler:user', 'mdi:no-such-icon-xyz']);
  });

  it('lists each reference once', () => {
    expect(
      iconRefsIn('architecture-beta\n  service a(tabler:server)\n  service b(tabler:server)')
    ).toEqual(['tabler:server']);
  });
});

describe('packNames / loadPack', () => {
  it('knows the standard icons and the bundled packs', async () => {
    expect(packNames()).toEqual(expect.arrayContaining(['mermaid', 'tabler', 'logos']));
    expect((await loadPack('tabler'))?.icons.server).toBeDefined();
    expect((await loadPack('mermaid'))?.icons.database).toBeDefined();
    expect(await loadPack('no-such-pack')).toBeUndefined();
  });
});

describe('checkIcons', () => {
  // Suggestions load every pack (mdi and simple-icons are large), hence the time.
  it(
    'reports the unknown references with suggestions from the packs',
    { timeout: 60_000 },
    async () => {
      const unknown = await checkIcons(arch);
      expect(unknown.map(({ ref }) => ref)).toEqual(['aws:lambda', 'logos:aws-sqs-typo']);
      expect(unknown[0].candidates[0]).toBe('logos:aws-lambda');
      expect(unknown[1].candidates[0]).toBe('logos:aws-sqs');
    }
  );

  it('suggests by the name part even when the pack is unknown', { timeout: 60_000 }, async () => {
    const [bad] = await checkIcons('architecture-beta\n  service a(whatever:firewall)[x]');
    expect(bad.ref).toBe('whatever:firewall');
    // tabler has firewall-check & co., enough for the first pass; mdi is not loaded for it.
    expect(bad.candidates[0]).toMatch(/firewall/);
  });

  it('accepts a diagram whose icons all exist', { timeout: 60_000 }, async () => {
    expect(await checkIcons(flow.replace('mdi:no-such-icon-xyz', 'mdi:server'))).toEqual([]);
  });
});

describe('replaceIconRef', () => {
  it('replaces every use of the reference, nowhere else', () => {
    const code =
      'architecture-beta\n  service a(aws:lambda)[aws:lambda]\n  service b(aws:lambda)[B]';
    expect(replaceIconRef(code, 'aws:lambda', 'logos:aws-lambda')).toBe(
      'architecture-beta\n  service a(logos:aws-lambda)[aws:lambda]\n  service b(logos:aws-lambda)[B]'
    );
    expect(replaceIconRef(flow, 'mdi:no-such-icon-xyz', 'mdi:server')).toContain(
      "B@{ icon: 'mdi:server' }"
    );
  });
});
