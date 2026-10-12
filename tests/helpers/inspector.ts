import { TID } from '$/constants';
import type { Page } from '@playwright/test';

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
