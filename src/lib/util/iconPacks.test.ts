import { describe, expect, it } from 'vitest';
import { iconPacks, isBrandIcon } from './iconPacks';

// Names that would mean a trademark slipped into the bundle. Kept independent of
// the exclusion list in iconPacks.ts so a gap there fails here.
const trademarks =
  /(^|-)(brand|github|gitlab|google|microsoft|windows|apple|android|aws|amazon|azure|facebook|twitter|slack|linkedin|youtube|instagram|chrome|figma|bitcoin|docker|ibm|oracle)(-|$)/;

describe('iconPacks', () => {
  it('bundles only generic, OSS icon sets', () => {
    expect(iconPacks.map(({ name }) => name)).toEqual(['tabler', 'lucide']);
  });

  it.each([
    [
      'tabler',
      [
        'server',
        'database',
        'router',
        'switch',
        'firewall-check',
        'load-balancer',
        'cloud',
        'topology-star-3',
        'device-laptop',
        'users'
      ]
    ],
    [
      'lucide',
      [
        'server',
        'database',
        'router',
        'network',
        'brick-wall-fire',
        'shield',
        'laptop',
        'cloud',
        'hard-drive',
        'container'
      ]
    ]
  ])(
    'loads %s locally with the icons a system diagram needs',
    async (name, icons) => {
      const pack = iconPacks.find((candidate) => candidate.name === name);
      if (!pack) throw new Error(`no pack ${name}`);
      const json = await pack.loader();
      expect(json.prefix).toBe(name);
      for (const icon of icons) {
        expect(json.icons, `${name}:${icon}`).toHaveProperty(icon);
      }
    },
    30_000
  );

  it.each(['tabler', 'lucide'])(
    'leaves no logo or trademark icon in %s',
    async (name) => {
      const pack = iconPacks.find((candidate) => candidate.name === name);
      if (!pack) throw new Error(`no pack ${name}`);
      const json = await pack.loader();
      const names = [...Object.keys(json.icons), ...Object.keys(json.aliases ?? {})];
      expect(names.filter((icon) => trademarks.test(icon))).toEqual([]);
      for (const alias of Object.values(json.aliases ?? {})) {
        expect(json.icons, `alias parent ${alias.parent}`).toHaveProperty(alias.parent);
      }
    },
    30_000
  );
});

describe('isBrandIcon', () => {
  it('flags brand icons by prefix or by a trademark word, not by substrings', () => {
    expect(isBrandIcon('brand-aws')).toBe(true);
    expect(isBrandIcon('github')).toBe(true);
    expect(isBrandIcon('cloud-bitcoin')).toBe(true);
    expect(isBrandIcon('server')).toBe(false);
    expect(isBrandIcon('pocket-knife')).toBe(false);
  });
});
