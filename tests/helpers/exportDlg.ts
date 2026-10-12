import { TID } from '$/constants';
import { expect, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { verifyFileSizeGreaterThan } from '../utils';

export type ExportFormat = 'copy' | 'drawio' | 'html' | 'md' | 'png' | 'svg' | 'vsdx';

export interface ExportChoice {
  background?: 'theme' | 'transparent' | 'white';
  htmlMode?: 'file' | 'tag';
  /** The file name to type (without or with the extension). */
  name?: string;
  scale?: 1 | 2 | 3;
}

/** Opens the 書き出す dialog from the header. */
export const openExport = async (page: Page): Promise<void> => {
  const dialog = page.getByTestId(TID.exportDlg);
  if (!(await dialog.isVisible())) await page.getByTestId(TID.wsExportButton).click();
  await expect(dialog).toBeVisible();
};

export const closeExport = async (page: Page): Promise<void> => {
  const dialog = page.getByTestId(TID.exportDlg);
  if (await dialog.isVisible()) await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
};

/** Opens the dialog (if needed), picks `format` and sets the given options. */
export const chooseExport = async (
  page: Page,
  format: ExportFormat,
  { background, htmlMode, name, scale }: ExportChoice = {}
): Promise<void> => {
  await openExport(page);
  const card = page.getByTestId(`${TID.exportDlgFormat}-${format}`);
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  if (htmlMode) await page.getByTestId(`${TID.exportDlgHtmlMode}-${htmlMode}`).click();
  if (scale) await page.getByTestId(`${TID.exportDlgScale}-${scale}`).click();
  if (background) await page.getByTestId(`${TID.exportDlgBackground}-${background}`).click();
  if (name !== undefined) await page.getByTestId(TID.exportDlgFileName).fill(name);
};

/** Saves the diagram in `format` from the 書き出す dialog; resolves to the download. */
export const saveExport = async (
  page: Page,
  format: Exclude<ExportFormat, 'copy'>,
  choice: ExportChoice = {}
): Promise<Download> => {
  await chooseExport(page, format, choice);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20_000 }),
    page.getByTestId(TID.exportDlgSave).click()
  ]);
  return download;
};

/** The saved file's bytes. */
export const readDownload = async (download: Download): Promise<Buffer> =>
  readFileSync((await download.path()) ?? '');

/**
 * Copies from the 書き出す dialog (the image, or the HTML tag) and waits until the button
 * reports the outcome: 'done' or 'failed'.
 */
export const copyExport = async (
  page: Page,
  format: 'copy' | 'html',
  choice: ExportChoice = {}
): Promise<string | null> => {
  await chooseExport(page, format, format === 'html' ? { htmlMode: 'tag', ...choice } : choice);
  const button = page.getByTestId(TID.exportDlgSave);
  await button.click();
  await expect(button).toHaveAttribute('data-export-state', /^(done|failed)$/, {
    timeout: 20_000
  });
  return await button.getAttribute('data-export-state');
};

const download = async (
  page: Page,
  format: 'png' | 'svg',
  expectedSize: number
): Promise<number> => {
  await chooseExport(page, format);
  const saved = verifyFileSizeGreaterThan(page, 'diagram', format, expectedSize);
  await page.getByTestId(TID.exportDlgSave).click();
  return await saved;
};

/** Saves the diagram as PNG from the 書き出す dialog; resolves to the file's size. */
export const downloadPNG = (page: Page, expectedSize: number): Promise<number> =>
  download(page, 'png', expectedSize);

/** Saves the diagram as SVG from the 書き出す dialog; resolves to the file's size. */
export const downloadSVG = (page: Page, expectedSize: number): Promise<number> =>
  download(page, 'svg', expectedSize);
