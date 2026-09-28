/**
 * Check that the documented local delta matches the repository.
 *
 * docs-dev/UPSTREAM.md records every path this fork changes relative to the
 * pristine upstream snapshot (`vendorBaseCommit` in .upstream-version.json),
 * and which package.json keys it replaces or adds; docs-dev/STATUS.md repeats
 * the path count. Keeping them in step by hand has failed repeatedly — an entry
 * regenerated before the last edit, a status letter that flipped from A to M, a
 * package.json key nobody listed. This script does the comparison instead.
 *
 * Run it last, after every other edit (tracked changes need not be committed;
 * untracked files are reported, since git diff cannot see them):
 *
 *   node scripts/check-local-delta.js
 *
 * Exits 1 on any mismatch. Node-only, so it runs the same on Windows.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const read = (path) => readFileSync(path, 'utf8');

const { vendorBaseCommit } = JSON.parse(read('.upstream-version.json'));
const upstreamDoc = read('docs-dev/UPSTREAM.md');
const statusDoc = read('docs-dev/STATUS.md');
const problems = [];

// --- the path inventory -----------------------------------------------------
const letter = { A: 'Added', D: 'Deleted', M: 'Modified' };
const actual = new Set(
  git('diff', '--name-status', '--no-renames', vendorBaseCommit)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t');
      return `${letter[status[0]] ?? status} ${path}`;
    })
);
const documented = new Set(
  [...upstreamDoc.matchAll(/^\| (Modified|Added|Deleted) +\| `([^`]+)`/gm)].map(
    ([, status, path]) => `${status} ${path}`
  )
);
for (const entry of actual) {
  if (!documented.has(entry)) problems.push(`inventory: missing row  "${entry}"`);
}
for (const entry of documented) {
  if (!actual.has(entry)) problems.push(`inventory: stale row    "${entry}"`);
}

const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
for (const path of untracked) {
  problems.push(`untracked file (git diff cannot see it; add it first): ${path}`);
}

const statedCount = /currently \*\*(\d+)\*\*/.exec(statusDoc)?.[1];
if (Number(statedCount) !== documented.size) {
  problems.push(
    `STATUS.md says the inventory has ${statedCount} paths; the table has ${documented.size}`
  );
}

// --- package.json keys ------------------------------------------------------
const upstream = JSON.parse(git('show', `${vendorBaseCommit}:package.json`));
const current = JSON.parse(read('package.json'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const differs = (from, to) =>
  Object.keys(to).filter((key) => !(key in from) || !same(from[key], to[key]));

// Dependency versions are covered by their own rule in UPSTREAM.md (keep the
// higher version), so only the other keys, and individual scripts, must be listed.
const containers = new Set(['dependencies', 'devDependencies', 'scripts']);
const changedKeys = [
  ...differs(upstream, current).filter((key) => !containers.has(key)),
  ...differs(upstream.scripts ?? {}, current.scripts ?? {})
];
const listed = new Set(
  [...upstreamDoc.matchAll(/^- \*\*(?:Replaced|Added)\*\*[^\n]*(?:\n {2}[^\n]*)*/gm)].flatMap(
    ([bullet]) => [...bullet.matchAll(/`([^`]+)`/g)].map(([, name]) => name)
  )
);
for (const key of changedKeys) {
  if (!listed.has(key))
    problems.push(`package.json: "${key}" differs from upstream but is not listed`);
}

// --- report -----------------------------------------------------------------
if (problems.length > 0) {
  console.error(`Local delta does not match the documentation (base ${vendorBaseCommit}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `Local delta matches: ${documented.size} paths, ${changedKeys.length} package.json keys listed.`
);
