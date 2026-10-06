# Running the build on Linux and Windows

The production runner may be Windows, so every step the build and deploy path
takes has to behave identically on both. The rule this repository follows is:
**every step CI invokes directly is either a package-manager invocation or a Node
script** — no shell builtins, no Unix-only commands, no shell operators beyond
`&&` between whole commands.

One thing sits outside that rule and is called out rather than hidden by it:
`postinstall`, which `pnpm install` triggers rather than CI invoking it, still uses
`||` and parenthesised groups. Both are cmd.exe syntax as well as POSIX syntax, so
the form is believed portable — but **that has not been executed on Windows**, and
the section below says what would settle it.

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

Upstream's `postinstall`, at `vendorBaseCommit`, was:

```
husky install && svelte-kit sync && (git config blame.ignoreRevsFile .git-blame-ignore-revs || true)
```

`true` is not a command on Windows. That one guard existed precisely for installing
the published tarball, which ships no `.git` — so on Windows the fallback failed
and took `npm install` down with it, in exactly the case it was written for.

**Three things changed, not one.** The current value is:

```
(husky || node -e "process.exit(0)") && svelte-kit sync && (git config blame.ignoreRevsFile .git-blame-ignore-revs || node -e "process.exit(0)")
```

1. Upstream's `|| true` became `|| node -e "process.exit(0)"`. Node is already a hard
   dependency and behaves identically on both platforms, so the guard no longer
   depends on a Unix builtin. This is the portability half.
2. **The husky step gained a guard it never had upstream.** That half is not about
   Windows at all. `husky` is a devDependency, so it is absent exactly when this
   package is installed _as a dependency_ — the case publishing to npm creates. With
   no `husky` on `PATH` the shell exits 127 and upstream's `&&` chain aborts before
   `svelte-kit sync`, on every platform. Measured, both forms, `husky` removed from
   `PATH`: upstream's exits 127 and never reaches the next command; this one
   continues and exits 0.

   The guard is **not** for a missing `.git`, which is the intuitive reading and is
   wrong: husky 9.1.7 — the version pinned both here and at `vendorBaseCommit` —
   prints `.git can't be found` and still exits 0. If the pin ever moves to a husky
   that exits non-zero there, this guard starts covering that case too, but today it
   does not.

3. **`husky install` became `husky`.** husky 9 deprecated the `install` subcommand and
   prints a warning on every install; husky 10 removes it. Measured on 9.1.7, bare
   `husky` sets `core.hooksPath` to `.husky/_` exactly as `husky install` did, and
   outside a git worktree it likewise prints `.git can't be found` and exits 0. The same
   move dropped the two lines husky 9 flags as failing in v10 from `.husky/pre-commit`
   (the `#!/usr/bin/env sh` shebang and the sourcing of `_/husky.sh`); the hook is now
   just `pnpm pre-commit`.

`svelte-kit sync` stays unguarded and fails the install, as it should — it generates
`.svelte-kit`, which the build and the typecheck both need.

Reconstructing this during an upstream merge as "take their line and replace the
`|| true`" restores an unguarded husky step and breaks installs of the published
package. Take the whole line, and note that a future upstream may add its own guard
there, in which case only change (1) remains local.

This is the one place the rule at the top of this document is bent. `||` and
parenthesised groups are valid in cmd.exe as well as in POSIX shells, so the chain
should work — but "should" is doing real work in that sentence, and unlike the rest
of this document it is **not backed by an execution**. Running `pnpm install` once
on the Windows runner settles it; until then treat the postinstall path as the
weakest Windows claim here.

`scripts/postinstall.js`, a Node wrapper an earlier version of this work routed
`postinstall` through, was deleted once `eafb559` settled on the inline form and nothing
invoked it any more. If the Windows run turns out badly, restoring such a wrapper — one
that needs no shell operators at all — is the change that would bring `postinstall`
inside the rule above; recover it from git history rather than rewriting it.

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
- Both `postinstall` chains run with `husky` removed from `PATH` — upstream's exits
  127 and never reaches `svelte-kit sync`, the local one exits 0 and continues. Also
  `husky` / `husky install` outside a git worktree, which exits **0** on the pinned 9.1.7, which
  is why the section above says the guard is not for the missing-`.git` case.
- `npm_execpath` read from inside a `pnpm run` script, to confirm it names a `.cjs`
  entry point rather than a shim.

The Windows half is reasoned from the mechanisms above, not executed — there is no
Windows host in the development environment. Three mechanisms carry it, one per
active entry point:

- **`postinstall`** (the inline chain) — `&&`, `||` and parenthesised groups parse in
  cmd.exe, and the package manager puts `node_modules/.bin` `.cmd` shims on `PATH` so
  `husky` and `svelte-kit` resolve. The weakest of the three, for the reason the
  section above gives.
- **`scripts/dev-force.js`** — `npm_execpath` names the package manager's own JS entry
  point, so `spawnSync(process.execPath, [that, …])` starts it with no shell and no
  shim resolution in the path at all. Confirmed here to be
  `…/corepack/v1/pnpm/10.34.5/bin/pnpm.cjs`, a plain `.cjs` file. The strongest of the
  three, because it removes the shell rather than relying on it.
- **`scripts/prepare-pages.js`** — `renameSync` and `rmSync` are platform-neutral.

**Run the pipeline once on the real runner before relying on it.**

`scripts/update-from-registry.mjs` (see `PACKAGING.md`) is the first path in this repository
executed on a Windows runner: job `build-from-package` in `fork-checks.yml` runs it on
`windows-latest`. It exercises `npm.cmd` resolution, quoting and the tarball's `npm install`
(including `postinstall`), so a green run also settles part of the `postinstall` question
above for the published package, though not the pnpm path.
