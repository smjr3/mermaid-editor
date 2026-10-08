// Run with: node --test scripts/fetch-icon-packs.node-test.mjs
// Not named *.test.* on purpose: vitest's default include would pick that up.
// R11: what an earlier build generated must not outlive the setting that asked for it.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fetchIconPacks } from './fetch-icon-packs.js';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1"/></svg>';

async function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'fetch-icon-packs-'));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

const svgFolder = (dir, name) => {
  const folder = join(dir, name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'Server.svg'), svg);
  return folder;
};

const packs = (out) =>
  existsSync(out)
    ? readdirSync(out)
        .filter((file) => file.endsWith('.json'))
        .sort()
    : [];

test('an enabled run followed by a disabled one leaves no generated pack behind', async () => {
  await withTempDir(async (dir) => {
    const out = join(dir, 'vendor-icons');
    const written = await fetchIconPacks(`corp=${svgFolder(dir, 'corp')}`, out);
    assert.deepEqual(written, [{ count: 1, prefix: 'corp' }]);
    assert.deepEqual(packs(out), ['corp.json']);

    assert.deepEqual(await fetchIconPacks('', out), []);
    assert.deepEqual(packs(out), []);
  });
});

test('a run with other packs removes the ones the previous run generated', async () => {
  await withTempDir(async (dir) => {
    const out = join(dir, 'vendor-icons');
    await fetchIconPacks(`aaa=${svgFolder(dir, 'a')},bbb=${svgFolder(dir, 'b')}`, out);
    assert.deepEqual(packs(out), ['aaa.json', 'bbb.json']);
    await fetchIconPacks(`bbb=${svgFolder(dir, 'b')}`, out);
    assert.deepEqual(packs(out), ['bbb.json']);
  });
});

test('never deletes a file the script did not generate', async () => {
  await withTempDir(async (dir) => {
    const out = join(dir, 'vendor-icons');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'hand.json'), '{"prefix":"hand","icons":{}}');
    writeFileSync(join(out, 'README.txt'), 'kept');

    await fetchIconPacks(`corp=${svgFolder(dir, 'corp')}`, out);
    assert.deepEqual(packs(out), ['corp.json', 'hand.json']);
    await fetchIconPacks(undefined, out);
    assert.deepEqual(packs(out), ['hand.json']);
    assert.ok(existsSync(join(out, 'README.txt')));
  });
});

test('ignores a manifest entry that is not a generated pack file', async () => {
  await withTempDir(async (dir) => {
    const out = join(dir, 'vendor-icons');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(dir, 'outside.json'), '{}');
    writeFileSync(join(out, 'hand.json'), '{}');
    writeFileSync(
      join(out, '.fetch-icon-packs.manifest'),
      JSON.stringify({ files: ['../outside.json', 'sub/x.json', 42] })
    );
    await fetchIconPacks('', out);
    assert.ok(existsSync(join(dir, 'outside.json')));
    assert.deepEqual(packs(out), ['hand.json']);
  });
});

test('does not create the folder when nothing is configured', async () => {
  await withTempDir(async (dir) => {
    const out = join(dir, 'vendor-icons');
    assert.deepEqual(await fetchIconPacks('', out), []);
    assert.equal(existsSync(out), false);
  });
});
