# Saving files: the 書き出す dialog, names, .pptx, .drawio and .vsdx

What the header's 書き出す dialog writes, what other programs do with the `.pptx`, `.drawio` and
`.vsdx` files, and how that was checked. Added 2026-10-08 from user feedback (「ファイルで保存する際は名前を
付けて保存できるように」「.drawio形式で保存可能なようにして」「.vsdx形式で保存可能なようにして」);
the dialog replaced the 出す card on 2026-10-12 (the inspector redesign).

## The dialog (`src/lib/components/dialogs/ExportDialog.svelte`, `src/lib/util/exportDiagram.ts`)

- **Left:** a preview, a copy of the diagram on screen (`previewSvg`: the pan/zoom transform
  removed, framed by its own drawing because svg-pan-zoom takes the viewBox away) on the
  backdrop the file will get; transparent shows a checkerboard.
- **Right:** the formats as cards in two columns, each a name and one line: PNG 画像, SVG,
  PowerPoint, draw.io, Visio, HTML, Markdown 用 (the GitLab export), 画像をコピー (only where the browser has
  `ClipboardItem`). Under them only what the chosen format takes:
  - 解像度 標準 / 高画質 / 最高画質 (1x / 2x / 3x) for PNG and the copy;
  - 背景 白 / 透明 / テーマの色 for PNG, SVG, the copy and Markdown. The default for a new user is
    透明; the choice and the scale are remembered (`exportBackground`, `exportScale`). A theme
    preset's own background replaces white or the theme colour (`exportBackdrop`);
  - 方法 ファイルで保存 / HTML タグをコピー for HTML;
  - a note on what the file will be (the background and the scale, or the PowerPoint, draw.io,
    Visio, HTML and Markdown explanations).
  - With an external renderer configured (`MERMAID_RENDERER_URL`, `MERMAID_KROKI_RENDERER_URL`;
    empty by default) a 外部 row links to the mermaid.ink PNG and SVG and to Kroki, and the
    mermaid.ink Markdown field (`TID.copyMarkdown`) appears. None of this shows by default.
- **Bottom:** the file name (the diagram's title by default) with the extension next to it, and
  キャンセル / 保存 (コピー for the two copies, which have no file name). The button shows the
  outcome (`data-export-state`: busy, done, failed). Failures of PNG, SVG, `.pptx`, `.drawio`, `.vsdx`
  and the copy are notified; for HTML and Markdown, which render the diagram afresh, a diagram
  that does not render is reported in the dialog and nothing is saved. キャンセル stops an export
  that is still running (see "One state per file" below).

The PNG width and height in pixels and the size presets are gone (user decisions, 2026-10-08 and
2026-10-12). `.pptx`, `.drawio` and `.vsdx` show no background choice; they use the remembered
one, as the export card did, so with the default the draw.io page and the Visio picture are
transparent and the PowerPoint slide keeps its own white.

All exports draw from the diagram on screen with pan/zoom paused (`createPanZoomPause`), except
HTML and Markdown, which render it afresh from one snapshot of the state (`takeExportSnapshot`),
and SVG, which is a copy of the view without the pan/zoom transform (below).

**One state per file (review N01, 2026-10-13).** The dialog takes one snapshot of the input
state when 保存 is pressed and every export uses it: the file name, and for `.drawio` and
`.vsdx` the Mermaid source, the config and the hand-drawn setting. The picture of those two
comes from the view, so before reading it the export checks that the view's picture was drawn
from exactly that code, config and hand-drawn setting (`View.svelte` records what each placed
picture shows, `markDrawn` / `getDrawnFrom` in `renderView.ts`) and then reads it at once. If
the picture is of another state — the code or the config was edited while the export waited
for the view, or the latest code has not been drawn (a syntax error) — the export stops,
nothing is saved and the dialog says 「書き出し中に図が変わったため、保存を中止しました…」
(`ExportStaleError`, `exportDlg.stale`). The current input is never put back to the snapshot.
キャンセル, Escape or closing the dialog while an export is running aborts it (an
`AbortSignal` every save function takes): whatever it was waiting for, it saves and copies
nothing afterwards, and pan/zoom comes back as before. Tests: `exportDiagram.capture.test.ts`
(an edit of code and config during the wait; the `.drawio`'s cells, `mermaidData` code and
config and the `.vsdx`'s PNG and Shape Data must all name one state), `tests/fileExports.spec.ts`
("An export cancelled while it is made").

**The SVG file is the whole diagram (review N02, 2026-10-13).** With pan/zoom on, svg-pan-zoom
takes the svg's viewBox away and moves the drawing with a `transform` on its
`.svg-pan-zoom_viewport` group; the SVG export used to serialise that as it was, so the file
kept the zoom and the pan of the moment. `saveSvg` now saves `unzoomedCopy` of the view, as the
preview does: the transform and its style removed, the viewBox the picture had when the view
placed it (recorded by `markDrawn` before pan/zoom applied; measured from the drawing only
when there is no record), and `width`/`height` set to that viewBox. The live view and its
pan/zoom are untouched, and the file is the same with pan/zoom off, before and after zooming
and panning, hand-drawn or not (`exportDiagram.capture.test.ts`, `tests/fileExports.spec.ts`
"The SVG file after zooming the view").

## File names (`src/lib/util/saveFile.ts`)

The file is saved at once under the name in the dialog, through a temporary link
(`anchorDownload`), into the browser's download folder. There is no second 「名前を付けて保存」 step
and no browser save picker any more (user decision, 2026-10-12: 「ファイル名確認の別ダイアログは挟まない」).

- The suggested name is the diagram's title (`diagramTitle.ts`: front matter, or the `title`
  statement of timeline, C4, packet and ZenUML), else `diagram`. What is typed is made safe for
  every file system (`fileNameFromInput`): characters Windows rejects (`\ / : * ? " < > |`,
  control characters) become spaces, leading and trailing dots go, reserved names (`CON`,
  `NUL`…) get a `_`, and the name is cut at 100 characters. Japanese stays as it is. The
  extension is added unless it was typed; an empty name falls back to the suggestion.
- The Markdown export's Markdown points at the name the SVG was saved under. The name is
  written as one relative URL path segment (`fileUrlSegment` in `htmlExport.ts`: everything but
  letters, digits and `-._~` percent-encoded), so a `#` or `?` in the name does not start a
  fragment or a query, a typed `%` stays a `%`, and spaces or unbalanced parentheses do not end
  the Markdown link early; GitLab and GitHub decode it back to the saved name
  (`report(1)#draft%20.svg` → `report%281%29%23draft%2520.svg`). The file name rules above are
  unchanged by this (review N05, 2026-10-13).

Upstream named every file `mermaid-diagram-<timestamp>.<ext>`; that is gone.

Chromium on a system without a UTF-8 locale (`LANG` unset, as in some containers) saves a
download with a non-ASCII name as `download`; that is the browser, not the editor. The e2e
download names are ASCII for that reason; the Japanese names are unit-tested. The e2e helpers
for the dialog are in `tests/helpers/exportDlg.ts` (`saveExport`, `copyExport`, `chooseExport`).

## .drawio (`src/lib/util/drawioExport.ts`, `svgToDrawio.ts`, `svgPath.ts`)

Since 2026-10-09 (「.drawio形式は、drawioで全ての要素が個別に編集可能なようにして。」) every element of
the diagram is its own draw.io cell, so in draw.io each box, arrow, label and group can be
selected, moved, resized, restyled and retyped on its own. The file is an uncompressed draw.io
document: `mxfile > diagram > mxGraphModel > root`, the root cell `0`, the layer `1`, then one
`mxCell` per element. The page is the size of the diagram (its viewBox) with the export background.

### What becomes what

`svgToDrawio.ts` reads the SVG on screen (pan/zoom paused, as for the PNG) through `Measure`:
`getBBox` and `getScreenCTM` give every element's place in the diagram's coordinates, and
`getComputedStyle` gives the colours, widths, dashes and fonts mermaid's stylesheet and theme
actually applied. Nothing is re-laid out and nothing leaves the browser.

| In the SVG                                                                             | In draw.io                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a node (`g.node`: flowchart, class, state, ER, mindmap…; architecture services)        | a vertex: its outline as `rect` (rounded with the same corner radius), `ellipse`, `rhombus`, `hexagon`, `parallelogram`, `trapezoid` (flipped as drawn) when it is one, else a custom stencil shape (`shape=stencil(…)`) with exactly the outline (stadium, cylinder, subroutine, hand-drawn boxes); fill, stroke, width, opacity |
| the node's label                                                                       | the vertex's value (`html=1`, escaped, line breaks as `<br>`), with the label's colour, size, family, bold/italic, and its alignment where it was not centred; a caption under an icon is the value placed below the shape                                                                                                        |
| the rest of a node (class members, ER attribute rows and dividers, icons)              | cells inside the node (its children), so they move with it and can still be edited one by one                                                                                                                                                                                                                                     |
| a subgraph, composite state, swimlane lane, architecture group                         | a container (`container=1;collapsible=0`) with its title as the value (a lane's sideways title as vertical text); the nodes, texts and inner containers inside it become its children, in its coordinates, behind them                                                                                                            |
| a link (`.edgePaths`, `data-edge`, class/ER/state/architecture edges)                  | an edge with `source`/`target` set to the node cells (by mermaid's ids, `L_A_B_0`, `id_entity-…`, else the nearest shape), the route as waypoints (mermaid's `data-points` where present), `rounded`/`curved` as drawn, the arrowheads, dashed or dotted, width and colour; fixed connection points on box-shaped ends            |
| arrowheads                                                                             | `block` (filled or open for inheritance), `open`, `oval`, `cross`, `diamondThin` (composition / aggregation), `ERmandOne`, `ERzeroToOne`, `ERoneToMany`, `ERzeroToMany`                                                                                                                                                           |
| a link label                                                                           | the edge's value, with an offset to where mermaid put it and its background colour                                                                                                                                                                                                                                                |
| other shapes (sequence actors and notes, gantt bars, pie slices, legends, backgrounds) | shape cells as above; a text centred on a shape (an actor's name, a bar's task) becomes that shape's value                                                                                                                                                                                                                        |
| lines and open paths (lifelines, messages, axes, ticks, loop frames)                   | edges without terminals, with their arrowheads and dash; open curves are stroke-only stencil shapes                                                                                                                                                                                                                               |
| free text (titles, messages, axis labels, percentages)                                 | text cells (`text;html=1`), not wrapped, rotated if drawn rotated                                                                                                                                                                                                                                                                 |
| icons, nested SVGs, `<use>`, pictures                                                  | an image cell of just that element (`shape=image`, an SVG data URI with its computed styles written in), never the whole diagram                                                                                                                                                                                                  |

A hand-drawn shape that mermaid draws twice (a filled copy and a stroked copy, from roughjs) is one
cell. Hidden elements and anything wholly outside the picture (gantt's "today" line far right) are
left out. A diagram type without its own rules (pie, gantt, quadrant, xychart, timeline, C4…) still
comes out as separate primitives by the same walk; no type falls back to one picture.

### The Mermaid source

The root cell is a `UserObject` with `label=""` and `mermaidData="{"data": <source>, "config":
<mermaid config or null>}"` — the JSON draw.io itself keeps for Mermaid
(`EditorUi.createMermaidData` in draw.io's `EditorUi.js`). It is the diagram's own data in draw.io
(Edit Data with nothing selected shows it) and survives saving in draw.io. Before this change
the file was a single image cell carrying `mermaidData`, which draw.io's double-click turned
into its Mermaid dialog; with separate cells there is no such cell, so editing the Mermaid again
means copying the source from the diagram data into this editor (or a draw.io Mermaid insert).

### How it was checked

- `svgPath.test.ts` (path parsing, arcs, transforms, flattening, simplification) and
  `svgToDrawio.test.ts` (a cut-down flowchart SVG in jsdom with a stub `Measure`: shapes,
  container nesting and relative coordinates, connected and labelled edges, dashes and arrows,
  free text, a slice, a line, an icon, hidden elements; label placement; shape and arrow mapping);
  `drawioExport.test.ts` (XML structure, edge geometry, styles, the stencil compression read back
  the way draw.io's `Graph.decompress` reads it, `mermaidData`).
- `tests/fileExports.spec.ts` downloads `.drawio` files from the built site: a flowchart with a
  subgraph, a dotted link and labels (six vertices with their labels, one container holding three
  nodes, five edges all with source and target, one dashed, the labels on the edges, no
  whole-diagram image) and a sequence diagram (actors, note, messages and lifelines as separate
  cells).
- The draw.io web app (`dev` branch of jgraph/drawio, served locally, opened in Chromium with every
  outside request blocked), on 2026-10-09, with files exported from the built site for flowchart
  (subgraph, dotted link, labels, ten node shapes), sequence, class, state, ER, gantt, pie,
  architecture, swimlane and mindmap: every file loaded without errors, every cell was rendered,
  selectable and movable, every stencil shape parsed and drew, every link that joins nodes had both
  ends connected (flowchart 10/10, class 3/3, state 5/5, ER 2/2, architecture 2/2, swimlane 3/3),
  containers held their children, `mermaidData` was on the root and stayed there when draw.io
  wrote the diagram back out, and draw.io's own rendering (screenshots) matched the diagram.
  The desktop app was not run; it is the same code.

Limitations: draw.io lays text out with its own font metrics (this editor's theme font is named,
and falls back if draw.io does not have it), so text widths can differ slightly; links are routed
by draw.io from the waypoints, so a moved node re-routes like any draw.io edge; mermaid's drop
shadows, gradients (the first stop is used) and `themeCSS` effects do not carry over; sequence
messages are not attached to the lifelines; the hand-drawn look turns into many small strokes.

## .pptx (`src/lib/util/pptxExport.ts`)

Added 2026-10-22 (「パワーポイントにひとつひとつのアイテムが編集可能なオブジェクトとして貼り付け」, option 1 of
the proposal: a PowerPoint file of native shapes). Before it, nothing reached PowerPoint as
editable shapes: PNG, the copy and Visio are one picture, and an SVG put through PowerPoint's
「図形に変換」 loses the node text (mermaid draws it in `foreignObject`, which PowerPoint does not
show) and the colours (they live in the SVG's stylesheet).

The file starts from the same cells as the `.drawio` (`svgToDrawio` reads the SVG on screen with
pan/zoom paused; the converter also hands over each custom outline, each link's drawn route and
each link label's box, which the `.drawio` writer does not use), so the two formats split the
diagram the same way. One slide, 16:9 (13.33 × 7.5 in, `12192000 × 6858000` EMU, 96 px per
inch): a diagram that fits keeps its size, centred; a larger one is scaled down to fit inside a
quarter-inch margin, text sizes with it. The page background of a theme preset (or the white or
theme backdrop, if remembered) becomes the slide colour.

| In the diagram (draw.io cell)                                              | On the slide                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a node: rect, rounded, ellipse, rhombus, hexagon, parallelogram, trapezoid | a shape of that preset (`rect`, `roundRect` with the corner radius, `ellipse`, `diamond`, `hexagon`, `parallelogram`, `trapezoid`, flips kept), its fill, line, width, dash and opacity, holding the label (one paragraph per line, font, size in pt, colour, bold/italic/underline, alignment, no wrapping)                                                 |
| a node of any other outline (stadium, cylinder, hand-drawn…)               | a freeform (`custGeom`) with exactly the outline, and four connection sites                                                                                                                                                                                                                                                                                  |
| a node with parts (class members, ER attributes, icons)                    | a group of the shape and its parts, so they move together and can still be edited one by one                                                                                                                                                                                                                                                                 |
| a subgraph, composite state, lane, architecture group                      | a shape behind the nodes inside it (not a group: the nodes stay free to move out)                                                                                                                                                                                                                                                                            |
| a link                                                                     | a connector glued to the shapes it joins (`stCxn` / `endCxn`, the connection site nearest to where the line meets the shape), drawn as an elbow connector (`bentConnector2`–`5`, rotated and flipped as needed, the bends as adjust values) or a straight one where that draws mermaid's route; any other route as a freeform line of exactly the drawn path |
| arrowheads                                                                 | the line ends PowerPoint has (filled triangle, open arrow, filled oval); the others (hollow triangle, diamonds, ER cardinalities, cross, hollow circle) as small freeforms at the end of the line                                                                                                                                                            |
| a link label                                                               | a text box where mermaid put it, with its background colour                                                                                                                                                                                                                                                                                                  |
| titles, messages, axis labels, percentages                                 | text boxes; lines without ends (lifelines, axes) are connectors without glue                                                                                                                                                                                                                                                                                 |
| icons and pictures                                                         | pictures: the SVG (`asvg:svgBlip`) with a PNG fallback at 2× drawn in the browser; nothing is fetched, a picture that is not inside the diagram is left out                                                                                                                                                                                                  |
| a caption beside an icon                                                   | a text box below (or beside) the picture                                                                                                                                                                                                                                                                                                                     |

Small steps mermaid puts in a route to meet a node's centre (under 6 px between two parallel
segments) are taken out so the route fits an elbow connector; where mermaid stops a link short
of a box to leave room for its arrowhead (class diagrams), the line is carried on to the box so
the arrowhead touches it. The Mermaid source is the slide's notes (first paragraph `Mermaid`,
then one paragraph per line). Shapes are named after their label (PowerPoint's selection pane),
connectors `Connector n`.

The package: `[Content_Types].xml` first, `_rels/.rels`, `docProps/core.xml` (title = file name)
and `app.xml`, `ppt/presentation.xml` (one slide, one notes master), one blank master and layout,
two themes (Office colours; Calibri, 游ゴシック for Japanese), `presProps`, `viewProps`,
`tableStyles`, `ppt/slides/slide1.xml`, `ppt/notesSlides/notesSlide1.xml`, the notes master, and
`ppt/media/` for pictures. Zipped with `fflate`; PNGs stored.

How it was checked: `pptxExport.test.ts` builds a file from a set of cells and checks every part
is well-formed, the content types, the slide size, the notes, each shape's preset, text and
font, positions, the group and the container, the picture with its SVG, the glue (ids and
connection sites), the elbow connector's adjust value, the dashes, the drawn arrowheads, unique
ids; and the pure pieces (placement, presets, sites, line ends, route corners and jogs, connector
choice with rotation and flips, carrying a short line on to its box). `tests/fileExports.spec.ts`
saves a flowchart from the site and checks the shapes with their labels, the five glued
connectors, the dashed one and the notes; `offline.spec.ts` that the export asks nothing of the
network. On 2026-10-22 files saved from the site for flowchart (subgraph, labels, seven node
shapes), sequence, class, ER, state, pie and architecture were opened with `python-pptx` (every
object read back: shapes, freeforms, connectors, groups, pictures, text boxes, notes) and
rendered with LibreOffice Impress 24.2 and compared with the diagram on screen.
**Microsoft PowerPoint itself was not available here**, so the first open in PowerPoint is still
to be confirmed by a person. Two things to know when comparing: LibreOffice re-routes every
glued connector by its own rules when it opens the file (PowerPoint draws the stored route until a
shape is moved), so a route can look different there; with the glue removed it draws the routes
as stored, and those matched the diagram. And PowerPoint itself re-routes a connector, as an elbow
or a straight line, when one of its shapes is moved; a freeform route then becomes PowerPoint's
own.

Limitations: text is laid out with PowerPoint's font metrics (the diagram's font is named; if the
machine lacks it, PowerPoint substitutes), so a label can come out slightly wider or narrower;
mermaid's rounded bends become square elbows; shadows, gradients (the first stop is used),
`themeCSS` effects and the hand-drawn look's fill hatching do not carry over; sequence messages are
not glued to the lifelines; there is one slide, so a very large diagram gets small text.

## .vsdx (`src/lib/util/vsdxExport.ts`)

The file is a Visio 2013+ package ([MS-VSDX], OOXML/OPC), zipped with `fflate` (MIT, a direct
dependency since this feature; see `THIRD-PARTY-LICENSES.md`):

| Part                                                        | Holds                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `[Content_Types].xml`                                       | `rels`, `xml`, `png` defaults; overrides for document, pages, page, windows, core and app properties           |
| `_rels/.rels`                                               | document (`…/visio/2010/relationships/document`), core and app properties                                      |
| `docProps/core.xml`, `docProps/app.xml`                     | title (the file name), created/modified time; application name                                                 |
| `visio/document.xml`, `visio/_rels/document.xml.rels`       | document settings, one style sheet (`No Style`, ID 0); links pages and windows                                 |
| `visio/pages/pages.xml`, `visio/pages/_rels/pages.xml.rels` | one page, the size of the diagram plus a quarter inch all round, 1:1 scale                                     |
| `visio/pages/page1.xml`, `visio/pages/_rels/page1.xml.rels` | one `Type="Foreign"` shape with `ForeignData ForeignType="Bitmap" CompressionType="PNG"` pointing at the image |
| `visio/media/image1.png`                                    | the diagram as PNG at 2× its size (stored, not recompressed)                                                   |
| `visio/windows.xml`                                         | one drawing window showing the page                                                                            |

The picture is a PNG, not the SVG: Visio 2013 and every later version show a PNG picture; SVG
pictures came with Visio 2016 / Microsoft 365 and other readers (LibreOffice, viewers) handle
them less reliably. The shape is the diagram's size at 96 px per inch, with its aspect locked.
The mermaid source is the shape's data: Shape Data 「Mermaid」 (`Property` row `MermaidSource`,
a string), visible in Visio under Data > Shape Data, line breaks kept.

What Visio does with it: it opens the drawing with one page and one **picture** — it can be
moved, resized, cropped, rotated and drawn over, and the source can be read from its shape data —
but the boxes, text and arrows are pixels, not Visio shapes, and cannot be edited, re-routed or
restyled in Visio. A larger or sharper copy needs a new export. Visio has no Mermaid support, so
there is no way back from the file to an editable diagram other than copying the source out of
the shape data into this editor.

How it was checked: `vsdxExport.test.ts` unzips the package and checks every part is present
and well-formed, the content types, that each relationship resolves to a part, the page and
shape sizes and the shape data; `tests/fileExports.spec.ts` downloads it from the built site and
checks the ZIP and PNG signatures and the parts; every XML part of an exported file passed
`xmllint`. The part layout and the document, page and window settings were compared with a
package saved by Visio 2016 (the template shipped in the `vsdx` Python package, 0.6.1), and that
package's reader opened an exported file: one page of 8.03 × 3.01 in, one shape centred on it at
7.53 × 2.51 in, Shape Data 「Mermaid」 holding the source. **Microsoft Visio itself was not
available here, nor was LibreOffice's Draw module (its Visio import)**, so the first open in Visio
is still to be confirmed by a person; if Visio reports a problem, compare `page1.xml` with a
picture inserted and saved in Visio (the `ForeignData` element and the `Img*` cells).
