import { TID } from '$/constants';
import { expect, type Page } from '@playwright/test';

/** The /edit shell: header, the three columns and their rails (W1). */

export const headerActions = (page: Page) => page.getByTestId(TID.wsHeaderActions);

/** Opens the header's 新規 menu (its two items: 形式から作る… / サンプルから作る…). */
export const openNewMenu = async (page: Page): Promise<void> => {
  await page.getByTestId(TID.wsNewMenu).click();
  await expect(page.getByTestId(TID.wsNewFromType)).toBeVisible();
};

export const openShare = async (page: Page): Promise<void> => {
  await page.getByTestId(TID.wsShareButton).click();
  await expect(page.getByTestId(TID.shareDlg)).toBeVisible();
};

export const undo = (page: Page) => page.getByTestId(TID.undoButton).click();
export const redo = (page: Page) => page.getByTestId(TID.redoButton).click();

export const codeTab = async (page: Page, mode: 'code' | 'config'): Promise<void> => {
  await page.getByTestId(`${TID.wsCodeTab}-${mode}`).click();
};

export const collapseCode = async (page: Page): Promise<void> => {
  await page.getByTestId(TID.wsCodeCollapse).click();
  await expect(page.getByTestId(TID.wsCodeRail)).toBeVisible();
};

export const expandCode = async (page: Page): Promise<void> => {
  await page.getByTestId(TID.wsCodeExpand).click();
  await expect(page.getByTestId(TID.wsCodeRail)).toBeHidden();
};

export const collapseInspector = async (page: Page): Promise<void> => {
  await page.getByTestId(TID.inspCollapse).click();
  await expect(page.getByTestId(TID.wsInspectorRail)).toBeVisible();
};

export const expandInspector = async (page: Page): Promise<void> => {
  await page.getByTestId(TID.wsInspectorExpand).click();
  await expect(page.getByTestId(TID.wsInspectorRail)).toBeHidden();
};

export const toggleHistory = (page: Page) => page.getByTestId(TID.wsHistoryButton).click();

/** The width of a column in CSS pixels. */
export const paneWidth = async (page: Page, pane: 'code' | 'canvas' | 'inspector') => {
  const id = { canvas: TID.wsCanvasPane, code: TID.wsCodePane, inspector: TID.wsInspectorPane }[
    pane
  ];
  const box = await page.getByTestId(id).boundingBox();
  return box?.width ?? 0;
};
