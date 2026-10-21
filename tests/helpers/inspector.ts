import { TID } from '$/constants';
import { expect, type Page } from '@playwright/test';

/** The inspector (right column): 図全体, or the selected object's rows (W3). */

export const panel = (page: Page) => page.getByTestId(TID.inspPanel);

/** A generic field row by its `data-key`. */
export const field = (page: Page, key: string) =>
  panel(page).locator(`[data-testid="${TID.inspField}"][data-key="${key}"]`);

/** One tab of the target switcher over the panel (図全体 / 図形 / 矢印 / …), by its id. */
export const tab = (page: Page, id: string) =>
  panel(page).locator(`[data-testid="${TID.inspTab}"][data-tab="${id}"]`);

/** The active tab: 図全体 with nothing selected, else the selection's kind. */
export const activeTab = (page: Page) =>
  panel(page).locator(`[data-testid="${TID.inspTab}"][aria-selected="true"]`);

/** Asserts that something is selected: a tab other than 図全体 is active. */
export const expectSelected = (page: Page) =>
  expect(activeTab(page)).not.toHaveAttribute('data-tab', 'all');

/** Asserts that nothing is selected: 図全体 is active. */
export const expectAtRoot = (page: Page) =>
  expect(activeTab(page)).toHaveAttribute('data-tab', 'all');

/** The 図全体 tab, which clears the selection and goes back to the whole diagram. */
export const backToRoot = (page: Page) => tab(page, 'all').click();

export const closeSelection = backToRoot;

/** Picks an option of a Segmented control by value (`${testID}-${value}`). */
export const segment = (page: Page, testID: string, value: string) =>
  page.getByTestId(`${testID}-${value}`).click();

/** Back to 図全体, when something is selected or a tab's list is open. */
export const toRoot = async (page: Page): Promise<void> => {
  await backToRoot(page);
  await expectAtRoot(page);
  await expect(page.getByTestId(TID.inspPicker)).toHaveCount(0);
};

/** What the breadcrumb names (insp.crumb.*), or undefined at 図全体. */
export const crumb = (page: Page) => panel(page).locator('[data-crumb]');

/** An item of the list a tab opens, by the object's id. */
export const pickItem = (page: Page, id: string) =>
  page.locator(`[data-testid="${TID.inspPickItem}"][data-id="${id}"]`);

/** Opens a tab's list and asserts it is shown. */
export const openTab = async (page: Page, id: string): Promise<void> => {
  await tab(page, id).click();
  await expect(page.getByTestId(TID.inspPicker)).toHaveAttribute('data-tab', id);
};

/**
 * Selects an object by its id from the tabs over the panel: opens each object tab in
 * turn until one lists it, then clicks it.
 */
export const pickObject = async (page: Page, id: string): Promise<void> => {
  await toRoot(page);
  const tabs = panel(page).locator(
    `[data-testid="${TID.inspTab}"]:not([data-tab="all"]):not([data-tab="edge"])`
  );
  const ids = await tabs.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-tab') ?? '')
  );
  for (const tabId of ids) {
    await openTab(page, tabId);
    const item = pickItem(page, id);
    if ((await item.count()) > 0) {
      await item.click();
      await expectSelected(page);
      return;
    }
  }
  throw new Error(`no tab lists "${id}" (tabs: ${ids.join(', ')})`);
};

/** Selects an arrow by its position from the 矢印 tab's list. */
export const pickEdge = async (page: Page, index: number): Promise<void> => {
  await toRoot(page);
  await openTab(page, 'edge');
  await page.locator(`[data-testid="${TID.inspPickItem}"][data-index="${index}"]`).click();
  await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.edge');
};

/** Opens 図全体's 見た目 popover (the theme cards, the built-in theme, font, hand-drawn, line colour). */
export const openLook = async (page: Page): Promise<void> => {
  const content = page.getByTestId(TID.inspLookContent);
  if (await content.isVisible()) return;
  await page.getByTestId(TID.lookPopover).click();
  await expect(content).toBeVisible();
};

/** Closes the 見た目 popover with Escape. */
export const closeLook = async (page: Page): Promise<void> => {
  const content = page.getByTestId(TID.inspLookContent);
  if (!(await content.isVisible())) return;
  await page.keyboard.press('Escape');
  await expect(content).toBeHidden();
};

/** Types a new name into the 名前 (or ラベル) field and applies it with Enter. */
export const renameTo = async (page: Page, testID: string, name: string): Promise<void> => {
  const input = page.getByTestId(testID);
  await input.click();
  await input.fill(name);
  await input.press('Enter');
};
