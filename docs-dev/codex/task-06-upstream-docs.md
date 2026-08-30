# Task 6 — Upstream-tracking record and documentation

Read [`README.md`](README.md) in this directory first.

`scripts/update-upstream.sh` is **already implemented and tested** — its `--help` and
`--dry-run` are confirmed read-only. This task is the record file and the documentation only.

## 目的 (Goal)

Make future upstream updates a routine operation a maintainer who has never seen this repo can
carry out, and record exactly which upstream state the project currently sits on.

## 対象範囲 (Scope)

Documentation and the version record. No code.

## 変更してよいファイル (Files you may change)

- `.upstream-version.json` — new
- `docs-dev/UPSTREAM.md` — new

## 変更してはいけない範囲 (Hard boundaries)

- **Do not modify `scripts/update-upstream.sh`.** If you believe it has a defect, report it
  rather than editing it.
- Do not touch `package.json`, `LICENSE`, `README.md`, `NOTICE`, `THIRD-PARTY-LICENSES.md`
- Do not touch `src/`, `static/`, `tests/`, `bin/`, `.github/`
- Do not use `docs/` — it is the build output directory and every build wipes it
- **Do not fetch from upstream, do not create or move any branch, do not merge, do not commit**
- Do not rewrite git history

## 実装内容 (What to do)

1. `.upstream-version.json` — machine-readable record of the upstream state this repo is based
   on. Include the upstream URL, tracked branch (`master`), imported commit SHA
   (`990dd241f2acf39c10db9da94464cbb833150426`), imported tree SHA
   (`5d4bc43bae3d20f02e92bc5ce4dd40c9a68cbf2e`), upstream version (`2.0.67`), import date
   (`2026-08-25`), the local vendor-base commit, the vendor branch name (`vendor/upstream`),
   and the upstream license (`MIT`). Valid JSON, 2-space indent, trailing newline.

2. `docs-dev/UPSTREAM.md` — the maintainer's guide. Cover:
   - Why the vendor-branch approach, rather than importing upstream's full history (3507
     commits, ~141 MB) or doing an unrelated-histories merge (no common ancestor means every
     merge is a full manual resolution)
   - The layering rule: commit 1 is the pristine upstream import, everything above it is local
     customization, and local changes belong in separate files wherever possible so merges
     stay trivial
   - That upstream publishes no tags, so `master` plus a commit SHA identifies a version
   - The update procedure, both via `scripts/update-upstream.sh` and by hand
   - What to re-verify after a merge: `pnpm build`, the npm pack round-trip, regenerating
     `THIRD-PARTY-LICENSES.md` from `pnpm licenses list --prod`, and updating
     `.upstream-version.json`
   - The list of files this project adds or changes on top of upstream. **Derive this from the
     actual repository** (`git diff --stat d4f0d43 HEAD`, `git status`) and label it as
     accurate as of writing — do not assert it is permanent, and do not invent entries.
   - Conflict guidance for the two files most likely to conflict: `package.json` (local change
     is a 5-line replacement — name, version, `dev`, `build`, `postinstall`) and
     `pnpm-lock.yaml` (regenerate with pnpm, never hand-merge)

## 完了条件 (Definition of done)

1. Both files exist
2. `.upstream-version.json` parses as valid JSON
3. The file list in `docs-dev/UPSTREAM.md` is backed by real git output
4. `git status --short` shows only these two new paths
5. Nothing committed; no branch created or moved; no network fetch performed

## 実施するテスト (Tests to run)

1. `python3 -c "import json;print(json.load(open('.upstream-version.json')))"`
2. The git command(s) you used to derive the file list, with their real output
3. `git status --short`
4. `git log --oneline` — the commit count must be unchanged
5. `git branch` and `git remote -v` — unchanged

## 報告してほしい内容 (What to report)

1. The files you created
2. The real output of every test above
3. Any defect you noticed in `scripts/update-upstream.sh` — reported, not fixed
4. Any recommendation that fell outside scope (e.g. a `package.json` script entry) — as a
   proposal only
5. Anything you deliberately did not do, and why
6. Any open question you could not resolve by running something — as a question, not a guess
