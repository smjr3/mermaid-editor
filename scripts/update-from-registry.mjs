/**
 * Update a copy of @smjr3/mermaid-editor from an npm registry and rebuild the static site.
 *
 * Runs the flow documented in docs-dev/PACKAGING.md ("Rebuild the static site from the
 * package") into a target directory, with Node builtins and npm only. No tar, curl, rm or
 * cp is needed, so it behaves the same on Windows, Linux and macOS.
 *
 *   node scripts/update-from-registry.mjs [--version <x.y.z|latest>] [--registry <url>]
 *                                         [--dir <path>] [--no-build] [--keep-lock]
 *   node scripts/update-from-registry.mjs --tarball <file.tgz|directory> [--dir <path>] ...
 *
 * `--tarball` skips the download and uses a tarball already on disk — `npm pack` of a
 * checkout, as CI does to build the commit under review (job `build-from-head` in
 * .github/workflows/fork-checks.yml) — or the one `.tgz` in a directory.
 *
 * Credentials for a registry that needs them come from the user's own .npmrc; this script
 * never reads or passes a token.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const PACKAGE = '@smjr3/mermaid-editor';
export const REQUIRED_OUTPUTS = ['index.html', 'edit.html', 'view.html', '_app'];

export class StepError extends Error {
  constructor(step, detail) {
    super(`error in step "${step}": ${detail}`);
    this.step = step;
  }
}

export function parseArgs(argv) {
  const options = {
    build: true,
    dir: join('.', 'mermaid-editor-build'),
    keepLock: false,
    registry: undefined,
    tarball: undefined,
    version: 'latest'
  };
  let versionGiven = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const [flag, inline] = eq > 0 ? [arg.slice(0, eq), arg.slice(eq + 1)] : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new StepError('arguments', `${flag} needs a value`);
      }
      i++;
      return next;
    };
    switch (flag) {
      case '--version':
        options.version = value();
        versionGiven = true;
        break;
      case '--tarball':
        options.tarball = value();
        break;
      case '--registry':
        options.registry = value();
        break;
      case '--dir':
        options.dir = value();
        break;
      case '--no-build':
        options.build = false;
        break;
      case '--keep-lock':
        options.keepLock = true;
        break;
      default:
        throw new StepError('arguments', `unknown option ${arg}`);
    }
  }
  if (!/^[\w.\-+^~<>=*]+$/.test(options.version)) {
    throw new StepError('arguments', `invalid --version "${options.version}"`);
  }
  if (options.tarball !== undefined) {
    if (versionGiven || options.registry !== undefined) {
      throw new StepError('arguments', '--tarball cannot be combined with --version or --registry');
    }
    options.tarball = resolve(options.tarball);
  }
  options.dir = resolve(options.dir);
  return options;
}

/** The tarball to extract: `path` itself, or the only `.tgz` in the directory `path`. */
export function findTarball(path, step = 'download') {
  if (!existsSync(path)) throw new StepError(step, `${path} does not exist`);
  if (!statSync(path).isDirectory()) return path;
  const tarballs = readdirSync(path).filter((name) => name.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new StepError(step, `expected one .tgz in ${path}, found ${tarballs.length}`);
  }
  return join(path, tarballs[0]);
}

/** Names from REQUIRED_OUTPUTS that are missing under `<dir>/docs`. */
export function missingOutputs(dir) {
  return REQUIRED_OUTPUTS.filter((name) => !existsSync(join(dir, 'docs', name)));
}

/**
 * Entries of a (decompressed) tar archive: { path, type, data }. Reads ustar, the ustar
 * `prefix` field and pax `path` records, which is what `npm pack` writes.
 */
export function readTar(buffer) {
  const entries = [];
  const text = (start, length) => {
    const slice = buffer.subarray(start, start + length);
    const end = slice.indexOf(0);
    return slice.toString('utf8', 0, end === -1 ? length : end);
  };
  let pax = {};
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    if (buffer.subarray(offset, offset + 512).every((byte) => byte === 0)) break;
    const size = Number.parseInt(text(offset + 124, 12).trim() || '0', 8);
    const type = text(offset + 156, 1) || '0';
    const prefix = text(offset + 345, 155);
    const name = text(offset, 100);
    const data = buffer.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (offset > buffer.length + 511) throw new Error('truncated tar archive');
    if (type === 'x') {
      for (const m of data.toString('utf8').matchAll(/\d+ ([^=]+)=([^\n]*)\n/g)) pax[m[1]] = m[2];
      continue;
    }
    if (type === 'g') continue;
    entries.push({ data, path: pax.path ?? (prefix ? `${prefix}/${name}` : name), type });
    pax = {};
  }
  return entries;
}

/** Write the regular files of a package tarball into `dir`, dropping the leading `package/`. */
export function extractTarball(tgz, dir) {
  const root = resolve(dir) + sep;
  let count = 0;
  for (const { data, path, type } of readTar(gunzipSync(tgz))) {
    if (type !== '0' && type !== '7') continue; // regular files only
    const parts = path.split('/').filter(Boolean).slice(1);
    if (parts.length === 0) continue;
    const target = resolve(dir, ...parts);
    if (!target.startsWith(root) || parts.includes('..')) {
      throw new Error(`unsafe path in archive: ${path}`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    count++;
  }
  return count;
}

const quote = (arg) => (/^[\w\-.:\\/@=+^~]+$/.test(arg) ? arg : `"${arg.replaceAll('"', '\\"')}"`);

/** Run a command; on Windows through the shell so `npm` resolves to npm.cmd. */
function run(step, cmd, args, cwd) {
  const shown = [cmd, ...args].join(' ');
  console.log(`\n> [${step}] ${shown}`);
  // One command string on Windows: Node warns (DEP0190) when shell:true gets an args array.
  const result =
    process.platform === 'win32'
      ? spawnSync([cmd, ...args.map(quote)].join(' '), { cwd, shell: true, stdio: 'inherit' })
      : spawnSync(cmd, args, { cwd, shell: false, stdio: 'inherit' });
  if (result.error) {
    throw new StepError(step, `could not run \`${shown}\`: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new StepError(step, `\`${shown}\` exited with ${result.status ?? result.signal}`);
  }
}

export function main(argv) {
  const options = parseArgs(argv);
  const { dir } = options;
  const spec = `${PACKAGE}@${options.version}`;
  const scratch = mkdtempSync(join(tmpdir(), 'mermaid-editor-pack-'));
  const started = Date.now();
  try {
    // 1. download (or the local tarball)
    let tarball;
    if (options.tarball) {
      tarball = findTarball(options.tarball, 'tarball');
      console.log(`\n> [tarball] ${tarball} (no download)`);
    } else {
      const packArgs = ['pack', spec, '--pack-destination', scratch];
      if (options.registry) packArgs.push('--registry', options.registry);
      run('download', 'npm', packArgs, scratch);
      tarball = findTarball(scratch);
    }

    // 2. extract
    const lock = join(dir, 'package-lock.json');
    mkdirSync(dir, { recursive: true });
    rmSync(join(dir, 'docs'), { force: true, recursive: true });
    if (!options.keepLock) rmSync(lock, { force: true });
    console.log(`\n> [extract] ${tarball} -> ${dir}`);
    let files;
    try {
      files = extractTarball(readFileSync(tarball), dir);
    } catch (error) {
      throw new StepError('extract', `${tarball}: ${error.message}`);
    }
    const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;

    // 3. install and build
    if (options.build) {
      const useCi = options.keepLock && existsSync(lock);
      run('install', 'npm', [useCi ? 'ci' : 'install', '--no-audit', '--no-fund'], dir);
      run('build', 'npm', ['run', 'build'], dir);
      const missing = missingOutputs(dir);
      if (missing.length > 0) {
        throw new StepError('verify', `${join(dir, 'docs')} is missing: ${missing.join(', ')}`);
      }
    }

    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`\nDone in ${seconds}s.`);
    if (options.tarball) {
      console.log(`  package:   ${PACKAGE} ${version} (from ${tarball})`);
    } else {
      console.log(`  package:   ${PACKAGE} ${version} (requested ${options.version})`);
      console.log(`  registry:  ${options.registry ?? '(npm configured registry)'}`);
    }
    console.log(`  directory: ${dir} (${files} files extracted)`);
    console.log(
      options.build
        ? `  site:      ${join(dir, 'docs')} (${REQUIRED_OUTPUTS.join(', ')} present)`
        : '  build skipped (--no-build)'
    );
    console.log(
      existsSync(lock)
        ? `  lockfile:  ${lock} (commit it; use \`npm ci\` next time with --keep-lock)`
        : '  lockfile:  none'
    );
  } finally {
    rmSync(scratch, { force: true, recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof StepError ? error.message : `error: ${error.message}`);
    process.exit(1);
  }
}
