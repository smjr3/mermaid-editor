// Run with: node --test scripts/update-from-registry.node-test.mjs
// Not named *.test.* on purpose: vitest's default include would pick that up and fail on it.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { extractTarball, missingOutputs, parseArgs, readTar } from './update-from-registry.mjs';

function tarEntry(path, content, type = '0') {
  const body = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(path.slice(0, 100), 0);
  header.write('0000644\0', 100);
  header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
  header.write(type, 156);
  header.write('ustar\0', 257);
  return Buffer.concat([header, body, Buffer.alloc((512 - (body.length % 512)) % 512)]);
}
const tar = (...entries) => Buffer.concat([...entries, Buffer.alloc(1024)]);

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'mer-test-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

test('parseArgs defaults', () => {
  const o = parseArgs([]);
  assert.equal(o.version, 'latest');
  assert.equal(o.registry, undefined);
  assert.equal(o.build, true);
  assert.equal(o.keepLock, false);
  assert.equal(o.dir, resolve('mermaid-editor-build'));
});

test('parseArgs reads every option, including --flag=value', () => {
  const o = parseArgs([
    '--version',
    '0.2.1',
    '--registry=https://h/r/',
    '--dir',
    'x',
    '--no-build',
    '--keep-lock'
  ]);
  assert.deepEqual(
    [o.version, o.registry, o.build, o.keepLock],
    ['0.2.1', 'https://h/r/', false, true]
  );
  assert.equal(o.dir, resolve('x'));
});

test('parseArgs rejects bad input with the step named', () => {
  assert.throws(() => parseArgs(['--bogus']), /step "arguments".*unknown option/);
  assert.throws(() => parseArgs(['--dir']), /--dir needs a value/);
  assert.throws(() => parseArgs(['--version', '1.0.0 && calc']), /invalid --version/);
});

test('missingOutputs reports what docs/ lacks', () =>
  withTempDir((dir) => {
    assert.equal(missingOutputs(dir).length, 4);
    mkdirSync(join(dir, 'docs', '_app'), { recursive: true });
    for (const f of ['index.html', 'edit.html']) writeFileSync(join(dir, 'docs', f), '');
    assert.deepEqual(missingOutputs(dir), ['view.html']);
    writeFileSync(join(dir, 'docs', 'view.html'), '');
    assert.deepEqual(missingOutputs(dir), []);
  }));

test('readTar applies pax path records and the ustar prefix', () => {
  const long = `package/${'d/'.repeat(80)}f.txt`;
  let record = ` path=${long}\n`;
  record = `${record.length + String(record.length).length}${record}`;
  const entries = readTar(tar(tarEntry('PaxHeader', record, 'x'), tarEntry('short', 'hi')));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].path, long);
  assert.equal(entries[0].data.toString(), 'hi');
});

test('extractTarball strips package/ and writes nested files', () =>
  withTempDir((dir) => {
    const tgz = gzipSync(
      tar(
        tarEntry('package/package.json', '{"version":"1.2.3"}'),
        tarEntry('package/src/a.txt', 'A')
      )
    );
    assert.equal(extractTarball(tgz, dir), 2);
    assert.equal(readFileSync(join(dir, 'src', 'a.txt'), 'utf8'), 'A');
  }));

test('extractTarball refuses path traversal', () =>
  withTempDir((dir) => {
    const tgz = gzipSync(tar(tarEntry('package/../../evil', 'x')));
    assert.throws(() => extractTarball(tgz, dir), /unsafe path/);
  }));
