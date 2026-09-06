# Running the build on Linux and Windows

The production runner may be Windows, so every step the build and deploy path
takes has to behave identically on both. The rule this repository follows is:
**anything CI runs is either a package-manager invocation or a Node script.**
No shell builtins, no Unix-only commands, no shell operators beyond `&&` between
whole commands.

## What CI runs

```
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm build
pnpm build:pages
```

Those four lines run unchanged on cmd.exe, PowerShell and sh.

`pnpm build:pages` (`scripts/prepare-pages.js`) replaces what used to be
`mv docs public`. SvelteKit writes to `docs/` (see `svelte.config.js`) while
GitLab Pages serves `public/`; `mv` does not exist on cmd.exe, whereas Node's
`renameSync` behaves the same everywhere. The script also removes a stale
`public/` first, because CI workspaces are reused.

`.gitlab-ci.yml` carries a commented Windows variant. Only two keys differ:
`image:` applies to Linux Docker executors only, so a Windows shell runner drops
it and takes Node from the runner itself, plus a `tags:` entry to select that
runner.

## Line endings

`.gitattributes` sets `* text=auto eol=lf`. Without it, Git for Windows checks
files out as CRLF by default (`core.autocrlf=true`), and:

- `pnpm lint` fails on **every** file, because Prettier's `endOfLine` defaults
  to `lf`;
- `.husky/pre-commit` and `scripts/update-upstream.sh` break, because bash
  rejects the carriage returns.

Adding it produced no diff in the existing tree — the repository was already LF —
so it only constrains future checkouts.

## postinstall

Upstream's `postinstall` was:

```
(husky install || true) && svelte-kit sync && (git config … || true)
```

`true` is not a command on Windows. The guards existed precisely for installing
the published tarball, which ships no `.git` — so on Windows the fallback failed
and took `npm install` down with it, in exactly the case it was written for.

It is now the same chain with each `|| true` replaced by
`|| node -e "process.exit(0)"`. Node is already a hard dependency and behaves
identically on both platforms, so the guard no longer depends on a Unix builtin;
`svelte-kit sync` stays unguarded and fails the install, as it should.

**`scripts/postinstall.js` is in the tree but nothing invokes it.** An earlier
version of this work routed `postinstall` through that wrapper; `eafb559` chose
the inline form instead and the file was left behind. Until that is resolved it
is a decoy: editing it changes nothing. Do not debug it expecting `npm install`
to run it.

## A trap worth knowing about

`vite.embed.config.js` sets `outDir: 'static'` and, having no SvelteKit plugin,
used to inherit Vite's default `publicDir` of `public`. Once `pnpm build:pages`
creates `public/`, the next build copied the **entire generated site** into the
tracked `static/` directory, and the build after that shipped it — growing on
every CI run and dirtying the working tree. The config now sets
`publicDir: false`; the embed bundle is a single library entry with no public
assets. `public/` is also gitignored.

## `dev:force`, and a judgement that was overruled

`dev:force` was `MERMAID_LOCAL=true pnpm dev --force`. Inline environment
assignment is POSIX-shell syntax and fails on cmd.exe, so the script was broken on
Windows like the others — but this document argued for leaving it alone, on the
grounds that `MERMAID_LOCAL` is read by nothing in the repository, making the
script equivalent to `pnpm dev --force`, which a Windows developer could run
instead.

An adversarial review rejected that, and was right to. The premise held — nothing
reads `MERMAID_LOCAL` even now — but the conclusion did not follow: a developer who
runs the script the project documents gets a failure, and "there is an equivalent
command you could have run instead" is no help to someone who did not know that.
Every entry point a developer or CI runs to build, test or package this project was
made to work on Windows; leaving one of those broken is a worse outcome than one more
small local file. (`scripts/update-upstream.sh` is the deliberate exception — it is a
maintenance script for importing upstream, is Bash-only, and `UPSTREAM.md` sends
Windows users to WSL for it.)

`dev:force` is now `node scripts/dev-force.js`, which spawns the package manager
through `process.execPath` and passes `MERMAID_LOCAL` in the child's environment.
It runs on cmd.exe, PowerShell and sh alike.

The general lesson, since this document exists to record them: "a broken thing has
a working equivalent" is not a reason to leave it broken. It only relocates the
cost onto whoever hits it first.

## Verified

On Linux, Node 24.16.0:

- `pnpm build && pnpm build:pages` run twice in the same workspace — stable
  27 MB `public/` both times, `static/` untouched.
- npm tarball round trip — `npm install` from the extracted package exits 0 with
  no `.git` present, `git config` skipping gracefully; `npm run build` and
  `npm run build:pages` then produce `public/` with all three legal files.
- `git clean` plus a single build confirms a clean build does not write into
  `static/`; injecting a canary file into `public/` reproduced the old leak and
  confirmed `publicDir: false` stops it.

The Windows half is reasoned from the mechanisms above, not executed — there is
no Windows host in the development environment. The claims that rest on this are
narrow: `spawnSync(command, { shell: true })` resolves `node_modules/.bin`
`.cmd` shims on Windows, and `renameSync`/`rmSync` are platform-neutral. **Run
the pipeline once on the real runner before relying on it.**
