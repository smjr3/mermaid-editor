import { TID } from '$/constants';
import { expect, type Page } from '@playwright/test';
import { verifyFileSizeGreaterThan } from '../utils';

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

/**
 * Until the new dialog lands it shows the old export card, which saves through the
 * browser's save dialog (which a test cannot answer) or, without one, asks for the file
 * name: the picker is removed and the name dialog confirmed as soon as it opens.
 */
const legacySave = async (page: Page, button: string): Promise<void> => {
  await page.evaluate(
    ({ confirm, dialog }) => {
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: undefined,
        writable: true
      });
      const target = window as unknown as { __autoConfirmSaveAs?: boolean };
      if (target.__autoConfirmSaveAs) return;
      target.__autoConfirmSaveAs = true;
      new MutationObserver(() => {
        document
          .querySelector<HTMLButtonElement>(
            `[data-testid="${dialog}"][data-state="open"] [data-testid="${confirm}"]:not([disabled])`
          )
          ?.click();
      }).observe(document, { attributes: true, childList: true, subtree: true });
    },
    { confirm: TID.saveAsConfirm, dialog: TID.saveAsDialog }
  );
  await page.getByTestId(button).click();
};

const download = async (
  page: Page,
  format: 'png' | 'svg',
  expectedSize: number
): Promise<number> => {
  await openExport(page);
  const saved = verifyFileSizeGreaterThan(page, 'diagram', format, expectedSize);
  if ((await page.getByTestId(`${TID.exportDlgFormat}-${format}`).count()) > 0) {
    await page.getByTestId(`${TID.exportDlgFormat}-${format}`).click();
    await page.getByTestId(TID.exportDlgSave).click();
  } else {
    await legacySave(page, format === 'png' ? TID.downloadPNG : TID.downloadSVG);
  }
  return await saved;
};

/** Saves the diagram as PNG from the 書き出す dialog; resolves to the file's size. */
export const downloadPNG = (page: Page, expectedSize: number): Promise<number> =>
  download(page, 'png', expectedSize);

/** Saves the diagram as SVG from the 書き出す dialog; resolves to the file's size. */
export const downloadSVG = (page: Page, expectedSize: number): Promise<number> =>
  download(page, 'svg', expectedSize);
