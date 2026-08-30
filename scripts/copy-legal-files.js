import { copyFileSync } from 'node:fs';

const legalFiles = ['LICENSE', 'NOTICE', 'THIRD-PARTY-LICENSES.md'];

for (const legalFile of legalFiles) {
  copyFileSync(legalFile, `static/${legalFile}`);
}
