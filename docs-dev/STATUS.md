# Where this fork stands

An index and a handover note. Read this first; each section points at the document that
carries the detail and the reasoning.

Accurate as of **2026-10-06**, including the 0.2.0, 0.2.1 and 0.2.2 work: the upstream merge of `a70ed76`,
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
  every locally changed path — currently **293**.
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

**Three panes and one toolbar (0.2.2).** On desktop (640px and wider) the editor is three panes:
by default the tools on the left (three tabs: 作る, 直す, 出す — see below), the diagram
in the centre, and the code on the right (code and config tabs, undo/redo, reset config, docs) —
people start from the left, and most of this fork's users build diagrams with the tools, so the
code comes last. The ⇄ button in the tools header ("パネルの並びを入れ替える") swaps to mermaid.live's
code | diagram | tools; the choice is kept per browser (`localStorage` `paneOrder`,
`src/lib/util/toolsPane.svelte.ts`). The tools take about 32% of a window 1280px or wider (25%
below), the code about 27% (25%; at 22% the default diagram's `fa-car` token ran past the right edge of a 1280px window and Firefox could not click it). Each divider drags, and the sizes are remembered per browser
(paneforge `autoSaveId`), separately for each order (`liveEditorToolsLeft`, and `liveEditor` for
code-left, which keeps the sizes saved before the swap existed), so one order's widths never
apply to the other; each pane has an `id`/`order`, so the layout with the history column open is
remembered separately too. Swapping remounts the panes; the Monaco models get a path per editor
instance (`DesktopEditor.svelte`) and the pan/zoom observer ignores a removed diagram
(`panZoom.ts`), which the remount would otherwise trip over. Both side panes collapse on their
own to a slim rail on their own side: the button in the code header folds the code to a rail
(code, config), the button in the tools header ("ツール") folds the tools to a rail with one icon
per section, grouped by tab; a rail icon expands its pane and opens that tab and section. Someone who never writes code
folds the code away and works with the diagram and the tools; someone who only writes code folds
the tools away. The old "Hide the tools" bar under the editor and its `editorFocus` setting are
gone — the tools pane's own collapse replaces them.

The desktop tools pane has **three tabs** (`ToolsTabs.svelte`), named for what the user is doing
rather than for the old seven cards: **作る** (make) holds Samples — with "新しい図を作る…" and
"テンプレートから作る…" at its top — and Add; **直す** (fix) starts with the "選択中" panel (see
"Selection" below), then Edit, Colours, Layout and Icons; **出す** (out) holds Actions (export
presets, HTML and GitLab export, copy and share links) and "AI・アイコン確認" (`AiTools.svelte`: the
unknown-icon list and the AI briefing, moved out of the Icons card). Within a tab the sections are
an **accordion**: one section open at a time in the whole pane (`toolsAccordion` in
`toolsPane.svelte.ts`, used by `Card.svelte` for the stackable cards that have a test id), the
closed ones one-line headers, the open one filling the rest of the pane's height and the only thing
that scrolls — the pane itself never shows a second scrollbar. Samples (作る) is open on a first
visit, as upstream's card is; a tab remembers its last open section, and showing it again reopens
that one (or its first). Every section keeps its header test id (`TID.addCard`, `colorsCard`, …),
and a click on a header opens the section **and shows its tab** (`toggleSection`), so the specs,
the command palette (`uiBus.openCard`) and the template dialog, which all open a section by
clicking its header, needed no change. That works because the three panels sit side by side in a
strip that scrolls sideways with only the active one in view, rather than hiding the others: a
header in another tab is still in the page, scrolling it into view (as Playwright does before a
click) moves the strip, and focus moving into another panel shows its tab. The arrow keys move
between the tabs. The boxed inner scroll areas (icon results and
browse grids, the edit card's icon results, the New diagram type list, the sample buttons) keep
their `max-h-*` on phones and drop it from `sm:` up, so on desktop they use the card's height; the
sample types are a grid that fits the width (truncated names carry a tooltip), with "新しい図を作る…"
first. The forms are styled from the page (`+page.svelte`, scoped to `.tools-pane`, written against
the cards' existing markup so the cards' own logic is untouched): controls at 2.25rem (h-9), a 0.5rem
gap, a little more space above each section title, and, where the pane is 25rem or wider (a third
of a 1280px window), the label-and-select rows of a section two to a row with each label above its
select. Checked at 1280×800 and 1920×1080: new diagram → three nodes → connect → colour one →
PNG needs no page scroll and at most one scroll inside the open card (at 1280×800, to reach
"作成" in New diagram). On phones the cards stack under the editor and open independently as before.

When the code pane is narrow (under 30rem) the buttons in its header show icons only, so the
collapse button stays in view at 1024px. Upstream's three floating toolbars over the drawing are
replaced by one bar across the top of the diagram pane (`DiagramToolbar.svelte`): zoom out, zoom
in, reset view (the frame icon, "図を画面に収める"), open the diagram alone in a new tab (the
`open-in-new` icon — the earlier diagonal open-in-full arrows read as "fit to screen" next to
reset); hand-drawn and grid; then, at the right end, light/dark, the language button, privacy (only
when the deployment shows it) and the mermaid version as plain text. There is no auto-sync toggle:
upstream removed it before this fork's base. It fits on one row at 1024px. On phones (under 640px)
the layout is unchanged — the editor with the tool cards under it, swiped against the diagram —
except that the same bar sits above the diagram, without the zoom buttons, as before.
`tests/toolsPane.spec.ts` (order, swap and reload, rails, accordion), `tests/toolsTabs.spec.ts`
(the tabs, header test ids opening their section and tab, the rail mapping, the accordion),
`tests/editorPanes.spec.ts`, `tests/fixedLayout.spec.ts`.

**Selection: click the diagram, then change it (0.2.2).** The diagram itself is now where
editing starts. A click on a drawn object (node, lane, state, class, entity, participant, service,
group, topic, kanban card, timeline item, gantt task, requirement, block, C4 element) or an arrow
selects it — one selection (`selection.svelte.ts`); a dashed outline, drawn as an overlay rather
than in the SVG so exports never see it, marks it; Escape or a click on the empty canvas clears it.
Which object a click lands on comes from the ids mermaid 12 gives the drawn elements, per type
(`diagramPick.ts`, which reuses the Colours card's `pickedObject`/`pickedEdge`): flowchart, state,
class, ER, requirement, block and C4 nodes by id, architecture `service-`/`group-`, a sequence
participant's `data-id`, mindmap and timeline nodes by position, kanban cards by their id, gantt
bars by their task's name; arrows by mermaid's edge id (flowchart), by their two ends (class, ER,
requirement, block, architecture), by position (state) or by a unique label (sequence messages).
A PowerPoint-style **mini toolbar** floats just above the selection (`SelectionToolbar.svelte`):
rename inline, the colour buttons (the Colours card's palette and "any colour",
`ColorSwatches.svelte`), bold and text size, and for nodes the shape, an icon search,
"この後に追加" (a new node joined after it, selected with its name open for typing),
"ここから矢印" (then click the node to connect to) and delete; for arrows the label, reverse, line
style, colour (flowchart) and delete; and a button that opens the 直す tab. The **"選択中" panel** at
the top of 直す (`SelectionPanel.svelte`) has the same edits as full controls, plus lane or group
moves, the text colour, class members and ER attributes, and gantt and pie properties; with nothing
selected it says how to select, and its ? lists the keys. A double click renames; a **right click**
opens a small menu (`DiagramContextMenu.svelte`: rename, colour, shape, line style, reverse,
"この後に追加", "ここから矢印", delete; on the empty canvas "ノードを追加" and "画面に合わせる"). **Keys**
on a selection, when focus is not in a field, the code editor, a dialog or a menu
(`selectionKeys.ts`): Enter adds the next node (and opens its name, so Enter, a name, Enter, …
builds a chain), Tab adds a branch from where the selected node comes from, Delete or Backspace
deletes, F2 renames, the arrow keys move along the arrows, Escape clears; they are in the help's
tips too. Nothing is written twice: every edit is one of the existing functions — the Edit card's
(`diagramModify.ts`, `diagramDetails.ts`, checked with `checkEdit` before it is applied), the
Colours card's (`colors.ts`, applied straight away as that card does) and the Add card's, which
`selectionActions.ts` composes into "この後に追加" (flowchart and swimlane, in the same lane;
architecture, in the same group; state; class and ER with a relation; C4; block; mindmap, as a child
topic; sequence, a participant with a message), connections (every type with a connect action) and
"ノードを追加"; `selectionModel.svelte.ts` holds the lists for the last valid code and the edits on
the selection, shared by the toolbar, the panel, the menu and the keys. What a type has no edit for
is hidden: gantt tasks, kanban cards and timeline items are selected and renamed, deleted and
(gantt) given their properties, but get no "この後に追加"; pie slices are drawn without ids to tell
them apart, so they stay in the Edit card's list; journey, git and the other chart types have no
selection. The Edit and Colours cards keep their own lists and
their own pick-by-click, unchanged (another change is adding table editors to the Edit card).
`tests/selection.spec.ts` (select and the toolbar, inline rename, colour and bold, chained
"この後に追加", Enter/Tab/Delete/arrows, the menu's delete, colour and "ノードを追加", an arrow's
reverse and style, "ここから矢印", the panel, a state diagram) and the unit tests of the five
selection files.

**Contradictory operations (0.2.2).** A pass that used the tools out of order and against each
other (connect what is connected, undo from the keyboard after deleting with it, click away
mid-rename, open one dialog over another, rapid clicks, table and colour abuse) fixed: Ctrl+Z / Ctrl+Y
(⌘Z, ⌘⇧Z) now undo and redo the diagram when focus is outside a field and the code editor
(`historyCommand`, `selectionKeys.ts`); two tool edits in quick succession are two undo steps, not one
(a change written with `updateDiagram` is recorded at once, `undoStack.svelte.ts`); "ここから矢印" and the
Add card's Connect refuse an arrow that is already there (the card allows it with another label), and
turning an arrow round onto its opposite is refused (`reverseDuplicates`); a name typed in the inline
rename is applied when the user clicks another node, the canvas or the tools (the draft lives in the
selection model, `commitDraft`), while Escape and ✕ still discard it; an empty name says so; refusals
from the mini toolbar show over the diagram (`TID.selectionWarning`), not only in the 直す panel; an
edit computed from code that changed while mermaid checked it is dropped instead of overwriting the
newer code; Ctrl+K does not open the palette over another dialog; the right-click menu closes when the
wheel zooms the diagram under it; renaming a flowchart node defined with text in two statements changes
both (mermaid draws the last). `tests/contradictions.spec.ts` covers each; `tests/invariants.ts` holds
the checks run after every step (parses, drawn, no console errors, one dialog, no empty dropdown, no
added duplicate or dangling lines, undo and redo exact), shared with `tests/monkey.spec.ts`, a seeded
random-action test (60 actions in CI; `MONKEY_ACTIONS=300 MONKEY_SEEDS=1,2,3` locally). Left open: a
node's shape and icon change only its first definition when it has two; deleting the only gantt task
leaves an empty chart that mermaid draws with `NaN` lines; `swimlane-beta LR` draws lane titles left
of mermaid's viewBox, so the first column of titles is cut off at the view's edge; selection does not
work in hand-drawn mode (the redrawn SVG has no ids).

**Dark mode (0.2.0).** In dark mode, the dark themes
render with near-white lines unless the user set `lineColor`, and a diagram in a light theme
gets a light grey background so its dark lines stay visible (`src/lib/util/darkLines.ts`).

**Icon picker (0.2.0).** The "Icons" card searches the bundled, build-time, hosted and imported
packs by name, shows the matches as icons, and inserts the clicked icon's `prefix:name` at the
cursor in the code editor (`IconPicker.svelte`, `iconSearch.ts`); where no editor can take it
(mobile, config tab) the name is copied instead. "Enlarge" opens a large dialog with names under
the icons. mermaid's five built-in icons are listed first and marked standard (they render in
GitLab too); the rest are marked extended (`src/lib/util/standardIcons.ts`).

**Browsing icons (0.2.2)** (`src/lib/util/iconCategories.ts`). Searching needs a name, so the
picker also has "一覧から選ぶ / Browse": twelve hand-written categories (standard icons, servers
and storage, network equipment, security, cloud and SaaS, Microsoft 365, AWS / Azure / Google
Cloud, databases, devices, people, documents and business, development and operations), 15–40
icons each across the packs with a short Japanese and English label (the standard group has its
five), or a whole pack, alphabetical, 200 icons a page with previous/next and a count
(`iconPage`). A click inserts or collects exactly as a search result does; the licence tooltip
and ™ marks stay. Packs load through `loadPack` with a loading state; icons a build lacks are
skipped, and a category left with no pack (the cloud vendors, logos off) is not offered. The
large dialog shares the mode, list and page. A unit test checks every category id against the
packs; `tests/iconBrowse.spec.ts` covers the grid, insertion, paging and the new packs.

**Icon licences (0.2.1)** (`src/lib/util/iconLicenses.ts`). The "How to use" guide has an "Icon
licences" section: a table of every bundled set with its licence, copyright holder and links
(`IconLicenseTable.svelte`), then the artwork-versus-trademark distinction and a note that vendor,
hosted and imported packs follow their own terms. Deliberately out of the cards' way: each icon's
tooltip in the picker names its set and licence, logos and brand icons carry a ™ mark, and that is
all a user sees unless they look. The facts repeat `NOTICE` and `THIRD-PARTY-LICENSES.md`; keep the
three in step.

**AI briefing and unknown icons (0.2.2)** (`src/lib/util/aiPrompt.ts`, `iconCatalog.ts`). An AI
asked for an architecture diagram invents icon names, because it cannot see the packs. The Icons
card has two helpers for that. "Copy a briefing for an AI" puts on the clipboard the syntax (an
example and the rules an AI gets wrong: ASCII ids, no id starting with R/L/T/B, edge sides, no
Font Awesome), the packs this site offers, a curated list of about eighty icons for the usual parts
of a system (`curatedIcons`, each checked against the packs by the unit test) and the icons the
user collected in the picker (a "collect" checkbox makes a click add to that list instead of
inserting; `aiCollection.svelte.ts`, kept per browser). "Unknown icons in the code" lists the
`prefix:name` references no pack provides (`checkIcons`: architecture `service/group/junction`
icons and flowchart `@{ icon: … }` nodes), each with suggestions found by searching every pack for
the name and its words, and a button that replaces the reference everywhere in the code
(`replaceIconRef`). `loadPack` is the one shared loader of the packs for the picker and the check.

**Offline switch (0.2.2)** (`MERMAID_OFFLINE`, on by default). The site makes no request outside
itself: the config editor does not download mermaid's config schema (validation stays,
completions go), exported SVGs carry no Font Awesome stylesheet reference, and the `?code=`, `?config=` and gist
loaders refuse every origin but the site's own (`data:` URLs still work; the "Load Gist" field is hidden). Links that open another site on a click
stay. `tests/offline.spec.ts` watches every request during a load, a render with Font Awesome
and an icon pack, a config-tab visit and an SVG export, and expects none to leave localhost.

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

**Export presets (0.2.2)** (`src/lib/util/exportPresets.ts`). For pasting into PowerPoint, Word, Excel
or e-mail, the Actions card has a preset (as is, PowerPoint 16:9 = 1920x1080, 4:3 = 1440x1080, A4 landscape
1123x794, A4 portrait 794x1123, square 1080x1080, all at 1x), a background (white, transparent, the site
theme colour) and a scale (1x to 3x, default 2x). The diagram is scaled to fit inside the canvas, centred, with
a margin of 4% of the shorter side; `computeExportLayout` returns the canvas and the draw rectangle and is
unit-tested (ratios, padding, tall in wide and wide in tall, scale). PNG and "Copy image" fill the canvas
only for a non-transparent background, so a transparent PNG keeps its alpha; the SVG export wraps the diagram
in an outer `<svg>` whose viewBox is the preset size (1x). The three choices are kept in `localStorage`
(`exportPreset`, `exportBackground`, `exportScale`), and a line under the buttons says what the files will
be. The old width/height PNG size applies to "as is" only. The default background is now white (it used to be
the site colour). `tests/exportPresets.spec.ts` checks the PNG's IHDR size, a transparent corner pixel and the
SVG viewBox.

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

**Japanese UI, switchable to English** (`I18N.md`). A dependency-free catalogue, **995 keys**,
read through a typed `t(key, params)`. Japanese is the default; a button beside the theme
toggle switches to English and the choice is remembered per browser. `en` holds upstream's
original wording, so `MERMAID_LOCALE=en` makes English the default. Sample group keys stay
the catalogue's English names (they are keys into `@mermaid-js/examples`); the card shows the common
ones under a Japanese name (`sampleNames.ts`) and English keeps the catalogue's.

**The audit's three findings each have a follow-up** (`QUALITY-AUDIT-2026-08-31.md`), but
"followed up" is not the same as "finished" and the difference matters:

- **Finding 2** (a hoisted test mock) is resolved outright.
- **Finding 3** (Chromium-only e2e) is resolved as a deliverable — Firefox now runs the
  `@smoke` journeys, which in turn exposed a latent CI misconfiguration that only a second
  browser engine could reveal. WebKit is a deliberate exclusion carrying a reopen condition.
- **Finding 1** (dependency advisories) is resolved. The Monaco-specific DOMPurify override that
  closed it has since been removed again: Monaco 0.57.0 depends on the patched
  `dompurify@3.4.15` itself. The production audit reports zero advisories.

**Performance guards (0.2.2).** "Rendering sometimes becomes extremely slow" was measured in
a production build (Chromium, typing into Monaco, every sample plus a 200-node/300-edge
flowchart, an 8-lane swimlane and a 30-service architecture diagram with icons from six packs)
and had five causes, each fixed:

- **Every edit queued its own render**, one after another (`View.svelte` chained a promise per
  state), and a render over 150 ms deferred the next by a second (`autoSync.ts`). A 20-key
  burst drew up to 20 pictures and a "slow" diagram waited over a second for every change.
  Now `renderScheduler.ts`: renders never overlap, a typed change waits 100 ms (more after a
  slow render, at most 300 ms), only the newest state is drawn, and a finished render is not
  placed if the code changed meanwhile or a newer picture is already shown. A button's edit,
  a config or theme change renders at once.
- **Pan and zoom re-parsed the diagram on every mouse move** (each move wrote the store, which
  re-validates): one drag-and-wheel gesture on the 200-node flowchart blocked the page for
  16 s. The store write is debounced (200 ms) and `parse` is remembered per code.
- **The tool cards parsed on every key.** All three tool tabs stay mounted, and the cards and the
  selection layer read the diagram through mermaid (often `parse` and `getDiagramFromText`):
  about seven parses per key, several hundred ms per key on a 100-node flowchart. They now read
  `settledState` (typing paused 250 ms, a button's edit at once, pan/zoom not at all). Typed code
  is also validated after a pause when the last parse took over 50 ms.
- **Stale validations could be published**: mermaid's parse waits for a running render, so an
  older result could arrive after a newer edit and put old code back into the editor. Only
  the newest validation is published (`createLatestGuard`).
- **Two renders on every load**: the diagram stored from last time was drawn before the linked
  one (which also loaded ELK for a sequence diagram), and the managed theme was set after
  the first render. The view skips the unvalidated state and the theme is synced before publishing.

Measured before → after (ms; one machine, shared with other jobs, so ±30 %): picture after
opening a link, 2,600–6,700 → 1,000–1,900 for the samples, 12,200 → 3,800 for the 200-node
flowchart; one key on a sample that counted as "slow" (Class, ER, Swimlane, Architecture,
Office Network) 1,100–1,260 → 200–400; a 20-key burst drew up to 20 pictures → 1 for every
case, with 0.9–5.9 s of long tasks → under 0.25 s; one key on the 100-node flowchart 1,680 →
1,280, on the 200-node one 9,500 → 2,600, on the 30-service architecture 1,230 → 400. Fast
samples now take 130–300 ms per key instead of 25–220: the price of not drawing every key.
Not slow, verified: History auto-save (once a minute, not per key), the URL hash (debounced), Monaco's error markers, hovering and
selection (no handler walks the SVG on mouse move; the selected outline costs ~4 ms a second),
the icon picker and unknown-icon check (no pack loads at startup; the check waits 800 ms),
memory across 220 edits (heap, DOM nodes and listeners flat), svg-pan-zoom set-up. Still slow,
and why: mermaid's own flowchart parse (its `getConfig` deep-copies the config for every node:
~200 ms for 200 nodes, run by the validation, the render and once more by the cards after a
pause) and layout — a 200-node flowchart takes 2–3 s to draw with ELK or dagre alike; the
hand-drawn mode adds svg2roughjs on top. A cold load fetches ~6.9 MB of JS (Monaco 4 MB of it;
icon packs, ELK and ZenUML load only when a diagram needs them).

`tests/performance.spec.ts` guards it: typing into a 100-node flowchart shows the picture
within 5 s of the last key, a 20-key burst ends in exactly one picture (`data-render-count` on
`#view`), panning and zooming draw nothing, an older large render never replaces a newer
picture, and fast typing during a slow render is never undone in the editor.
`renderScheduler.test.ts` covers the scheduler, the guard and the settler. With the error recovery
(`codeHealth.svelte.ts`) both hold: the cards read `settledState` and still refuse edits through
`applyToolEdit`/`editsBlocked` while the code is broken (that check reads the validated state,
not the settled one); an error state is a validation like any other, so the newest one is
always published, and `lastValid` is updated by every valid result, published or not.

A related delay, found in exploratory QA: after Enter, Tab or 「この後に追加」 on a selected node,
the new node's name field appeared only once the edit had been checked, the lists re-read and
the diagram redrawn (0.4–1.8 s), because the toolbar holding it waited for the new node's
element; keys typed meanwhile were lost and a final Enter added another node. The field now
opens at once on the name the node will get (`selectionModel.draftLabel`), the toolbar stays
put until the new node is drawn, and a name confirmed before the node exists is applied once it
does (`pendingAdd`). `tests/selection.spec.ts` types straight after Enter and Tab.

## What is open

One standing decision is recorded in `QUALITY-AUDIT-2026-08-31.md` rather than in the issue
tracker — that is where this project tracks findings, and the owner chose to keep it that way.

**The `dompurify` override.** `monaco-editor` 0.57.0 (the latest) pins `dompurify@3.4.15`
exactly, which a low advisory (GHSA-p98j-92pf-mc4p) covers. Monaco's copy is overridden to the
patched `3.4.16` — twice, because the package is built with both package managers:
`pnpm.overrides` (`monaco-editor>dompurify`) for this repository and a nested npm `overrides`
for the published tarball, which consumers install with `npm install`; see
`QUALITY-AUDIT-2026-08-31.md`. Remove both once a Monaco release depends on `dompurify >=3.4.16`.
The same pattern covers `katex`: mermaid 12.1.0 depends on `katex@0.16.x`, which a low
advisory (GHSA-238p-pmpm-9mq7, prototype pollution) covers, so `mermaid>katex` is overridden to
`0.18.11` in both places. Remove it once mermaid depends on `katex >=0.18.2`.
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

`pnpm test:unit` (vitest, 2,999 tests) and `pnpm test:e2e` (Playwright).

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
