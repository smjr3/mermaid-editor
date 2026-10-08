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

## .drawio (`src/lib/util/drawioExport.ts`)

The file is an uncompressed draw.io document: `mxfile > diagram > mxGraphModel > root`, the two
root cells `0` and `1`, and one cell in a `UserObject`:

```xml
<UserObject label="" mermaidData="{&#10;  &quot;data&quot;: &quot;flowchart LR…&quot;,&#10;  &quot;config&quot;: {…}&#10;}" id="2">
  <mxCell style="shape=image;noLabel=1;verticalAlign=top;imageAspect=1;aspect=fixed;editIcon=1;image=data:image/svg+xml,<base64>;" vertex="1" parent="1">
    <mxGeometry x="0" y="0" width="…" height="…" as="geometry" />
  </mxCell>
</UserObject>
```

This is the same cell draw.io makes itself when Mermaid is inserted as an image
(`EditorUi.prototype.createMermaidImageXml` and `EditorUi.createMermaidData` in draw.io's
`src/main/webapp/js/diagramly/EditorUi.js`, read on 2026-10-08): an image cell whose
`mermaidData` attribute is `{"data": <source>, "config": <mermaid config or null>}`. The image is
the SVG this editor rendered (theme, background and icons as exported as SVG), sized from its
viewBox; the page is the size of the diagram. draw.io style values cannot hold `;`, so the data
URI is written without `;base64`, as draw.io's `convertDataUri` does.

What draw.io does with it (checked on 2026-10-08 in the draw.io web app, `dev` branch of
jgraph/drawio, run locally in Chromium with a file exported from the built site):

- **It opens as the picture this editor drew**: one selectable, movable, resizable image on a page
  the size of the diagram, the page tab named after the file. Displaying it needs neither Mermaid
  support nor a network connection, so older draw.io versions and viewers (Confluence, Jira, the
  VS Code extension) show the same picture.
- **A double-click (or the pen handle) opens draw.io's Mermaid dialog with the source**, line
  breaks and Japanese text intact (the double-click handler finds `mermaidData` and calls
  `editMermaidData`). The dialog offers two outputs:
  - **Image** (preselected, since the cell is an image) re-renders the picture with draw.io's own
    Mermaid, keeping the source on the cell for the next edit;
  - **Diagram** converts it into native draw.io shapes and connectors (checked: the expense-flow
    sample became four shapes, three connectors and the title, each editable), which is how a user
    gets an editable draw.io diagram from this editor.
- Either way the result is drawn by **draw.io's** Mermaid and defaults, not this editor's: the
  colours, fonts and layout change (the converted diagram above used draw.io's purple default
  look, not this editor's theme), this editor's themes and `themeCSS` do not carry over, a type
  draw.io's Mermaid does not know (this editor renders with mermaid 12, e.g. `swimlane-beta`)
  gives an error there and the old picture stays, and icons from this editor's bundled packs
  (`tabler:server` and the like) are not registered in draw.io. Until it is edited in draw.io, the
  picture is exactly this editor's.

How it was checked: `drawioExport.test.ts` parses the file (structure, sizes from the viewBox, the
source with its line breaks and the config round-tripping through `mermaidData`);
`tests/fileExports.spec.ts` downloads it from the built site and checks the structure, the source
and that the embedded SVG is the diagram; and the draw.io run above (load, double-click, Image and
Diagram outputs, by screenshot). The desktop app was not run; it is the same code.

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
