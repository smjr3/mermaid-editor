/**
 * Move the built site to the directory GitLab Pages publishes from.
 *
 * SvelteKit's adapter-static writes to `docs/` (see svelte.config.js), while
 * GitLab Pages serves `public/`. CI used to bridge that with `mv docs public`,
 * which does not exist on a Windows runner's cmd.exe. Node renames identically
 * on every platform.
 */
import { existsSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const buildOutput = resolve('docs');
const pagesDirectory = resolve('public');

if (!existsSync(buildOutput)) {
  console.error(`prepare-pages: ${buildOutput} does not exist. Run the build before this script.`);
  process.exit(1);
}

// CI workspaces are reused, so a previous run's output may still be here.
if (existsSync(pagesDirectory)) {
  rmSync(pagesDirectory, { recursive: true, force: true });
}

renameSync(buildOutput, pagesDirectory);
console.log(`prepare-pages: ${buildOutput} -> ${pagesDirectory}`);
