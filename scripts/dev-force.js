import { spawnSync } from 'node:child_process';

const packageManagerPath = process.env.npm_execpath;

if (!packageManagerPath) {
  console.error('Unable to identify the package manager. Run this with "npm run dev:force".');
  process.exit(1);
}

const result = spawnSync(process.execPath, [packageManagerPath, 'run', 'dev', '--', '--force'], {
  env: { ...process.env, MERMAID_LOCAL: 'true' },
  stdio: 'inherit'
});

if (result.error) {
  console.error(`Unable to start the development server: ${result.error.message}`);
  process.exitCode = 1;
} else if (result.signal) {
  console.error(`Development server stopped by signal ${result.signal}.`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
