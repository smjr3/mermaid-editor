# Where this fork stands

An index and a handover note. Read this first; each section points at the document that
carries the detail and the reasoning.

Accurate as of **2026-10-06**, including the 0.2.0 to 0.2.3 work: the upstream merge of `a70ed76`,
mermaid 12.1.0, and the editor, layout and icon features below.

## What this is

`@smjr3/mermaid-editor` is a fork of [mermaid-live-editor](https://github.com/mermaid-js/mermaid-live-editor),
imported at upstream **2.0.67** and last merged from upstream commit `a70ed76` (2026-09-30), customised for general, privacy-conscious use (promotional, AI and external-service surfaces off by default).

The standing constraints, which shape almost every decision recorded here:

- **Swimlane support** is the reason for the fork. It arrived in mermaid 11.16.0; this
  fork renders with `mermaid ^12.0.0`, so `swimlane-beta` is available. mermaid 12 kept the
  `swimlane-beta` keyword (its detector is unchanged from 11.17.2), so saved diagrams still render.
- **Keep the upstream delta small.** Prefer a feature flag or a wrapper over deleting or
  rewriting upstream code, so a future upstream merge takes their side and re-applies ours.
- **Keep the boundary explicit.** `docs-dev/UPSTREAM.md` holds a regenerated inventory of
  every locally changed path — currently **302**.
- Public on GitHub and published to npmjs.org by `.github/workflows/publish.yml`
  (`PACKAGING.md`); it builds into a static site that any static host can serve, with a GitLab Pages example in `docs-dev/GITLAB-PAGES.md`.

## The documents

| Document                      | What it covers                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `UPSTREAM.md`                 | How the vendor branch works, how to merge an upstream update, the per-area conflict guidance, and the inventory of locally changed paths |
| `FEATURE-FLAGS.md`            | Which surfaces are switched off by default and by which variable                                                                         |
| `CROSS-PLATFORM.md`           | Why the build runs on Windows as well as Linux, and what is reasoned rather than executed                                                |
| `THEME.md`                    | The accent palette per mode with measured contrast, and why the dark `--accent-foreground` must not be reverted                          |
| `ICONS.md`                    | The bundled icon packs and logos, build-time vendor sets, hosted and user-imported packs, redistribution, and sanitising                 |
| `I18N.md`                     | The message catalogue, `t()` and its interpolation, what stays in English, and how the e2e suite avoids depending on translated text     |
| `PACKAGING.md`                | npm packaging and the tarball → rebuild round trip                                                                                       |
| `GITLAB-PAGES.md`             | A GitLab Pages publishing example                                                                                                        |
| `QUALITY-AUDIT-2026-08-31.md` | An external portability audit, its three findings, and a follow-up for each recording how it was resolved                                |

## What is delivered

All of this is on `master`.

**Base and packaging.** Upstream imported on a `vendor/upstream` branch, derivative-OSS
licensing and attribution in place, npm packaging verified by an actual tarball → install →
rebuild round trip, GitLab Pages build verified twice in one workspace.

**Promotional, AI and external-service surfaces off by default** (`FEATURE-FLAGS.md`). Mermaid Chart links, AI
features and community links are switched off by environment variable; `MERMAID_RENDERER_URL`
and `MERMAID_KROKI_RENDERER_URL` are emptied, which closes every path that would put diagram
source into a third-party URL. Local PNG/SVG export still works — it renders in the browser.
Nothing was deleted, so an upstream merge keeps their markup and re-applies the guard.

**The build runs on Windows** (`CROSS-PLATFORM.md`). Three things were genuinely broken, not
merely untested: `mv docs public` in CI, a `postinstall` chain that used `true` as a command,
and the absence of `.gitattributes`. The Windows half is reasoned from mechanism — there is
no Windows host in the development environment — and that document says so and asks for one
real run on a Windows runner.

**Unused files removed.** Upstream's release and hosting helpers, container files, dependency-bot
configs, `SECURITY.md` (which pointed reporters at mermaid.live) and 13 dev dependencies that
nothing loaded are deleted; `UPSTREAM.md` lists them and how to keep a merge from restoring them.

**Swimlane samples.** `@mermaid-js/examples` ships none, so the "Sample Diagrams" card
gains a local `Swimlane` entry (`src/lib/util/localSamples.ts`) with two examples; a `@smoke`
e2e test renders it in Chromium and Firefox. See `UPSTREAM.md`.

**Business templates (0.2.1).** The same file adds a "業務テンプレート" group, listed first in the
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
closed. On desktop the tools, the diagram and the code are three fixed panes with visible dividers (swappable)
instead of floating cards (see "Three panes and one toolbar" below). Each has an e2e test; see `UPSTREAM.md` → "Editor, layout and icon additions".

**Icons (0.2.0)** (`ICONS.md`). Diagrams can name icons as `prefix:name` from twelve bundled OSS
Iconify sets, loaded lazily from the site, never a CDN: nine generic ones (`tabler`, `lucide`,
`carbon`, `fluent`, `flat-color-icons`, `mdi`, and since 0.2.2 `clarity` for network and
data-centre gear, `eos-icons` for DNS/proxy/Kubernetes concepts and `fluent-color` for the
Microsoft 365 look — all MIT, chosen against about twenty candidates; `ICONS.md` → "Choosing the
packs") and three logo sets (`logos`, `simple-icons`, `devicon`). They are npm dependencies, so the repository and the npm package carry no icon data.
`MERMAID_BUNDLE_LOGOS=false` builds without the logo sets and strips the brand icons from the
generic ones, for sites that may not host trademarks. Vendor architecture icon sets (AWS, Azure,
Google Cloud) are not OSS, so they are imported from the vendor at build time
(`MERMAID_FETCH_ICON_PACKS`, `scripts/fetch-icon-packs.js`, output gitignored and kept out of
the npm package); verified with Google Cloud's archive (216 icons). A deployment can also host
packs (`MERMAID_ICON_PACKS`) and a user can import SVG files or an Iconify JSON file from the
"Icons" card (kept in IndexedDB). Every non-bundled icon is sanitised with DOMPurify before
mermaid inserts it. A "System Architecture" sample entry shows a web system, an office network,
a generic cloud and an AWS example with logos. The packs add about 39 MB to the built site (17 MB
of it the logo sets, 2.8 MB the three 0.2.2 packs); a page loads only the ones its diagram names.

**Command palette and first-visit guide.** Ctrl+K (⌘K) or the search button in the header opens
a palette of twenty actions (and one per diagram theme) in Japanese with English keywords (`src/lib/util/commands.ts`, a
registry plus a small scorer; arrow keys, Enter, Escape; Enter that confirms an IME conversion
is ignored). An entry opens the right tools card and focuses or presses a control by
`data-testid` (`uiBus.ts` drives the card header click and the tools rail's expand button, so
`+page.svelte` needed no change), or runs undo/redo, theme, language, help, share or history.
The first visit shows a three-step popover guide (tools pane, diagram, the help button and
sharing) from `GuideTour.svelte`; closing it or pressing Escape stores `guideDoneKey` and it
never opens by itself again; "最初の案内をもう一度見る" in the How to use dialog restarts it.
`tests/test.ts` sets that flag in every spec's browser context (`guideSeen: false` opts out,
as `tests/onboarding.spec.ts` does).

**Layout card (0.2.0)** (`src/lib/util/layout.ts`). mermaid has no aspect-ratio setting, so the
"Layout" card adjusts what shapes a diagram instead: its direction (top-to-bottom, left-to-right,
or "fit to view", which renders both and keeps the one that shows larger in the view, preferring
left-to-right when they are close), the layout engine (standard or ELK) and the node/rank
spacing. mermaid 12's default `layout` is `elk`, and ELK ignores `nodeSpacing`/`rankSpacing`, so
"Standard" is written as `layout: dagre`, ELK is the absence of the key, and the spacing buttons only
change the picture under Standard (the card says so under ELK). The direction is written into the code (`flowchart LR`, `direction LR` for state, class,
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

**Diagram themes (0.2.2)** (`src/lib/util/themePresets.ts`). The Colours card opens with a grid
of twelve named themes (テーマ), each a card with its name, five colour dots and a two-line description,
the current one ringed and ticked; the old row of mermaid's built-in themes stays under it as
"mermaid の組み込みテーマ". 標準（mermaid 既定） is the default and is the absence of a preset: the
editor manages the theme as before. The other eleven — モダン, ネオン, サイバー, パステル, ミニマル／モノクロ,
ビジネス（ブルー）, サンセット, フォレスト, ダーク・グラス, 和（わ）, ハイコントラスト — are plain mermaid config:
`theme: "base"` (which the editor does not manage, so dark/light switching leaves a preset alone), a full
set of `themeVariables` generated from a small palette per preset (`variablesOf`: flowchart, sequence,
state, class, ER, gantt, pie, git graph, mindmap/timeline/kanban `cScale*`, quadrant, xy, requirement,
C4 person, architecture) and a `themeCSS` for what variables cannot do (glow via `drop-shadow`, rounded
corners via `rx`, line weight, dashed clusters). The CSS starts with `/* theme-preset: <id> */`, which is
how `presetOf` recognises a preset after a shared link, a reload or a hand-changed line colour.
Applying a preset replaces the previous theme, variables and CSS as a whole and keeps every other key;
標準 drops all three. Each preset is also in the command palette as 「テーマ: ネオン」 etc.
A preset paints its own background: `render` (`mermaid.ts`) adds `#id{background-color}` to the SVG
instead of the dark site's grey backdrop, `renderView.ts` puts it inline on the hand-drawn sketch (which
drops the SVG's `<style>`), and the PNG/SVG exports use it in place of white or the site colour
("transparent" still drops it). Every rule is in the SVG's own `<style>`, so the exported files carry it.
mermaid limits found while checking every diagram type: `themeCSS` goes through the browser's CSS parser
and is prefixed with the diagram id, so it cannot style the root `<svg>` itself (hence the injected
background); `useGradient`/`dropShadow` only apply to the neo look's nodes, so the glow is CSS; ER and
flowchart edge labels draw a half-transparent box derived from `tertiaryColor` (overridden on
`.labelBkg`); C4 draws boundaries, relationships and their text in a fixed `#444444` presentation
attribute (overridden by attribute selectors), and its elements keep mermaid's own blue/grey boxes with
white text; a `style` statement in the code that sets a fill without a text colour (as some upstream
samples do) keeps the preset's text colour, which can be light on a dark preset; and CSS cannot make text
bold without overflow, since mermaid measures labels before the CSS applies (ハイコントラスト uses a larger
font instead). Unit tests `themePresets.test.ts` and a managed-theme case in `state.svelte.test.ts`;
`tests/themePresets.spec.ts` (neon colours and glow, SVG and PNG export, reload, shared link, back to
標準 and dark-mode switching, a phone-width picker driven by the keyboard).

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
Journey, XY, quadrant, sankey, git graph, packet and ZenUML have forms too (see "Chart types from zero" below); radar, treemap, Venn and the other newer types have none.
**What is inside objects (0.2.2)** (`src/lib/util/diagramDetails.ts`). The Add card
also fills objects in: a class attribute or method with visibility (+ - # ~ or none), type or
return type and parameters, written last in the class body (`-total: Money`, `+pay(x) bool`) or, for
a class without a body, as an `X : +Type name` statement (mermaid rejects a second colon there); an
ER attribute (type, name, PK/FK/UK/PK+FK, comment) last in the entity's `{ }` block, opening one on
its `id["label"]` line or adding one; a composite state (`state "Name" as g1 { }`, empty or around a
chosen state, placed right after that state's first mention so a state inside another composite
stays nested) and a new state inside a chosen composite; a C4 boundary (system, container,
enterprise or plain) drawn around a chosen element where it stands (mermaid rejects an empty
boundary, so the element is required); gantt tasks with a status (not started, done, in progress),
critical and milestone marks and "after task", which gives the chosen task an id (and the one it
follows, when it has no start of its own) because `after` needs one; requirements of each kind with
text, risk and verification, elements and the seven relationships (names that are not a plain word
are quoted, so Japanese names work); the pie's `showData`; and, on an empty `mindmap`, which mermaid
does not parse, "最初の話題を追加" for the root (an action's `when` hides the actions that do not
apply). The first task of an empty gantt chart is dated today: mermaid crashes on a first task with
nothing to follow. The Add card now applies a result only if mermaid parses it as the same type
(`checkAdd`; code that did not parse may become a diagram of the type its header names).
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

**Edit card (0.2.1)** (`src/lib/util/diagramModify.ts`, `EditControls.svelte`). Choose an object
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
architecture (reverse, arrowhead, delete), C4 relationships (label, reverse, delete; the
technology after the label is kept) and block arrows (label, reverse, arrowhead, delete). Journey,
XY, quadrant, sankey, git graph, packet and ZenUML are edited as described under "Chart types from
zero"; the other newer types have no edit forms. Every edit is applied only if mermaid still parses the result as the same
diagram type; the all-diagram check renames and deletes every object and runs every arrow edit on
every sample. Ids in Japanese (申請者, 営業) are listed and edited like any other in flowcharts, swimlanes, ER and C4 diagrams, and the Colours and Add cards accept them too; mermaid's state, class, requirement and block grammars reject a non-ASCII id in a `style` statement, so those cards leave such ids out (`unicodeIds` in `mermaid.ts`).

**Edit card: inside objects and more types (0.2.2).** Choosing a class lists its
attributes and methods (from its bodies and `X : …` statements), choosing an ER entity its
attributes; each can be changed (visibility, name, type, parameters; type, name, key, comment) or
deleted, and an attribute keeps how it was written (`Type name` or `name: Type`). Composite states
are groups (rename; delete with what is inside, or keep the states, moved out one level, dropping a
concurrency divider that only means something inside); arrows are editable on diagrams with
composite states — the refusal the audit saw was the counting check, which compared the statements
with `getRelations()`, top-level only, and now counts `getData().edges` without the note links. C4
boundaries are groups (rename through the same pattern as elements; delete with the elements and
their relationships, or keeping them). Gantt: sections (rename, delete with or keeping their tasks)
and tasks (rename, delete; and start date, "after task", days, status, critical, milestone through
the fields under the name, changing only what was changed and keeping other tags such as `vert`); a
deleted task hands its start to the task that followed it and to tasks that started `after` it, so
no first task is left without a start (which mermaid cannot draw). Pie slices: rename, value,
delete. Requirements and elements: rename everywhere the name is used (definition, relationships,
style), delete with relationships and style. Blocks: rename whatever the shape (`(("x"))`,
`<["x"]>(down)`, keeping a `:2` width), delete from a line placing several, with arrows and style; a
`block:id … end` is a group (no text of its own; delete with or keeping its blocks; an emptied one
goes, since mermaid rejects it). The all-diagram check changes and deletes every member, runs every
property field through each option, and runs every Add action with each choice option.

**From zero, UI only.** For someone who cannot write mermaid. "New diagram…" at the top of the
Samples card (open by default, so the first thing in the tool stack) offers 21 types — flowchart,
swimlane, architecture, sequence, state, class, ER, gantt, mindmap, kanban, timeline, pie, C4, block,
user journey, XY chart, quadrant chart, sankey, git graph, packet and ZenUML
— each with a one-line description, plus an optional title and, where the type has one, a direction;
"Create" replaces the code with a minimal starter (`src/lib/util/newDiagram.ts`: a header and one or
two placeholders named in Japanese, ASCII ids) after a confirm, unless the code is empty, a sample or
an unchanged starter. Every starter parses as its type and gives the Add card actions (unit test);
the all-diagram check runs every feature over the starters too.

**Chart types from zero (0.2.2)** (`src/lib/util/chartEdit.ts`). The seven types the QA pass found
could not be made without writing code each have a starter, Add forms, Edit card operations and, where
they are lists, the table editor; every write is plain mermaid and every form says in Japanese what is
missing. User journey: step (section, satisfaction 1–5, people) and section; rename, delete (a section
with or keeping its steps), score and people; table of steps (section moves a step). XY chart: axes
(horizontal items, titles, vertical range) and series (bar or line, name, values); the axes and each
series are objects (title, items or range, kind, values); table of series. Quadrant chart: point (x, y in
0–1) and axis/quadrant names; points renamed, moved, deleted, quadrants renamed, axis ends changed;
table of points; text that is not plain words is quoted (mermaid's quadrant lexer rejects `(`, `:` …).
Sankey: flow (from, to, amount); names renamed everywhere or deleted with their flows, amounts changed;
table of flows. **mermaid's sankey lexer reads ASCII only** (quoted or not), so a Japanese name is refused
with that reason, the starter's names are English, and the type picker says so. Git graph: commit (name,
branch, tag, look), branch (from a branch; a Japanese name is quoted — mermaid rejects it bare), merge
(adds the `checkout` it needs) and switch; branches and commits renamed (checkouts, merges and
cherry-picks follow) or deleted — a delete drops what mermaid would then refuse (a merge with nothing to
merge, a cherry-pick of a commit that is gone; `repairGit`). Packet: field (name, width in bits) after the
last; rename, width, delete and reorder renumber the following fields, which mermaid requires to be
contiguous (`+n` fields keep their form). ZenUML: participant (person, database or plain; one word, so
spaces become `_`) and message `A->B: text`; participants renamed everywhere or deleted with their
messages. Packet and ZenUML titles are their own `title` statement (`diagramTitle.ts`). The Samples card
gains a Japanese example in each of these groups but sankey (`localExamples` in `localSamples.ts`, appended
after the group's own default). A delete that would leave a diagram mermaid cannot read (the last sankey
flow) is not offered. Unit tests `chartEdit.test.ts`; the all-diagram check compares each table with
mermaid's own count and edits every object of every sample; `tests/qaFindings2.spec.ts` drives each type
in the browser.

**Second QA pass (0.2.2).** Besides the chart types above: the history opens as a sheet over the
code pane (`+page.svelte`), so the diagram keeps its width (it was squeezed to ~215px at 1280px) — no
longer a resizable fourth pane; a click selects a swimlane lane (its cluster id is unprefixed), an
architecture group (its box has no fill, so a click inside is found by position, smallest box first),
a sequence message (by the text beside its line, or by the line's order when texts repeat), an ER
relationship or any arrow within a few pixels of its line, and a C4 relationship by its text
(`diagramPick.ts`, `SelectionLayer.svelte`); a composite state made by the Add card has a 「内容」 state
inside (mermaid draws an empty one as its label alone); a misspelt icon (`tabler:servr`) gets the names
within two edits in the same pack first (`editDistance`, `iconCatalog.ts`); internal ids are shown only
to tell apart two objects with the same text (`displayName.ts`: selection panel, the new context menu
header, Edit/Add/Colours/table lists); an unnamed participant, state, class, entity, element, block or
card is called 参加者3, 状態3 … ; required Add choices say 「（選んでください）」; the common sample groups have
Japanese names that wrap to two lines instead of being cut short (`sampleNames.ts`, shared with the e2e
helper). Left for later: the rename delay (performance work elsewhere), mobile tabs, the packet loading
state, and click-selection for the seven chart types.

**From a template, by form (0.2.2).** "From a template…" sits under "New diagram…" in the
Samples card and opens a dialog listing the nine business templates, each with a one-line
description and a preview (`TemplateForms.svelte`). The previews are each template's default
diagram rendered by mermaid once per theme when the dialog first opens, one after another, and
cached for the page (`templateThumbnails.ts`); they arrive within a second or two and the list is
usable before then. Choosing one shows its form (`src/lib/util/templateForms.ts`: a schema per
template of text boxes, choices and lists of rows to add or remove, labelled in Japanese and
English, filled in with that template's content) and "Create" writes the diagram from it through
the template's generator, sets its title, and opens the Add card so the user carries on there
(by clicking its header, as the tools rail does — no page hook was needed). It asks first unless
the code is empty, a sample, an unchanged starter or an unchanged template. The forms: the three
flows (swimlane expense flow, approval flow, support flow) take lanes and steps, each step with
its lane, a kind (step, decision, start/end) and where it goes next — a decision has a "yes" and a
"no" target and label, which is how the 差戻し loops are written; hiring takes periods (stage,
when, what happens separated by `/`); architecture takes groups (name, icon), services (name, an
icon from a short tabler list, group) and connections (from, side, to); the gantt chart takes a
project name, a start date and tasks (phase, name, start or "after the previous", days, status);
the org chart takes units and whom each reports to; the monthly close takes participants and
messages (from, to, text, request or reply arrow) — the sample's `alt` block is left out; the
duty board takes columns and cards (work, column, assignee). Rows refer to other rows by a hidden
id, so renaming a lane keeps its steps; a step whose lane was removed goes to the first lane,
empty rows are dropped and a list emptied entirely still produces a diagram that parses. Ids are
ASCII and never start with R/L/T/B (`n1`, `g1`, `grp1`, `svc1`, `o1`, `p1`, `col1`/`card1`);
text is cleaned as the Add card cleans it (tags dropped, `;` → `,`, quotes as `#quot;` in
flowchart labels, arrow labels quoted so brackets survive, `#` as `#35;` in sequence text, `[]`
out of architecture labels, `:` out of gantt names). `templateForms.test.ts` parses every
template's defaults, the result with every list emptied and with awkward Japanese text in every
box; `tests/templateForms.spec.ts` adds a lane and a step to the expense flow and changes a gantt
task, and checks the render.

**Diagram title** (`src/lib/util/diagramTitle.ts`). The Layout card has a title field that sets,
changes and removes the title. It is front matter (`---\ntitle: "…"\n---`, other keys kept) for
flowchart, swimlane, sequence, state, class, ER, gantt and pie — checked in the real render
(`tests/newDiagram.spec.ts`). Timeline and C4 ignore a front-matter title, so theirs is their own
`title …` statement. Mindmap, kanban, architecture and block diagrams draw no title at all; the card
and the new-diagram form say so. Getting the title to show exposed a race: mermaid keeps the title in
one store shared by every diagram and each parse clears it; `mermaid.parse` and `mermaid.render`
share mermaid's queue but `getDiagramFromText` (the cards' reads) does not, so a card reading the new
code while the view rendered it dropped the title from the picture. Renders and those reads now take
turns (`diagramFromText` in `mermaid.ts`).

**Edit card additions.** For a flowchart or swimlane node: change its shape (the Add card's five;
a node written as `@{ shape: … }` too), move it to another lane or subgraph or out of every lane, and
set or remove an icon (`id@{ icon: "prefix:name", label: … }`) found with a small search box
(`IconChooser.svelte` over `src/lib/util/iconCatalog.ts`, every pack the editor knows). A move takes
the node's definition with it; an arrow statement inside the old lane moves out to just after that
lane (the other nodes it named stay as definitions), so every arrow stays, and `linkStyle` numbers
follow the arrows if their order changed. mermaid gives a node to the first subgraph to close that
mentions it, which is how the card reads the current lane. For an architecture service: change its
icon (mermaid's standard ones are offered first and written without a prefix) or move it to another
group. A node with an icon keeps the icon's shape, so the shape list is hidden for it.

**Table editor (0.2.2)** (`src/lib/util/tableEdit.ts`, `TableEditor.svelte`). Business users
think of the list-like types as tables, so the Edit card ends with "表で編集": gantt tasks (section,
task, start, days, status — not started, done, in progress, critical, milestone, or the combination
a task already has — and "after task"), kanban cards (column, card, assignee, priority), timeline
periods (period, events separated by `/`), pie slices (label, value) and, for an ER entity chosen in
the table's own list, its attributes (type, name, key, comment). Cells are inputs and selects; a
change applies on blur or Enter, rows can be added, deleted and moved up or down (the code order
changes: the two rows' lines swap, re-indented to each other's place), and choosing another column
or section moves a card or task to the end of it. Writes go through the Add and Edit cards'
functions where they exist (`renameObject`, `setObjectFields`, `setEntityAttribute`, the gantt,
kanban and pie Add actions, …); the section and column moves, kanban `@{ assigned, priority }`
metadata (other keys such as `ticket` kept; a card written as bare text gets an id so it can carry
metadata), a period's events and the reorders are rewritten in `tableEdit.ts`. A reorder or move that
would leave the first gantt task without a start gives it the start the first task had (mermaid
cannot draw a first task without one), and a task that followed the moved one straight on keeps its
date. Each change is applied only if `checkEdit` passes, else the message says so and the cell shows
the code again. The rows come from the code's lines, read only when mermaid parses the code; the ER
entities (including ones named only in relationships) and the kanban assignees and priorities come
from mermaid's database, so the table follows edits made in the code editor or the Add card. Pasting
tab-separated rows (copied from Excel, quoted cells included) into the table appends them in column
order; a header row is skipped, choices are matched by value or by their Japanese or English label,
sections and columns by name (a new name creates one), "after task" by task name, dates written
`2024/6/3` are accepted, `1,234` is a number. The per-row forms above it are unchanged. Unit tests
`tableEdit.test.ts` (read model per type, every write, reorder, paste, Japanese text with `:` `;` `,`
`#` `"` and brackets); the all-diagram check compares the rows with mermaid's own count on every
gantt, kanban, timeline, pie and ER sample and deletes and moves every row; `tests/tableEditor.spec.ts`.

**Sequence notes and blocks.** The Add card adds a note (over one or two participants, or right or
left of one) and an `alt`/`loop`/`opt` block, at the end or after a chosen message; a block can be
empty (header + `end`, as asked) or wrap the chosen message. A new message, note or block can also go
first inside a block. An empty block renders its condition broken into hyphenated characters
(`[-承-認-]`), since mermaid sizes the label to the block's (empty) width; it reads normally once a
message is inside. The Edit card lists notes and blocks after the participants: change a note's text
or a block's condition, delete a note, or delete a block keeping the messages inside (its
`else`/`and` lines go with it).

The lists behind the Add and Colours cards come from mermaid's parse on every change; results
are shared per code (`memoByCode`, `memo.ts`), so a large diagram is not parsed once per card. It
cut the heaviest sample's all-diagram e2e from about 15 s to 9 s locally (it had begun timing out
on CI).
Only groups with an id (`subgraph id` or `subgraph id [Title]`) are listed; a quoted title alone
has no id a `style` statement could name.

**Audit fixes.** From the UI audit: renaming or deleting a kanban card that carries `@{ … }`
metadata keeps its id and attributes, and the Edit list shows only the text in the brackets
(`splitMeta` in `addActions.ts`, used by `nodeLabel` and `renameLine`). The Add card says what is
missing (`add.chooseParent`, `add.chooseColumn`, `add.choosePeriod`; `add.choose` stays for
connections). The Layout card's "cannot change direction" note is per diagram type
(`directionUnsupportedKey` in `layout.ts`; only architecture mentions R/L/T/B). Japanese wording is
unified: 接続元/接続先, ラベル, 参加者; a flowchart's subgraph is グループ and a swimlane's is レーン
(the Add and Edit cards pick the key from the header); the Samples card shows ER 図 / XY チャート /
パケット図 through a display-name map (group names stay mermaid's catalogue keys); the nav title
and the Gist button read naturally in Japanese (`nav.appTitle`).

**How to use (0.2.0)** (`src/lib/util/helpContent.ts`). A "How to use" button in the editor's
header opens a short guide: the basics, starting a diagram, adding shapes, changing and deleting, layout, colours, icons,
export and sharing, tips. The text is prose, kept out of the message catalogue; a test keeps the
languages' sections and points in step. Update it when a tool changes.

**Undo / redo (0.2.1)** (`src/lib/util/undoStack.svelte.ts`). Two arrow buttons in the editor header step
back and forward through the diagram code, for the user who does not know Ctrl+Z or whose change
came from the Add, Colours or Layout card rather than the editor. The history records each distinct
code value as it passes through the input state (typing settles into one entry after a 500 ms pause,
100 entries kept), so it is the same for Monaco, CodeMirror and the cards and does not depend on
either editor's own stack; an undo is applied through `updateCode` and is not itself recorded.
The buttons are disabled when there is nothing to undo or redo, and the history starts afresh once
the diagram is loaded, so opening a shared link offers no step back to what the browser held before.
Shown on the code tab only. Unit test `undoStack.test.ts`; e2e `tests/undo.spec.ts`.

**A mistake in the code never leaves you stuck (0.2.2)** (`src/lib/util/codeHealth.svelte.ts`,
`codeError.ts`, `stateGuard.ts`, `CodeErrorNotice.svelte`). Users reported that once the code had a
syntax error the tools stopped working and there was no way back. Now, while the code does not parse:
the diagram keeps the last picture that rendered, faded; a notice over the diagram and at the top of the
tools pane (so it is seen with the code pane folded) says in plain Japanese which line is wrong — "3
行目が途中で終わっています", "1 行目が図の種類で始まっていません", "コードが空です" — and offers
**"直前の正しい状態に戻す"**, which puts back the last code that parsed (or, for a diagram that parsed but
failed to draw, the last one drawn) as one more undo step, so Undo brings the change back; with nothing
valid since the page opened it offers "見本の図から始める" instead. The line is found from mermaid's
own excerpt, with front matter and `%%` comments taken out as mermaid does (upstream's
longest-common-substring guess pointed at the line before whenever the excerpt spanned two lines); the
Monaco squiggle uses the same line. The tool lists stay those of the last valid code, but every tool
that edits the code (Add, Edit, Colours, Layout's direction and title, the table editor, the unknown-icon
replacement, the selection's toolbar, panel, menu and keys) refuses while the code is broken and says
why (`editsBlocked`) — applying an edit to the broken code could not be checked, and applying it to the
last valid code would throw away what was typed. Whole-diagram replacements (a sample, a new diagram, a
template, a history entry) stay available as ways out; so do the config-only settings. The tools that
wrote straight into the code (Add, Colours, Layout, unknown icons, the selection's colours) now check
the result with mermaid first (`applyToolEdit`), like the Edit card. A broken config gets its own notice
with "設定をリセット". A diagram that parses but fails to draw (an invalid gantt date, a circular
sankey link) is reported too, and mermaid's half-drawn scratch element is removed (`renderView.ts`).
A composite state that refers to itself (`state A { A --> B }`) is reported instead of drawn: mermaid
overflows the stack on it and the tab stops responding — and, the code being saved, again on every
reload (`renderHazard`). A stored or linked state is taken field by field (`stateGuard.ts`): a
`codeStore` without `rough` (as old saves have) used to leave the page white, and a link whose code was
not text threw in every card; a linked config that is not JSON now costs the link its config, not its
diagram. An emptied editor is passed on (upstream kept the old code unseen, still drawn and edited by the
tools). Found and fixed at the source while testing: the Add card's "Connect" label with `]`, `(` or
`{` (now quoted), an empty node, lane, group or service name, `"` or `'` in an architecture name,
mindmap and kanban names with brackets or quotes (they lost them and could leave an empty line; now
quoted), gantt task names starting with a keyword such as `click` (now in 「」), and templates with any
of these; "Create" in the template dialog also checks the result. `tests/errorRecovery.spec.ts` (15
journeys, each also failing on any uncaught page error) and the unit tests of the files above.

**Source review of 2026-10-08, P1 findings.** An external review of v0.2.3 (master
`534956be`) raised twelve findings; R01–R05 are fixed here, each with a regression test.
R01: the table editor, the Edit card and the icon picker's take-back checked an edit
asynchronously and then wrote it even when the code had changed meanwhile, throwing away
what was typed. All three now go through `applyToolEdit` (or, for the picker,
`insertChecked` in `iconSearch.ts`), which drops an edit made from code that is no longer
current (`stale`, message `edit.stale`) and keeps the newer code
(`TableEditor.test.ts`, `EditControls.test.ts` mount the components with a pending check).
R02: F2 renamed an id onto one another object already had, and mermaid silently merged the
two (`A[Alpha] --> B[Beta]` renamed A → B is one node). `checkedRename` now refuses an id that
mermaid's parse lists for another object (`diagramIds.ts`: flowchart and swimlane nodes and
lanes, states, classes and namespaces, ER entities, architecture services, groups and junctions,
sequence participants, C4 elements and boundaries, blocks, kanban, mindmap and requirement ids,
gitGraph branches), and any rename that leaves fewer objects; a label with the same text is not a
collision. Types without a reader fall back to the lexical scan (`editor.renameTaken`). A refused
rename is now also shown as a notice: the standalone Monaco editor only logs a rename's
`rejectReason` to the console, so the existing "breaks"/"invalid" refusals were never seen either.
R03: a browser that does not save stopped the editor. `readJSON` touched the `localStorage` getter
outside its `try` (it throws with site data blocked) and `writeJSON` let a `QuotaExceededError`
escape, which aborted `persistAndProcess` before the URL hash, the validation and the render. Every
access is guarded now (`persist.svelte.ts`), a failed save leaves the input in memory and the rest
running, and the user is told once per page (`storage.notSaving`) to copy the link or export before
closing the tab. With storage blocked the page used to end in a 500 — mode-watcher reads
`localStorage` as it loads — so `app.html` puts an in-memory stand-in there first, which
`persist.svelte.ts` counts as not saving. Unit tests inject a throwing getter and a throwing
`setItem`; `tests/errorRecovery.spec.ts` edits, draws and links a diagram with full and with
blocked storage.
R04: `MERMAID_OFFLINE` did not cover the hosted icon packs, which fetched any URL directly, nor
analytics; and an imported SVG kept `<image href="https://…">` and `url(https://…)` paints, which the
browser fetches as soon as the icon is drawn. The pack loader now goes through `assertFetchAllowed`
(moved to `offline.ts`, so `customIcons.ts` can use it without an import cycle; `util.ts` re-exports
it), `initAnalytics` does nothing offline, and icon bodies lose every external reference
(`customIcons.test.ts`, `stats.test.ts`, `tests/offline.spec.ts`).
R05: `render` (`mermaid.ts`) called `mermaid.initialize(config)` before waiting for its turn and read
`getConfig()` after it, so of two renders with different configs (the view and an HTML export, the
layout card's two probes, the template thumbnails, a theme change) the one waiting drew, and took
its backdrop from, the other's config. Initialise, render and read-back now share one turn; every
caller goes through `render`, so all of them are covered (`mermaidRender.test.ts`, with a fake
mermaid: concurrent dark and forest renders each keep their own theme and background).
