import { TID } from '$/constants';
import { expect, type Page } from '@playwright/test';

/** The diagram column: selection, zoom, the add bar (W2). */

/** The rendered node (or other object) whose text is `text`. */
export const nodeByText = (page: Page, text: string) =>
  page.locator('#container svg').getByText(text, { exact: true }).first();

/** Clicks an object in the diagram and waits for the selection outline. */
export const selectByText = async (page: Page, text: string): Promise<void> => {
  await nodeByText(page, text).click();
  await expect(page.getByTestId(TID.selectionOutline)).toBeVisible();
};

/** Clicks an empty spot of the diagram, which clears the selection. */
export const clearSelectionByClick = async (page: Page): Promise<void> => {
  const box = await page.locator('#view').boundingBox();
  if (!box) throw new Error('No diagram view');
  await page.mouse.click(box.x + 8, box.y + box.height - 8);
  await expect(page.getByTestId(TID.selectionOutline)).toBeHidden();
};

export const insertBar = (page: Page) => page.getByTestId(TID.canvasInsertBar);

/** Presses an add-bar item by its `data-insert` key. */
export const insert = async (page: Page, key: string): Promise<void> => {
  await insertBar(page)
    .locator(`[data-testid="${TID.canvasInsertItem}"][data-insert="${key}"]`)
    .click();
};

export const zoomIn = (page: Page) => page.getByTestId(TID.zoomInButton).click();
export const zoomOut = (page: Page) => page.getByTestId(TID.zoomOutButton).click();
export const resetView = (page: Page) => page.getByTestId(TID.resetViewButton).click();
