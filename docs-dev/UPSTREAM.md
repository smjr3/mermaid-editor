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

The update script requires Bash and standard Unix command-line tools; it is not a
PowerShell or Command Prompt script. On Windows, prefer WSL. Git Bash may also run
the script, but Windows checkout behavior for line endings, executable bits, or
symbolic links can make the exact-tree check fail. If it does, stop and repeat the
import in an environment that preserves the upstream tree (such as a WSL filesystem).
Never bypass the check or commit a tree with a different hash.

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

- **Replaced** (7): `name`, `version`, `dev`, `build`, `dev:force`, `postinstall`, `pnpm`
- **Added** (local, absent upstream): `build:pages`, `description`, `keywords`,
  `homepage`, `repository`, `bugs`, `author`, `publishConfig`, `files`, `overrides`

Two of those carry a Windows fix and are the ones a careless resolution silently
undoes. `dev:force` is `node scripts/dev-force.js`; upstream's value is
`MERMAID_LOCAL=true pnpm dev --force`, which is POSIX-only and fails on cmd.exe.
`build:pages` is local-only and CI depends on it.

Dependency versions are a third kind of delta. This fork updates dependencies ahead of
upstream, so `dependencies` and `devDependencies` differ from upstream's in version ranges
only (the command below lists them). On a conflict, keep the **higher** of the
two versions for each package and regenerate the lockfile — never take upstream's side
wholesale, which silently downgrades whatever this fork already moved forward.
`@playwright/test` is the exception: it must match the image tag in
`.github/workflows/tests.yml`.

`pnpm` is the third one to watch. The key exists upstream too, so it is a replacement
rather than an addition, but the local value adds `overrides` with `monaco-editor>dompurify`
(Monaco 0.57.0 pins a `dompurify` with a low advisory; see
`QUALITY-AUDIT-2026-08-31.md`). Taking upstream's `pnpm` block silently removes the
override and brings the production audit advisory back.

The top-level `overrides` (added) is the same fix for npm, which ignores `pnpm.overrides`.
It is what protects the published tarball, built with `npm install` by anyone
rebuilding from the package. Keep the two in step: an override added to one belongs in the other.

`monaco-editor` must not go below **0.57.0**. It is pinned exactly; 0.57.0 was the
first release that depended on a DOMPurify patched for the advisories known at the time
(a later low advisory is what the current `monaco-editor>dompurify` override covers). Upstream is still on 0.55.1, so
taking its side of that line reintroduces the vulnerable `dompurify@3.2.7` with no
override left to catch it. 0.56 also moved the worker entry points behind an `exports`
map, so `src/lib/components/DesktopEditor.svelte` imports
`monaco-editor/editor/editor.worker` and `monaco-editor/language/json/json.worker`
instead of the old `monaco-editor/esm/vs/...` paths; keep those if that file conflicts.

Both lists were regenerated by diffing this file's `package.json` against
`vendorBaseCommit` rather than by reading, because the earlier hand-written list
had drifted and omitted exactly `dev:force` and `build:pages`. `pnpm` was later
missed the same way when PR #28 added an override. `node scripts/check-local-delta.js`
now fails when a changed top-level key or script is missing from the two lists; to see
the values themselves, `git diff <vendorBaseCommit> -- package.json`.

Preserve **every** intentional local addition, not just the replacements. Taking
upstream wholesale for anything outside the seven replaced keys silently drops the
added ones — and losing `files` or `publishConfig` changes what the published npm
tarball contains and how it is published. Reapply the local values to the new
upstream file and confirm the resulting diff rather than choosing an entire side of
the conflict.

### Local fix to upstream's render wait

| Path                             | Local change                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `src/lib/util/autoSync.ts`       | Adds `markViewCurrent()`, which resolves a pending `waitForRender()`             |
| `src/lib/components/View.svelte` | Calls it on the "no change in Code/Config/PanZoom" early return                  |
| `src/lib/util/autoSync.test.ts`  | Added. Covers the deferred-render case that used to leave the promise unresolved |

This is a bug fix, not a customisation. After a render counted as slow (over 150 ms),
the next state change is deferred and leaves `waitForRender()` pending; if the state
then settles back to what is already on screen, `View` returned early and nothing
resolved it, so PNG export hung without downloading. mermaid 12 renders the ER sample
in about 150 ms, which made `actions.spec.ts` "should download png and svg" fail about
half the time. If upstream fixes this themselves, take their version and drop ours.

### Render scheduling (performance)

| Path                                                        | Local change                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/View.svelte`                            | Renders through `createRenderScheduler` instead of a promise chain of every state; no longer calls `recordRenderTime`; debounces pan/zoom store writes; skips the pre-validation state; `data-render-count`; redraws when an icon pack is imported or removed |
| `src/lib/util/renderView.ts`                                | `shouldPlace` option: a finished render is dropped instead of placed when it says no                                                                                                                                                                          |
| `src/lib/util/state.svelte.ts`                              | Publishes only the newest validation (`createLatestGuard`), syncs the managed theme before publishing, validates typed code after a pause when parsing is slow                                                                                                |
| `src/lib/util/mermaid.ts`, `src/lib/util/memo.ts`           | `parse` is remembered per code; `memoByCode` forgets failures                                                                                                                                                                                                 |
| `src/lib/util/renderScheduler.ts`, `settledState.svelte.ts` | Added. The scheduler, the guard and the settler; the tool cards and the selection layer read `settledState` instead of `validatedState`                                                                                                                       |

Upstream queues a render for every state and, after a render over 150 ms, defers the next
one by a second (`autoSync.ts`). Measured in a production build, a burst of typing queued up
to twenty renders, a slow diagram waited over a second for every change, and a pan of a
200-node flowchart re-parsed it on every mouse move (16 s of blocked main thread). `autoSync.ts`
itself is unchanged: `View` still calls `shouldRefreshView()` (always true now, since nothing
records a slow render) so `waitForRender()` keeps working for PNG export, and resolves it with
`markViewCurrent()` when the scheduler is idle. On a merge, keep upstream's `View.svelte`
markup and re-apply the scheduler effect; `STATUS.md` → "Performance guards" lists the
measurements and `tests/performance.spec.ts` the guards.

### Swimlane samples and business templates

| Path                                | Local change                                                                                                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/util/localSamples.ts`      | Added. Swimlane samples, which `@mermaid-js/examples` does not ship; the Japanese "業務テンプレート" group                                                                                                                                     |
| `src/lib/components/Preset.svelte`  | Deleted (2026-10-12). The template picker became the 新規 dialog's サンプル tab (`dialogs/NewDiagramDialog.svelte`, `src/lib/util/sampleCatalog.ts`); carry an upstream change to `Preset.svelte` over there by hand and keep the file deleted |
| `src/lib/util/localSamples.test.ts` | Added. Each sample parses as its diagram type; none shadows an upstream sample; the templates are small and Japanese                                                                                                                           |
| `tests/swimlane.spec.ts`            | Added. `@smoke`: the default sample renders its lanes, in both engines                                                                                                                                                                         |
| `tests/templates.spec.ts`           | Added. Each business template loads from the 新規 dialog's サンプル tab and renders without an error                                                                                                                                           |

If `@mermaid-js/examples` starts shipping a `Swimlane` entry, `localSamples.test.ts`
fails on purpose: drop the local entry and take upstream's.

### `pnpm-lock.yaml`

Never hand-merge the lockfile. Resolve `package.json` first, remove the conflicted
lockfile, and regenerate it with the repository-pinned pnpm using `pnpm install`.
Review the regenerated diff and include it with the merge.

### `.github/pull_request_template.md`

Two checklist lines are changed locally, and taking upstream's side of a conflict
re-breaks both:

- upstream links its own contribution guidelines at mermaid.js.org, which describe
  contributing to `mermaid-js/mermaid-live-editor`, not to this fork. The local line
  points at `docs-dev/UPSTREAM.md` instead.
- upstream asks contributors to target `develop`. That branch does not exist here;
  pull requests target `master`.

Everything else in the file is upstream's and should track upstream. Keep the two
local lines and take upstream's changes for the rest.

### Feature-flag guards in `src/` and `tests/`

Six source files carry small local guards that switch off upstream's promotional, AI
and community features, plus the two e2e specs that covered them. The full rationale
and the variables are in `docs-dev/FEATURE-FLAGS.md`; what matters at merge time:

| Path                                                                                                                              | Local change                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/util/env.ts`                                                                                                             | Adds `isEnabledAiFeatures` and `isEnabledCommunityLinks` beside upstream's own `isEnabledMermaidChartLinks`                                                                                                                                                                          |
| `src/lib/components/DesktopEditor.svelte`                                                                                         | Wraps `<AIPromptPopup>` in `{#if env.isEnabledAiFeatures}`; also gates its gutter button and glyph margin                                                                                                                                                                            |
| `src/lib/util/util.ts`, `src/lib/components/DesktopEditor.svelte`, `src/lib/util/exportDiagram.ts`, `src/lib/util/env.ts`, `.env` | `MERMAID_OFFLINE`: refuses `?code=`/`?config=`/gist loading from any origin but the site's own (`assertFetchAllowed`), skips the config-schema download and the Font Awesome stylesheet line in exported SVGs. (The "Load Gist" field it hid went with the 出す card on 2026-10-12.) |
| `src/routes/(app)/edit/+page.svelte`                                                                                              | Wraps `<EnhancedEditsButton>` in the same guard                                                                                                                                                                                                                                      |
| `src/lib/components/Navbar.svelte`                                                                                                | Wraps the GitHub dropdown and its separator in `{#if env.isEnabledCommunityLinks}`                                                                                                                                                                                                   |
| `src/lib/components/MainMenu.svelte`                                                                                              | No longer imported since 2026-10-12 (the header has no hamburger menu) and therefore restored to upstream's version. If a change mounts it again, spread the Discord "Community" entry in conditionally on `env.isEnabledCommunityLinks` first                                       |
| `.env`                                                                                                                            | Sets this fork's defaults                                                                                                                                                                                                                                                            |
| `tests/actions.spec.ts`, `tests/errorDisplay.spec.ts`                                                                             | Assert the configured behaviour rather than upstream's                                                                                                                                                                                                                               |

These are additive guards, not rewrites: the guarded markup is upstream's own. On a
conflict, take upstream's version of the inner content and re-apply the surrounding
`{#if}`. Do **not** resolve by dropping the guard — that silently re-enables an AI or
promotional surface in a build that keeps them off.

If upstream introduces a new promotional, AI or outbound-link surface, it arrives
unguarded and will not be caught by a merge conflict. After each merge, re-check the
running app for new external links; `docs-dev/FEATURE-FLAGS.md` lists the ones known
to remain.

### Editor, layout and icon additions (0.2.0)

Fork features that touch upstream files. Each upstream file gains a few lines that call
into a fork-local file; the logic lives in the fork-local file, so a conflict is resolved by
taking upstream's version and re-adding those lines.

| Path                                                                                                                                    | Local change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/DesktopEditor.svelte`                                                                                               | Calls `registerMermaidRename(monaco)` after `initEditor`: F2 / Rename Symbol for the `mermaid` language; registers `insertAtCursor` so the icon picker can insert at the cursor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/util/mermaidRename.ts`                                                                                                         | Added. The rename scan (skips labels, edge text, messages, comments, strings) and the Monaco provider, which applies a rename only if the diagram still parses as the same type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/util/state.svelte.ts`                                                                                                          | Adds `resetConfig()`, which returns the config to `{}` and keeps the diagram                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/components/ResetConfigButton.svelte`                                                                                           | Added. The "Reset config" button on the config tab                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/lib/util/mermaid.ts`                                                                                                               | Registers the bundled and hosted packs at module load, waits for the stored ones before rendering, and passes the SVG through `addLabelHalo`; `diagramObjects` lists the objects the Colours card can colour; renders and the cards' `getDiagramFromText` reads take turns (`diagramFromText`), since every parse clears mermaid's shared title store                                                                                                                                                                                                                                                                                                                                                                   |
| `src/lib/util/architectureLabels.ts`                                                                                                    | Added. Outlines architecture service and edge labels in the background colour so edges do not run through them (mermaid draws them that way)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/util/darkLines.ts`                                                                                                             | Added. Dark themes render with near-white lines unless the user set `lineColor`; (the dark-mode backdrop for light themes was removed: the diagram looks the same in both modes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/lib/util/iconPacks.ts`                                                                                                             | Added. The nine bundled packs (generic and logo sets), loaded lazily — never from a CDN; `MERMAID_BUNDLE_LOGOS=false` drops the logos; plus the build-time vendor packs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/lib/util/customIcons.ts`, `customIconStore.ts`                                                                                     | Added. Build-time vendor, hosted (`MERMAID_ICON_PACKS`) and user-imported packs, sanitised with DOMPurify; the IndexedDB store                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/components/IconPacks.svelte`                                                                                                   | Added. The "Icons" card: the bundled pack list and SVG / Iconify JSON import                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/util/env.ts`, `.env`                                                                                                           | Add `iconPacks` / `MERMAID_ICON_PACKS` and `colorPresets` / `MERMAID_COLOR_PRESETS`; `.env` also documents `MERMAID_BUNDLE_LOGOS`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `scripts/svg-to-iconify.js`                                                                                                             | Added. Converts an SVG folder into a pack a deployment can host; inlines `<style>` class rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `scripts/fetch-icon-packs.js`                                                                                                           | Added. Imports vendor icon archives at build time (`MERMAID_FETCH_ICON_PACKS`) into the gitignored `src/lib/vendor-icons/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.gitignore`                                                                                                                            | Ignores `src/lib/vendor-icons/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/util/layout.ts`                                                                                                                | Added. Direction (top-to-bottom, left-to-right, fit to view), the layout engine and spacing; the inspector's 図全体 rows 向き / 配置 / 間隔 call it (the Layout card is gone since 2026-10-12)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/util/colors.ts`                                                                                                                | Added. Colours: line colour (config `themeVariables.lineColor`), lane and group colours, object fills and strokes, text style and arrow colours, applied from the inspector (図全体 and the selection's 色 / 文字 rows; the Colours card is gone since 2026-10-12)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/lib/util/diagramEdit.ts`                                                                                                           | Added. Adding to a flowchart or swimlane: a lane, a node in a lane joined by an arrow, an arrow between two nodes; the add bar over the diagram calls it (`canvas/FlowInsert.svelte`, `src/lib/util/insertActions.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/util/diagramModify.ts`                                                                                                         | Added. Renaming, deleting and the arrows (label, reverse, line style, the arrowhead at the end, at both ends or none, and since 2026-10-12 `edgeFields`: head shape, length, animation and curve, a message's end and activation, class relation kinds and multiplicities, ER cardinality, architecture sides, C4 directions) of every editable type, used by the inspector through `selectionModel.svelte.ts` (the Edit card is gone since 2026-10-12)                                                                                                                                                                                                                                                                 |
| `src/lib/util/diagramOptions.ts`                                                                                                        | Added. The options mermaid offers per type that have no row of their own, for the inspector: the whole diagram's (curve, look, `autonumber`, a gantt's `excludes weekends` / `todayMarker` / `axisFormat` / `tickInterval`, `pie showData`, a horizontal XY chart, a git graph's direction, block `columns`, a mindmap's layout, sankey / packet / timeline settings, `accTitle` / `accDescr`) and the selected object's (a subgraph's direction, a participant's symbol, a topic's shape, a class's annotation and type parameter, a kanban card's metadata, a requirement's fields, a block's width). The arrow's (`edgeFields`) are in `diagramModify.ts`. Tests `diagramOptions.test.ts`, `tests/inspector.spec.ts` |
| `src/lib/util/newDiagram.ts`                                                                                                            | Added. The starters of the 21 types (title, direction) that the 新規 dialog's 形式 tab opens in a new tab (`newTab.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/lib/components/TemplateForms.svelte`, `src/lib/util/templateForms.ts`, `src/lib/util/templateThumbnails.ts`                        | Added. "Create from a template" under "New diagram": a dialog listing the nine business templates with a rendered preview each; a form per template (text, choices, lists of rows) whose generator writes the diagram; mounted by one line in `NewDiagram.svelte`. Tests `templateForms.test.ts`, `tests/templateForms.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/components/TableEditor.svelte`, `src/lib/util/tableEdit.ts`                                                                    | Added. "Edit as a table" at the end of the Edit card: gantt tasks, kanban cards, timeline periods, pie slices and an ER entity's attributes as rows with inline cells, add/delete/move rows, kanban column moves and TSV paste from Excel; writes through `diagramDetails.ts`, `diagramModify.ts` and `addActions.ts` where they can. Mounted by one line (plus its import) at the end of `EditControls.svelte`. Tests `tableEdit.test.ts`, the all-diagram check, `tests/tableEditor.spec.ts`                                                                                                                                                                                                                          |
| `src/lib/util/themePresets.ts`                                                                                                          | Added. The named diagram themes (テーマ) of the Colours card and the command palette: `theme: "base"` + `themeVariables` + a marked `themeCSS` per preset; "standard" hands the theme back to the managed family. `mermaid.ts` paints a preset's background (`renderView.ts` copies it onto the rough sketch, `Actions.svelte` uses it for exports). Tests `themePresets.test.ts`, `tests/themePresets.spec.ts`                                                                                                                                                                                                                                                                                                         |
| `src/lib/util/diagramTitle.ts`                                                                                                          | Added. Sets, changes and removes the diagram title — front matter `title:`, or the `title` statement of timeline and C4, which ignore front matter — from the Layout card's title field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/lib/components/IconChooser.svelte`, `src/lib/util/iconCatalog.ts`                                                                  | Added. A small icon search in the Edit card over every pack the editor knows (standard, bundled, build-time, hosted, imported), for a flowchart node's or an architecture service's icon                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/components/HelpButton.svelte`, `src/lib/util/helpContent.ts`                                                                   | Added. The "How to use" button in the header (Navbar) and its guide dialog; the guide text per language                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `.claude/settings.json`, `.claude/hooks/session-start.sh`                                                                               | Added. Claude Code on the web: a SessionStart hook puts Node 24 first on PATH, enables pnpm and installs the dependencies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/lib/util/selection.svelte.ts`, `selectionModel.svelte.ts`, `selectionActions.ts`, `selectionKeys.ts`, `diagramPick.ts`             | Added. Selection-driven editing: the one selected object or arrow, the inline-rename and "ここから矢印" states; the model that reads the Edit and Colours cards' lists and applies their functions to the selection (checked with `checkEdit`); "この後に追加", branches, connections and "ノードを追加" built from the Add card's functions; the keys (Enter, Tab, Delete, F2, Escape, arrows); and which object or arrow a click in the SVG lands on, per diagram type                                                                                                                                                                                                                                                |
| `src/lib/components/SelectionLayer.svelte`, `DiagramContextMenu.svelte`                                                                 | Added. Over the diagram: clicks, double clicks and right clicks select an object or an arrow, draw its outline, show the connect banner and refusals, and open the right-click menu, whose 色 / 形 ask the inspector for that row (`focusInspector`). The mini toolbar and the selection panel of 0.2.2 are gone (2026-10-12): their rows are in the inspector                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/components/DesktopEditor.svelte`                                                                                               | The two Monaco models get a path per editor instance (`internal://editor/<n>/config.json`), so the remount on a pane swap does not create a duplicate model URI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/util/panZoom.ts`                                                                                                               | The resize observer ignores a zero-size (just removed) diagram, which a pane swap otherwise zooms into a "matrix is not invertible" error; `reveal` pans (at the same zoom, or zooms out when it is bigger than the view) so a box is fully visible, for a node just added (`revealView.ts`, called by `SelectionLayer.svelte`)                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/components/UndoRedoButtons.svelte`, `src/lib/util/undoStack.svelte.ts`                                                         | Added. Undo / redo buttons in the editor header: a history of the diagram code as it passes through the input state (one entry per pause in typing, 100 kept), so one undo covers Monaco, CodeMirror and the Add / Colours / Layout cards; applying an entry goes through `updateCode`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/components/GuideTour.svelte`, `src/lib/util/onboarding.svelte.ts`                                                              | Added. The first-visit guide (three steps: the add bar and the inspector, the diagram, the header's actions and 使い方). The command palette that shared this row was removed on 2026-10-12                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/lib/components/Navbar.svelte`, `src/lib/components/HelpButton.svelte`                                                              | The header of the inspector layout: app icon and title, undo/redo, 新規 ▾ / 共有 / 書き出す (opening the dialogs through `editorUi.svelte.ts`), 使い方, 履歴, 初期化 and light/dark; it mounts `<GuideTour />` and the three dialogs. HelpButton gains a "show the guide again" button and the version page. No `MainMenu`, language button or command search. Keep new header features mounted from these two files                                                                                                                                                                                                                                                                                                    |
| `src/lib/components/IconPicker.svelte`, `src/lib/util/iconSearch.ts`, `src/lib/util/monacoInsert.ts`                                    | Added. Search the icon packs in the "Icons" card, or browse hand-picked categories (`iconCategories.ts`) or a whole pack a page at a time, and click an icon to insert its `prefix:name` at the cursor (or copy it when no editor can take it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/util/standardIcons.ts`                                                                                                         | Added. mermaid's five built-in architecture icons (copied, MIT) so the picker can show and mark them as standard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/lib/components/IconLicenseTable.svelte`, `src/lib/util/iconLicenses.ts`                                                            | Added. Licence, holder and trademark facts for every bundled icon set, shown in the "How to use" guide's licences section and in the picker's tooltips                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/components/AiIconPrompt.svelte`, `UnknownIcons.svelte`, `src/lib/util/aiPrompt.ts`, `aiCollection.svelte.ts`, `iconCatalog.ts` | Added. "Copy a briefing for an AI" (syntax, packs, curated and collected icon names) and the "Unknown icons" list with one-click replacement; the shared icon pack loader                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/lib/util/htmlExport.ts`                                                                                                            | Added. HTML export (standalone page, self-contained `<img>` tag), the GitLab Markdown and `toXmlSvg`; the 書き出す dialog calls it through `exportDiagram.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/lib/components/Actions.svelte`                                                                                                     | Deleted (2026-10-12). Every export moved, unchanged in what the files hold, to `dialogs/ExportDialog.svelte` and `src/lib/util/exportDiagram.ts`; the share links to `dialogs/ShareDialog.svelte`. Carry an upstream change to `Actions.svelte` over to `exportDiagram.ts` by hand and keep the file deleted                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/routes/(app)/edit/+page.svelte`                                                                                                    | The inspector layout: the code column (`editor/CodePane.svelte` around upstream's editor), the diagram column (`canvas/CanvasPane.svelte`: add bar, view, `<SelectionLayer>`, zoom controls, table view) and the inspector, each side foldable to a `PaneRail`, widths kept in `editorLayout.svelte.ts` (paneforge without `autoSaveId`); the history column when open; the undo history reset once the diagram is loaded                                                                                                                                                                                                                                                                                               |
| `src/lib/util/saveFile.ts`                                                                                                              | Added. File names (the diagram's title by default, made safe for every file system) and the download under the name typed in the 書き出す dialog. The save picker and `SaveAsDialog.svelte` / `saveAsPrompt.svelte.ts` were removed on 2026-10-12 (user decision: no second name dialog)                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/util/drawioExport.ts`, `vsdxExport.ts`, `pptxExport.ts`, `xmlText.ts`                                                          | Added. The `.drawio` file (every element its own draw.io cell, converted from the rendered SVG by `svgToDrawio.ts` with `svgPath.ts`; source in the root cell's `mermaidData`) and the `.vsdx` package (one page, the diagram as a PNG picture, source in Shape Data; zipped with `fflate`), and the `.pptx` (one 16:9 slide of native PowerPoint shapes, glued connectors and text boxes made from the same cells; source in the notes)                                                                                                                                                                                                                                                                                |
| `tests/test.ts`                                                                                                                         | The fixture opens the 書き出す and 新規 dialogs for the helpers upstream's specs call (`toggleActions`, `toggleSampleDiagrams`, `loadSampleDiagram`, the PNG/SVG downloads; `tests/helpers/`), sets the guide flag, and offers `captureWindowOpen` for what opens in a new tab. The `saveAs` option is gone with the name dialog                                                                                                                                                                                                                                                                                                                                                                                        |
| `package.json`                                                                                                                          | Adds the `@iconify-json/*` packs (tabler, lucide, carbon, fluent, flat-color-icons, clarity, eos-icons, fluent-color, simple-icons, devicon) `dompurify` and `fflate` to `dependencies`, `fetch-icon-packs.js` to `build`, and `!src/lib/vendor-icons/` to `files`                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

The pane markup is local: upstream has one editor column and the view. On a conflict,
take upstream's changes to what goes inside the editor and the view, and keep the three
columns (code, diagram, inspector), the rails and the add bar; `tests/fixedLayout.spec.ts`,
`tests/editorPanes.spec.ts` and `tests/header.spec.ts` fail if the layout is lost,
`tests/selection.spec.ts` and `tests/inspector.spec.ts` if the selection layer or the
inspector is.

### Inspector layout (2026-10-12)

The redesign of `/edit` into code | diagram | inspector (`STATUS.md`, "Editor layout: the
inspector"). The new components and helpers are local files; these are the upstream files it
touches, deletes or leaves unused:

| Path                                                                                                                                | Local change                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/Editor.svelte`                                                                                                  | The syntax error under the editor is one compact block (mermaid's message in full; the code pane's footer says it in one line); the Mermaid Chart repair button keeps its guard. Still mounts `MobileEditor.svelte` (unchanged) for narrow windows |
| `src/lib/components/Share.svelte`                                                                                                   | Rendered inside `dialogs/ShareDialog.svelte` instead of its own trigger: the embed code (iframe or web component, size, grid) with the links above it; copy buttons through `CopyButton`                                                           |
| `src/lib/components/History/History.svelte`, `historyState.svelte.ts`                                                               | The Gist revisions tab is gone (user decision); import checks as before                                                                                                                                                                            |
| `src/lib/util/migrations.svelte.ts`, `migrations.test.ts`                                                                           | Runs `migrateEditorLayout` (`editorLayout.svelte.ts`): the old pane keys and `locale` are read once and removed                                                                                                                                    |
| `src/lib/components/Actions.svelte`, `src/lib/components/Preset.svelte`                                                             | Deleted; see their rows above                                                                                                                                                                                                                      |
| `src/lib/components/MainMenu.svelte`, `src/lib/components/DiagramDocumentationButton.svelte`, `src/lib/components/Card/Card.svelte` | No longer imported (or no longer given a local prop) and therefore restored to upstream's version, so a merge takes upstream's side without a conflict                                                                                             |
| `tests/docMap.spec.ts`                                                                                                              | Deleted: it checked the Docs link above the code, which the code pane no longer shows (user decision). `DiagramDocumentationButton.svelte` and `diagramDocs.ts` stay upstream's                                                                    |
| `tests/*.spec.ts` (upstream's)                                                                                                      | Select through `tests/helpers/` (the dialogs, the add bar, the inspector) where upstream clicked cards that no longer exist                                                                                                                        |

New local files: `src/lib/components/{canvas,dialogs,editor,form,inspector}/`,
`src/lib/util/{colorRecent.svelte,diagramFont,flowShapes,editorLayout.svelte,editorUi.svelte,exportDiagram,insertActions,newTab,newThumbs,sampleCatalog}.ts`
and their tests, `tests/helpers/` and `tests/inspector.spec.ts`. Removed local files (they were
listed as Added): the tool cards (`AddControls`, `AddActions`, `ArchitectureAdd`,
`EditControls`, `ColorControls`, `ColorSwatches`, `LayoutControls`, `AiTools`, `SelectionPanel`,
`SelectionToolbar`, `NewDiagram`, `HtmlExport`, `ShareLinks`), the shell (`ToolsBar`,
`ToolsTabs`, `EditorRail`, `EditorPaneToggle`, `DiagramToolbar`, `StyleCodeIcon`,
`CommandPalette`, `LocaleToggle`, `SaveAsDialog`) and `commands.ts`, `uiBus.ts`, `toolsPane.svelte.ts`,
`toolbarPlacement.ts`, `exportPresets.ts`, `saveAsPrompt.svelte.ts` with their tests and specs.

### Input hardening (source review of 2026-10-08)

| Path                                                                                | Local change                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/util/sanitize.ts`                                                          | `silentlySanitizeConfig` treats JSON whose root is not an object (`null`, a number, a string, an array) as no config instead of throwing or spreading it (R06)                                                                                                                  |
| `src/lib/components/History/historyState.svelte.ts`, `History.svelte`               | Import checks each entry (known type, finite time, a saved state via `stateGuard.ts`, a text id or a new one), dedupes ids within the file too, and reports a file that is not a JSON list instead of throwing (R07)                                                            |
| `src/lib/util/exportDiagram.ts`, `CopyButton.svelte`, `src/lib/util/imageExport.ts` | PNG export and image copy are one promise (image load, canvas, blob, clipboard write) whose failure reaches the caller; pan/zoom is paused while the image is taken                                                                                                             |
| `src/lib/util/serde.ts`                                                             | `deserialize` refuses a link that unpacks (pako, inflated in chunks) or decodes (base64) to more than `MAX_INFLATED_BYTES` (5 MB); the pako bytes are decoded with `TextDecoder` as pako 2.1.0 does, so `serde.compat.test.ts` holds. On an upstream pako upgrade re-check both |
| `src/lib/util/util.ts`, `src/lib/util/fileLoaders/loader.ts`                        | `fetchText`/`fetchJSON` reject a non-2xx answer naming the status; an empty `?code=` file is refused instead of replacing the diagram with the default; `initHandler` reports a failed URL load and keeps the current diagram                                                   |
| `src/lib/util/embed.ts`                                                             | The hash state goes through `normalizeState` (a state that is not one is a link error; a pan, zoom, rough or grid of the wrong type is dropped), and `?zoom=` must be positive                                                                                                  |

Review of 2026-10-13 (N01, N02, N05), same rule on a conflict:

| Path                                                           | Local change                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/View.svelte`, `src/lib/util/renderView.ts` | `View` records what each placed picture was drawn from (code, config, hand-drawn) and its viewBox before pan/zoom (`markDrawn` / `getDrawnFrom`)                                                                                                                                                                                              |
| `src/lib/util/exportDiagram.ts`, `dialogs/ExportDialog.svelte` | `.drawio` / `.vsdx` take the dialog's one state snapshot and stop with `ExportStaleError` when the view shows another; every save takes an `AbortSignal` that キャンセル aborts; the SVG file is `unzoomedCopy` of the view (no pan/zoom transform, the viewBox restored). Tests `exportDiagram.capture.test.ts`, `tests/fileExports.spec.ts` |
| `src/lib/util/htmlExport.ts`                                   | The Markdown image link is the file name as one percent-encoded path segment (`fileUrlSegment`)                                                                                                                                                                                                                                               |

On a conflict, take upstream's version and re-apply these guards; the tests named in each commit (`sanitize.test.ts`, `historyState.test.ts`, …) fail if one is lost.

### Cross-platform guards

The build may run on Windows, so the build and publish path uses only
package-manager invocations and Node scripts — never a shell builtin or a
Unix-only command. Details in `docs-dev/CROSS-PLATFORM.md`; at merge time:

| Path                               | Local change                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.gitattributes`                   | Added. `* text=auto eol=lf`, so a Windows checkout matches Linux and Prettier does not fail on CRLF                                                          |
| `scripts/prepare-pages.js`         | Added. Replaces `mv docs public` in CI                                                                                                                       |
| `scripts/update-from-registry.mjs` | Added. Downloads the package from a registry (or takes a local tarball, `--tarball`), extracts it in pure Node, installs and builds; proven on Windows by CI |
| `vite.embed.config.js`             | Adds `publicDir: false`                                                                                                                                      |
| `package.json`                     | `build:pages` and `dev:force` point at local scripts; `postinstall` guards with `node -e` inline                                                             |
| `.gitignore`                       | Ignores `/public`                                                                                                                                            |

`publicDir: false` is load-bearing, not tidying. That config has no SvelteKit
plugin, so Vite defaults `publicDir` to `public` while its `outDir` is `static`.
Once `pnpm build:pages` creates `public/`, a later build copies the whole
generated site into the tracked `static/` directory. If a merge drops that line,
CI starts committing its own output.

Should upstream reintroduce a shell-only step in `postinstall` or a CI script,
it will merge cleanly and only fail on a Windows machine. Re-read
`docs-dev/CROSS-PLATFORM.md` after a merge that touches `package.json` scripts.

### Theme changes

`docs-dev/THEME.md` has the rationale and the measured contrast figures. At merge
time:

| Path                               | Local change                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app.css`                      | `--accent` per mode (upstream uses one pink for both) and a near-black `--accent-foreground` in dark; restates the dialogs' centring outside any layer, which a ZenUML diagram's injected Tailwind 3 reset otherwise overrides (2026-10-12) |
| `src/app.html`                     | `theme-color` meta as a `prefers-color-scheme` pair instead of the pink; an inline script that puts an in-memory `localStorage` in place when the browser blocks it (keep it before `%sveltekit.head%`)                                     |
| `src/lib/components/Navbar.svelte` | Upstream's Mermaid logo removed from the header                                                                                                                                                                                             |
| `static/icons/mermaid.svg`         | Deleted — the brand mark, now unused                                                                                                                                                                                                        |
| `static/favicon.{svg,png,ico}`     | Brand mark replaced with a generic diagram glyph                                                                                                                                                                                            |
| `static/manifest.json`             | `background_color` and `theme_color` moved off the brand pink; icon, `start_url` and `scope` are relative so they follow `MERMAID_BASE_PATH`                                                                                                |

The dark `--accent-foreground` is near-black **because** the dark accent is
bright. Restoring upstream's near-white value there drops accent-button labels to
1.9:1, well under AA, so a merge must not take upstream's side of that line on
its own.

The light/dark mechanism is upstream's and untouched: the editor follows the
operating system. `docs-dev/THEME.md` records why `<ModeWatcher defaultMode>`
cannot change that on its own, should a fixed default ever be wanted.

### UI language

`docs-dev/I18N.md` has the design. At merge time the shape matters more than the
strings: nearly every component that renders text now reads it from
`src/lib/i18n/messages.ts` through `t('some.key')`, so an upstream change to a
label arrives as a conflict on a line this fork replaced with a lookup.

Resolving one is mechanical — take upstream's structural change, keep the `t()`
call, and update the message in the catalogue if the wording moved. Two rules
keep that honest:

- The `en` catalogue is upstream's wording. If upstream rewords a string, the
  edit belongs in `ja.ts`/`en.ts`, not at the call site.
- Keys are typed off `en`, and `src/lib/i18n/i18n.test.ts` asserts both locales
  carry the same keys and the same `{placeholders}`. Adding a key to one locale
  only fails `pnpm check` or the unit suite, not review.

| Path                                     | Local change                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/i18n/`                          | Added: the catalogue, `t()`, and their test                                                                                                    |
| `src/lib/util/env.ts`                    | Added `locale`, read from `MERMAID_LOCALE`                                                                                                     |
| `src/lib/util/state.svelte.ts`           | The broken-URL diagram comes from the catalogue, and no longer links to upstream's issue tracker (below)                                       |
| `src/lib/components/Card/Card.svelte`    | Restored to upstream's version on 2026-10-12: the `testID` prop it gained for the tool cards has no user left (History passes none)            |
| `tests/test.ts`                          | Exports a test-side `t()`; the specs select by catalogue key rather than by English text                                                       |
| `src/lib/components/LocaleToggle.svelte` | Added for the language button, deleted on 2026-10-12 with it (user decision: Japanese only; `MERMAID_LOCALE` still picks the build's language) |
| `tests/locale.spec.ts`                   | Deleted with the language button (2026-10-12); `tests/releaseAudit.spec.ts` checks that an English browser still gets the Japanese UI          |

Upstream's new specs arrive selecting by English text and fail against the Japanese UI —
`tests/configMigration.spec.ts` (waits for "Sample Diagrams") did exactly that in the
2026-09-27 merge. Switch such selectors to `t('key')` as part of the merge.

The one place this fork does **not** keep upstream's wording is the flowchart
`state.svelte.ts` renders when a shared URL fails to parse. Upstream ends it with
a `click` handler filing a bug against `mermaid-js/mermaid-live-editor`. A fork
must not send its users to upstream's issue tracker for a link its own
deployment produced, so both locales point at the deployment's administrator and
the handler is gone. Re-taking upstream's side of that string reintroduces the
link.

### Deleted upstream files

These upstream files are deleted in this fork. Three reasons cover all of them: they serve
mermaid.live's own release, hosting and funding and misfire when they run under
`smjr3/mermaid-editor`, nothing in this fork uses them and nothing is planned to, or a
local component replaces them (the two floating toolbars).

| Path                                                                                             | Why it is gone                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy.yml`                                                                   | Publishes to GitHub Pages for mermaid.live (custom domain, no sub-path); this fork's own `pages.yml` publishes under `/mermaid-editor`; `ci/gitlab-ci.example.yml` is a template for GitLab Pages.                                                 |
| `.github/workflows/docker-publish.yml`                                                           | On pushes to `master` it publishes an image to `ghcr.io/${{ github.repository }}` — this fork's own namespace, so it would publish for real rather than failing on upstream's.                                                                     |
| `.github/workflows/close-broken-link-issues.yml`                                                 | Auto-closes new issues with mermaid.live support boilerplate; it fires on this fork's own issues.                                                                                                                                                  |
| `.github/workflows/update-browserlist.yml`                                                       | Scheduled PR against a `develop` base branch that does not exist here.                                                                                                                                                                             |
| `.github/workflows/release-pr.yml`                                                               | Triggers on pushes to `develop`, which does not exist here.                                                                                                                                                                                        |
| `netlify.toml`                                                                                   | Netlify build config carrying mermaid.live environment values.                                                                                                                                                                                     |
| `CNAME`, `.nojekyll`                                                                             | GitHub Pages settings (the `mermaid.live` custom domain, Jekyll opt-out); this fork does not ship a hosting configuration.                                                                                                                         |
| `.github/FUNDING.yml`                                                                            | `github: [sidharthv96, knsv]` — renders a "Sponsor this project" button on this repository that pays the upstream maintainers.                                                                                                                     |
| `SECURITY.md`                                                                                    | Tells reporters to e-mail `security@mermaid.live`, which would send vulnerability reports about this deployment to upstream.                                                                                                                       |
| `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `.dockerignore`                                | This fork ships an npm package built into a static site and never builds or publishes a container. With `docker-publish.yml` gone nothing validated them either, so they could only rot.                                                           |
| `bin/beta-release`, `bin/fix-path`, `bin/update-monaco.js`                                       | mermaid.live release helpers (publish into `mermaid-js/docs`, rewrite its paths, refresh Monaco CDN tags `src/app.html` no longer has). No script calls them.                                                                                      |
| `renovate.json`, `.github/dependabot.disabled.yml`                                               | Upstream's dependency bots, targeting `develop`. No bot is installed here; dependency updates are done by hand as recorded in `STATUS.md`.                                                                                                         |
| `src/lib/components/SyncRoughToolbar.svelte`, `src/lib/components/VersionSecurityToolbar.svelte` | Deleted. Replaced first by one bar above the diagram, since 2026-10-12 by the zoom controls at its bottom right (`canvas/ZoomControls.svelte`) and the inspector's 手描き風 row. Kept as dead files they would take upstream's changes for nothing |

`.github/workflows/tests.yml`, `unit-tests.yml` and `codeql-analysis.yml` are kept —
they run CI, not releases. `codeql-analysis.yml` carries one local change: a job-level
`permissions` block granting `security-events: write`, without which `push` and `schedule`
runs cannot upload results. Keep it if upstream rewrites the file, unless upstream adds its
own (`STATUS.md`, CodeQL).

Unused upstream dev dependencies were removed from `package.json` for the same reason:
`@eslint/eslintrc`, `@iconify-json/hugeicons`, `@tailwindcss/typography`, `autoprefixer`,
`c8`, `chai`, `cssnano`, `eslint-plugin-es`, `eslint-plugin-no-only-tests`,
`eslint-plugin-tailwindcss`, `node-html-parser` (only `bin/update-monaco.js` used it),
`tslib` and `vitest-dom`. None was loaded by any config, script or source file. If an
upstream merge brings one back, check whether upstream started using it before deleting
it again.

**A merge will bring deleted files back whenever upstream touches them.** Git treats
"deleted here, modified there" as a conflict and, if upstream only adds files, it
restores them with no conflict at all. After every merge, re-check that none of them
have reappeared:

```sh
git ls-files -- \
  .github/workflows/deploy.yml \
  .github/workflows/docker-publish.yml \
  .github/workflows/close-broken-link-issues.yml \
  .github/workflows/update-browserlist.yml \
  .github/workflows/release-pr.yml \
  netlify.toml CNAME .nojekyll .github/FUNDING.yml SECURITY.md \
  Dockerfile docker-compose.yml nginx.conf .dockerignore \
  bin/beta-release bin/fix-path bin/update-monaco.js \
  renovate.json .github/dependabot.disabled.yml \
  src/lib/components/SyncRoughToolbar.svelte \
  src/lib/components/VersionSecurityToolbar.svelte
```

It prints one line per file that is tracked again. Silence means the deletions
survived the merge; any output is a file to delete again.

Delete any that returned (`git rm`) before pushing the merge. Do not resolve such a
conflict by keeping upstream's version.

## Verification after every merge

1. Install dependencies and run `pnpm build`.
2. Exercise the npm pack round-trip: create the tarball with `npm pack`, unpack it in
   a clean temporary directory, run `npm install`, and then run `npm run build` from
   the unpacked package. Run `npm audit --omit=dev` there as well: npm ignores
   `pnpm.overrides`, so a clean `pnpm audit --prod` does not cover this install path.
3. Run `pnpm licenses list --prod` and regenerate `THIRD-PARTY-LICENSES.md` from the
   current production dependency licenses.
4. Update and JSON-parse `.upstream-version.json`; verify that its imported tree is
   the pristine vendor commit's tree.
5. Confirm none of the deleted upstream files reappeared (see
   [Deleted upstream files](#deleted-upstream-files)).
6. Confirm the feature-flag guards survived and no new promotional, AI or outbound-link
   surface appeared (see [Feature-flag guards](#feature-flag-guards-in-src-and-tests)).
7. Confirm the cross-platform guards survived, in particular `publicDir: false` in
   `vite.embed.config.js` (see [Cross-platform guards](#cross-platform-guards)).
8. Confirm the dark `--accent-foreground` survived as a near-black value (see
   [Theme changes](#theme-changes)).
9. Confirm the swimlane samples still load and render (`tests/swimlane.spec.ts`; see
   [Swimlane samples](#swimlane-samples)).
10. Run `node scripts/check-local-delta.js` last, after every other edit.

## Current local file layer

The following list is accurate as of **2026-10-21**. It is a snapshot, not a
permanent allowlist.

Re-derive it against the **current vendor base** — the `vendorBaseCommit` recorded in
`.upstream-version.json`, which is updated on every import. Read it from the record
rather than naming the `vendor/upstream` branch, so the command works in a fresh
clone that has not fetched that branch:

```sh
vendor_base=$(node -p "require('./.upstream-version.json').vendorBaseCommit")
git diff --name-status "$vendor_base"
```

After updating the table below (and the count in `STATUS.md`), confirm it with
`node scripts/check-local-delta.js`.

Do **not** re-derive it against the original import `d4f0d43`. That commit is frozen
at upstream 2.0.67. Once any upstream update has been merged, `HEAD` carries upstream
code newer than `d4f0d43`, so diffing against it reports upstream's own additions and
modifications as if they were local customizations.

| Status   | Path                                                  |
| -------- | ----------------------------------------------------- |
| Added    | `.claude/hooks/session-start.sh`                      |
| Added    | `.claude/settings.json`                               |
| Deleted  | `.dockerignore`                                       |
| Modified | `.env`                                                |
| Added    | `.gitattributes`                                      |
| Deleted  | `.github/FUNDING.yml`                                 |
| Deleted  | `.github/dependabot.disabled.yml`                     |
| Modified | `.github/pull_request_template.md`                    |
| Deleted  | `.github/workflows/close-broken-link-issues.yml`      |
| Modified | `.github/workflows/codeql-analysis.yml`               |
| Deleted  | `.github/workflows/deploy.yml`                        |
| Deleted  | `.github/workflows/docker-publish.yml`                |
| Added    | `.github/workflows/fork-checks.yml`                   |
| Added    | `.github/workflows/pages.yml`                         |
| Added    | `.github/workflows/publish.yml`                       |
| Deleted  | `.github/workflows/release-pr.yml`                    |
| Modified | `.github/workflows/tests.yml`                         |
| Deleted  | `.github/workflows/update-browserlist.yml`            |
| Modified | `.gitignore`                                          |
| Modified | `.husky/pre-commit`                                   |
| Deleted  | `.nojekyll`                                           |
| Added    | `.upstream-version.json`                              |
| Modified | `CLAUDE.md`                                           |
| Deleted  | `CNAME`                                               |
| Deleted  | `Dockerfile`                                          |
| Added    | `NOTICE`                                              |
| Modified | `README.md`                                           |
| Added    | `README.upstream.md`                                  |
| Deleted  | `SECURITY.md`                                         |
| Added    | `THIRD-PARTY-LICENSES.md`                             |
| Deleted  | `bin/beta-release`                                    |
| Deleted  | `bin/fix-path`                                        |
| Deleted  | `bin/update-monaco.js`                                |
| Added    | `ci/gitlab-ci.example.yml`                            |
| Deleted  | `docker-compose.yml`                                  |
| Added    | `docs-dev/CROSS-PLATFORM.md`                          |
| Added    | `docs-dev/EXPORTS.md`                                 |
| Added    | `docs-dev/FEATURE-FLAGS.md`                           |
| Added    | `docs-dev/GITLAB-PAGES.md`                            |
| Added    | `docs-dev/I18N.md`                                    |
| Added    | `docs-dev/ICONS.md`                                   |
| Added    | `docs-dev/PACKAGING.md`                               |
| Added    | `docs-dev/QUALITY-AUDIT-2026-08-31.md`                |
| Added    | `docs-dev/STATUS.md`                                  |
| Added    | `docs-dev/THEME.md`                                   |
| Added    | `docs-dev/UPSTREAM.md`                                |
| Deleted  | `netlify.toml`                                        |
| Deleted  | `nginx.conf`                                          |
| Modified | `package.json`                                        |
| Modified | `playwright.config.ts`                                |
| Modified | `pnpm-lock.yaml`                                      |
| Deleted  | `renovate.json`                                       |
| Added    | `scripts/check-local-delta.js`                        |
| Added    | `scripts/copy-legal-files.js`                         |
| Added    | `scripts/dev-force.js`                                |
| Added    | `scripts/fetch-icon-packs.d.ts`                       |
| Added    | `scripts/fetch-icon-packs.js`                         |
| Added    | `scripts/fetch-icon-packs.node-test.mjs`              |
| Added    | `scripts/prepare-pages.js`                            |
| Added    | `scripts/svg-to-iconify.d.ts`                         |
| Added    | `scripts/svg-to-iconify.js`                           |
| Added    | `scripts/update-from-registry.mjs`                    |
| Added    | `scripts/update-from-registry.node-test.mjs`          |
| Added    | `scripts/update-upstream.sh`                          |
| Modified | `src/app.css`                                         |
| Modified | `src/app.html`                                        |
| Deleted  | `src/lib/components/Actions.svelte`                   |
| Added    | `src/lib/components/AiIconPrompt.svelte`              |
| Modified | `src/lib/components/Card/Tabs.svelte`                 |
| Added    | `src/lib/components/CodeErrorNotice.svelte`           |
| Modified | `src/lib/components/CopyButton.svelte`                |
| Added    | `src/lib/components/CopyButton.test.ts`               |
| Modified | `src/lib/components/CopyInput.svelte`                 |
| Modified | `src/lib/components/DesktopEditor.svelte`             |
| Added    | `src/lib/components/DiagramContextMenu.svelte`        |
| Modified | `src/lib/components/Editor.svelte`                    |
| Modified | `src/lib/components/ExternalLinkWrapper.svelte`       |
| Added    | `src/lib/components/GuideTour.svelte`                 |
| Added    | `src/lib/components/HelpButton.svelte`                |
| Modified | `src/lib/components/History/History.svelte`           |
| Modified | `src/lib/components/History/historyState.svelte.ts`   |
| Modified | `src/lib/components/History/historyState.test.ts`     |
| Added    | `src/lib/components/IconChooser.svelte`               |
| Added    | `src/lib/components/IconLicenseTable.svelte`          |
| Added    | `src/lib/components/IconPacks.svelte`                 |
| Added    | `src/lib/components/IconPicker.svelte`                |
| Modified | `src/lib/components/Navbar.svelte`                    |
| Modified | `src/lib/components/PanZoomToolbar.svelte`            |
| Deleted  | `src/lib/components/Preset.svelte`                    |
| Modified | `src/lib/components/Privacy.svelte`                   |
| Added    | `src/lib/components/ResetAllButton.svelte`            |
| Added    | `src/lib/components/ResetConfigButton.svelte`         |
| Added    | `src/lib/components/SelectionLayer.svelte`            |
| Modified | `src/lib/components/Share.svelte`                     |
| Deleted  | `src/lib/components/SyncRoughToolbar.svelte`          |
| Added    | `src/lib/components/TableEditor.svelte`               |
| Added    | `src/lib/components/TableEditor.test.ts`              |
| Added    | `src/lib/components/TemplateForms.svelte`             |
| Added    | `src/lib/components/UndoRedoButtons.svelte`           |
| Added    | `src/lib/components/UnknownIcons.svelte`              |
| Added    | `src/lib/components/VersionInfo.svelte`               |
| Deleted  | `src/lib/components/VersionSecurityToolbar.svelte`    |
| Modified | `src/lib/components/View.svelte`                      |
| Added    | `src/lib/components/canvas/AddActionForm.svelte`      |
| Added    | `src/lib/components/canvas/AddFormFrame.svelte`       |
| Added    | `src/lib/components/canvas/ArchAddForms.svelte`       |
| Added    | `src/lib/components/canvas/CanvasPane.svelte`         |
| Added    | `src/lib/components/canvas/FlowInsert.svelte`         |
| Added    | `src/lib/components/canvas/InsertBar.svelte`          |
| Added    | `src/lib/components/canvas/InsertItems.svelte`        |
| Added    | `src/lib/components/canvas/SelectionBar.svelte`       |
| Added    | `src/lib/components/canvas/SpecInsert.svelte`         |
| Added    | `src/lib/components/canvas/ViewModeSwitch.svelte`     |
| Added    | `src/lib/components/canvas/ZoomControls.svelte`       |
| Added    | `src/lib/components/canvas/connectMode.svelte.ts`     |
| Added    | `src/lib/components/canvas/panMode.svelte.test.ts`    |
| Added    | `src/lib/components/canvas/panMode.svelte.ts`         |
| Added    | `src/lib/components/dialogs/ExportDialog.svelte`      |
| Added    | `src/lib/components/dialogs/NewDiagramDialog.svelte`  |
| Added    | `src/lib/components/dialogs/ShareDialog.svelte`       |
| Added    | `src/lib/components/editor/CodePane.svelte`           |
| Added    | `src/lib/components/editor/PaneRail.svelte`           |
| Added    | `src/lib/components/form/FieldRow.svelte`             |
| Added    | `src/lib/components/form/PanelGroup.svelte`           |
| Added    | `src/lib/components/form/Segmented.svelte`            |
| Added    | `src/lib/components/form/SwitchRow.svelte`            |
| Added    | `src/lib/components/inspector/ColorRow.svelte`        |
| Added    | `src/lib/components/inspector/DetailFieldRow.svelte`  |
| Added    | `src/lib/components/inspector/DiagramSettings.svelte` |
| Added    | `src/lib/components/inspector/EdgeSection.svelte`     |
| Added    | `src/lib/components/inspector/Inspector.svelte`       |
| Added    | `src/lib/components/inspector/Inspector.test.ts`      |
| Added    | `src/lib/components/inspector/LaneSection.svelte`     |
| Added    | `src/lib/components/inspector/LookRow.svelte`         |
| Added    | `src/lib/components/inspector/MultiSection.svelte`    |
| Added    | `src/lib/components/inspector/NameField.svelte`       |
| Added    | `src/lib/components/inspector/NodeSection.svelte`     |
| Added    | `src/lib/components/inspector/ObjectFields.svelte`    |
| Added    | `src/lib/components/inspector/SelectSameRow.svelte`   |
| Added    | `src/lib/components/inspector/TargetPicker.svelte`    |
| Modified | `src/lib/constants.ts`                                |
| Added    | `src/lib/i18n/en.ts`                                  |
| Added    | `src/lib/i18n/i18n.test.ts`                           |
| Added    | `src/lib/i18n/index.ts`                               |
| Added    | `src/lib/i18n/ja.ts`                                  |
| Added    | `src/lib/i18n/messages.ts`                            |
| Added    | `src/lib/i18n/translate.ts`                           |
| Modified | `src/lib/types.d.ts`                                  |
| Added    | `src/lib/util/addActions.test.ts`                     |
| Added    | `src/lib/util/addActions.ts`                          |
| Added    | `src/lib/util/aiCollection.svelte.ts`                 |
| Added    | `src/lib/util/aiPrompt.test.ts`                       |
| Added    | `src/lib/util/aiPrompt.ts`                            |
| Added    | `src/lib/util/allDiagrams.test.ts`                    |
| Added    | `src/lib/util/architectureLabels.test.ts`             |
| Added    | `src/lib/util/architectureLabels.ts`                  |
| Added    | `src/lib/util/autoSync.test.ts`                       |
| Modified | `src/lib/util/autoSync.ts`                            |
| Added    | `src/lib/util/chartEdit.test.ts`                      |
| Added    | `src/lib/util/chartEdit.ts`                           |
| Added    | `src/lib/util/codeError.test.ts`                      |
| Added    | `src/lib/util/codeError.ts`                           |
| Added    | `src/lib/util/codeHealth.svelte.ts`                   |
| Added    | `src/lib/util/codeHealth.test.ts`                     |
| Added    | `src/lib/util/codeText.ts`                            |
| Added    | `src/lib/util/colorRecent.svelte.ts`                  |
| Added    | `src/lib/util/colors.test.ts`                         |
| Added    | `src/lib/util/colors.ts`                              |
| Added    | `src/lib/util/customIconStore.test.ts`                |
| Added    | `src/lib/util/customIconStore.ts`                     |
| Added    | `src/lib/util/customIcons.test.ts`                    |
| Added    | `src/lib/util/customIcons.ts`                         |
| Added    | `src/lib/util/darkLines.test.ts`                      |
| Added    | `src/lib/util/darkLines.ts`                           |
| Added    | `src/lib/util/diagramDetails.test.ts`                 |
| Added    | `src/lib/util/diagramDetails.ts`                      |
| Added    | `src/lib/util/diagramEdit.test.ts`                    |
| Added    | `src/lib/util/diagramEdit.ts`                         |
| Added    | `src/lib/util/diagramFont.test.ts`                    |
| Added    | `src/lib/util/diagramFont.ts`                         |
| Added    | `src/lib/util/diagramIds.ts`                          |
| Added    | `src/lib/util/diagramModify.test.ts`                  |
| Added    | `src/lib/util/diagramModify.ts`                       |
| Added    | `src/lib/util/diagramOptions.test.ts`                 |
| Added    | `src/lib/util/diagramOptions.ts`                      |
| Added    | `src/lib/util/diagramPick.test.ts`                    |
| Added    | `src/lib/util/diagramPick.ts`                         |
| Added    | `src/lib/util/diagramTitle.test.ts`                   |
| Added    | `src/lib/util/diagramTitle.ts`                        |
| Added    | `src/lib/util/displayName.test.ts`                    |
| Added    | `src/lib/util/displayName.ts`                         |
| Added    | `src/lib/util/drawioExport.test.ts`                   |
| Added    | `src/lib/util/drawioExport.ts`                        |
| Added    | `src/lib/util/editorLayout.svelte.ts`                 |
| Added    | `src/lib/util/editorLayout.test.ts`                   |
| Added    | `src/lib/util/editorUi.svelte.ts`                     |
| Added    | `src/lib/util/editorUi.test.ts`                       |
| Modified | `src/lib/util/embed.test.ts`                          |
| Modified | `src/lib/util/embed.ts`                               |
| Modified | `src/lib/util/env.ts`                                 |
| Added    | `src/lib/util/exportDiagram.capture.test.ts`          |
| Added    | `src/lib/util/exportDiagram.test.ts`                  |
| Added    | `src/lib/util/exportDiagram.ts`                       |
| Added    | `src/lib/util/fakeIndexedDB.ts`                       |
| Added    | `src/lib/util/fetchIconPacks.test.ts`                 |
| Added    | `src/lib/util/fileLoaders/loader.test.ts`             |
| Modified | `src/lib/util/fileLoaders/loader.ts`                  |
| Added    | `src/lib/util/flowShapes.test.ts`                     |
| Added    | `src/lib/util/flowShapes.ts`                          |
| Added    | `src/lib/util/helpContent.test.ts`                    |
| Added    | `src/lib/util/helpContent.ts`                         |
| Added    | `src/lib/util/htmlExport.test.ts`                     |
| Added    | `src/lib/util/htmlExport.ts`                          |
| Added    | `src/lib/util/iconCatalog.test.ts`                    |
| Added    | `src/lib/util/iconCatalog.ts`                         |
| Added    | `src/lib/util/iconCategories.test.ts`                 |
| Added    | `src/lib/util/iconCategories.ts`                      |
| Added    | `src/lib/util/iconLicenses.test.ts`                   |
| Added    | `src/lib/util/iconLicenses.ts`                        |
| Added    | `src/lib/util/iconPacks.test.ts`                      |
| Added    | `src/lib/util/iconPacks.ts`                           |
| Added    | `src/lib/util/iconSearch.test.ts`                     |
| Added    | `src/lib/util/iconSearch.ts`                          |
| Added    | `src/lib/util/imageExport.test.ts`                    |
| Added    | `src/lib/util/imageExport.ts`                         |
| Added    | `src/lib/util/insertActions.test.ts`                  |
| Added    | `src/lib/util/insertActions.ts`                       |
| Added    | `src/lib/util/inspectorMulti.test.ts`                 |
| Added    | `src/lib/util/inspectorMulti.ts`                      |
| Added    | `src/lib/util/inspectorTabs.test.ts`                  |
| Added    | `src/lib/util/inspectorTabs.ts`                       |
| Added    | `src/lib/util/layout.test.ts`                         |
| Added    | `src/lib/util/layout.ts`                              |
| Added    | `src/lib/util/localSamples.test.ts`                   |
| Added    | `src/lib/util/localSamples.ts`                        |
| Added    | `src/lib/util/memo.test.ts`                           |
| Added    | `src/lib/util/memo.ts`                                |
| Modified | `src/lib/util/mermaid.test.ts`                        |
| Modified | `src/lib/util/mermaid.ts`                             |
| Added    | `src/lib/util/mermaidRename.test.ts`                  |
| Added    | `src/lib/util/mermaidRename.ts`                       |
| Added    | `src/lib/util/mermaidRender.test.ts`                  |
| Modified | `src/lib/util/migrations.svelte.ts`                   |
| Modified | `src/lib/util/migrations.test.ts`                     |
| Added    | `src/lib/util/monacoInsert.ts`                        |
| Added    | `src/lib/util/moveAvailability.svelte.ts`             |
| Added    | `src/lib/util/newDiagram.test.ts`                     |
| Added    | `src/lib/util/newDiagram.ts`                          |
| Added    | `src/lib/util/newTab.ts`                              |
| Added    | `src/lib/util/newThumbs.ts`                           |
| Added    | `src/lib/util/offline.ts`                             |
| Added    | `src/lib/util/onboarding.svelte.ts`                   |
| Added    | `src/lib/util/panZoom.test.ts`                        |
| Modified | `src/lib/util/panZoom.ts`                             |
| Modified | `src/lib/util/persist.svelte.test.ts`                 |
| Modified | `src/lib/util/persist.svelte.ts`                      |
| Added    | `src/lib/util/pptxExport.test.ts`                     |
| Added    | `src/lib/util/pptxExport.ts`                          |
| Added    | `src/lib/util/renderScheduler.test.ts`                |
| Added    | `src/lib/util/renderScheduler.ts`                     |
| Added    | `src/lib/util/renderView.test.ts`                     |
| Modified | `src/lib/util/renderView.ts`                          |
| Added    | `src/lib/util/reorder.test.ts`                        |
| Added    | `src/lib/util/reorder.ts`                             |
| Added    | `src/lib/util/revealView.test.ts`                     |
| Added    | `src/lib/util/revealView.ts`                          |
| Added    | `src/lib/util/sampleCatalog.test.ts`                  |
| Added    | `src/lib/util/sampleCatalog.ts`                       |
| Added    | `src/lib/util/sampleNames.test.ts`                    |
| Added    | `src/lib/util/sampleNames.ts`                         |
| Modified | `src/lib/util/sanitize.test.ts`                       |
| Modified | `src/lib/util/sanitize.ts`                            |
| Added    | `src/lib/util/saveFile.test.ts`                       |
| Added    | `src/lib/util/saveFile.ts`                            |
| Added    | `src/lib/util/selection.svelte.ts`                    |
| Added    | `src/lib/util/selection.test.ts`                      |
| Added    | `src/lib/util/selectionActions.test.ts`               |
| Added    | `src/lib/util/selectionActions.ts`                    |
| Added    | `src/lib/util/selectionCommands.test.ts`              |
| Added    | `src/lib/util/selectionCommands.ts`                   |
| Added    | `src/lib/util/selectionKeys.test.ts`                  |
| Added    | `src/lib/util/selectionKeys.ts`                       |
| Added    | `src/lib/util/selectionModel.multi.test.ts`           |
| Added    | `src/lib/util/selectionModel.svelte.ts`               |
| Added    | `src/lib/util/serde.compat.test.ts`                   |
| Modified | `src/lib/util/serde.test.ts`                          |
| Modified | `src/lib/util/serde.ts`                               |
| Added    | `src/lib/util/settledState.svelte.ts`                 |
| Added    | `src/lib/util/standardIcons.test.ts`                  |
| Added    | `src/lib/util/standardIcons.ts`                       |
| Modified | `src/lib/util/state.svelte.test.ts`                   |
| Modified | `src/lib/util/state.svelte.ts`                        |
| Added    | `src/lib/util/stateGuard.test.ts`                     |
| Added    | `src/lib/util/stateGuard.ts`                          |
| Added    | `src/lib/util/stateLoad.test.ts`                      |
| Modified | `src/lib/util/stats.test.ts`                          |
| Modified | `src/lib/util/stats.ts`                               |
| Added    | `src/lib/util/svgPath.test.ts`                        |
| Added    | `src/lib/util/svgPath.ts`                             |
| Added    | `src/lib/util/svgToDrawio.test.ts`                    |
| Added    | `src/lib/util/svgToDrawio.ts`                         |
| Added    | `src/lib/util/svgToIconify.test.ts`                   |
| Added    | `src/lib/util/tableEdit.test.ts`                      |
| Added    | `src/lib/util/tableEdit.ts`                           |
| Added    | `src/lib/util/templateForms.test.ts`                  |
| Added    | `src/lib/util/templateForms.ts`                       |
| Added    | `src/lib/util/templateNotice.svelte.ts`               |
| Added    | `src/lib/util/templateThumbnails.ts`                  |
| Added    | `src/lib/util/themePresets.test.ts`                   |
| Added    | `src/lib/util/themePresets.ts`                        |
| Added    | `src/lib/util/undoStack.svelte.ts`                    |
| Added    | `src/lib/util/undoStack.test.ts`                      |
| Added    | `src/lib/util/util.test.ts`                           |
| Modified | `src/lib/util/util.ts`                                |
| Added    | `src/lib/util/vsdxExport.test.ts`                     |
| Added    | `src/lib/util/vsdxExport.ts`                          |
| Added    | `src/lib/util/xmlText.ts`                             |
| Modified | `src/routes/(app)/edit/+page.svelte`                  |
| Modified | `src/routes/+error.svelte`                            |
| Modified | `src/routes/embed/+page.svelte`                       |
| Modified | `src/tests/setup.ts`                                  |
| Modified | `static/favicon.ico`                                  |
| Modified | `static/favicon.png`                                  |
| Modified | `static/favicon.svg`                                  |
| Deleted  | `static/icons/mermaid.svg`                            |
| Modified | `static/manifest.json`                                |
| Modified | `tests/actions.spec.ts`                               |
| Added    | `tests/addControls.spec.ts`                           |
| Added    | `tests/aiIcons.spec.ts`                               |
| Added    | `tests/allDiagrams.spec.ts`                           |
| Added    | `tests/colors.spec.ts`                                |
| Modified | `tests/configMigration.spec.ts`                       |
| Added    | `tests/configReset.spec.ts`                           |
| Added    | `tests/contextMenu.spec.ts`                           |
| Added    | `tests/contradictions.spec.ts`                        |
| Modified | `tests/diagramUpdate.spec.ts`                         |
| Deleted  | `tests/docMap.spec.ts`                                |
| Added    | `tests/editControls.spec.ts`                          |
| Added    | `tests/editorAiGlyph.spec.ts`                         |
| Added    | `tests/editorPanes.spec.ts`                           |
| Modified | `tests/embed.spec.ts`                                 |
| Modified | `tests/errorDisplay.spec.ts`                          |
| Added    | `tests/errorRecovery.spec.ts`                         |
| Added    | `tests/exportOptions.spec.ts`                         |
| Added    | `tests/fileExports.spec.ts`                           |
| Added    | `tests/fixedLayout.spec.ts`                           |
| Added    | `tests/header.spec.ts`                                |
| Added    | `tests/help.spec.ts`                                  |
| Added    | `tests/helpers/canvas.ts`                             |
| Added    | `tests/helpers/exportDlg.ts`                          |
| Added    | `tests/helpers/inspector.ts`                          |
| Added    | `tests/helpers/newDlg.ts`                             |
| Added    | `tests/helpers/shell.ts`                              |
| Modified | `tests/history.spec.ts`                               |
| Added    | `tests/htmlExport.spec.ts`                            |
| Added    | `tests/iconBrowse.spec.ts`                            |
| Added    | `tests/iconImport.spec.ts`                            |
| Added    | `tests/iconLicenses.spec.ts`                          |
| Added    | `tests/iconPacks.spec.ts`                             |
| Added    | `tests/inspector.spec.ts`                             |
| Added    | `tests/inspectorMulti.spec.ts`                        |
| Added    | `tests/inspectorTabs.spec.ts`                         |
| Added    | `tests/invariants.ts`                                 |
| Added    | `tests/layout.spec.ts`                                |
| Modified | `tests/loadSite.spec.ts`                              |
| Modified | `tests/managedTheme.spec.ts`                          |
| Added    | `tests/monkey.spec.ts`                                |
| Added    | `tests/multiSelect.spec.ts`                           |
| Added    | `tests/newDiagram.spec.ts`                            |
| Added    | `tests/offline.spec.ts`                               |
| Added    | `tests/onboarding.spec.ts`                            |
| Added    | `tests/performance.spec.ts`                           |
| Added    | `tests/qaFindings.spec.ts`                            |
| Added    | `tests/qaFindings2.spec.ts`                           |
| Added    | `tests/releaseAudit.spec.ts`                          |
| Added    | `tests/renameSymbol.spec.ts`                          |
| Added    | `tests/selection.spec.ts`                             |
| Added    | `tests/selectionBar.spec.ts`                          |
| Added    | `tests/swimlane.spec.ts`                              |
| Added    | `tests/tableEditor.spec.ts`                           |
| Added    | `tests/templateForms.spec.ts`                         |
| Added    | `tests/templates.spec.ts`                             |
| Modified | `tests/test.ts`                                       |
| Added    | `tests/textStyle.spec.ts`                             |
| Added    | `tests/themePresets.spec.ts`                          |
| Added    | `tests/undo.spec.ts`                                  |
| Modified | `vite.embed.config.js`                                |

Re-derive this inventory after each update; do not assume it remains unchanged.
