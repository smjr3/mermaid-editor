# Where this fork stands

An index and a handover note. Read this first; each section points at the document that
carries the detail and the reasoning.

Accurate as of **2026-10-03**, including the 0.2.0 work: the upstream merge of `a70ed76`,
mermaid 12.1.0, and the editor, layout and icon features below.

## What this is

`@smjr3/mermaid-editor` is a fork of [mermaid-live-editor](https://github.com/mermaid-js/mermaid-live-editor),
imported at upstream **2.0.67** and last merged from upstream commit `a70ed76` (2026-09-30), customised for internal organisational use.

The standing constraints, which shape almost every decision recorded here:

- **Swimlane support** is the reason for the fork. It arrived in mermaid 11.16.0; this
  fork renders with `mermaid ^12.0.0`, so `swimlane-beta` is available. mermaid 12 kept the
  `swimlane-beta` keyword (its detector is unchanged from 11.17.2), so saved diagrams still render.
- **Keep the upstream delta small.** Prefer a feature flag or a wrapper over deleting or
  rewriting upstream code, so a future upstream merge takes their side and re-applies ours.
- **Keep the boundary explicit.** `docs-dev/UPSTREAM.md` holds a regenerated inventory of
  every locally changed path — currently **191**.
- Public on GitHub and published to npmjs.org by `.github/workflows/publish.yml`
  (`PACKAGING.md`); also delivered internally through JFrog → internal GitLab → GitLab Pages.

## The documents

| Document                      | What it covers                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `UPSTREAM.md`                 | How the vendor branch works, how to merge an upstream update, the per-area conflict guidance, and the inventory of locally changed paths |
| `FEATURE-FLAGS.md`            | Which surfaces are switched off for organisational use and by which variable                                                             |
| `CROSS-PLATFORM.md`           | Why the build runs on Windows as well as Linux, and what is reasoned rather than executed                                                |
| `THEME.md`                    | The accent palette per mode with measured contrast, and why the dark `--accent-foreground` must not be reverted                          |
| `ICONS.md`                    | The bundled icon packs and logos, build-time vendor sets, hosted and user-imported packs, redistribution, and sanitising                 |
| `I18N.md`                     | The message catalogue, `t()` and its interpolation, what stays in English, and how the e2e suite avoids depending on translated text     |
| `PACKAGING.md`                | npm packaging and the tarball → rebuild round trip                                                                                       |
| `GITLAB-PAGES.md`             | The GitLab Pages deployment path                                                                                                         |
| `QUALITY-AUDIT-2026-08-31.md` | An external portability audit, its three findings, and a follow-up for each recording how it was resolved                                |

## What is delivered

All of this is on `master`.

**Base and packaging.** Upstream imported on a `vendor/upstream` branch, derivative-OSS
licensing and attribution in place, npm packaging verified by an actual tarball → install →
rebuild round trip, GitLab Pages build verified twice in one workspace.

**Organisational surfaces off by default** (`FEATURE-FLAGS.md`). Mermaid Chart links, AI
features and community links are switched off by environment variable; `MERMAID_RENDERER_URL`
and `MERMAID_KROKI_RENDERER_URL` are emptied, which closes every path that would put diagram
source into a third-party URL. Local PNG/SVG export still works — it renders in the browser.
Nothing was deleted, so an upstream merge keeps their markup and re-applies the guard.

**The build runs on Windows** (`CROSS-PLATFORM.md`). Three things were genuinely broken, not
merely untested: `mv docs public` in CI, a `postinstall` chain that used `true` as a command,
and the absence of `.gitattributes`. The Windows half is reasoned from mechanism — there is
no Windows host in the development environment — and that document says so and asks for one
real run on the runner.

**Unused files removed.** Upstream's release and hosting helpers, container files, dependency-bot
configs, `SECURITY.md` (which pointed reporters at mermaid.live) and 13 dev dependencies that
nothing loaded are deleted; `UPSTREAM.md` lists them and how to keep a merge from restoring them.

**Swimlane samples.** `@mermaid-js/examples` ships none, so the "Sample Diagrams" card
gains a local `Swimlane` entry (`src/lib/util/localSamples.ts`) with two examples; a `@smoke`
e2e test renders it in Chromium and Firefox. See `UPSTREAM.md`.

**Business templates.** The same file adds a "業務テンプレート" group, listed first in the
card: nine Japanese-language samples of what a Japanese office draws — a swimlane expense
flow with a 承認/差戻し loop, a 稟議 approval flowchart, a support swimlane (顧客/サポート/開発),
a hiring timeline, an on-premises + cloud architecture with tabler icons, a gantt 工程表
(要件定義 → リリース), an org chart, a monthly-close sequence diagram and a kanban 業務分担表.
Ids are ASCII so the Add, Colours and F2 features apply; each stays around a dozen nodes.
The group name is the sample key (the card does not translate group names), so it is
Japanese in both UI languages. `tests/templates.spec.ts` loads each from the card and
checks it renders; the all-diagram checks cover them too.

**Editor and layout (0.2.0).** F2 renames a node, participant or service id everywhere it is
used, leaving labels and messages alone (`mermaidRename.ts`). The config tab has a "Reset
config" button for a config that leaves every render failing. With AI features off, the
editor no longer shows the AI gutter button, which used to open an empty zone that could not be
closed. On desktop the editor column and the view are fixed panes with a visible divider instead
of floating cards. Each has an e2e test; see `UPSTREAM.md` → "Editor, layout and icon additions".

**Icons (0.2.0)** (`ICONS.md`). Diagrams can name icons as `prefix:name` from nine bundled OSS
Iconify sets, loaded lazily from the site, never a CDN: six generic ones (`tabler`, `lucide`,
`carbon`, `fluent`, `flat-color-icons`, `mdi`) and three logo sets (`logos`, `simple-icons`,
`devicon`). They are npm dependencies, so the repository and the npm package carry no icon data.
`MERMAID_BUNDLE_LOGOS=false` builds without the logo sets and strips the brand icons from the
generic ones, for sites that may not host trademarks. Vendor architecture icon sets (AWS, Azure,
Google Cloud) are not OSS, so they are imported from the vendor at build time
(`MERMAID_FETCH_ICON_PACKS`, `scripts/fetch-icon-packs.js`, output gitignored and kept out of
the npm package); verified with Google Cloud's archive (216 icons). A deployment can also host
packs (`MERMAID_ICON_PACKS`) and a user can import SVG files or an Iconify JSON file from the
"Icons" card (kept in IndexedDB). Every non-bundled icon is sanitised with DOMPurify before
mermaid inserts it. A "System Architecture" sample entry shows a web system, an office network,
a generic cloud and an AWS example with logos. The packs add about 36 MB to the built site (17 MB
of it the logo sets); a page loads only the ones its diagram names.

**Layout card (0.2.0)** (`src/lib/util/layout.ts`). mermaid has no aspect-ratio setting, so the
"Layout" card adjusts what shapes a diagram instead: its direction (top-to-bottom, left-to-right,
or "fit to view", which renders both and keeps the one that shows larger in the view, preferring
left-to-right when they are close), the layout engine (standard or ELK) and the node/rank
spacing. The direction is written into the code (`flowchart LR`, `direction LR` for state, class,
ER and requirement diagrams, the `swimlane-beta` header) and the rest into the config, so shared
links and mermaid.live render the same. Diagram types without a direction (architecture, sequence,
…) get an explanation instead of the buttons.

**Colours card (0.2.0)** (`src/lib/util/colors.ts`). Theme buttons (auto, plus the themes the
editor does not manage: a managed one would be replaced, see `isManagedTheme`), a line colour
(`themeVariables.lineColor` in the config; the dark-mode line brightening leaves it alone) and,
for swimlane and flowchart diagrams, a colour per lane or subgraph (or all at once), and a colour
per object — flowchart nodes, states, classes, ER entities, requirements and elements, blocks and
C4 elements — chosen from a list or by clicking it in the diagram. The list comes from mermaid's
own parse (`diagramObjects` in `mermaid.ts`), leaving out what is not an object (start and end
points, notes, concurrency dividers, lanes that a `style` statement also registers as vertices).
Colours are `style <id> fill:…,stroke:…,color:#1f2329` statements in the code, or
`UpdateElementStyle(id, $bgColor=…, $borderColor=…, $fontColor=…)` for C4, which has no `style`
statement — plain mermaid, so shared links keep them; the dark text colour keeps titles readable
on the light fills in dark mode. Sequence, mindmap, architecture, kanban and the chart types have
no per-object colour syntax that works, so the card says so for them.
Flowchart and swimlane arrows get a colour each too (`linkStyle <n> stroke:…`; `n` is the
arrow's order in the code, so adding or removing arrows above it shifts the number — mermaid's own
limitation). The colour buttons are the deployment's palette (`MERMAID_COLOR_PRESETS`) or the
built-in eight, followed by the colours this browser picked freely ("any colour", kept in
`localStorage` as `colorRecent`, latest eight).
The chosen object's text can be made bold, given a size (small 12px, normal, large 18px, extra
large 24px) and a colour of its own (`getTextStyle`/`setTextStyle`, `setTextColor`): `font-weight:bold`,
`font-size:18px` and `color:…` go into the same `style <id>` statement as the fill, so there is
never a second one, and "Reset text" removes just those three. Verified in the rendered SVG that
mermaid honours both properties for flowchart, swimlane, state, class, ER, requirement and block
diagrams (`tests/textStyle.spec.ts` checks the computed `font-weight`/`font-size` of the label).
Two mermaid quirks are worked around: a class-diagram `style` statement may not start with a
hyphenated property (`style A font-size:18px` fails with "got 'MINUS'"), so a harmless `opacity:1`
leads when no colour does and is dropped again once one does; and a text colour the user chose is
kept when the fill changes (the dark default is written only when none is set). C4 gets the text
colour only (`$fontColor`), and the card says bold and size are unavailable there; the types with
no `style` statement show the existing "nothing to colour" note.

**Add card (0.2.0)** (`src/lib/util/diagramEdit.ts`). For flowcharts and swimlane diagrams: add a
lane, or a node (box, rounded box, decision diamond, circle or stadium) into a lane, optionally
joined by an arrow from another node; the next node is joined from the one just added; "Connect"
joins two existing nodes with an optional label. New statements go after the last statement and before trailing
`style`/`linkStyle` lines, so existing arrow numbers do not change.
For architecture diagrams (`ArchitectureAdd.svelte`): add a group (in another group), a service
with a standard or any pack icon, in a group and joined from another service on a chosen side
(right/below/left/above, with or without an arrowhead), or connect two existing services. Ids
are `grpN`/`svcN`, lower case, since an architecture id may not start with a capital R, L, T or B.
Every other type with a simple add syntax gets forms from `src/lib/util/addActions.ts`, one
spec per type listing its actions and their fields (rendered by `AddActions.svelte`): sequence
(participant, message), state (state joined from another, transition, incl. `[*]`), class (class,
relation by kind), ER (entity, relationship by cardinality), mindmap (topic under a chosen parent,
after its last descendant), gantt (task at the end of a section, on a date in the chart's
`dateFormat` or straight after the previous task; section), pie (slice), kanban (card in a column,
column), timeline (event in a period, period), C4 (element of a kind, optionally in a boundary
and joined from another; relationship) and block (block, arrow). Lists come from mermaid's parse
or, for indentation-based types, from the lines past front matter. The all-diagram check runs
every action on every matching sample; it found front matter being read as the header (kanban,
mindmap, the flowchart/architecture Add and lane colours) and class labels with `:` or `"`.
Quadrant, XY and the other chart types have no add forms.
**Review of the 0.2.0 additions.** A pass over every feature above with adversarial names
(`A: B "q" #1 [x] (y) {z} | & ; <b>`) in every diagram type found and fixed: a `;` splitting a
state or sequence statement (now a comma), `#` + digits in a sequence name or message read by
mermaid as an entity code (now `#35;`), an HTML tag typed into a kanban card blanking the board
without an error (tags are dropped from every typed name), composite states offered for colouring
though a `style` statement colours nothing on them, a C4 Deployment element not placed inside its
`Deployment_Node`, gantt dates for charts in unix time, and a choice that the code no longer has
(a deleted lane, group or participant still selected in a form) writing a broken statement. What
is left as mermaid's own behaviour: `<`/`>` in a flowchart, class or ER label render as HTML
(`x < 10` is fine), and `linkStyle` numbers shift when arrows are added above by hand.

**Edit card (0.2.0)** (`src/lib/util/diagramModify.ts`, `EditControls.svelte`). Choose an object
from a list or by clicking it in the diagram, then change the text it shows or delete it with every
arrow, relationship, note and `style` line that refers to it; a lane, architecture group or mindmap
topic can go with what is inside or leave it, moved out one level. Choose an arrow the same way,
then change its label, turn it round (the two ends swap, the arrow text stays), draw it solid, dotted
or thick, with or without an arrowhead, or delete it. Flowchart and swimlane statements go through a
small tokenizer (`A[x] & B --> C -->|yes| D`): a node is taken out of its chain, one arrow of a chain
is edited by splitting the chain in place, and `linkStyle N` statements are renumbered the way
mermaid numbers arrows; the tokenizer's arrows are matched against mermaid's own list and the card
refuses to edit arrows it cannot match. Objects: flowchart/swimlane nodes and lanes, states,
classes, ER entities (through an alias), C4 elements, architecture services and groups (junctions
have no text), sequence participants (an undeclared one is declared in its place so the order
stays), mindmap topics (not the centre), kanban columns and cards, timeline periods and events.
Arrows: flowchart/swimlane in full; state (label, reverse, delete), class (plus solid/dotted and
arrowhead), ER (plus solid/dotted), sequence (plus solid/dotted; `+`/`-` activations stay paired),
architecture (reverse, arrowhead, delete). Requirement, block, gantt, pie, git and the chart types
have no edit forms. Every edit is applied only if mermaid still parses the result as the same
diagram type; the all-diagram check renames and deletes every object and runs every arrow edit on
every sample. Ids in Japanese (申請者, 営業) are listed and edited like any other in flowcharts, swimlanes, ER and C4 diagrams, and the Colours and Add cards accept them too; mermaid's state, class, requirement and block grammars reject a non-ASCII id in a `style` statement, so those cards leave such ids out (`unicodeIds` in `mermaid.ts`).

The lists behind the Add and Colours cards come from mermaid's parse on every change; results
are shared per code (`memoByCode`, `memo.ts`), so a large diagram is not parsed once per card. It
cut the heaviest sample's all-diagram e2e from about 15 s to 9 s locally (it had begun timing out
on CI).
Only groups with an id (`subgraph id` or `subgraph id [Title]`) are listed; a quoted title alone
has no id a `style` statement could name.

**How to use (0.2.0)** (`src/lib/util/helpContent.ts`). A "How to use" button in the editor's
header opens a short guide: the basics, starting a diagram, adding shapes, changing and deleting, layout, colours, icons,
export and sharing, tips. The text is prose, kept out of the message catalogue; a test keeps the
languages' sections and points in step. Update it when a tool changes.

**Undo / redo** (`src/lib/util/undoStack.svelte.ts`). Two arrow buttons in the editor header step
back and forward through the diagram code, for the user who does not know Ctrl+Z or whose change
came from the Add, Colours or Layout card rather than the editor. The history records each distinct
code value as it passes through the input state (typing settles into one entry after a 500 ms pause,
100 entries kept), so it is the same for Monaco, CodeMirror and the cards and does not depend on
either editor's own stack; an undo is applied through `updateCode` and is not itself recorded.
The buttons are disabled when there is nothing to undo or redo, and the history starts afresh once
the diagram is loaded, so opening a shared link offers no step back to what the browser held before.
Shown on the code tab only. Unit test `undoStack.test.ts`; e2e `tests/undo.spec.ts`.

**Editor column and dark mode (0.2.0).** The button in the editor header collapses the editor
column to a slim icon rail; each rail icon (code, config, layout, add, edit, colours, icons, samples, actions)
expands the column and opens that section. The bar above the tool cards hides them so the
editor fills the column (remembered per browser); the cards are stacked — layout, icons,
samples, actions — and scroll instead of squeezing the editor. In dark mode, the dark themes
render with near-white lines unless the user set `lineColor`, and a diagram in a light theme
gets a light grey background so its dark lines stay visible (`src/lib/util/darkLines.ts`).

**Icon picker (0.2.0).** The "Icons" card searches the bundled, build-time, hosted and imported
packs by name, shows the matches as icons, and inserts the clicked icon's `prefix:name` at the
cursor in the code editor (`IconPicker.svelte`, `iconSearch.ts`); where no editor can take it
(mobile, config tab) the name is copied instead. "Enlarge" opens a large dialog with names under
the icons. mermaid's five built-in icons are listed first and marked standard (they render in
GitLab too); the rest are marked extended (`src/lib/util/standardIcons.ts`).

**Icon licences (0.2.1)** (`src/lib/util/iconLicenses.ts`). The "How to use" guide has an "Icon
licences" section: a table of every bundled set with its licence, copyright holder and links
(`IconLicenseTable.svelte`), then the artwork-versus-trademark distinction and a note that vendor,
hosted and imported packs follow their own terms. Deliberately out of the cards' way: each icon's
tooltip in the picker names its set and licence, logos and brand icons carry a ™ mark, and that is
all a user sees unless they look. The facts repeat `NOTICE` and `THIRD-PARTY-LICENSES.md`; keep the
three in step.

**HTML export (0.2.0)** (`src/lib/util/htmlExport.ts`). The actions card downloads the diagram
as a standalone HTML page (rendered afresh, icons inlined, the mermaid source in a `<details>`,
nothing loaded from the network) or copies it as one self-contained `<img>` tag (SVG data URI) to
paste into wikis, intranet pages or e-mail, where mermaid or this editor's icon packs are
unavailable. "Export for GitLab" saves the diagram as an SVG and copies Markdown that shows it,
links back to the editor and keeps the source in a collapsed plain-text block (not a mermaid
block, which GitLab would render without the icons). Known limit: Font Awesome icons (`fa:`) are
not embedded in the HTML export.

**0.2.0 release check.** Every 0.2.0 feature was re-checked end to end (`tests/releaseAudit.spec.ts`
covers the cross-feature cases: icons on the view and embed pages, mobile, the config tab, PNG
export with logos, state diagrams in the layout card, the English UI and failure paths), against
the dev server and a production build, plus a logos-off build, a build-time vendor import, and an
install and build from the npm tarball. Bugs found and fixed: the layout card misread code with
Windows line endings (which Monaco can write); the icon picker could stay on "loading" when the
search was cleared mid-load; HTML/GitLab exports of a broken diagram failed silently; inserting a
standard icon into a non-architecture diagram gave no warning; the AWS logo sample stayed in a
logos-off build. Firefox is covered only by CI's `@smoke` run.

**All-diagram check.** Every sample diagram (all of `@mermaid-js/examples`, the local samples and
ZenUML) runs through every feature: parse, layout direction, HTML/GitLab source round trip and F2
rename (`src/lib/util/allDiagrams.test.ts`), plus light and dark rendering, the layout card, the
HTML, GitLab, SVG and PNG exports and the view and embed pages in a browser
(`tests/allDiagrams.spec.ts`, about 6 minutes). Bugs found and fixed: PNG export silently did
nothing, and SVG files were not valid XML, for diagrams with `&nbsp;` (block arrows, event
modeling) or kanban ticket links — the SVG now goes through `toXmlSvg` (`htmlExport.ts`); F2
rename could produce broken code (renaming to a keyword, a number, or an architecture id starting
with R/L/T/B), so a rename is now applied only if the diagram still parses as the same type.

**Theme** (`THEME.md`). Upstream's single pink accent is replaced by one per mode, both at
WCAG AA, with the figures computed rather than eyeballed. The editor follows the operating
system; the toggle overrides it per browser. The Mermaid brand mark is removed from the
navbar, the favicons and `manifest.json`.

**Japanese UI, switchable to English** (`I18N.md`). A dependency-free catalogue, **402 keys**,
read through a typed `t(key, params)`. Japanese is the default; a button beside the theme
toggle switches to English and the choice is remembered per browser. `en` holds upstream's
original wording, so `MERMAID_LOCALE=en` makes English the default. Sample diagram names stay
in English on purpose — they are keys into `@mermaid-js/examples`.

**The audit's three findings each have a follow-up** (`QUALITY-AUDIT-2026-08-31.md`), but
"followed up" is not the same as "finished" and the difference matters:

- **Finding 2** (a hoisted test mock) is resolved outright.
- **Finding 3** (Chromium-only e2e) is resolved as a deliverable — Firefox now runs the
  `@smoke` journeys, which in turn exposed a latent CI misconfiguration that only a second
  browser engine could reveal. WebKit is a deliberate exclusion carrying a reopen condition.
- **Finding 1** (dependency advisories) is resolved. The Monaco-specific DOMPurify override that
  closed it has since been removed again: Monaco 0.57.0 depends on the patched
  `dompurify@3.4.15` itself. The production audit reports zero advisories.

## What is open

One standing decision is recorded in `QUALITY-AUDIT-2026-08-31.md` rather than in the issue
tracker — that is where this project tracks findings, and the owner chose to keep it that way.

**The `dompurify` override.** `monaco-editor` 0.57.0 (the latest) pins `dompurify@3.4.15`
exactly, which a low advisory (GHSA-p98j-92pf-mc4p) covers. Monaco's copy is overridden to the
patched `3.4.16` — twice, because the package is built with both package managers:
`pnpm.overrides` (`monaco-editor>dompurify`) for this repository and a nested npm `overrides`
for the published tarball, which consumers install with `npm install`; see
`QUALITY-AUDIT-2026-08-31.md`. Remove both once a Monaco release depends on `dompurify >=3.4.16`.
(The earlier `lodash-es` override is gone: mermaid 12.1.0 moved to chevrotain 13, which no longer
pulls in the vulnerable `lodash-es`.)

**TypeScript held at 6.x.** TypeScript 7 is the native (Go) compiler: its `typescript` package no
longer exposes the compiler API (only a version export and `unstable/*` entry points), and
`svelte-check`, `svelte2tsx` and `typescript-eslint` all declare support up to TypeScript 6
(`<6.1.0` for typescript-eslint). Upgrading would break `pnpm check` and `pnpm lint`. Revisit
when those three support 7. `@types/node` likewise stays on 24.x to match the Node 24 runtime.

**`pako` held at 2.1.0.** pako 3 silently ignores `inflate(..., { to: 'string' })` and returns
bytes, so upgrading as-is breaks every existing shared link; it also changes the deflate bytes,
so the same diagram gets a new URL. 2.1.0 has no advisory and upstream is still on it, so the
upgrade is deferred to an upstream merge. `src/lib/util/serde.compat.test.ts` freezes links
made by 2.1.0 and fails on either change — run it before any pako or js-base64 upgrade.

**Deprecated dependencies, kept on purpose.** `lucide-svelte` (successor `@lucide/svelte`) is
used only by two vendored shadcn-svelte components (`ui/dialog`, `ui/resizable`); it is left
for upstream to migrate so this fork adds no delta. `plausible-tracker` is never loaded while
`MERMAID_ANALYTICS_URL` is empty — see `FEATURE-FLAGS.md`. Revisit either if it stops
installing or picks up an advisory.

**WebKit coverage.** Safari is a documented exclusion, not a silent gap — nothing is known to
be broken there, it simply is not exercised, so it is not claimed. Reopen if any of these
becomes true: a request to support Safari, a macOS or iOS user of this deployment, or a
WebKit-only defect reported by a user.

## Repository conventions worth knowing before changing anything

- **`docs/` is build output** (GitHub Pages convention) and is gitignored. Never edit it.
- **`vendor/upstream` must not be deleted.** It is the base against which upstream updates
  are merged, and `.upstream-version.json` records the commit (`vendorBaseCommit`) the
  inventory is derived from.
- **Regenerate the inventory last, and against the merge base you will actually land on.**
  `UPSTREAM.md`'s table of locally changed paths is produced by the command that document
  names. Two ways it goes stale, both of which have now happened:
  - Regenerating it _before_ the other edits in the same commit leaves it short by exactly
    those edits. Caught in review.
  - Regenerating it on a branch whose base has since moved leaves it short by whatever landed
    on `master` meanwhile — `scripts/dev-force.js` was missed this way. Re-check **after**
    merging, not only before.

  Compare the entries, not the totals: one path added while another is reverted leaves the
  count unchanged and the table still wrong. Compare the **status letter as well as the
  path**: an upstream update that starts tracking a file this fork added flips its row from
  `A` to `M`, which a path-only comparison cannot see.

  `node scripts/check-local-delta.js` does exactly that — the table against
  `git diff --name-status vendorBaseCommit` as a set of status-and-path pairs, the count
  above against the table, and every changed `package.json` key against `UPSTREAM.md`'s
  lists — and exits 1 on any mismatch. Run it as the last step of any change; CI also runs it
  on every pull request (`.github/workflows/fork-checks.yml`).

- **Node.js 24.16.0** is required (`engines`, and `.node-version`). pnpm 10.34.5 via
  `corepack enable pnpm`. The husky pre-commit hook runs lint-staged under pnpm, so
  committing with an older Node is rejected with `ERR_PNPM_UNSUPPORTED_ENGINE`.
- eslint enforces alphabetically sorted keys on objects with 5+ keys under `src/`, which the
  message catalogue is subject to.

## Testing

`pnpm test:unit` (vitest, 230 tests) and `pnpm test:e2e` (Playwright).

`.github/workflows/fork-checks.yml` holds the checks only this fork runs, kept out of
upstream's workflows so those keep merging cleanly: the local-delta check on every pull
request, and a dependency audit of **both** install paths — `pnpm audit --prod`, and
`npm audit --omit=dev` against the packed tarball, since npm ignores `pnpm.overrides` —
on pull requests, weekly (so a new advisory against an unchanged lockfile still surfaces)
and on demand. With no dependency bot installed, that weekly run is what notices new
advisories.

The e2e suite runs **Chromium** for everything and **Firefox** for seven `@smoke`-tagged
journeys — load, edit/render, persistence, embed, and the swimlane sample. `README.md` states
the supported-browser policy.

Two facts that cost time to rediscover:

- `test.slow()` extends a test's _overall_ budget, not the per-assertion `expect` timeout.
  A test marked slow can still fail on a single 5-second assertion.
- The view renders asynchronously — a debounced state update, an async `mermaid.parse`, then
  a render the app deliberately defers for large diagrams. `EditorPage.checkTextInView`
  carries a raised timeout for that reason; `checkTextNotInView` deliberately does not,
  because it asserts absence and returns as soon as the text is gone.
- `EditorPage.start(url)` with a `#…` URL first goes to `about:blank`: the fixture has
  already opened the editor, and changing only the hash could lose to the editor writing its
  previous state back into the URL, leaving the default sample on screen.

In Claude Code on the web, `.claude/hooks/session-start.sh` puts Node 24 first on PATH (the
image defaults to Node 22, below `engines`), enables pnpm and installs the dependencies, so
`pnpm` scripts and the husky pre-commit hook run there as they do locally.

## CodeQL

`Analyze (javascript)` (CodeQL) passes again. It failed on every run while the repository
was private, because uploading results needs code scanning, which private repositories here
do not have. Making the repository public (2026-09-30) fixed pull requests but not `push`
and `schedule` runs on `master`: those upload with the default read-only `GITHUB_TOKEN` and
were refused. `codeql-analysis.yml` now grants its job `security-events: write` (plus
`actions: read` and `contents: read`, as GitHub's own template does), scoped to that one
job rather than widening the repository-wide token setting.

That is the one local change to the workflow; `UPSTREAM.md` covers it for merges. Do not
delete the workflow: it is the code scanning this repository has.
