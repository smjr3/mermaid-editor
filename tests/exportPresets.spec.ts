import { TID } from '$/constants';
import { readFileSync } from 'node:fs';
import { expect, test } from './test';
import type { Page } from '@playwright/test';

const code = 'flowchart LR\n  A[Start] --> B[End]';
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

const PNG_SIGNATURE = '89504e470d0a1a0a';

const pngSize = (bytes: Buffer) => {
  expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
  // IHDR: length(4) "IHDR"(4) width(4) height(4)
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { height: bytes.readUInt32BE(20), width: bytes.readUInt32BE(16) };
};

const downloadPng = async (page: Page) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-PNG').click()
  ]);
  return readFileSync((await download.path()) ?? '');
};

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

test.describe('Export presets', () => {
  test.beforeEach(async ({ editPage, page }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Start');
    await page.getByTestId(TID.actionsCard).click();
  });

  test('PowerPoint 16:9 at 2x downloads a 3840x2160 PNG and says so', async ({ page }) => {
    await page.getByTestId(`${TID.exportPreset}-ppt169`).click();
    await page.getByTestId(`${TID.exportScale}-2`).click();
    await expect(page.getByTestId(TID.exportNote)).toContainText('3840×2160');
    const bytes = await downloadPng(page);
    expect(pngSize(bytes)).toEqual({ height: 2160, width: 3840 });
    // White background by default: the corner is opaque white.
    expect(await pixelAt(page, bytes, 0, 0)).toEqual([255, 255, 255, 255]);
  });

  test('A4 portrait at 1x follows its own ratio', async ({ page }) => {
    await page.getByTestId(`${TID.exportPreset}-a4portrait`).click();
    await page.getByTestId(`${TID.exportScale}-1`).click();
    expect(pngSize(await downloadPng(page))).toEqual({ height: 1123, width: 794 });
  });

  test('a transparent background leaves the corner transparent', async ({ page }) => {
    await page.getByTestId(`${TID.exportPreset}-ppt169`).click();
    await page.getByTestId(`${TID.exportBackground}-transparent`).click();
    const bytes = await downloadPng(page);
    expect(await pixelAt(page, bytes, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  test('the SVG has the preset viewBox and the diagram inside it', async ({ page }) => {
    await page.getByTestId(`${TID.exportPreset}-ppt43`).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-SVG').click()
    ]);
    const svg = readFileSync((await download.path()) ?? '', 'utf8');
    expect(svg).toContain('viewBox="0 0 1440 1080"');
    expect(svg).toContain('Start');
  });

  test('the choice is remembered after a reload', async ({ editPage, page }) => {
    await page.getByTestId(`${TID.exportPreset}-square`).click();
    await page.getByTestId(`${TID.exportScale}-3`).click();
    await editPage.start(url);
    await editPage.checkTextInView('Start');
    if (!(await page.getByTestId(TID.exportNote).isVisible())) {
      await page.getByTestId(TID.actionsCard).click();
    }
    await expect(page.getByTestId(TID.exportNote)).toContainText('3240×3240');
  });
});
