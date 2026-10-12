import { TID } from '$/constants';
import { expect, type Page } from '@playwright/test';

/** What `loadSample` needs from the EditorPage (tests/test.ts). */
interface Opener {
  page: Page;
  captureWindowOpen(action: () => Promise<unknown>): Promise<string>;
  openUrlHere(url: string): Promise<void>;
}

const byTid = (id: string) => `[data-testid="${id}"]`;

/** Opens the 新規 dialog from the header menu on the given tab. */
export const openNewDialog = async (page: Page, tab: 'type' | 'sample'): Promise<void> => {
  const dialog = page.getByTestId(TID.newDlg);
  if (!(await dialog.isVisible())) {
    await page.getByTestId(TID.wsNewMenu).click();
    await page.getByTestId(tab === 'type' ? TID.wsNewFromType : TID.wsNewFromSample).click();
  }
  await expect(dialog).toBeVisible();
  const tabButton = page.getByTestId(`${TID.newDlgTab}-${tab}`);
  if ((await tabButton.getAttribute('aria-selected')) !== 'true') await tabButton.click();
};

export const closeNewDialog = async (page: Page): Promise<void> => {
  const dialog = page.getByTestId(TID.newDlg);
  if (await dialog.isVisible()) await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
};

/**
 * Starts from a sample: opens the サンプル tab, picks the group's first sample (or the one
 * titled `title`), presses 「このサンプルで始める」 and opens the URL it would open in a new
 * tab in this page instead.
 */
export const loadSample = async (editor: Opener, group: string, title?: string): Promise<void> => {
  const { page } = editor;
  await openNewDialog(page, 'sample');
  const dialog = page.getByTestId(TID.newDlg);
  const titled = title === undefined ? '' : `[data-title="${title}"]`;
  const card = dialog.locator(`${byTid(TID.newDlgSample)}[data-group="${group}"]${titled}`);
  await card.first().click();
  const url = await editor.captureWindowOpen(() =>
    dialog.getByTestId(TID.newDlgSampleStart).click()
  );
  await editor.openUrlHere(url);
};
