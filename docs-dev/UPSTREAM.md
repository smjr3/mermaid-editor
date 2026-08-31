# Maintaining the upstream snapshot

This repository is a customized distribution of
[Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor). The exact
snapshot currently in use is recorded in [`.upstream-version.json`](../.upstream-version.json).
Upstream does not publish Git tags: identify a release by the `master` branch and a
full commit SHA (with the version from its `package.json`).

## Why a vendor branch

Importing upstream's complete history would add 3,507 commits and about 141 MB. At
the other extreme, repeatedly merging an independently rooted snapshot with
`--allow-unrelated-histories` provides no common ancestor, so every update becomes a
full manual resolution.

Instead, the first commit in this repository is a byte-exact, pristine upstream
tree. The `vendor/upstream` branch is rooted at that commit and contains only later
pristine upstream snapshots. It therefore shares history with the customization
branch, and `git merge vendor/upstream` is an ordinary three-way merge.

Preserve this layering:

1. Commit 1 (`d4f0d4317a8aa225ba1796ce98df9fb0ac8b7fde`) is the pristine
   upstream import.
2. Every commit above it on the working branch is local customization.
3. Put local behavior in separate files wherever possible. Keep unavoidable edits
   to upstream files small and explicit so future merges remain easy to review.

Never add local changes to `vendor/upstream`.

## Updating with the script

Start from the customization branch with a clean working tree and ensure the local
`vendor/upstream` branch exists. Then run:

```sh
scripts/update-upstream.sh master
git merge vendor/upstream
```

The script adds a correctly configured `upstream` remote if necessary, fetches the
requested ref, replaces the vendor branch tree, verifies that its tree hash exactly
matches upstream, commits the pristine snapshot, and returns to the starting branch.
It deliberately does not perform the merge. Preview its actions without changing
anything using `scripts/update-upstream.sh master --dry-run`.

After merging, resolve conflicts according to the guidance below, update
`.upstream-version.json` with the new commit, tree, version, import date, and vendor
base commit, and commit the merge and record together as appropriate.

## Updating by hand

The script is preferred because its tree-hash check guards the pristine vendor
snapshot. If it cannot be used, reproduce its safeguards explicitly:

1. Require a clean working tree and record the current customization branch.
2. Configure `upstream` as
   `https://github.com/mermaid-js/mermaid-live-editor.git`, then fetch `master`.
3. Record the fetched commit (`git rev-parse FETCH_HEAD`), its tree
   (`git rev-parse FETCH_HEAD^{tree}`), and the version in its `package.json`.
4. Check out `vendor/upstream`, remove its tracked tree, and extract the fetched tree
   with `git archive FETCH_HEAD | tar -x`.
5. Stage all paths. If upstream contains `.npmrc`, force-add it with
   `git add -f .npmrc` because upstream's own ignore rules otherwise omit it.
6. Compare `git write-tree` with `git rev-parse FETCH_HEAD^{tree}`. **Do not commit
   unless they are identical.** Commit the pristine snapshot on `vendor/upstream`.
7. Return to the customization branch, merge `vendor/upstream`, and resolve conflicts.
8. Update `.upstream-version.json` and complete all verification below.

Do not copy selected upstream files or introduce local fixes on the vendor branch;
either action defeats the exact-tree guarantee.

## Resolving likely conflicts

### `package.json`

The local delta is **not** only the replaced lines. Two distinct groups exist, and
both must survive the merge:

- **Replaced** (5): `name`, `version`, `dev`, `build`, `postinstall`
- **Added** (local, absent upstream): `description`, `keywords`, `homepage`,
  `repository`, `bugs`, `author`, `publishConfig`, `files`

Preserve **every** intentional local addition, not just the replacements. Taking
upstream wholesale for anything outside the five replaced keys silently drops the
added ones — and losing `files` or `publishConfig` changes what the published npm
tarball contains and how it is published. Reapply the local values to the new
upstream file and confirm the resulting diff rather than choosing an entire side of
the conflict.

### `pnpm-lock.yaml`

Never hand-merge the lockfile. Resolve `package.json` first, remove the conflicted
lockfile, and regenerate it with the repository-pinned pnpm using `pnpm install`.
Review the regenerated diff and include it with the merge.

## Verification after every merge

1. Install dependencies and run `pnpm build`.
2. Exercise the npm pack round-trip: create the tarball with `npm pack`, unpack it in
   a clean temporary directory, run `npm install`, and then run `npm run build` from
   the unpacked package.
3. Run `pnpm licenses list --prod` and regenerate `THIRD-PARTY-LICENSES.md` from the
   current production dependency licenses.
4. Update and JSON-parse `.upstream-version.json`; verify that its imported tree is
   the pristine vendor commit's tree.

## Current local file layer

The following list is accurate as of **2026-08-31**. It is a snapshot, not a
permanent allowlist.

Re-derive it against the **current vendor base** — the `vendorBaseCommit` recorded in
`.upstream-version.json`, which is updated on every import. Read it from the record
rather than naming the `vendor/upstream` branch, so the command works in a fresh
clone that has not fetched that branch:

```sh
vendor_base=$(node -p "require('./.upstream-version.json').vendorBaseCommit")
git diff --name-status "$vendor_base" HEAD
```

Do **not** re-derive it against the original import `d4f0d43`. That commit is frozen
at upstream 2.0.67. Once any upstream update has been merged, `HEAD` carries upstream
code newer than `d4f0d43`, so diffing against it reports upstream's own additions and
modifications as if they were local customizations.

| Status   | Path                                      |
| -------- | ----------------------------------------- |
| Modified | `.gitignore`                              |
| Added    | `.upstream-version.json`                  |
| Added    | `NOTICE`                                  |
| Modified | `README.md`                               |
| Added    | `README.upstream.md`                      |
| Added    | `THIRD-PARTY-LICENSES.md`                 |
| Added    | `.gitlab-ci.yml`                          |
| Added    | `docs-dev/GITLAB-PAGES.md`                |
| Added    | `docs-dev/PACKAGING.md`                   |
| Added    | `docs-dev/UPSTREAM.md`                    |
| Added    | `docs-dev/codex/README.md`                |
| Added    | `docs-dev/codex/task-04-npm-roundtrip.md` |
| Added    | `docs-dev/codex/task-05-gitlab-pages.md`  |
| Added    | `docs-dev/codex/task-06-upstream-docs.md` |
| Modified | `package.json`                            |
| Added    | `scripts/copy-legal-files.js`             |
| Added    | `scripts/update-upstream.sh`              |

Re-derive this inventory after each update; do not assume it remains unchanged.
