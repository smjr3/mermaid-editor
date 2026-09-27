# Codex task queue

Work through the task files in this directory **in numbered order**. Each file is
self-contained and states its own scope, boundaries, completion criteria, tests and
reporting requirements.

| Task                             | File                                                   | Status                      |
| -------------------------------- | ------------------------------------------------------ | --------------------------- |
| 1. Import upstream snapshot      | —                                                      | **done** (commit `d4f0d43`) |
| 2. Licensing & attribution       | —                                                      | **done** (commit `d416711`) |
| 3. npm package configuration     | —                                                      | **done** (commit `d416711`) |
| 4. npm pack → rebuild round-trip | [`task-04-npm-roundtrip.md`](task-04-npm-roundtrip.md) | **todo**                    |
| 5. GitLab Pages static delivery  | [`task-05-gitlab-pages.md`](task-05-gitlab-pages.md)   | **todo**                    |
| 6. Upstream-tracking docs        | [`task-06-upstream-docs.md`](task-06-upstream-docs.md) | **todo**                    |

Task 4 modifies `package.json`; run it before task 5. Task 6 is independent.

Read the rest of this file before starting any task. **The facts below are already
verified — use them, do not re-derive or guess them.**

---

## Project goal

A customizable distribution of Mermaid Live Editor, published to the npm registry as
`@smjr3/mermaid-editor`, fetched internally through JFrog, built on an internal GitLab,
and deployed to GitLab Pages as a static site.

**Guiding constraint: keep changes to upstream code as small as possible.** Future
upstream updates must stay easy to merge. Keep the boundary between upstream-derived
code and local customization explicit. **Do not do any UI customization yet.**

## Upstream

- Repo: <https://github.com/mermaid-js/mermaid-live-editor>
- Upstream publishes **no git tags** (`git ls-remote --tags` is empty). Versions are
  identified by commit SHA plus the `version` field in upstream's `package.json`.
- Two long-lived branches: `develop` (default) and `master`. **`master` is the release
  branch** deployed to mermaid.live, and is what this project tracks.
- Imported commit: `990dd241f2acf39c10db9da94464cbb833150426`
- Imported tree: `5d4bc43bae3d20f02e92bc5ce4dd40c9a68cbf2e`
- Upstream version 2.0.67, dated 2026-08-25
- Upstream license: MIT, `Copyright (c) 2020 - 2023 Knut Sveidqvist`

## Swimlane requirement (a hard requirement of this project)

Satisfied by upstream 2.0.67, which pins `mermaid ^11.17.2`. Swimlanes arrived in
mermaid **11.16.0** (verified absent in 11.15.0). Rendering was confirmed end-to-end in
headless Chromium.

Still satisfied after the 2026-09-27 upstream merge, which moved to `mermaid ^12.0.0`: the
detector regex below is byte-identical in 12.0.0, and the example was re-rendered in the editor
(`aria-roledescription="swimlane"`, no console errors).

The keyword is `swimlane-beta`; detection regex is `/^\s*swimlane-beta\b/`. It is
implemented as the flowchart grammar with `createFlowDiagram({ defaultLayout: "swimlane" })`,
so **lanes are expressed as subgraphs**. Verified working example:

```
swimlane-beta
  subgraph Customer
    A[Place order]
  end
  subgraph Sales
    B[Confirm order]
  end
  A --> B
```

There is no `lane` or `title` keyword. Do not invent syntax.

## Toolchain

- Node **>= 24.16.0** required (`.node-version` pins 24.16.0; `.npmrc` sets `engine-strict=true`)
- pnpm for development (`packageManager` pins pnpm@10.34.5)
- SvelteKit + `@sveltejs/adapter-static`; build output goes to **`docs/`**, which is gitignored
- **Never put documentation in `docs/`** — every build wipes it. Use `docs-dev/`.

## Current repository state

Branch `claude/mermaid-editor-customization-base-3jdcus`, two commits:

- `d4f0d43` — pristine upstream import; its tree hash equals upstream's
- `d416711` — licensing, npm packaging, upstream-tracking script

Already present: `LICENSE` (untouched), `NOTICE`, `THIRD-PARTY-LICENSES.md`, `README.md`,
`README.upstream.md`, `scripts/update-upstream.sh`.

Still missing: `.upstream-version.json`, `docs-dev/UPSTREAM.md`, `docs-dev/PACKAGING.md`,
`docs-dev/GITLAB-PAGES.md`, `.gitlab-ci.yml`.

`package.json` is `@smjr3/mermaid-editor` v0.1.0. Its diff against upstream replaces
**exactly 5 lines**; `dependencies`, `devDependencies`, `engines` and `packageManager`
are byte-identical to upstream. Keep it that way.

## Verified behaviour — do not break, do not re-verify

- `pnpm install --frozen-lockfile && pnpm build` succeeds; static site lands in `docs/`
- The upstream tree builds with plain `npm install && npm run build` too (667 packages)
- `MERMAID_BASE_PATH=/mermaid-editor npm run build`, served from a subpath, boots the app
  correctly — router initializes and the diagram renders, no page errors
- Generated asset references are **relative** (`./_app/...`), so output is subpath-portable
- `npm pack` currently yields 164 files / 122.4 kB / 380.6 kB unpacked, with no
  `node_modules`, `.git`, `docs/`, `.npmrc` or `.env.local`

## Verified pitfalls — these have already cost time

1. Upstream **tracks `.npmrc` in git even though upstream's own `.gitignore` lists it.**
   A plain `git add -A` silently drops it and the tree diverges from upstream by exactly
   one file. `git add -f .npmrc` is required when re-importing.
2. Upstream's scripts hard-coded `pnpm` (`"build": "pnpm build:embed && vite build"`),
   which breaks an npm-only consumer. Already fixed by inlining the vite call.
3. `postinstall`'s `husky install` errors outside a git work tree (e.g. an unpacked
   tarball). Already made tolerant.
4. The build needs `.svelte-kit/tsconfig.json`, generated by `svelte-kit sync` in
   `postinstall`. Deleting `.svelte-kit` then building fails with `Tsconfig not found`.
5. At runtime the app fetches `https://mermaid.js.org/schemas/config.schema.json` for
   config autocomplete. This fails on an air-gapped network — degraded, not fatal.
6. **npm always strips `/pnpm-lock.yaml` from tarballs** — hard-coded in
   `npm-packlist/lib/index.js:299`. Listing it in `files` is a no-op. Consequence: the
   published package ships no lockfile, so a consumer's `npm install` floats within
   semver ranges and builds are not reproducible. Measured workaround: the exclusion is
   root-anchored, so a copy at a nested path (e.g. `packaging/pnpm-lock.yaml`) **does**
   survive packing.
7. npm also always strips `.npmrc`, so upstream's `engine-strict=true` never reaches
   consumers; a Node version mismatch degrades from an error to a warning.
8. The husky `pre-commit` hook runs lint-staged (prettier + eslint). **Committing with
   Node older than 24.16.0 is rejected** with `ERR_PNPM_UNSUPPORTED_ENGINE`.

## Dependency licenses — audited, do not re-scan

Production tree: **306 packages**. MIT 234, ISC 38, Apache-2.0 15, BSD-3-Clause 11,
OFL-1.1 1, `(MPL-2.0 OR Apache-2.0)` 1, EPL-2.0 1, `(MIT AND Zlib)` 1, Unlicense 1,
BSD-2-Clause 1, 0BSD 1, Unknown 1.

**No GPL / AGPL / LGPL / SSPL / CC-BY-SA anywhere in the production tree.**

- `elkjs` — EPL-2.0, reaches the build via `@mermaid-js/layout-elk`, used unmodified
- `dompurify` — dual `MPL-2.0 OR Apache-2.0`; this project **elects Apache-2.0**
- `@fontsource-variable/recursive` — OFL-1.1, shipped unmodified
- `khroma` — reports `Unknown` (no `license` field) but ships an MIT license file

Regenerate with `pnpm licenses list --prod` (add `--json` for machine-readable output).

## Rules for every task

- Stay inside the task's declared file list. Do not widen scope on your own.
- Never edit `LICENSE`. MIT requires the upstream notice to survive.
- Never change `dependencies`, `devDependencies`, `engines` or `packageManager` values.
- Never regenerate `pnpm-lock.yaml` unless a task explicitly says to.
- Never disable or skip a test, lint rule or type check to make something pass.
- Do not guess. If a fact is not in this file and you cannot verify it by running
  something, report it as an open question instead of inventing an answer.
- Report the **actual output** of the tests each task lists, not a summary of them.
