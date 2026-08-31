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

`postinstall` is `node scripts/postinstall.js` rather than a shell chain. It had
been:

```
(husky install || true) && svelte-kit sync && (git config … || true)
```

`true` is not a command on Windows. The guards existed precisely for installing
the published tarball, which ships no `.git` — so on Windows the fallback failed
and took `npm install` down with it, in exactly the case it was written for.
Node behaves identically on both platforms, so the optionality lives there now:
`husky install` and `git config` are optional and log a skip, `svelte-kit sync`
is required and fails the install.

## A trap worth knowing about

`vite.embed.config.js` sets `outDir: 'static'` and, having no SvelteKit plugin,
used to inherit Vite's default `publicDir` of `public`. Once `pnpm build:pages`
creates `public/`, the next build copied the **entire generated site** into the
tracked `static/` directory, and the build after that shipped it — growing on
every CI run and dirtying the working tree. The config now sets
`publicDir: false`; the embed bundle is a single library entry with no public
assets. `public/` is also gitignored.

## Known Unix-only script, deliberately unchanged

`dev:force` is `MERMAID_LOCAL=true pnpm dev --force`. Inline environment
assignment is POSIX-shell syntax and fails on cmd.exe. It is left as upstream
wrote it because `MERMAID_LOCAL` is read by nothing in this repository
(`git grep MERMAID_LOCAL` matches only that line), so the script is equivalent
to `pnpm dev --force` — which is what a Windows developer should run instead. It
is a developer convenience and never runs on the production runner, so changing
it would add upstream delta for no behavioural gain.

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
