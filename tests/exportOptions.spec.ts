import { TID } from '$/constants';
import { readFileSync } from 'node:fs';
import { expect, t, test } from './test';
import type { Page } from '@playwright/test';

// The 出す tab's export options. The size presets (PowerPoint, A4, square) were removed
// after user feedback (2026-10-08); the background and the scale stay.
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

test.describe('Export options', () => {
  test.beforeEach(async ({ editPage, page }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Start');
    await page.getByTestId(TID.actionsCard).click();
  });

  test('offers no size presets; the image is the diagram as it is', async ({ page }) => {
    await expect(page.getByTestId(TID.downloadPNG)).toBeVisible();
    await expect(page.locator(`[data-testid^="${TID.exportPreset}-"]`)).toHaveCount(0);
    await expect(page.getByTestId(TID.exportNote)).toContainText(t('actions.noteAsIs'));
  });

  test('the scale multiplies the PNG size', async ({ page }) => {
    await page.getByTestId(`${TID.exportScale}-1`).click();
    const one = pngSize(await downloadPng(page));
    await page.getByTestId(`${TID.exportScale}-2`).click();
    const two = pngSize(await downloadPng(page));
    expect(Math.abs(two.width - 2 * one.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(two.height - 2 * one.height)).toBeLessThanOrEqual(2);
  });

  test('a white background by default, a transparent one on request', async ({ page }) => {
    let bytes = await downloadPng(page);
    expect(await pixelAt(page, bytes, 0, 0)).toEqual([255, 255, 255, 255]);
    await page.getByTestId(`${TID.exportBackground}-transparent`).click();
    bytes = await downloadPng(page);
    expect(await pixelAt(page, bytes, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  test('the choice is remembered after a reload', async ({ editPage, page }) => {
    await page.getByTestId(`${TID.exportScale}-3`).click();
    await page.getByTestId(`${TID.exportBackground}-transparent`).click();
    await editPage.start(url);
    await editPage.checkTextInView('Start');
    if (!(await page.getByTestId(TID.exportNote).isVisible())) {
      await page.getByTestId(TID.actionsCard).click();
    }
    await expect(page.getByTestId(`${TID.exportScale}-3`)).toHaveAttribute('data-state', 'on');
    await expect(page.getByTestId(`${TID.exportBackground}-transparent`)).toHaveAttribute(
      'data-state',
      'on'
    );
  });
});
