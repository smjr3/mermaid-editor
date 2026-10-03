import { describe, expect, it } from 'vitest';
import { iconPacks } from './iconPacks';

describe('iconPacks', () => {
  it('offers the cloud, brand and generic packs under their Iconify prefixes', () => {
    expect(iconPacks.map(({ name }) => name)).toEqual([
      'logos',
      'simple-icons',
      'devicon',
      'carbon',
      'fluent',
      'flat-color-icons',
      'mdi'
    ]);
  });

  it.each([
    ['logos', ['aws', 'aws-lambda', 'aws-s3', 'microsoft-azure', 'google-cloud', 'kubernetes']],
    [
      'simple-icons',
      ['microsoftazure', 'googlecloud', 'amazons3', 'azurefunctions', 'googlebigquery']
    ],
    ['devicon', ['azure', 'microsoftsqlserver', 'windows11', 'oracle']],
    [
      'carbon',
      ['firewall', 'router', 'switch-layer-3', 'load-balancer-network', 'vpn', 'server-dns']
    ],
    [
      'fluent',
      ['server-24-regular', 'database-24-regular', 'laptop-24-regular', 'shield-24-regular']
    ],
    ['flat-color-icons', ['database', 'multiple-devices', 'conference-call']],
    ['mdi', ['server', 'database', 'cloud']]
  ])(
    'loads %s locally with the icons a diagram is likely to name',
    async (name, icons) => {
      const pack = iconPacks.find((candidate) => candidate.name === name);
      if (!pack) throw new Error(`no pack ${name}`);
      const json = await pack.loader();
      expect(json.prefix).toBe(name);
      for (const icon of icons) {
        expect(json.icons, `${name}:${icon}`).toHaveProperty(icon);
      }
      // The larger packs are several MB of JSON, which vitest transforms on import.
    },
    30_000
  );
});
