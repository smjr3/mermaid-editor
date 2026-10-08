import { TID } from '$/constants';
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { expect, test } from './test';

// "名前を付けて保存" and the .drawio / .vsdx files (saveFile.ts, drawioExport.ts,
// vsdxExport.ts). By default the fixture removes showSaveFilePicker and confirms
// the editor's own name dialog with the suggested name (tests/test.ts).

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
    await page.getByTestId(TID.actionsCard).click();
  });

  test('saves a draw.io file holding the SVG and the Mermaid source', async ({ page }) => {
    const button = page.getByTestId(TID.downloadDrawio);
    await expect(button).toHaveAttribute('title', /draw\.io/);
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe('Expense flow.drawio');
    const xml = readFileSync((await download.path()) ?? '', 'utf8');
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toMatch(
      /<mxfile [^>]*>\s*<diagram [^>]*name="Expense flow"[^>]*>\s*<mxGraphModel /
    );
    expect(xml).toMatch(/<root>\s*<mxCell id="0" \/>\s*<mxCell id="1" parent="0" \/>/);
    const data = /mermaidData="([^"]*)"/.exec(xml)?.[1] ?? '';
    const unescaped = data
      .replaceAll('&#10;', '\n')
      .replaceAll('&quot;', '"')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&');
    expect((JSON.parse(unescaped) as { data: string }).data).toBe(code);
    const image = /image=data:image\/svg\+xml,([A-Za-z0-9+/=]+);/.exec(xml)?.[1] ?? '';
    const svg = Buffer.from(image, 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('承認');
    const width = Number(/<mxGeometry [^>]*width="([\d.]+)"/.exec(xml)?.[1]);
    const viewBox = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"/.exec(svg)?.[1];
    expect(width).toBeCloseTo(Number(viewBox), 1);
  });

  test('saves a Visio package with the diagram as a PNG picture', async ({ page }) => {
    const button = page.getByTestId(TID.downloadVsdx);
    await expect(button).toHaveAttribute('title', /Visio/);
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe('Expense flow.vsdx');
    const file = readFileSync((await download.path()) ?? '');
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

test.describe('名前を付けて保存 without the browser save dialog', () => {
  test.use({ saveAs: 'manual' });

  test.beforeEach(async ({ editPage, page }) => {
    await editPage.start(url);
    await editPage.checkTextInView('承認');
    await page.getByTestId(TID.actionsCard).click();
  });

  test('asks for the name, suggesting the title, and saves under the typed one', async ({
    page
  }) => {
    await page.getByTestId(TID.downloadPNG).click();
    const dialog = page.getByTestId(TID.saveAsDialog);
    await expect(dialog).toBeVisible();
    const input = page.getByTestId(TID.saveAsInput);
    await expect(input).toHaveValue('Expense flow.png');
    await input.fill('monthly report');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(TID.saveAsConfirm).click()
    ]);
    expect(download.suggestedFilename()).toBe('monthly report.png');
    const file = readFileSync((await download.path()) ?? '');
    expect([...file.subarray(0, 4)]).toEqual(PNG_MAGIC);
    await expect(dialog).toBeHidden();
  });

  test('saves nothing when the dialog is cancelled', async ({ page }) => {
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.getByTestId(TID.downloadSVG).click();
    await expect(page.getByTestId(TID.saveAsInput)).toHaveValue('Expense flow.svg');
    await page.getByTestId(TID.saveAsCancel).click();
    await expect(page.getByTestId(TID.saveAsDialog)).toBeHidden();
    await page.getByTestId(TID.downloadHTML).click();
    await expect(page.getByTestId(TID.saveAsInput)).toHaveValue('Expense flow.html');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.saveAsDialog)).toBeHidden();
    await page.waitForTimeout(500);
    expect(downloads).toBe(0);
  });
});

test.describe('名前を付けて保存 with the browser save dialog', () => {
  test.use({ saveAs: 'picker' });

  test('writes the file to the handle the save dialog returns', async ({ editPage, page }) => {
    await page.addInitScript(() => {
      const state = window as unknown as {
        pickerOptions?: unknown;
        written?: number[];
      };
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: (options: unknown) => {
          state.pickerOptions = options;
          return Promise.resolve({
            createWritable: () =>
              Promise.resolve({
                close: () => Promise.resolve(),
                write: async (blob: Blob) => {
                  state.written = [...new Uint8Array(await blob.arrayBuffer())];
                }
              }),
            name: 'chosen.vsdx'
          });
        }
      });
    });
    let downloads = 0;
    page.on('download', () => downloads++);
    await editPage.start(url);
    await editPage.checkTextInView('承認');
    await page.getByTestId(TID.actionsCard).click();
    await page.getByTestId(TID.downloadVsdx).click();
    const written = await page.waitForFunction(
      () => (window as unknown as { written?: number[] }).written,
      undefined,
      { timeout: 15_000 }
    );
    const bytes = new Uint8Array((await written.jsonValue()) ?? []);
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Object.keys(unzipSync(bytes))).toContain('visio/document.xml');
    expect(
      await page.evaluate(() => (window as unknown as { pickerOptions?: unknown }).pickerOptions)
    ).toEqual({
      suggestedName: 'Expense flow.vsdx',
      types: [
        {
          accept: { 'application/vnd.ms-visio.drawing.main+xml': ['.vsdx'] },
          description: expect.any(String)
        }
      ]
    });
    await expect(page.getByTestId(TID.saveAsDialog)).toBeHidden();
    expect(downloads).toBe(0);
  });
});
