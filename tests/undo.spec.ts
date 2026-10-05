import { TID } from '$/constants';
import { expect, test } from './test';

const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order]
  end
  subgraph Shop
    C[Accept order]
  end
  A --> C`;
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const stored = async (page: import('@playwright/test').Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));

test.describe('Undo / redo', () => {
  test('takes back what the Add card wrote, then puts it back', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    const undo = page.getByTestId(TID.undoButton);
    const redo = page.getByTestId(TID.redoButton);
    // The loaded diagram is the starting point, not a step back to what was there before.
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();

    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(TID.addLaneName).fill('Delivery');
    await page.getByTestId(TID.addLaneButton).click();
    await expect.poll(() => stored(page)).toContain('subgraph Lane1 ["Delivery"]');
    await editPage.checkTextInView('Delivery');
    await expect(undo).toBeEnabled();
    await expect(redo).toBeDisabled();

    await undo.click();
    await expect.poll(() => stored(page)).toBe(lanes);
    await editPage.checkTextNotInView('Delivery');
    await expect(undo).toBeDisabled();
    await expect(redo).toBeEnabled();

    await redo.click();
    await expect.poll(() => stored(page)).toContain('subgraph Lane1 ["Delivery"]');
    await editPage.checkTextInView('Delivery');
    await expect(undo).toBeEnabled();
    await expect(redo).toBeDisabled();
  });

  test('typing settles into one step and a new change drops the redo', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  A --> B'));
    await editPage.checkTextInView('B');
    const undo = page.getByTestId(TID.undoButton);
    const redo = page.getByTestId(TID.redoButton);

    await editPage.typeInEditor('\n  B --> C');
    await editPage.checkTextInView('C');
    await undo.click();
    await expect.poll(() => stored(page)).toBe('flowchart TD\n  A --> B');
    await expect(redo).toBeEnabled();

    await editPage.typeInEditor('\n  B --> D');
    await editPage.checkTextInView('D');
    await expect(redo).toBeDisabled();
    await expect(undo).toBeEnabled();
  });
});
