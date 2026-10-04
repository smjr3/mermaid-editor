import { TID } from '$/constants';
import { expect, t, test } from './test';

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
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
  );

test.describe('Add card', () => {
  test('adds a lane, then a node in it joined from another node', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.addCard).click();

    await page.getByTestId(TID.addLaneName).fill('Delivery');
    await page.getByTestId(TID.addLaneButton).click();
    await expect.poll(() => stored(page)).toContain('subgraph Lane1 ["Delivery"]');
    await editPage.checkTextInView('Delivery');
    // The new lane is chosen for the next node.
    await expect(page.getByTestId(TID.addNodeLane)).toHaveValue('Lane1');

    await page.getByTestId(TID.addNodeName).fill('Pack');
    await page.getByTestId(TID.addNodeFrom).selectOption('C');
    await page.getByTestId(TID.addNodeName).press('Enter');
    await expect.poll(() => stored(page)).toContain('C --> n1');
    expect(await stored(page)).toContain('subgraph Lane1 ["Delivery"]\n    n1["Pack"]\n  end');
    await editPage.checkTextInView('Pack');
    await expect(page.getByTestId(TID.addMessage)).toHaveText(t('add.done', { name: 'Pack' }));
    // The next node follows the new one.
    await expect(page.getByTestId(TID.addNodeFrom)).toHaveValue('n1');
  });

  test('explains which diagrams it works for', async ({ editPage, page }) => {
    await editPage.start(urlFor('sequenceDiagram\n  A->>B: hi'));
    await editPage.checkTextInView('hi');
    await page.getByTestId(TID.addCard).click();
    await expect(page.getByText(t('add.unsupported'))).toBeVisible();
  });
});
