import { TID } from '$/constants';
import { expect, type Page } from '@playwright/test';

/** The diagram column: selection, zoom, the add bar (W2). */

/** The rendered node (or other object) whose text is `text`. */
export const nodeByText = (page: Page, text: string) =>
  page.locator('#container svg').getByText(text, { exact: true }).first();

/**
 * Clicks an object in the diagram and waits for the selection outline. After an edit the
 * view keeps its pan and zoom, so an object just added to a diagram that grew (or a view
 * whose panes settled after it was drawn, as on a slow CI machine) can lie outside the
 * visible part of the view, where a click lands on the column around it. Such an object
 * is brought into sight with 全体 (fit) first, as a user would.
 */
export const selectByText = async (page: Page, text: string): Promise<void> => {
  const node = page.locator('#view .node', { hasText: text }).first();
  const target = (await node.count()) > 0 ? node : nodeByText(page, text);
  await expect(target).toBeVisible();
  const [box, view] = await Promise.all([
    target.boundingBox(),
    page.locator('#view').boundingBox()
  ]);
  const inside =
    box &&
    view &&
    box.x >= view.x &&
    box.y >= view.y &&
    box.x + box.width <= view.x + view.width &&
    box.y + box.height <= view.y + view.height;
  if (!inside) await page.getByTestId(TID.resetViewButton).click();
  await target.click();
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

const itemSelector = (key: string) =>
  `[data-testid="${TID.canvasInsertItem}"][data-insert="${key}"]`;

/** The add-bar items on the bar itself, by their `data-insert` keys, in order. */
export const barItems = (page: Page) =>
  insertBar(page)
    .getByTestId(TID.canvasInsertItem)
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-insert') ?? ''));

/**
 * Presses an add-bar item by its `data-insert` key: on the bar, or under その他▾ (opened
 * first) when the bar does not show it. An item with a form opens it in a popover.
 */
export const insert = async (page: Page, key: string): Promise<void> => {
  const onBar = insertBar(page).locator(itemSelector(key));
  if ((await onBar.count()) > 0) {
    await onBar.click();
    return;
  }
  const menu = page.getByTestId(TID.canvasInsertMenu);
  if (!(await menu.isVisible())) await insertBar(page).getByTestId(TID.canvasInsertMore).click();
  await menu.locator(itemSelector(key)).click();
};

/**
 * The open add form (one at a time). The popover of the form opened before fades out for a
 * moment, so only a form inside an open popover counts.
 */
export const addForm = (page: Page) =>
  page.locator(`[data-state="open"] [data-testid="${TID.canvasAddForm}"]`);

/** A field of the open add form by its `data-key`. */
export const formField = (page: Page, key: string) =>
  addForm(page).locator(`[data-testid="${TID.canvasAddFormField}"][data-key="${key}"]`);

export const submitForm = (page: Page) =>
  addForm(page).getByTestId(TID.canvasAddFormSubmit).click();

export const formMessage = (page: Page) => addForm(page).getByTestId(TID.canvasAddFormMessage);

export const closeForm = async (page: Page): Promise<void> => {
  await addForm(page).getByTestId(TID.canvasAddFormClose).click();
  await expect(addForm(page)).toBeHidden();
};

/** Opens an item's form: `insert`, then waits for the form it opens. */
export const openForm = async (page: Page, key: string): Promise<void> => {
  await insert(page, key);
  await expect(addForm(page)).toBeVisible();
};

/** 図 / 表 / 並べる over a table-shaped diagram. */
export const viewMode = (page: Page, mode: 'diagram' | 'table' | 'both') =>
  page.getByTestId(`${TID.canvasViewMode}-${mode}`).click();

/** An item of the right-click menu by its key (rename, color, shape, add-after, …). */
export const menuItem = (page: Page, key: string) =>
  page.getByTestId(TID.contextMenu).getByTestId(`${TID.contextMenuItem}-${key}`);

/** A submenu row of the right-click menu by its key (color, shape, lineStyle, selectSame, …). */
export const menuSub = (page: Page, key: string) =>
  page.getByTestId(TID.contextMenu).getByTestId(`${TID.contextMenuSub}-${key}`);

/** The open panel of a submenu. */
export const menuSubPanel = (page: Page, key: string) =>
  page.getByTestId(TID.contextMenu).getByTestId(`${TID.contextMenuSub}-${key}-panel`);

/** A choice inside a submenu by its command key and value (fillColor / blue, shape / circle, …). */
export const menuChoice = (page: Page, command: string, value: string) =>
  page.getByTestId(TID.contextMenu).getByTestId(`${TID.contextMenuChoice}-${command}-${value}`);

/** Opens a submenu of the right-click menu by hovering its row. */
export const openMenuSub = async (page: Page, key: string): Promise<void> => {
  await menuSub(page, key).hover();
  await expect(menuSubPanel(page, key)).toBeVisible();
};

export const zoomIn = (page: Page) => page.getByTestId(TID.zoomInButton).click();
export const zoomOut = (page: Page) => page.getByTestId(TID.zoomOutButton).click();
export const resetView = (page: Page) => page.getByTestId(TID.resetViewButton).click();
