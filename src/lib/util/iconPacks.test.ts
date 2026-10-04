import { describe, expect, it } from 'vitest';
import { isBrandIcon, selectIconPacks } from './iconPacks';

const names = (bundleLogos: boolean) => selectIconPacks(bundleLogos).map(({ name }) => name);

describe('selectIconPacks', () => {
  it('bundles the generic and the logo sets by default', () => {
    expect(names(true)).toEqual([
      'tabler',
      'lucide',
      'carbon',
      'fluent',
      'flat-color-icons',
      'mdi',
      'logos',
      'simple-icons',
      'devicon'
    ]);
  });

  it('leaves the logo sets out when MERMAID_BUNDLE_LOGOS is false', () => {
    expect(names(false)).toEqual([
      'tabler',
      'lucide',
      'carbon',
      'fluent',
      'flat-color-icons',
      'mdi'
    ]);
  });

  it.each([
    ['tabler', ['server', 'router', 'firewall-check', 'load-balancer']],
    ['lucide', ['server', 'brick-wall-fire', 'hard-drive']],
    ['carbon', ['firewall', 'switch-layer-3', 'load-balancer-network', 'vpn']],
    ['logos', ['aws-lambda', 'microsoft-azure', 'google-cloud']],
    ['simple-icons', ['microsoftazure', 'googlecloud']],
    ['devicon', ['azure', 'microsoftsqlserver']]
  ])(
    'loads %s locally, logos included by default',
    async (name, icons) => {
      const pack = selectIconPacks(true).find((candidate) => candidate.name === name);
      if (!pack) throw new Error(`no pack ${name}`);
      const json = await pack.loader();
      expect(json.prefix).toBe(name);
      for (const icon of icons) {
        expect(json.icons, `${name}:${icon}`).toHaveProperty(icon);
      }
    },
    30_000
  );

  it.each(['tabler', 'mdi', 'carbon'])(
    'strips the brand icons mixed into %s when logos are off',
    async (name) => {
      const pack = selectIconPacks(false).find((candidate) => candidate.name === name);
      if (!pack) throw new Error(`no pack ${name}`);
      const json = await pack.loader();
      const all = [...Object.keys(json.icons), ...Object.keys(json.aliases ?? {})];
      expect(all.filter((icon) => isBrandIcon(icon))).toEqual([]);
      expect(json.icons).toHaveProperty(
        'server' in json.icons ? 'server' : Object.keys(json.icons)[0]
      );
    },
    30_000
  );
});

describe('isBrandIcon', () => {
  it('flags brand icons by prefix or by a trademark word, not by substrings', () => {
    expect(isBrandIcon('brand-aws')).toBe(true);
    expect(isBrandIcon('logo-vmware')).toBe(true);
    expect(isBrandIcon('github')).toBe(true);
    expect(isBrandIcon('ibm-cloud-hpc')).toBe(true);
    expect(isBrandIcon('server')).toBe(false);
    expect(isBrandIcon('pocket-knife')).toBe(false);
  });
});
