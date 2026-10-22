import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { chooseExport, openExport, readDownload, saveExport } from './helpers/exportDlg';
import { expect, t, test } from './test';

// The 書き出す dialog's options: 解像度 and 背景 for the formats that take them, the preview
// on the chosen background, and the file name. The size presets (PowerPoint, A4, square)
// and the PNG width/height in pixels are gone (user feedback, 2026-10-08 and 2026-10-12).
const code = 'flowchart LR\n  A[Start] --> B[End]';
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

const PNG_SIGNATURE = '89504e470d0a1a0a';

const pngSize = (bytes: Buffer) => {
  expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
  // IHDR: length(4) "IHDR"(4) width(4) height(4)
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { height: bytes.readUInt32BE(20), width: bytes.readUInt32BE(16) };
};

const downloadPng = async (page: Page) => readDownload(await saveExport(page, 'png'));

/** Decode a PNG in the browser and read one pixel. */
const pixelAt = (page: Page, bytes: Buffer, x: number, y: number) =>
  page.evaluate(
    async ({ b64, px, py }) => {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.addEventListener('load', resolve);
        image.addEventListener('error', reject);
        image.src = `data:image/png;base64,${b64}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context?.drawImage(image, 0, 0);
      return [...(context?.getImageData(px, py, 1, 1).data ?? [])];
    },
    { b64: bytes.toString('base64'), px: x, py: y }
  );

const shown = (page: Page, testID: string) => page.locator(`[data-testid^="${testID}-"]`);

test.describe('Export options', () => {
  test.beforeEach(async ({ editPage, page }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Start');
    await openExport(page);
  });

  test('previews the diagram; no size presets or pixel sizes, the image is as it is', async ({
    page
  }) => {
    const preview = page.getByTestId(TID.exportDlgPreview);
    await expect(preview.locator('svg')).toBeVisible();
    await expect(preview).toContainText('Start');
    await expect(page.getByTestId(`${TID.exportDlgFormat}-png`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('[data-testid^="export-preset-"]')).toHaveCount(0);
    await expect(page.getByTestId(TID.exportDlg).locator('input[type="number"]')).toHaveCount(0);
    await expect(page.getByTestId(TID.exportDlgNote)).toContainText(t('actions.noteAsIs'));
  });

  test('offers each option only for the formats that take it', async ({ page }) => {
    const expected = {
      copy: { background: 3, html: 0, scale: 3 },
      drawio: { background: 0, html: 0, scale: 0 },
      html: { background: 0, html: 2, scale: 0 },
      md: { background: 3, html: 0, scale: 0 },
      png: { background: 3, html: 0, scale: 3 },
      pptx: { background: 0, html: 0, scale: 0 },
      svg: { background: 3, html: 0, scale: 0 },
      vsdx: { background: 0, html: 0, scale: 0 }
    } as const;
    for (const [format, counts] of Object.entries(expected)) {
      await chooseExport(page, format as keyof typeof expected);
      await expect(shown(page, TID.exportDlgScale)).toHaveCount(counts.scale);
      await expect(shown(page, TID.exportDlgBackground)).toHaveCount(counts.background);
      await expect(shown(page, TID.exportDlgHtmlMode)).toHaveCount(counts.html);
      await expect(page.getByTestId(TID.exportDlgNote)).toBeVisible();
    }
    await chooseExport(page, 'drawio');
    await expect(page.getByTestId(TID.exportDlgNote)).toHaveText(t('saveAs.drawioHint'));
    await chooseExport(page, 'vsdx');
    await expect(page.getByTestId(TID.exportDlgNote)).toHaveText(t('saveAs.vsdxHint'));
    await chooseExport(page, 'pptx');
    await expect(page.getByTestId(TID.exportDlgNote)).toHaveText(t('saveAs.pptxHint'));
  });

  test('the file name and extension follow the format; copies have none', async ({ page }) => {
    const name = page.getByTestId(TID.exportDlgFileName);
    const extension = page.getByTestId(TID.exportDlgExtension);
    await expect(name).toHaveValue('diagram');
    for (const [format, ext] of [
      ['png', '.png'],
      ['svg', '.svg'],
      ['pptx', '.pptx'],
      ['drawio', '.drawio'],
      ['vsdx', '.vsdx'],
      ['html', '.html'],
      ['md', '.svg']
    ] as const) {
      await chooseExport(page, format);
      await expect(extension).toHaveText(ext);
      await expect(page.getByTestId(TID.exportDlgSave)).toHaveText(t('exportDlg.save'));
    }
    await chooseExport(page, 'html', { htmlMode: 'tag' });
    await expect(name).toHaveCount(0);
    await expect(page.getByTestId(TID.exportDlgSave)).toHaveText(t('exportDlg.copy'));
    await chooseExport(page, 'copy');
    await expect(name).toHaveCount(0);
  });

  test('the scale multiplies the PNG size; the labels are 標準/高画質/最高画質', async ({
    page
  }) => {
    await expect(page.getByTestId(`${TID.exportDlgScale}-1`)).toHaveText(t('exportDlg.scale1'));
    await expect(page.getByTestId(`${TID.exportDlgScale}-3`)).toHaveText(t('exportDlg.scale3'));
    await page.getByTestId(`${TID.exportDlgScale}-1`).click();
    const one = pngSize(await downloadPng(page));
    await page.getByTestId(`${TID.exportDlgScale}-2`).click();
    const two = pngSize(await downloadPng(page));
    expect(Math.abs(two.width - 2 * one.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(two.height - 2 * one.height)).toBeLessThanOrEqual(2);
  });

  test('a transparent background for a new user, white on request', async ({ page }) => {
    const preview = page.getByTestId(TID.exportDlgPreview);
    await expect(page.getByTestId(`${TID.exportDlgBackground}-transparent`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(preview).toHaveAttribute('data-background', 'transparent');
    let bytes = await downloadPng(page);
    expect(await pixelAt(page, bytes, 0, 0)).toEqual([0, 0, 0, 0]);
    await page.getByTestId(`${TID.exportDlgBackground}-white`).click();
    await expect(preview).toHaveAttribute('data-background', '#ffffff');
    bytes = await downloadPng(page);
    expect(await pixelAt(page, bytes, 0, 0)).toEqual([255, 255, 255, 255]);
  });

  test('the choice is remembered after a reload', async ({ editPage, page }) => {
    await page.getByTestId(`${TID.exportDlgScale}-3`).click();
    await page.getByTestId(`${TID.exportDlgBackground}-white`).click();
    await editPage.start(url);
    await editPage.checkTextInView('Start');
    await openExport(page);
    await expect(page.getByTestId(`${TID.exportDlgScale}-3`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByTestId(`${TID.exportDlgBackground}-white`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('saves under the typed name at once, without a second dialog', async ({ page }) => {
    const download = await saveExport(page, 'png', { name: 'monthly: report' });
    expect(download.suggestedFilename()).toBe('monthly report.png');
    await expect(page.getByTestId('save-as-dialog')).toHaveCount(0);
    // A name typed with its extension keeps it once; an empty one falls back.
    expect((await saveExport(page, 'svg', { name: 'chart.svg' })).suggestedFilename()).toBe(
      'chart.svg'
    );
    expect((await saveExport(page, 'svg', { name: '  ' })).suggestedFilename()).toBe('diagram.svg');
  });

  test('キャンセル closes the dialog', async ({ page }) => {
    await page.getByTestId(TID.exportDlgCancel).click();
    await expect(page.getByTestId(TID.exportDlg)).toBeHidden();
  });
});
