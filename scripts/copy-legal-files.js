/**
 * Copy the repository's legal files into static/, from where adapter-static
 * carries them into the build output. The copies are gitignored so they cannot
 * go stale against their sources or against an upstream merge.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const legalFiles = ['LICENSE', 'NOTICE', 'THIRD-PARTY-LICENSES.md'];
const staticDirectory = resolve('static');

// join() rather than a "/" template, so the path is native on Windows too.
mkdirSync(staticDirectory, { recursive: true });
for (const legalFile of legalFiles) {
  copyFileSync(resolve(legalFile), join(staticDirectory, legalFile));
}
