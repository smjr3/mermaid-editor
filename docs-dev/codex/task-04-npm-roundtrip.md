# Task 4 — Verify the npm pack → rebuild round-trip

Read [`README.md`](README.md) in this directory first. Pitfalls 6 and 7 are central to this task.

## 目的 (Goal)

Prove that a consumer can take the published npm package, unpack it elsewhere, and rebuild
the web app from it — and decide and implement how to handle the fact that no lockfile can
ship in the tarball. This mirrors the internal path: fetch from JFrog → build on internal
GitLab → deploy to GitLab Pages.

## 対象範囲 (Scope)

Packaging verification, and the minimum changes that verification proves necessary. Nothing else.

## 変更してよいファイル (Files you may change)

- `package.json` — only the `files` field, and a `prepack`/`postpack` script if your chosen
  lockfile approach needs one
- `packaging/` — new, only if you choose to ship a lockfile copy there
- `docs-dev/PACKAGING.md` — new

## 変更してはいけない範囲 (Hard boundaries)

- Do not touch `src/`, `static/`, `tests/`, `bin/`, `scripts/`
- Do not change `dependencies`, `devDependencies`, `engines` or `packageManager` values
- Do not touch `LICENSE`, `NOTICE`, `THIRD-PARTY-LICENSES.md`, `README.md`
- Do not disable a test, lint rule or type check to make the build pass
- Do not publish anything to any registry. Prepare only.

## 実装内容 (What to do)

1. Run the round-trip: `npm pack` → unpack into an **empty directory outside this repo** →
   `npm install` → `npm run build`. Use **npm, not pnpm** — that is the internal scenario.

2. Decide and implement a response to pitfall 6 (npm strips `/pnpm-lock.yaml`, so the
   published package has no lockfile and consumer builds are not reproducible). Choose one
   and justify it in your report:
   - (a) ship a copy at `packaging/pnpm-lock.yaml`, documented for the consumer to restore
   - (b) ship no lockfile; the consumer commits their own `package-lock.json` after first
     install and uses `npm ci` thereafter
   - (c) something else you can defend

   If you duplicate the lockfile, add a mechanism that keeps the copy from drifting from the
   real one across upstream updates (generating it in `prepack` rather than committing a
   stale copy, for example). A silently stale duplicate is worse than none.

3. Write `docs-dev/PACKAGING.md` covering: how to build the npm package, how to publish it
   (note that a scoped package needs `--access public`, already set via `publishConfig`), how
   to rebuild the web app from the package, and the reproducibility caveat with your chosen
   approach.

## 完了条件 (Definition of done)

1. `npm install` in the unpacked directory exits 0
2. `npm run build` in the unpacked directory exits 0
3. The unpacked directory's `docs/` contains `index.html`, `edit.html`, `view.html`, `_app/`
4. The tarball contains no `node_modules`, `.git`, `docs/`, `.env.local`, or credentials
5. The lockfile decision is implemented and documented in `docs-dev/PACKAGING.md`
6. `package.json`'s `dependencies`/`devDependencies`/`engines`/`packageManager` still match
   upstream byte-for-byte

## 実施するテスト (Tests to run)

Run these and paste the real output — exit codes included — into your report.

1. `npm pack` — tarball name, size, file count
2. `npm install` in the unpacked dir — exit code and package count
3. `npm run build` in the unpacked dir — exit code
4. `ls` of the unpacked dir's `docs/`
5. `tar -tzf <tarball> | grep -E '(node_modules|\.git/|\.env\.local|\.npmrc)'` — must be empty
6. Proof your lockfile approach actually works end to end (e.g. for (a): unpack → restore →
   `npm ci` succeeds)
7. A script comparing `dependencies`/`devDependencies`/`engines`/`packageManager` against
   `git show d4f0d43:package.json`, printing whether each is identical

## 報告してほしい内容 (What to report)

1. The real output of every test above
2. Which lockfile approach you chose, why, and why you rejected the others
3. Every warning or error the npm path produced (verbatim), and your assessment of its impact
4. The `package.json` diff, if you changed it
5. Anything you expect to be a problem when fetching through JFrog specifically
6. Anything you deliberately did not do, and why
7. Any open question you could not resolve by running something — as a question, not a guess
