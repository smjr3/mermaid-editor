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
It is what protects the published tarball, built with `npm install` in the internal
pipeline. Keep the two in step: an override added to one belongs in the other.

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

### Swimlane samples and business templates

| Path                                | Local change                                                                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/util/localSamples.ts`      | Added. Swimlane samples, which `@mermaid-js/examples` does not ship; the Japanese "業務テンプレート" group                                            |
| `src/lib/components/Preset.svelte`  | Spreads `localSamples` into the sample list after upstream's own; lists the business templates first; renders `<NewDiagram>` above the sample buttons |
| `src/lib/util/localSamples.test.ts` | Added. Each sample parses as its diagram type; none shadows an upstream sample; the templates are small and Japanese                                  |
| `tests/swimlane.spec.ts`            | Added. `@smoke`: the default sample renders its lanes, in both engines                                                                                |
| `tests/templates.spec.ts`           | Added. Each business template loads from the card and renders without an error                                                                        |

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

| Path                                                                                                                                  | Local change                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/util/env.ts`                                                                                                                 | Adds `isEnabledAiFeatures` and `isEnabledCommunityLinks` beside upstream's own `isEnabledMermaidChartLinks`                                                                                                                      |
| `src/lib/components/DesktopEditor.svelte`                                                                                             | Wraps `<AIPromptPopup>` in `{#if env.isEnabledAiFeatures}`; also gates its gutter button and glyph margin                                                                                                                        |
| `src/lib/util/util.ts`, `src/lib/components/DesktopEditor.svelte`, `src/lib/components/Actions.svelte`, `src/lib/util/env.ts`, `.env` | `MERMAID_OFFLINE`: refuses `?code=`/`?config=`/gist loading from any origin but the site's own (`assertFetchAllowed`), skips the config-schema download and the Font Awesome stylesheet line in exported SVGs; hides "Load Gist" |
| `src/routes/(app)/edit/+page.svelte`                                                                                                  | Wraps `<EnhancedEditsButton>` in the same guard                                                                                                                                                                                  |
| `src/lib/components/Navbar.svelte`                                                                                                    | Wraps the GitHub dropdown and its separator in `{#if env.isEnabledCommunityLinks}`                                                                                                                                               |
| `src/lib/components/MainMenu.svelte`                                                                                                  | Spreads the Discord "Community" entry in conditionally                                                                                                                                                                           |
| `.env`                                                                                                                                | Sets the organisational defaults                                                                                                                                                                                                 |
| `tests/actions.spec.ts`, `tests/errorDisplay.spec.ts`                                                                                 | Assert the configured behaviour rather than upstream's                                                                                                                                                                           |

These are additive guards, not rewrites: the guarded markup is upstream's own. On a
conflict, take upstream's version of the inner content and re-apply the surrounding
`{#if}`. Do **not** resolve by dropping the guard — that silently re-enables an AI or
promotional surface in an organisational build.

If upstream introduces a new promotional, AI or outbound-link surface, it arrives
unguarded and will not be caught by a merge conflict. After each merge, re-check the
running app for new external links; `docs-dev/FEATURE-FLAGS.md` lists the ones known
to remain.

### Editor, layout and icon additions (0.2.0)

Fork features that touch upstream files. Each upstream file gains a few lines that call
into a fork-local file; the logic lives in the fork-local file, so a conflict is resolved by
taking upstream's version and re-adding those lines.

| Path                                                                                                                                    | Local change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/DesktopEditor.svelte`                                                                                               | Calls `registerMermaidRename(monaco)` after `initEditor`: F2 / Rename Symbol for the `mermaid` language; registers `insertAtCursor` so the icon picker can insert at the cursor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/util/mermaidRename.ts`                                                                                                         | Added. The rename scan (skips labels, edge text, messages, comments, strings) and the Monaco provider, which applies a rename only if the diagram still parses as the same type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/util/state.svelte.ts`                                                                                                          | Adds `resetConfig()`, which returns the config to `{}` and keeps the diagram                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/components/ResetConfigButton.svelte`                                                                                           | Added. The "Reset config" button on the config tab                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/lib/util/mermaid.ts`                                                                                                               | Registers the bundled and hosted packs at module load, waits for the stored ones before rendering, and passes the SVG through `addLabelHalo`; `diagramObjects` lists the objects the Colours card can colour; renders and the cards' `getDiagramFromText` reads take turns (`diagramFromText`), since every parse clears mermaid's shared title store                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/lib/util/architectureLabels.ts`                                                                                                    | Added. Outlines architecture service and edge labels in the background colour so edges do not run through them (mermaid draws them that way)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/util/darkLines.ts`                                                                                                             | Added. Dark themes render with near-white lines unless the user set `lineColor`; a light-themed diagram gets its own background while the site is dark                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/util/iconPacks.ts`                                                                                                             | Added. The nine bundled packs (generic and logo sets), loaded lazily — never from a CDN; `MERMAID_BUNDLE_LOGOS=false` drops the logos; plus the build-time vendor packs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/lib/util/customIcons.ts`, `customIconStore.ts`                                                                                     | Added. Build-time vendor, hosted (`MERMAID_ICON_PACKS`) and user-imported packs, sanitised with DOMPurify; the IndexedDB store                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/components/IconPacks.svelte`                                                                                                   | Added. The "Icons" card: the bundled pack list and SVG / Iconify JSON import                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/util/env.ts`, `.env`                                                                                                           | Add `iconPacks` / `MERMAID_ICON_PACKS` and `colorPresets` / `MERMAID_COLOR_PRESETS`; `.env` also documents `MERMAID_BUNDLE_LOGOS`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `scripts/svg-to-iconify.js`                                                                                                             | Added. Converts an SVG folder into a pack a deployment can host; inlines `<style>` class rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `scripts/fetch-icon-packs.js`                                                                                                           | Added. Imports vendor icon archives at build time (`MERMAID_FETCH_ICON_PACKS`) into the gitignored `src/lib/vendor-icons/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.gitignore`                                                                                                                            | Ignores `src/lib/vendor-icons/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/components/LayoutControls.svelte`, `src/lib/util/layout.ts`                                                                    | Added. The "Layout" card: direction (top-to-bottom, left-to-right, fit to view), layout engine (standard / ELK) and spacing, written into the code and the config                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/lib/components/ColorControls.svelte`, `src/lib/util/colors.ts`                                                                     | Added. The "Colours" card: theme buttons, line colour (config `themeVariables.lineColor`) lane/subgraph, object and arrow colours written into the code (`style`, `linkStyle`; `UpdateElementStyle` for C4), the deployment palette and freely picked recent colours; per-object text styling (bold, font size, text colour) in the same `style` statement, with the `opacity:1` lead-in class diagrams need (`tests/textStyle.spec.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/components/AddControls.svelte`, `src/lib/util/diagramEdit.ts`                                                                  | Added. The "Add" card: a new lane, or a node in a lane joined by an arrow from another node, for flowcharts and swimlane diagrams; groups, services and connections for architecture diagrams (`ArchitectureAdd.svelte`); per-type forms for sequence, state, class, ER, mindmap, gantt, pie, kanban, timeline, C4 and block diagrams (`AddActions.svelte`, `src/lib/util/addActions.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/lib/components/EditControls.svelte`, `src/lib/util/diagramModify.ts`                                                               | Added. The "Edit" card: rename (the shown text) and delete objects — flowchart/swimlane nodes and lanes, states, classes, ER entities, C4 elements, architecture services and groups, sequence participants, mindmap, kanban and timeline items — and relabel, reverse, restyle and delete arrows (flowchart/swimlane in full; state, class, ER, sequence and architecture where their syntax allows), with `linkStyle` renumbered; a flowchart node's shape, lane and icon, an architecture service's icon and group, and sequence notes and blocks; every edit is checked with mermaid's parse first                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/components/NewDiagram.svelte`, `src/lib/util/newDiagram.ts`                                                                    | Added. "New diagram" at the top of the Samples card: a type picker (14 types, a one-line description each), an optional title and a direction; replaces the code with a minimal starter with Japanese placeholders, asking first unless the code is a sample or an unchanged starter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/lib/util/diagramTitle.ts`                                                                                                          | Added. Sets, changes and removes the diagram title — front matter `title:`, or the `title` statement of timeline and C4, which ignore front matter — from the Layout card's title field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/lib/components/IconChooser.svelte`, `src/lib/util/iconCatalog.ts`                                                                  | Added. A small icon search in the Edit card over every pack the editor knows (standard, bundled, build-time, hosted, imported), for a flowchart node's or an architecture service's icon                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/components/HelpButton.svelte`, `src/lib/util/helpContent.ts`                                                                   | Added. The "How to use" button in the header (Navbar) and its guide dialog; the guide text per language                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `.claude/settings.json`, `.claude/hooks/session-start.sh`                                                                               | Added. Claude Code on the web: a SessionStart hook puts Node 24 first on PATH, enables pnpm and installs the dependencies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/lib/components/EditorPaneToggle.svelte`, `EditorRail.svelte`, `ToolsBar.svelte`                                                    | Added. The code pane header button collapses the code pane to the left icon rail (code, config); `ToolsBar` is the tools pane header, whose button collapses that pane to the right rail (`<EditorRail side="right">`: layout, add, edit, colours, icons, samples, actions). Each rail icon reopens its pane on that section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/components/DiagramToolbar.svelte`                                                                                              | Added. One toolbar across the top of the diagram pane, replacing upstream's `PanZoomToolbar` (on the editor page), `SyncRoughToolbar` and `VersionSecurityToolbar`: zoom out, zoom in, reset, full screen; hand-drawn and grid; then theme, language, privacy (only when `MERMAID_HIDE_PRIVACY_POLICY` is off) and the mermaid version as plain text. Carries the grid default for old states from `SyncRoughToolbar`. An upstream change to any of the three toolbars is ported here; `PanZoomToolbar.svelte` itself stays for the embed page                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/components/UndoRedoButtons.svelte`, `src/lib/util/undoStack.svelte.ts`                                                         | Added. Undo / redo buttons in the editor header: a history of the diagram code as it passes through the input state (one entry per pause in typing, 100 kept), so one undo covers Monaco, CodeMirror and the Add / Colours / Layout cards; applying an entry goes through `updateCode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/components/IconPicker.svelte`, `src/lib/util/iconSearch.ts`, `src/lib/util/monacoInsert.ts`                                    | Added. Search the icon packs in the "Icons" card, or browse hand-picked categories (`iconCategories.ts`) or a whole pack a page at a time, and click an icon to insert its `prefix:name` at the cursor (or copy it when no editor can take it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/util/standardIcons.ts`                                                                                                         | Added. mermaid's five built-in architecture icons (copied, MIT) so the picker can show and mark them as standard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/lib/components/IconLicenseTable.svelte`, `src/lib/util/iconLicenses.ts`                                                            | Added. Licence, holder and trademark facts for every bundled icon set, shown in the "How to use" guide's licences section and in the picker's tooltips                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/components/AiIconPrompt.svelte`, `UnknownIcons.svelte`, `src/lib/util/aiPrompt.ts`, `aiCollection.svelte.ts`, `iconCatalog.ts` | Added. "Copy a briefing for an AI" (syntax, packs, curated and collected icon names) and the "Unknown icons" list with one-click replacement; the shared icon pack loader                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/lib/components/HtmlExport.svelte`, `src/lib/util/htmlExport.ts`                                                                    | Added. HTML export (standalone page, self-contained `<img>` tag) and GitLab export (SVG file plus Markdown with an edit link and the source); a diagram with an error is reported, not exported                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/components/Actions.svelte`                                                                                                     | Renders `<HtmlExport>` under the PNG / SVG buttons; PNG / SVG serialise through `toXmlSvg` (upstream's `outerHTML` made `&nbsp;` or kanban links break the PNG silently)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/routes/(app)/edit/+page.svelte`                                                                                                    | Renders `<UndoRedoButtons>`, `<ResetConfigButton>` and `<EditorPaneToggle>` in the editor card (and resets the undo history once the diagram is loaded) and the three-pane desktop layout: code (left, 25%), the diagram with `<DiagramToolbar>` above it instead of upstream's three floating toolbars (centre), the history column when open, and a tools pane (right, 25%) with `<ToolsBar>` over `<LayoutControls>`, `<AddControls>`, `<EditControls>`, `<ColorControls>`, `<IconPacks>`, the samples and actions (in that order, scrolling). Both side panes are collapsible to an `<EditorRail>`; panes carry `id`/`order` so `autoSaveId` keeps each combination's sizes. On mobile the tool cards stay under the editor. Also `sm:` classes on the pane group, visible `withHandle` dividers, flat sections, the window width as the first `width`, and a container query that shows the editor header's buttons as icons in a narrow code pane |
| `package.json`                                                                                                                          | Adds the `@iconify-json/*` packs (tabler, lucide, carbon, fluent, flat-color-icons, clarity, eos-icons, fluent-color, simple-icons, devicon) and `dompurify` to `dependencies`, `fetch-icon-packs.js` to `build`, and `!src/lib/vendor-icons/` to `files`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

The pane markup is local: upstream has one editor column and the view. On a conflict,
take upstream's changes to what goes inside the editor card and the view, and keep the
three panes (code, diagram, tools), their `id`/`order`, the rails and `<DiagramToolbar>`;
`tests/fixedLayout.spec.ts`, `tests/editorPanes.spec.ts` and `tests/toolsPane.spec.ts`
fail if the layout is lost.

### Cross-platform guards

The production runner may be Windows, so the build and deploy path uses only
package-manager invocations and Node scripts — never a shell builtin or a
Unix-only command. Details in `docs-dev/CROSS-PLATFORM.md`; at merge time:

| Path                       | Local change                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `.gitattributes`           | Added. `* text=auto eol=lf`, so a Windows checkout matches Linux and Prettier does not fail on CRLF |
| `scripts/prepare-pages.js` | Added. Replaces `mv docs public` in CI                                                              |
| `vite.embed.config.js`     | Adds `publicDir: false`                                                                             |
| `package.json`             | `build:pages` and `dev:force` point at local scripts; `postinstall` guards with `node -e` inline    |
| `.gitignore`               | Ignores `/public`                                                                                   |

`publicDir: false` is load-bearing, not tidying. That config has no SvelteKit
plugin, so Vite defaults `publicDir` to `public` while its `outDir` is `static`.
Once `pnpm build:pages` creates `public/`, a later build copies the whole
generated site into the tracked `static/` directory. If a merge drops that line,
CI starts committing its own output.

Should upstream reintroduce a shell-only step in `postinstall` or a CI script,
it will merge cleanly and only fail on the Windows runner. Re-read
`docs-dev/CROSS-PLATFORM.md` after a merge that touches `package.json` scripts.

### Theme changes

`docs-dev/THEME.md` has the rationale and the measured contrast figures. At merge
time:

| Path                               | Local change                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app.css`                      | `--accent` per mode (upstream uses one pink for both) and a near-black `--accent-foreground` in dark |
| `src/app.html`                     | `theme-color` meta as a `prefers-color-scheme` pair instead of the pink                              |
| `src/lib/components/Navbar.svelte` | Upstream's Mermaid logo removed from the header                                                      |
| `static/icons/mermaid.svg`         | Deleted — the brand mark, now unused                                                                 |
| `static/favicon.{svg,png,ico}`     | Brand mark replaced with a generic diagram glyph                                                     |
| `static/manifest.json`             | `background_color` and `theme_color` moved off the brand pink                                        |

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
  edit belongs in `messages.ts`, not at the call site.
- Keys are typed off `en`, and `src/lib/i18n/i18n.test.ts` asserts both locales
  carry the same keys and the same `{placeholders}`. Adding a key to one locale
  only fails `pnpm check` or the unit suite, not review.

| Path                                     | Local change                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/lib/i18n/`                          | Added: the catalogue, `t()`, and their test                                                              |
| `src/lib/util/env.ts`                    | Added `locale`, read from `MERMAID_LOCALE`                                                               |
| `src/lib/util/state.svelte.ts`           | The broken-URL diagram comes from the catalogue, and no longer links to upstream's issue tracker (below) |
| `src/lib/components/Card/Card.svelte`    | Added a `testID` prop so tests can target panels without depending on a translated title                 |
| `tests/test.ts`                          | Exports a test-side `t()`; the specs select by catalogue key rather than by English text                 |
| `src/lib/components/LocaleToggle.svelte` | Added: the language button; `DiagramToolbar.svelte` renders it beside the theme toggle                   |
| `tests/locale.spec.ts`                   | Added: switching language keeps the diagram and survives a reload                                        |

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

| Path                                                                                             | Why it is gone                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy.yml`                                                                   | Publishes to GitHub Pages; this fork deploys through GitLab Pages (`.gitlab-ci.yml`).                                                                                                                                                     |
| `.github/workflows/docker-publish.yml`                                                           | On pushes to `master` it publishes an image to `ghcr.io/${{ github.repository }}` — this fork's own namespace, so it would publish for real rather than failing on upstream's.                                                            |
| `.github/workflows/close-broken-link-issues.yml`                                                 | Auto-closes new issues with mermaid.live support boilerplate; it fires on this fork's own issues.                                                                                                                                         |
| `.github/workflows/update-browserlist.yml`                                                       | Scheduled PR against a `develop` base branch that does not exist here.                                                                                                                                                                    |
| `.github/workflows/release-pr.yml`                                                               | Triggers on pushes to `develop`, which does not exist here.                                                                                                                                                                               |
| `netlify.toml`                                                                                   | Netlify build config carrying mermaid.live environment values.                                                                                                                                                                            |
| `CNAME`, `.nojekyll`                                                                             | GitHub Pages settings (the `mermaid.live` custom domain, Jekyll opt-out); this fork is served by GitLab Pages.                                                                                                                            |
| `.github/FUNDING.yml`                                                                            | `github: [sidharthv96, knsv]` — renders a "Sponsor this project" button on this repository that pays the upstream maintainers.                                                                                                            |
| `SECURITY.md`                                                                                    | Tells reporters to e-mail `security@mermaid.live`, which would send vulnerability reports about this deployment to upstream.                                                                                                              |
| `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `.dockerignore`                                | This fork ships an npm package built into a static site for GitLab Pages and never builds or publishes a container. With `docker-publish.yml` gone nothing validated them either, so they could only rot.                                 |
| `bin/beta-release`, `bin/fix-path`, `bin/update-monaco.js`                                       | mermaid.live release helpers (publish into `mermaid-js/docs`, rewrite its paths, refresh Monaco CDN tags `src/app.html` no longer has). No script calls them.                                                                             |
| `renovate.json`, `.github/dependabot.disabled.yml`                                               | Upstream's dependency bots, targeting `develop`. No bot is installed here; dependency updates are done by hand as recorded in `STATUS.md`.                                                                                                |
| `src/lib/components/SyncRoughToolbar.svelte`, `src/lib/components/VersionSecurityToolbar.svelte` | Replaced by `DiagramToolbar.svelte`, the one bar above the diagram. Kept as dead files they would take upstream's changes silently; deleted, a change upstream makes to them surfaces as a conflict to port into `DiagramToolbar.svelte`. |

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

The following list is accurate as of **2026-10-05**. It is a snapshot, not a
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

| Status   | Path                                                   |
| -------- | ------------------------------------------------------ |
| Added    | `.claude/hooks/session-start.sh`                       |
| Added    | `.claude/settings.json`                                |
| Deleted  | `.dockerignore`                                        |
| Modified | `.env`                                                 |
| Added    | `.gitattributes`                                       |
| Deleted  | `.github/FUNDING.yml`                                  |
| Deleted  | `.github/dependabot.disabled.yml`                      |
| Modified | `.github/pull_request_template.md`                     |
| Deleted  | `.github/workflows/close-broken-link-issues.yml`       |
| Modified | `.github/workflows/codeql-analysis.yml`                |
| Deleted  | `.github/workflows/deploy.yml`                         |
| Deleted  | `.github/workflows/docker-publish.yml`                 |
| Added    | `.github/workflows/fork-checks.yml`                    |
| Added    | `.github/workflows/publish.yml`                        |
| Deleted  | `.github/workflows/release-pr.yml`                     |
| Modified | `.github/workflows/tests.yml`                          |
| Deleted  | `.github/workflows/update-browserlist.yml`             |
| Modified | `.gitignore`                                           |
| Added    | `.gitlab-ci.yml`                                       |
| Modified | `.husky/pre-commit`                                    |
| Deleted  | `.nojekyll`                                            |
| Added    | `.upstream-version.json`                               |
| Modified | `CLAUDE.md`                                            |
| Deleted  | `CNAME`                                                |
| Deleted  | `Dockerfile`                                           |
| Added    | `NOTICE`                                               |
| Modified | `README.md`                                            |
| Added    | `README.upstream.md`                                   |
| Deleted  | `SECURITY.md`                                          |
| Added    | `THIRD-PARTY-LICENSES.md`                              |
| Deleted  | `bin/beta-release`                                     |
| Deleted  | `bin/fix-path`                                         |
| Deleted  | `bin/update-monaco.js`                                 |
| Deleted  | `docker-compose.yml`                                   |
| Added    | `docs-dev/CROSS-PLATFORM.md`                           |
| Added    | `docs-dev/FEATURE-FLAGS.md`                            |
| Added    | `docs-dev/GITLAB-PAGES.md`                             |
| Added    | `docs-dev/I18N.md`                                     |
| Added    | `docs-dev/ICONS.md`                                    |
| Added    | `docs-dev/PACKAGING.md`                                |
| Added    | `docs-dev/QUALITY-AUDIT-2026-08-31.md`                 |
| Added    | `docs-dev/STATUS.md`                                   |
| Added    | `docs-dev/THEME.md`                                    |
| Added    | `docs-dev/UPSTREAM.md`                                 |
| Deleted  | `netlify.toml`                                         |
| Deleted  | `nginx.conf`                                           |
| Modified | `package.json`                                         |
| Modified | `playwright.config.ts`                                 |
| Modified | `pnpm-lock.yaml`                                       |
| Deleted  | `renovate.json`                                        |
| Added    | `scripts/check-local-delta.js`                         |
| Added    | `scripts/copy-legal-files.js`                          |
| Added    | `scripts/dev-force.js`                                 |
| Added    | `scripts/prepare-pages.js`                             |
| Added    | `scripts/fetch-icon-packs.d.ts`                        |
| Added    | `scripts/fetch-icon-packs.js`                          |
| Added    | `scripts/svg-to-iconify.d.ts`                          |
| Added    | `scripts/svg-to-iconify.js`                            |
| Added    | `scripts/update-upstream.sh`                           |
| Modified | `src/app.css`                                          |
| Modified | `src/app.html`                                         |
| Modified | `src/lib/components/Actions.svelte`                    |
| Added    | `src/lib/components/AiIconPrompt.svelte`               |
| Added    | `src/lib/components/AddActions.svelte`                 |
| Added    | `src/lib/components/AddControls.svelte`                |
| Added    | `src/lib/components/ArchitectureAdd.svelte`            |
| Modified | `src/lib/components/Card/Card.svelte`                  |
| Added    | `src/lib/components/ColorControls.svelte`              |
| Modified | `src/lib/components/CopyButton.svelte`                 |
| Modified | `src/lib/components/CopyInput.svelte`                  |
| Modified | `src/lib/components/DesktopEditor.svelte`              |
| Modified | `src/lib/components/DiagramDocumentationButton.svelte` |
| Added    | `src/lib/components/DiagramToolbar.svelte`             |
| Modified | `src/lib/components/Editor.svelte`                     |
| Added    | `src/lib/components/EditControls.svelte`               |
| Added    | `src/lib/components/EditorPaneToggle.svelte`           |
| Added    | `src/lib/components/EditorRail.svelte`                 |
| Modified | `src/lib/components/ExternalLinkWrapper.svelte`        |
| Added    | `src/lib/components/HelpButton.svelte`                 |
| Modified | `src/lib/components/History/History.svelte`            |
| Added    | `src/lib/components/HtmlExport.svelte`                 |
| Added    | `src/lib/components/IconLicenseTable.svelte`           |
| Added    | `src/lib/components/IconPacks.svelte`                  |
| Added    | `src/lib/components/LocaleToggle.svelte`               |
| Modified | `src/lib/components/MainMenu.svelte`                   |
| Added    | `src/lib/components/IconPicker.svelte`                 |
| Added    | `src/lib/components/IconChooser.svelte`                |
| Added    | `src/lib/components/LayoutControls.svelte`             |
| Modified | `src/lib/components/Navbar.svelte`                     |
| Added    | `src/lib/components/NewDiagram.svelte`                 |
| Modified | `src/lib/components/PanZoomToolbar.svelte`             |
| Modified | `src/lib/components/Preset.svelte`                     |
| Modified | `src/lib/components/Privacy.svelte`                    |
| Added    | `src/lib/components/ResetConfigButton.svelte`          |
| Modified | `src/lib/components/Share.svelte`                      |
| Deleted  | `src/lib/components/SyncRoughToolbar.svelte`           |
| Added    | `src/lib/components/ToolsBar.svelte`                   |
| Added    | `src/lib/components/UnknownIcons.svelte`               |
| Added    | `src/lib/components/UndoRedoButtons.svelte`            |
| Deleted  | `src/lib/components/VersionSecurityToolbar.svelte`     |
| Modified | `src/lib/components/View.svelte`                       |
| Modified | `src/lib/constants.ts`                                 |
| Added    | `src/lib/i18n/i18n.test.ts`                            |
| Added    | `src/lib/i18n/index.ts`                                |
| Added    | `src/lib/i18n/messages.ts`                             |
| Added    | `src/lib/i18n/translate.ts`                            |
| Added    | `src/lib/util/aiCollection.svelte.ts`                  |
| Added    | `src/lib/util/aiPrompt.test.ts`                        |
| Added    | `src/lib/util/aiPrompt.ts`                             |
| Added    | `src/lib/util/addActions.test.ts`                      |
| Added    | `src/lib/util/addActions.ts`                           |
| Added    | `src/lib/util/allDiagrams.test.ts`                     |
| Added    | `src/lib/util/architectureLabels.test.ts`              |
| Added    | `src/lib/util/architectureLabels.ts`                   |
| Added    | `src/lib/util/autoSync.test.ts`                        |
| Modified | `src/lib/util/autoSync.ts`                             |
| Added    | `src/lib/util/colors.test.ts`                          |
| Added    | `src/lib/util/colors.ts`                               |
| Added    | `src/lib/util/customIconStore.ts`                      |
| Added    | `src/lib/util/customIcons.test.ts`                     |
| Added    | `src/lib/util/customIcons.ts`                          |
| Added    | `src/lib/util/darkLines.test.ts`                       |
| Added    | `src/lib/util/darkLines.ts`                            |
| Added    | `src/lib/util/diagramEdit.test.ts`                     |
| Added    | `src/lib/util/diagramEdit.ts`                          |
| Added    | `src/lib/util/diagramModify.test.ts`                   |
| Added    | `src/lib/util/diagramModify.ts`                        |
| Added    | `src/lib/util/diagramTitle.test.ts`                    |
| Added    | `src/lib/util/diagramTitle.ts`                         |
| Modified | `src/lib/util/embed.ts`                                |
| Modified | `src/lib/util/env.ts`                                  |
| Added    | `src/lib/util/fetchIconPacks.test.ts`                  |
| Added    | `src/lib/util/helpContent.test.ts`                     |
| Added    | `src/lib/util/helpContent.ts`                          |
| Added    | `src/lib/util/htmlExport.test.ts`                      |
| Added    | `src/lib/util/htmlExport.ts`                           |
| Added    | `src/lib/util/iconPacks.test.ts`                       |
| Added    | `src/lib/util/iconPacks.ts`                            |
| Added    | `src/lib/util/iconSearch.test.ts`                      |
| Added    | `src/lib/util/iconSearch.ts`                           |
| Added    | `src/lib/util/layout.test.ts`                          |
| Added    | `src/lib/util/layout.ts`                               |
| Added    | `src/lib/util/localSamples.test.ts`                    |
| Added    | `src/lib/util/localSamples.ts`                         |
| Modified | `src/lib/util/mermaid.test.ts`                         |
| Modified | `src/lib/util/mermaid.ts`                              |
| Added    | `src/lib/util/memo.test.ts`                            |
| Added    | `src/lib/util/memo.ts`                                 |
| Added    | `src/lib/util/mermaidRename.test.ts`                   |
| Added    | `src/lib/util/mermaidRename.ts`                        |
| Added    | `src/lib/util/monacoInsert.ts`                         |
| Added    | `src/lib/util/newDiagram.test.ts`                      |
| Added    | `src/lib/util/newDiagram.ts`                           |
| Added    | `src/lib/util/serde.compat.test.ts`                    |
| Added    | `src/lib/util/iconCategories.test.ts`                  |
| Added    | `src/lib/util/iconCategories.ts`                       |
| Added    | `src/lib/util/iconCatalog.test.ts`                     |
| Added    | `src/lib/util/iconCatalog.ts`                          |
| Added    | `src/lib/util/iconLicenses.test.ts`                    |
| Added    | `src/lib/util/iconLicenses.ts`                         |
| Added    | `src/lib/util/iconCatalog.ts`                          |
| Added    | `src/lib/util/standardIcons.test.ts`                   |
| Added    | `src/lib/util/standardIcons.ts`                        |
| Modified | `src/lib/util/state.svelte.test.ts`                    |
| Modified | `src/lib/util/state.svelte.ts`                         |
| Added    | `src/lib/util/util.test.ts`                            |
| Modified | `src/lib/util/util.ts`                                 |
| Added    | `src/lib/util/svgToIconify.test.ts`                    |
| Added    | `src/lib/util/undoStack.svelte.ts`                     |
| Added    | `src/lib/util/undoStack.test.ts`                       |
| Modified | `src/routes/(app)/edit/+page.svelte`                   |
| Modified | `src/routes/+error.svelte`                             |
| Modified | `src/routes/embed/+page.svelte`                        |
| Modified | `src/tests/setup.ts`                                   |
| Modified | `static/favicon.ico`                                   |
| Modified | `static/favicon.png`                                   |
| Modified | `static/favicon.svg`                                   |
| Deleted  | `static/icons/mermaid.svg`                             |
| Modified | `static/manifest.json`                                 |
| Modified | `tests/actions.spec.ts`                                |
| Added    | `tests/addControls.spec.ts`                            |
| Added    | `tests/aiIcons.spec.ts`                                |
| Added    | `tests/allDiagrams.spec.ts`                            |
| Added    | `tests/colors.spec.ts`                                 |
| Modified | `tests/configMigration.spec.ts`                        |
| Added    | `tests/configReset.spec.ts`                            |
| Modified | `tests/diagramUpdate.spec.ts`                          |
| Added    | `tests/editControls.spec.ts`                           |
| Added    | `tests/editorAiGlyph.spec.ts`                          |
| Added    | `tests/editorPanes.spec.ts`                            |
| Modified | `tests/embed.spec.ts`                                  |
| Modified | `tests/errorDisplay.spec.ts`                           |
| Added    | `tests/fixedLayout.spec.ts`                            |
| Added    | `tests/help.spec.ts`                                   |
| Modified | `tests/history.spec.ts`                                |
| Added    | `tests/htmlExport.spec.ts`                             |
| Added    | `tests/iconBrowse.spec.ts`                             |
| Added    | `tests/iconImport.spec.ts`                             |
| Added    | `tests/iconLicenses.spec.ts`                           |
| Added    | `tests/iconPacks.spec.ts`                              |
| Added    | `tests/layout.spec.ts`                                 |
| Modified | `tests/loadSite.spec.ts`                               |
| Added    | `tests/locale.spec.ts`                                 |
| Added    | `tests/newDiagram.spec.ts`                             |
| Added    | `tests/releaseAudit.spec.ts`                           |
| Added    | `tests/renameSymbol.spec.ts`                           |
| Added    | `tests/swimlane.spec.ts`                               |
| Added    | `tests/offline.spec.ts`                                |
| Added    | `tests/templates.spec.ts`                              |
| Modified | `tests/test.ts`                                        |
| Added    | `tests/textStyle.spec.ts`                              |
| Added    | `tests/toolsPane.spec.ts`                              |
| Added    | `tests/undo.spec.ts`                                   |
| Modified | `vite.embed.config.js`                                 |

Re-derive this inventory after each update; do not assume it remains unchanged.
