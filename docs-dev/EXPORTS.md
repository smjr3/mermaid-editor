# Saving files: names, .drawio and .vsdx

What the 出す card's file buttons write, what other programs do with the `.drawio` and `.vsdx`
files, and how that was checked. Added 2026-10-08 from user feedback (「ファイルで保存する際は名前を
付けて保存できるように」「.drawio形式で保存可能なようにして」「.vsdx形式で保存可能なようにして」).

## 名前を付けて保存 (`src/lib/util/saveFile.ts`)

Every file the card saves — PNG, SVG, HTML, the GitLab SVG, `.drawio`, `.vsdx` — goes through
`pickSaveTarget`:

- **Chromium and Edge** have the File System Access API: `window.showSaveFilePicker` opens the
  system's own save dialog (name and folder), with the file type filled in. Cancelling it saves
  nothing. The dialog only opens straight after a click, so the target is chosen first and the
  file (the PNG and `.vsdx` take a second to draw) is written to it afterwards.
- **Firefox and Safari** have no such API, and Chromium refuses it in a cross-origin frame (the
  embed): a small dialog of ours (`SaveAsDialog.svelte`, 「名前を付けて保存」) asks for the name, with
  the name selected up to the extension, and the file is downloaded as before into the browser's
  download folder. Cancel or Escape saves nothing.
- The suggested name is the diagram's title (`diagramTitle.ts`: front matter, or the `title`
  statement of timeline, C4, packet and ZenUML), else `diagram`, plus the extension. Characters
  Windows rejects (`\ / : * ? " < > |`, control characters) become spaces, leading and trailing
  dots go, reserved names (`CON`, `NUL`…) get a `_`, and the name is cut at 100 characters.
  Japanese stays as it is. A name typed without the extension gets it.
- The GitLab export's Markdown points at the name actually chosen (`handle.name`).

Upstream named every file `mermaid-diagram-<timestamp>.<ext>`; that is gone.

The e2e fixture (`tests/test.ts`, option `saveAs`) removes `showSaveFilePicker` in every spec,
because headless Chromium has it and a test cannot answer the system dialog, and confirms our name
dialog with the suggested name as soon as it opens, so a click on a download button still ends in
a Playwright download. `tests/fileExports.spec.ts` uses `saveAs: 'manual'` to drive the dialog
and `saveAs: 'picker'` with a stubbed picker that records what is written.

Chromium on a system without a UTF-8 locale (`LANG` unset, as in some containers) saves a
download with a non-ASCII name as `download`; that is the browser, not the editor. The e2e
download names are ASCII for that reason; the Japanese names are unit-tested.

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
