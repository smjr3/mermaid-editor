import { TID } from '$/constants';
import { strFromU8, unzipSync } from 'fflate';
import type { Page } from '@playwright/test';
import {
  chooseExport,
  closeExport,
  openExport,
  readDownload,
  saveExport
} from './helpers/exportDlg';
import { expect, t, test } from './test';

// The .drawio / .vsdx files of the 書き出す dialog (drawioExport.ts, vsdxExport.ts) and the
// file name: the diagram's title by default, saved at once under what is typed (saveFile.ts,
// exportDiagram.ts). There is no second name dialog and no browser save picker any more.

// The title is ASCII: Chromium on a system without a UTF-8 locale saves a
// download with a non-ASCII name as "download" (the Japanese names themselves
// are covered by saveFile.test.ts).
const code = '---\ntitle: "Expense flow"\n---\nflowchart LR\n  A["申請"] --> B["承認"]';
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

test.describe('Save as .drawio and .vsdx', () => {
  test.beforeEach(async ({ editPage, page }) => {
    await editPage.start(url);
    await editPage.checkTextInView('承認');
    await openExport(page);
  });

  test('saves a draw.io file of separate cells, keeping the Mermaid source', async ({ page }) => {
    await chooseExport(page, 'drawio');
    await expect(page.getByTestId(TID.exportDlgNote)).toHaveText(t('saveAs.drawioHint'));
    await expect(page.getByTestId(TID.exportDlgFileName)).toHaveValue('Expense flow');
    await expect(page.getByTestId(TID.exportDlgExtension)).toHaveText('.drawio');
    const download = await saveExport(page, 'drawio');
    expect(download.suggestedFilename()).toBe('Expense flow.drawio');
    const xml = (await readDownload(download)).toString('utf8');
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toMatch(
      /<mxfile [^>]*>\s*<diagram [^>]*name="Expense flow"[^>]*>\s*<mxGraphModel /
    );
    const file = await page.evaluate(readDrawio, xml);
    expect(file.data).toBe(code);
    // The two nodes and the title.
    expect(file.values).toEqual(expect.arrayContaining(['申請', '承認', 'Expense flow']));
    expect(file.vertices).toBe(3);
    expect(file.connected).toBe(1);
  });

  test('saves a Visio package with the diagram as a PNG picture', async ({ page }) => {
    await chooseExport(page, 'vsdx');
    await expect(page.getByTestId(TID.exportDlgNote)).toHaveText(t('saveAs.vsdxHint'));
    const download = await saveExport(page, 'vsdx');
    expect(download.suggestedFilename()).toBe('Expense flow.vsdx');
    const file = await readDownload(download);
    expect([...file.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const parts = unzipSync(new Uint8Array(file));
    expect(Object.keys(parts)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'visio/document.xml',
        'visio/pages/pages.xml',
        'visio/pages/page1.xml',
        'visio/pages/_rels/page1.xml.rels',
        'visio/media/image1.png'
      ])
    );
    expect([...parts['visio/media/image1.png'].subarray(0, 4)]).toEqual(PNG_MAGIC);
    const page1 = strFromU8(parts['visio/pages/page1.xml']);
    expect(page1).toContain('Type="Foreign"');
    expect(page1).toContain('B[&quot;承認&quot;]');
    expect(strFromU8(parts['docProps/core.xml'])).toContain('<dc:title>Expense flow</dc:title>');
  });
});

test.describe('The file name', () => {
  test.beforeEach(async ({ editPage, page }) => {
    await editPage.start(url);
    await editPage.checkTextInView('承認');
    await openExport(page);
  });

  test('suggests the title and saves under the typed name, at once', async ({ page }) => {
    await expect(page.getByTestId(TID.exportDlgFileName)).toHaveValue('Expense flow');
    const download = await saveExport(page, 'png', { name: 'monthly report' });
    expect(download.suggestedFilename()).toBe('monthly report.png');
    const file = await readDownload(download);
    expect([...file.subarray(0, 4)]).toEqual(PNG_MAGIC);
    await expect(page.getByTestId('save-as-dialog')).toHaveCount(0);
  });

  test('saves nothing when the dialog is cancelled', async ({ page }) => {
    let downloads = 0;
    page.on('download', () => downloads++);
    await chooseExport(page, 'svg', { name: 'never' });
    await page.getByTestId(TID.exportDlgCancel).click();
    await expect(page.getByTestId(TID.exportDlg)).toBeHidden();
    await openExport(page);
    // Opened again, the name is the title again.
    await expect(page.getByTestId(TID.exportDlgFileName)).toHaveValue('Expense flow');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.exportDlg)).toBeHidden();
    await page.waitForTimeout(500);
    expect(downloads).toBe(0);
  });

  test('never opens the browser save picker', async ({ editPage, page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: () => {
          (window as unknown as { pickerUsed?: boolean }).pickerUsed = true;
          return Promise.reject(new DOMException('aborted', 'AbortError'));
        }
      });
    });
    await editPage.start(url);
    await editPage.checkTextInView('承認');
    const download = await saveExport(page, 'vsdx');
    expect(download.suggestedFilename()).toBe('Expense flow.vsdx');
    expect(Object.keys(unzipSync(new Uint8Array(await readDownload(download))))).toContain(
      'visio/document.xml'
    );
    expect(
      await page.evaluate(() => (window as unknown as { pickerUsed?: boolean }).pickerUsed)
    ).toBeUndefined();
  });
});

/** What a .drawio file holds, read in the page (which has DOMParser). */
const readDrawio = (xml: string) => {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const cells = [...document.querySelectorAll('mxCell')];
  const vertices = cells.filter((cell) => cell.getAttribute('vertex') === '1');
  const edges = cells.filter((cell) => cell.getAttribute('edge') === '1');
  const ids = new Set(vertices.map((cell) => cell.getAttribute('id')));
  const root = document.querySelector('root > UserObject[id="0"]');
  const model = document.querySelector('mxGraphModel');
  const pageWidth = Number(model?.getAttribute('pageWidth'));
  const styled = (cell: Element, pattern: RegExp) => pattern.test(cell.getAttribute('style') ?? '');
  return {
    connected: edges.filter(
      (cell) => ids.has(cell.getAttribute('source')) && ids.has(cell.getAttribute('target'))
    ).length,
    containers: vertices.filter((cell) => styled(cell, /(^|;)container=1;/)).length,
    dashed: edges.filter((cell) => styled(cell, /(^|;)dashed=1;/)).length,
    data: (JSON.parse(root?.getAttribute('mermaidData') ?? '{}') as { data?: string }).data,
    edgeValues: edges.map((cell) => cell.getAttribute('value')),
    edges: edges.length,
    nested: vertices.filter((cell) => ids.has(cell.getAttribute('parent'))).length,
    parsed: document.getElementsByTagName('parsererror').length === 0,
    values: vertices.map((cell) => cell.getAttribute('value')),
    vertices: vertices.length,
    // A picture as wide as the page would be the whole diagram as one image.
    wholeImages: vertices.filter(
      (cell) =>
        styled(cell, /(^|;)shape=image;/) &&
        Number(cell.querySelector('mxGeometry')?.getAttribute('width')) > pageWidth * 0.5
    ).length
  };
};

const drawioUrl = (source: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code: source, mermaid: '{}' })).toString('base64')}`;

test.describe('.drawio: every element its own draw.io cell', () => {
  const save = async (page: Page) => {
    const download = await saveExport(page, 'drawio');
    const xml = (await readDownload(download)).toString('utf8');
    return page.evaluate(readDrawio, xml);
  };

  test('a flowchart: shapes, a container for the subgraph, connected edges', async ({
    editPage,
    page
  }) => {
    const flowchart = [
      'flowchart LR',
      '  A[Request] --> B{Check}',
      '  B -->|ok| C([Done])',
      '  B -.->|back| A',
      '  subgraph S[Office]',
      '    C --> D[(Store)]',
      '    D --> E((End))',
      '  end'
    ].join('\n');
    await editPage.start(drawioUrl(flowchart));
    await editPage.checkTextInView('Office');
    const file = await save(page);
    expect(file.parsed).toBe(true);
    expect(file.data).toBe(flowchart);
    expect(file.wholeImages).toBe(0);
    // Five nodes and the subgraph, each a cell with its label.
    expect(file.vertices).toBe(6);
    expect(file.values).toEqual(
      expect.arrayContaining(['Request', 'Check', 'Done', 'Store', 'End', 'Office'])
    );
    expect(file.containers).toBe(1);
    // C, D and E sit inside the subgraph's container.
    expect(file.nested).toBe(3);
    expect(file.edges).toBe(5);
    expect(file.connected).toBe(5);
    expect(file.dashed).toBe(1);
    expect(file.edgeValues).toEqual(expect.arrayContaining(['ok', 'back']));
  });

  test('a sequence diagram: actors, lifelines, messages and text as separate cells', async ({
    editPage,
    page
  }) => {
    const sequence =
      'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi\n  Note over Alice,Bob: Memo';
    await editPage.start(drawioUrl(sequence));
    await editPage.checkTextInView('Memo');
    const file = await save(page);
    expect(file.parsed).toBe(true);
    expect(file.wholeImages).toBe(0);
    expect(file.values).toEqual(expect.arrayContaining(['Alice', 'Bob', 'Hello', 'Hi', 'Memo']));
    // Two actors drawn top and bottom, the note and the two message texts.
    expect(file.vertices).toBeGreaterThanOrEqual(7);
    // Two lifelines and two messages.
    expect(file.edges).toBeGreaterThanOrEqual(4);
    expect(file.dashed).toBeGreaterThanOrEqual(1);
  });
});

// Review N01 (2026-10-13): キャンセル during a .drawio / .vsdx export stops it, so it never
// finishes against a diagram edited after the dialog closed.
test.describe('An export cancelled while it is made', () => {
  for (const format of ['drawio', 'vsdx'] as const) {
    test(`saves no ${format} after キャンセル, even once the code is edited`, async ({
      editPage,
      page
    }) => {
      await editPage.start(url);
      await editPage.checkTextInView('承認');
      let downloads = 0;
      page.on('download', () => downloads++);
      await chooseExport(page, format);
      const save = page.getByTestId(TID.exportDlgSave);
      await save.click();
      await expect(save).toHaveAttribute('data-export-state', 'busy');
      await page.getByTestId(TID.exportDlgCancel).click();
      await expect(page.getByTestId(TID.exportDlg)).toBeHidden();
      await editPage.typeInEditor('B --> C["差戻し"]', { newline: true });
      await editPage.checkTextInView('差戻し');
      await page.waitForTimeout(2500);
      expect(downloads).toBe(0);
      // Pan/zoom is back on, and the dialog is ready for the next export.
      await expect(page.locator('#container .svg-pan-zoom_viewport')).toHaveCount(1);
      await openExport(page);
      await expect(page.getByTestId(TID.exportDlgSave)).toHaveAttribute(
        'data-export-state',
        'idle'
      );
    });
  }
});

// Review N02 (2026-10-13): the SVG file is the whole diagram, whatever the view's pan/zoom.
test.describe('The SVG file after zooming the view', () => {
  const savedSvg = async (page: Page, name: string) => {
    const download = await saveExport(page, 'svg', { name });
    const text = (await readDownload(download)).toString('utf8');
    return page.evaluate((xml) => {
      const svg = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
      return {
        transform: svg.querySelector('.svg-pan-zoom_viewport')?.getAttribute('transform') ?? null,
        viewBox: svg.getAttribute('viewBox'),
        width: svg.getAttribute('width')
      };
    }, text);
  };

  const stateUrl = (state: Record<string, unknown>) =>
    `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}', ...state })).toString('base64')}`;

  for (const rough of [false, true]) {
    test(`holds the same picture whatever the zoom and pan (hand-drawn ${rough})`, async ({
      editPage,
      page
    }) => {
      // The picture with pan/zoom off: the view keeps mermaid's own viewBox.
      await editPage.start(stateUrl({ panZoom: false, rough }));
      await editPage.checkTextInView('承認');
      const still = await savedSvg(page, 'still');
      await closeExport(page);

      await editPage.start(stateUrl({ panZoom: true, rough }));
      await editPage.checkTextInView('承認');
      const before = await savedSvg(page, 'before');
      await closeExport(page);
      for (let index = 0; index < 3; index++) await page.getByTestId(TID.zoomInButton).click();
      const box = await page.locator('#container').boundingBox();
      if (box) {
        const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 120, y + 60, { steps: 5 });
        await page.mouse.up();
      }
      const viewport = page.locator('#container .svg-pan-zoom_viewport');
      const zoomed = await viewport.getAttribute('transform');
      expect(zoomed).toMatch(/^matrix\(/);
      const after = await savedSvg(page, 'after');

      expect(still.transform).toBeNull();
      expect(still.viewBox).toMatch(/^[\d.-]+ [\d.-]+ [\d.]+ [\d.]+$/);
      expect(before).toEqual(still);
      expect(after).toEqual(still);
      // The view keeps its zoom and pan.
      await closeExport(page);
      await expect(viewport).toHaveAttribute('transform', zoomed ?? '');
    });
  }
});
