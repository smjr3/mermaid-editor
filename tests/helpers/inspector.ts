import { TID } from '$/constants';
import { expect, type Page } from '@playwright/test';

/** The inspector (right column): 図全体, or the selected object's rows (W3). */

export const panel = (page: Page) => page.getByTestId(TID.inspPanel);

/** A generic field row by its `data-key`. */
export const field = (page: Page, key: string) =>
  panel(page).locator(`[data-testid="${TID.inspField}"][data-key="${key}"]`);

/** The breadcrumb's 図全体, which goes back to the whole diagram. */
export const backToRoot = (page: Page) => page.getByTestId(TID.inspCrumbRoot).click();

export const closeSelection = (page: Page) => page.getByTestId(TID.inspClose).click();

/** Picks an option of a Segmented control by value (`${testID}-${value}`). */
export const segment = (page: Page, testID: string, value: string) =>
  page.getByTestId(`${testID}-${value}`).click();

/** Back to 図全体, when something is selected. */
export const toRoot = async (page: Page): Promise<void> => {
  const close = page.getByTestId(TID.inspClose);
  if (await close.isVisible()) await close.click();
  await expect(close).toBeHidden();
};

/** What the breadcrumb names (insp.crumb.*), or undefined at 図全体. */
export const crumb = (page: Page) => panel(page).locator('[data-crumb]');

/** Selects an object by its id from 図全体's 要素 list (the old Edit card's list). */
export const pickObject = async (page: Page, id: string): Promise<void> => {
  await toRoot(page);
  await page.getByTestId(TID.inspObjectSelect).selectOption(id);
  await expect(page.getByTestId(TID.inspClose)).toBeVisible();
};

/** Selects an arrow by its position from 図全体's 矢印 list. */
export const pickEdge = async (page: Page, index: number): Promise<void> => {
  await toRoot(page);
  await page.getByTestId(TID.inspEdgeSelect).selectOption(String(index));
  await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.edge');
};

/** Types a new name into the 名前 (or ラベル) field and applies it with Enter. */
export const renameTo = async (page: Page, testID: string, name: string): Promise<void> => {
  const input = page.getByTestId(testID);
  await input.click();
  await input.fill(name);
  await input.press('Enter');
};
