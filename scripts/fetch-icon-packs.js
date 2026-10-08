/**
 * Import vendors' official icon sets into the build, at build time:
 *
 *   MERMAID_FETCH_ICON_PACKS='gcp=https://…/google-cloud-icons.zip,aws=./aws-icons.zip' pnpm build
 *
 * Each `prefix=source` pair names a zip archive (URL or local path) or a local
 * folder of SVG files. The SVGs become an Iconify pack in src/lib/vendor-icons/
 * (gitignored), which the app bundles as a lazily loaded chunk under that
 * prefix (`gcp:cloud-sql`). Nothing is fetched without the variable, so the
 * repository and the npm package never carry these icons: whoever builds
 * downloads them from the vendor, under the vendor's terms, and hosts them on
 * their own site. See docs-dev/ICONS.md.
 *
 * Icon names come from file names: AWS's `Arch_`/`Res_` prefixes and size and
 * Light/Dark suffixes and Azure's `12345-icon-service-` prefix are dropped;
 * of several variants of one icon the largest light one is kept. The app
 * sanitises every icon when it loads the pack.
 *
 * Node-only and dependency-free, so it runs the same on Windows.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { convertSvgDirectory, inlineStyles, parseSvg } from './svg-to-iconify.js';

export { inlineStyles };

export const outputDir = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/vendor-icons');

const slug = (/** @type {string} */ value) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

const namePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The entries of a zip archive (stored or deflated; no zip64).
 * @param {Buffer} buffer
 * @returns {{ name: string, data: Buffer }[]}
 */
export const readZip = (buffer) => {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06_05_4b_50) end--;
  if (end < 0) throw new Error('Not a zip archive');
  const count = buffer.readUInt16LE(end + 10);
  let position = buffer.readUInt32LE(end + 16);
  const entries = [];
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(position) !== 0x02_01_4b_50) throw new Error('Corrupt zip archive');
    const method = buffer.readUInt16LE(position + 10);
    const size = buffer.readUInt32LE(position + 20);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const offset = buffer.readUInt32LE(position + 42);
    const name = buffer.toString('utf8', position + 46, position + 46 + nameLength);
    position += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/') || (method !== 0 && method !== 8)) continue;
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const raw = buffer.subarray(start, start + size);
    entries.push({ data: method === 8 ? inflateRawSync(raw) : raw, name });
  }
  return entries;
};

const variantPattern = /-(\d+)(?:-(light|dark))?$|-(light|dark)$/;

/** An icon name from a path inside a vendor archive. */
export const toVendorIconName = (/** @type {string} */ path) =>
  slug(path.replace(/^.*[\\/]/, '').replace(/\.svg$/i, ''))
    .replace(/^\d+-icon-service-/, '')
    .replace(/^(arch-category|arch|res)-/, '')
    .replace(variantPattern, '');

/** Higher for the variant to keep: larger, and light over dark. */
const rank = (/** @type {string} */ path) => {
  const match = variantPattern.exec(slug(path.replace(/^.*[\\/]/, '').replace(/\.svg$/i, '')));
  const size = Number(match?.[1] ?? 0);
  return (/dark/.test(match?.[2] ?? match?.[3] ?? '') ? 0 : 10_000) + size;
};

/**
 * @param {{ name: string, data: Buffer }[]} entries
 * @param {string} prefix
 */
const packFromZip = (entries, prefix) => {
  /** @type {Map<string, { rank: number, icon: { body: string, width: number, height: number } }>} */
  const chosen = new Map();
  for (const { name: path, data } of entries) {
    const base = path.replace(/^.*\//, '');
    if (!/\.svg$/i.test(base) || base.startsWith('._') || path.startsWith('__MACOSX/')) continue;
    const name = toVendorIconName(path);
    const icon = parseSvg(data.toString('utf8'));
    const score = rank(path);
    if (!icon || !namePattern.test(name)) continue;
    if ((chosen.get(name)?.rank ?? -1) < score) chosen.set(name, { icon, rank: score });
  }
  const icons = Object.fromEntries(
    [...chosen].sort(([a], [b]) => a.localeCompare(b)).map(([name, { icon }]) => [name, icon])
  );
  return { icons, prefix };
};

/** @param {string} source */
const readSource = async (source) => {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  return readFileSync(source);
};

/**
 * The list of pack files the last run wrote, kept beside them. Not `*.json`, so
 * the app's `import.meta.glob('../vendor-icons/*.json')` never takes it for a pack.
 */
export const manifestName = '.fetch-icon-packs.manifest';

const packFile = /^[a-z0-9]+(-[a-z0-9]+)*\.json$/;

/**
 * Remove the packs an earlier run generated, as its manifest lists them, and the
 * manifest. Only plain `prefix.json` names directly in `out` are removed, so a
 * file someone put there by hand, or a tampered manifest, never costs anything else.
 * @param {string} out
 */
const removeGenerated = (out) => {
  const manifest = join(out, manifestName);
  if (!existsSync(manifest)) return;
  /** @type {unknown} */
  let listed;
  try {
    listed = JSON.parse(readFileSync(manifest, 'utf8')).files;
  } catch {
    listed = [];
  }
  for (const file of Array.isArray(listed) ? listed : []) {
    if (typeof file === 'string' && packFile.test(file)) rmSync(join(out, file), { force: true });
  }
  rmSync(manifest, { force: true });
};

/**
 * Build the packs that `value` (MERMAID_FETCH_ICON_PACKS) names into `out`.
 * The packs an earlier run generated are removed first — also when `value` is
 * empty, so a build without the variable carries no vendor pack from before.
 * Files the script did not write are left alone.
 * @param {string | undefined} value
 * @param {string} [out]
 */
export const fetchIconPacks = async (value, out = outputDir) => {
  const pairs = (value ?? '')
    .split(',')
    .map((entry) => entry.split('='))
    .filter((parts) => parts.length >= 2)
    .map(([prefix, ...source]) => ({ prefix: slug(prefix), source: source.join('=').trim() }))
    .filter(({ prefix, source }) => namePattern.test(prefix) && source);
  removeGenerated(out);
  if (pairs.length === 0) return [];
  mkdirSync(out, { recursive: true });
  const written = [];
  /** @type {string[]} */
  const files = [];
  const record = () =>
    writeFileSync(join(out, manifestName), `${JSON.stringify({ files }, undefined, 2)}\n`);
  for (const { prefix, source } of pairs) {
    const pack =
      !/^https?:\/\//i.test(source) && existsSync(source) && statSync(source).isDirectory()
        ? convertSvgDirectory(source, prefix)
        : packFromZip(readZip(await readSource(source)), prefix);
    const count = Object.keys(pack.icons).length;
    if (count === 0) throw new Error(`${prefix}: no SVG icons in ${source}`);
    writeFileSync(join(out, `${prefix}.json`), JSON.stringify(pack));
    // Recorded at once, so a later source that fails still leaves this one known.
    files.push(`${prefix}.json`);
    record();
    written.push({ count, prefix });
  }
  return written;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    for (const { count, prefix } of await fetchIconPacks(process.env.MERMAID_FETCH_ICON_PACKS)) {
      console.log(`icon pack "${prefix}": ${count} icons`);
    }
  } catch (error) {
    console.error(`fetch-icon-packs: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
