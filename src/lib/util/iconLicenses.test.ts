import { describe, expect, it } from 'vitest';
import { iconPacks } from './iconPacks';
import { iconLicense, packLicenses } from './iconLicenses';
import { standardPrefix } from './standardIcons';

describe('icon licences', () => {
  it('lists every bundled pack and the standard icons', () => {
    const listed = new Set(packLicenses.map((pack) => pack.prefix));
    for (const { name } of iconPacks) expect(listed.has(name), name).toBe(true);
    expect(listed.has(standardPrefix)).toBe(true);
  });

  it('gives every pack a licence, a holder and links', () => {
    for (const pack of packLicenses) {
      expect(pack.license, pack.prefix).toMatch(/^(MIT|ISC|Apache-2\.0|CC0-1\.0)$/);
      expect(pack.holder, pack.prefix).not.toBe('');
      expect(pack.url, pack.prefix).toMatch(/^https:\/\//);
      expect(pack.licenseUrl, pack.prefix).toMatch(/^https:\/\//);
    }
  });

  it('describes a bundled icon by its pack', () => {
    expect(iconLicense('tabler:server')).toMatchObject({
      license: 'MIT',
      prefix: 'tabler',
      trademark: false
    });
  });

  it('describes the networking and Microsoft-style packs', () => {
    expect(iconLicense('clarity:router-line')).toMatchObject({ license: 'MIT', trademark: false });
    expect(iconLicense('eos-icons:dns')).toMatchObject({ license: 'MIT', trademark: false });
    expect(iconLicense('fluent-color:mail-48')).toMatchObject({
      holder: 'Microsoft Corporation',
      license: 'MIT',
      trademark: false
    });
  });

  it('marks logos and brand icons as trademarks', () => {
    expect(iconLicense('logos:aws-lambda')?.trademark).toBe(true);
    expect(iconLicense('simple-icons:github')?.trademark).toBe(true);
    expect(iconLicense('devicon:postgresql')?.trademark).toBe(true);
    expect(iconLicense('tabler:brand-github')?.trademark).toBe(true);
    expect(iconLicense('mdi:microsoft-azure')?.trademark).toBe(true);
    expect(iconLicense('mdi:server')?.trademark).toBe(false);
  });

  it('knows the standard mermaid icons', () => {
    expect(iconLicense('server')).toMatchObject({ license: 'MIT', prefix: standardPrefix });
    expect(iconLicense(`${standardPrefix}:cloud`)?.prefix).toBe(standardPrefix);
  });

  it('has nothing to say about vendor or imported packs', () => {
    expect(iconLicense('aws:lambda')).toBeUndefined();
    expect(iconLicense('corp:firewall')).toBeUndefined();
  });
});
