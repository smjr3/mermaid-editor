import { describe, expect, it } from 'vitest';
import { iconPacks } from './iconPacks';

describe('iconPacks', () => {
  it('offers the cloud, brand and generic packs under their Iconify prefixes', () => {
    expect(iconPacks.map(({ name }) => name)).toEqual(['logos', 'simple-icons', 'mdi']);
  });

  it.each([
    ['logos', ['aws', 'aws-lambda', 'aws-s3', 'microsoft-azure', 'google-cloud', 'kubernetes']],
    [
      'simple-icons',
      ['microsoftazure', 'googlecloud', 'amazons3', 'azurefunctions', 'googlebigquery']
    ],
    ['mdi', ['server', 'database', 'cloud']]
  ])('loads %s locally with the icons a diagram is likely to name', async (name, icons) => {
    const pack = iconPacks.find((candidate) => candidate.name === name);
    if (!pack) throw new Error(`no pack ${name}`);
    const json = await pack.loader();
    expect(json.prefix).toBe(name);
    for (const icon of icons) {
      expect(json.icons, `${name}:${icon}`).toHaveProperty(icon);
    }
  });
});
