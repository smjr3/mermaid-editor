/**
 * Cross-platform postinstall.
 *
 * This used to be a shell one-liner using `|| true` to make the optional steps
 * non-fatal. `true` is not a command on Windows, so on cmd.exe the fallback
 * itself failed and took the install down with it — exactly in the case the
 * fallback existed for: installing the published tarball, which has no `.git`.
 *
 * Node behaves the same on every platform, so the optionality lives here instead.
 */
import { spawnSync } from 'node:child_process';

/**
 * @param {string} command
 * @param {{ optional?: boolean }} [options]
 */
function run(command, { optional = false } = {}) {
  // shell: true so npm's node_modules/.bin shims resolve on Windows (.cmd) too.
  const { status } = spawnSync(command, { shell: true, stdio: 'inherit' });
  if (status === 0) {
    return;
  }
  if (optional) {
    console.warn(`postinstall: skipped "${command}" (exit ${status ?? 'signal'}).`);
    return;
  }
  process.exit(status ?? 1);
}

// Optional: absent when installing the published package, which ships no `.git`.
run('husky install', { optional: true });

// Required: generates .svelte-kit, which the build and typecheck both need.
run('svelte-kit sync');

// Optional: a local convenience, and meaningless outside a git checkout.
run('git config blame.ignoreRevsFile .git-blame-ignore-revs', { optional: true });
