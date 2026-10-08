/**
 * Local: the diagram as a Microsoft Visio drawing, `.vsdx` (the Visio 2013+
 * OOXML package, [MS-VSDX]).
 *
 * The package has one page holding one picture shape (`Type="Foreign"`, a PNG
 * in `visio/media/image1.png`) the size of the diagram, on a page the size of the
 * diagram plus a small margin. A PNG rather than the SVG: every Visio since 2013
 * shows a PNG picture, while an SVG part is only understood by later Visio
 * versions and not by other readers (LibreOffice, viewers). The mermaid source
 * is kept as the shape's data (Shape Data 「Mermaid」, `Property` row
 * `MermaidSource`), and the title in the document properties.
 *
 * Visio opens the diagram as a picture: it can be moved, resized, cropped and
 * drawn over, but its boxes and arrows are not Visio shapes
 * (docs-dev/EXPORTS.md).
 */
import { strToU8, zipSync } from 'fflate';
import { escapeXml } from './xmlText';

export interface VsdxInput {
  code: string;
  /** Diagram height in CSS pixels (96 per inch). */
  height: number;
  /** The diagram rendered as PNG (at any scale; it is shown at width × height). */
  png: Uint8Array;
  title: string;
  /** Diagram width in CSS pixels (96 per inch). */
  width: number;
}

const MAIN = 'http://schemas.microsoft.com/office/visio/2012/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const VISIO_RELS = 'http://schemas.microsoft.com/visio/2010/relationships';
const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
/** Margin around the picture on the page, in inches. */
const MARGIN = 0.25;

export const VSDX_PARTS = {
  app: 'docProps/app.xml',
  contentTypes: '[Content_Types].xml',
  core: 'docProps/core.xml',
  document: 'visio/document.xml',
  documentRels: 'visio/_rels/document.xml.rels',
  image: 'visio/media/image1.png',
  page: 'visio/pages/page1.xml',
  pageRels: 'visio/pages/_rels/page1.xml.rels',
  pages: 'visio/pages/pages.xml',
  pagesRels: 'visio/pages/_rels/pages.xml.rels',
  rels: '_rels/.rels',
  windows: 'visio/windows.xml'
} as const;

const inches = (pixels: number) => Math.max(pixels, 1) / 96;
const num = (value: number) => String(Math.round(value * 1e6) / 1e6);
const cell = (name: string, value: number | string, extra = '') =>
  `<Cell N="${name}" V="${typeof value === 'number' ? num(value) : escapeXml(value)}"${extra}/>`;

const relationships = (rels: [id: string, type: string, target: string][]) =>
  `${HEADER}<Relationships xmlns="${PACKAGE_RELS}">${rels
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
    .join('')}</Relationships>`;

const contentTypes = () =>
  `${HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Default Extension="png" ContentType="image/png"/>' +
  '<Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>' +
  '<Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>' +
  '<Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>' +
  '<Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/>' +
  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
  '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
  '</Types>';

// One style ("No Style", ID 0) that every shape and the page refer to; Visio
// fills in the cells it does not list with its defaults.
const documentXml = () =>
  `${HEADER}<VisioDocument xmlns="${MAIN}" xmlns:r="${R}" xml:space="preserve">` +
  '<DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0">' +
  '<GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions>' +
  '<SnapAngles/><DynamicGridEnabled>1</DynamicGridEnabled><ProtectStyles>0</ProtectStyles>' +
  '<ProtectShapes>0</ProtectShapes><ProtectMasters>0</ProtectMasters><ProtectBkgnds>0</ProtectBkgnds>' +
  '</DocumentSettings>' +
  '<Colors><ColorEntry IX="24" RGB="#7F7F7F"/><ColorEntry IX="25" RGB="#FFFFFF"/></Colors>' +
  '<FaceNames><FaceName NameU="Calibri"/></FaceNames>' +
  '<StyleSheets><StyleSheet ID="0" NameU="No Style" IsCustomNameU="1" Name="No Style" IsCustomName="1">' +
  [
    cell('EnableLineProps', 1),
    cell('EnableFillProps', 1),
    cell('EnableTextProps', 1),
    cell('HideForApply', 0),
    cell('LineWeight', 1 / 96),
    cell('LineColor', 0),
    cell('LinePattern', 1),
    cell('FillForegnd', 1),
    cell('FillBkgnd', 0),
    cell('FillPattern', 1),
    cell('ShdwPattern', 0),
    cell('VerticalAlign', 1)
  ].join('') +
  '</StyleSheet></StyleSheets></VisioDocument>';

const pagesXml = (pageWidth: number, pageHeight: number) =>
  `${HEADER}<Pages xmlns="${MAIN}" xmlns:r="${R}" xml:space="preserve">` +
  `<Page ID="0" NameU="Page-1" Name="Page-1" ViewScale="-1" ViewCenterX="${num(pageWidth / 2)}" ViewCenterY="${num(pageHeight / 2)}">` +
  '<PageSheet LineStyle="0" FillStyle="0" TextStyle="0">' +
  [
    cell('PageWidth', pageWidth),
    cell('PageHeight', pageHeight),
    cell('ShdwOffsetX', 0.125),
    cell('ShdwOffsetY', -0.125),
    cell('PageScale', 1, ' U="IN"'),
    cell('DrawingScale', 1, ' U="IN"'),
    cell('DrawingSizeType', 0),
    cell('DrawingScaleType', 0),
    cell('InhibitSnap', 0),
    cell('UIVisibility', 0),
    cell('ShdwType', 0),
    cell('ShdwObliqueAngle', 0),
    cell('ShdwScaleFactor', 1),
    cell('DrawingResizeType', 1)
  ].join('') +
  '</PageSheet><Rel r:id="rId1"/></Page></Pages>';

const pageXml = (input: VsdxInput, pageWidth: number, pageHeight: number) => {
  const width = inches(input.width);
  const height = inches(input.height);
  const row = [
    cell('Value', input.code, ' U="STR"'),
    cell('Prompt', ''),
    cell('Label', 'Mermaid'),
    cell('Format', ''),
    cell('SortKey', ''),
    cell('Type', 0),
    cell('Invisible', 0),
    cell('Verify', 0),
    cell('DataLinked', 0),
    cell('Calendar', 0)
  ].join('');
  return (
    `${HEADER}<PageContents xmlns="${MAIN}" xmlns:r="${R}" xml:space="preserve"><Shapes>` +
    `<Shape ID="1" NameU="Mermaid" Name="Mermaid" Type="Foreign" LineStyle="0" FillStyle="0" TextStyle="0">` +
    [
      cell('PinX', pageWidth / 2),
      cell('PinY', pageHeight / 2),
      cell('Width', width),
      cell('Height', height),
      cell('LocPinX', width / 2, ' F="Width*0.5"'),
      cell('LocPinY', height / 2, ' F="Height*0.5"'),
      cell('Angle', 0),
      cell('FlipX', 0),
      cell('FlipY', 0),
      cell('ResizeMode', 0),
      cell('ImgOffsetX', 0, ' F="ImgWidth*0"'),
      cell('ImgOffsetY', 0, ' F="ImgHeight*0"'),
      cell('ImgWidth', width, ' F="Width*1"'),
      cell('ImgHeight', height, ' F="Height*1"'),
      cell('LockAspect', 1),
      cell('LinePattern', 0),
      cell('FillPattern', 0)
    ].join('') +
    `<Section N="Property"><Row N="MermaidSource">${row}</Row></Section>` +
    '<ForeignData ForeignType="Bitmap" CompressionType="PNG"><Rel r:id="rId1"/></ForeignData>' +
    '</Shape></Shapes></PageContents>'
  );
};

const windowsXml = (pageWidth: number, pageHeight: number) =>
  `${HEADER}<Windows ClientWidth="1280" ClientHeight="800" xmlns="${MAIN}" xmlns:r="${R}" xml:space="preserve">` +
  `<Window ID="0" WindowType="Drawing" WindowState="1073741824" ContainerType="Page" Page="0" ViewScale="-1" ViewCenterX="${num(pageWidth / 2)}" ViewCenterY="${num(pageHeight / 2)}">` +
  '<ShowRulers>1</ShowRulers><ShowGrid>1</ShowGrid><ShowPageBreaks>0</ShowPageBreaks>' +
  '<ShowGuides>1</ShowGuides><ShowConnectionPoints>1</ShowConnectionPoints>' +
  '<GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions>' +
  '<SnapAngles/><DynamicGridEnabled>1</DynamicGridEnabled><TabSplitterPos>0.5</TabSplitterPos>' +
  '</Window></Windows>';

const coreXml = (title: string, now: Date) => {
  const stamp = `${now.toISOString().slice(0, 19)}Z`;
  return (
    `${HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${escapeXml(title)}</dc:title>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified>` +
    '</cp:coreProperties>'
  );
};

const appXml = () =>
  `${HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
  '<Application>mermaid-editor</Application></Properties>';

/** The parts of the package, by path; the PNG as given, the rest as XML text. */
export const vsdxParts = (input: VsdxInput, now = new Date()): Record<string, string> => {
  const pageWidth = inches(input.width) + 2 * MARGIN;
  const pageHeight = inches(input.height) + 2 * MARGIN;
  return {
    [VSDX_PARTS.app]: appXml(),
    [VSDX_PARTS.contentTypes]: contentTypes(),
    [VSDX_PARTS.core]: coreXml(input.title, now),
    [VSDX_PARTS.document]: documentXml(),
    [VSDX_PARTS.documentRels]: relationships([
      ['rId1', `${VISIO_RELS}/pages`, 'pages/pages.xml'],
      ['rId2', `${VISIO_RELS}/windows`, 'windows.xml']
    ]),
    [VSDX_PARTS.page]: pageXml(input, pageWidth, pageHeight),
    [VSDX_PARTS.pageRels]: relationships([
      [
        'rId1',
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        '../media/image1.png'
      ]
    ]),
    [VSDX_PARTS.pages]: pagesXml(pageWidth, pageHeight),
    [VSDX_PARTS.pagesRels]: relationships([['rId1', `${VISIO_RELS}/page`, 'page1.xml']]),
    [VSDX_PARTS.rels]: relationships([
      ['rId1', `${VISIO_RELS}/document`, 'visio/document.xml'],
      [
        'rId2',
        'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
        'docProps/core.xml'
      ],
      [
        'rId3',
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
        'docProps/app.xml'
      ]
    ]),
    [VSDX_PARTS.windows]: windowsXml(pageWidth, pageHeight)
  };
};

/** The `.vsdx` file. `[Content_Types].xml` comes first, as Office writes it. */
export const buildVsdx = (input: VsdxInput, now = new Date()): Uint8Array => {
  const parts = vsdxParts(input, now);
  const files: Record<string, Uint8Array> = {
    [VSDX_PARTS.contentTypes]: strToU8(parts[VSDX_PARTS.contentTypes])
  };
  for (const [path, text] of Object.entries(parts)) {
    if (path !== VSDX_PARTS.contentTypes) files[path] = strToU8(text);
  }
  // The PNG is compressed already.
  files[VSDX_PARTS.image] = input.png;
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, data]) => [
        path,
        [data, { level: path === VSDX_PARTS.image ? 0 : 6 }] as const
      ])
    ),
    { mtime: now }
  );
};
