import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
// The build-time importer (scripts/fetch-icon-packs.js) that turns a vendor's
// official icon archive into a pack in the build; see docs-dev/ICONS.md.
import {
  fetchIconPacks,
  inlineStyles,
  readZip,
  toVendorIconName
} from '../../../scripts/fetch-icon-packs.js';
import { sanitizeIconSet } from './customIcons';

/** A minimal zip archive: one local header + data per file, then the central directory. */
const zip = (files: Record<string, string>, deflate = true): Buffer => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text);
    const data = deflate ? deflateRawSync(raw) : raw;
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04_03_4b_50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02_01_4b_50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
};

const svg = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="${fill}" d="M0 0h64v64H0z"/></svg>`;

describe('scripts/fetch-icon-packs.js', () => {
  it('reads stored and deflated zip entries', () => {
    for (const deflate of [true, false]) {
      const entries = readZip(zip({ 'a/b.svg': '<svg/>', 'c.txt': 'x' }, deflate));
      expect(entries.map(({ name, data }) => [name, data.toString()])).toEqual([
        ['a/b.svg', '<svg/>'],
        ['c.txt', 'x']
      ]);
    }
  });

  it.each([
    ['Architecture-Service-Icons/Arch_Compute/64/Arch_Amazon-EC2_64.svg', 'amazon-ec2'],
    ['Resource-Icons/Res_Compute/Res_Amazon-EC2_Instance_48_Light.svg', 'amazon-ec2-instance'],
    ['Icons/networking/10061-icon-service-Virtual-Networks.svg', 'virtual-networks'],
    ['workflows/workflows.svg', 'workflows'],
    ['cloud_sql/cloud_sql.svg', 'cloud-sql']
  ])('names %s as %s', (path, name) => {
    expect(toVendorIconName(path)).toBe(name);
  });

  it('inlines class styles, so icons in one diagram do not restyle each other', () => {
    const text =
      '<svg viewBox="0 0 24 24"><defs><style>.cls-1{fill:#4285f4;}.cls-2,.cls-3{fill:none;fill-rule:evenodd;}</style></defs><path class="cls-1" d="M0 0"/><path class="cls-2" d="M1 1"/></svg>';
    const out = inlineStyles(text);
    expect(out).not.toContain('<style');
    expect(out).not.toContain('class=');
    expect(out).toContain('<path fill="#4285f4" d="M0 0"/>');
    expect(out).toContain('<path fill="none" fill-rule="evenodd" d="M1 1"/>');
  });

  it('writes one pack per archive, preferring the largest light variant of an icon', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fetch-icon-packs-'));
    const archive = join(dir, 'aws.zip');
    writeFileSync(
      archive,
      zip({
        'Arch/16/Arch_Amazon-EC2_16.svg': svg('#111111'),
        'Arch/32/Arch_Amazon-EC2_32.svg': svg('#323232'),
        'Arch/64/Arch_Amazon-EC2_64.png': 'png',
        'Arch/64/Arch_Amazon-EC2_64.svg': svg('#646464'),
        'Res/Res_Amazon-S3_48_Dark.svg': svg('#000000'),
        'Res/Res_Amazon-S3_48_Light.svg': svg('#ffffff'),
        '__MACOSX/Arch/._Arch_Amazon-EC2_64.svg': 'junk'
      })
    );
    const out = join(dir, 'packs');
    const written = await fetchIconPacks(`aws=${archive}`, out);

    expect(written).toEqual([{ count: 2, prefix: 'aws' }]);
    const pack = JSON.parse(readFileSync(join(out, 'aws.json'), 'utf8'));
    expect(pack.prefix).toBe('aws');
    expect(pack.icons['amazon-ec2'].body).toContain('#646464');
    expect(pack.icons['amazon-s3'].body).toContain('#ffffff');
    expect(Object.keys(sanitizeIconSet(pack).icons)).toEqual(['amazon-ec2', 'amazon-s3']);
  });

  it('does nothing without MERMAID_FETCH_ICON_PACKS', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'fetch-icon-packs-')), 'packs');
    expect(await fetchIconPacks('', out)).toEqual([]);
    expect(existsSync(out)).toBe(false);
  });
});
