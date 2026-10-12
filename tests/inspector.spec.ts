import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { nodeByText, selectByText } from './helpers/canvas';
import { backToRoot, closeSelection, crumb, panel, pickObject } from './helpers/inspector';
import { expect, t, test } from './test';

// The inspector itself: 図全体 and the breadcrumb, the node / arrow / lane / task views,
// the inline rename that the 名前 field takes over, the blocked state, the focus requests
// of the right-click menu, and folding the column.
const flow = `swimlane-beta LR
  subgraph Sales
    A[Order] --> B[Check]
  end
  subgraph Stock
    C[Pick]
  end
  B --> C`;
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const stored = async (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));

test.describe('Inspector', () => {
  test('shows 図全体, then the breadcrumb of what is selected, and goes back', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await expect(page.getByTestId(TID.inspCrumbRoot)).toHaveText(t('ws.inspectorRoot'));
    await expect(page.getByTestId(TID.inspTip)).toHaveText(t('insp.tip'));
    await expect(page.getByTestId(TID.inspClose)).toHaveCount(0);

    await selectByText(page, 'Check');
    await expect(crumb(page)).toHaveText(t('insp.crumb.node'));
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Check');
    await closeSelection(page);
    await expect(page.getByTestId(TID.selectionOutline)).toBeHidden();
    await expect(page.getByTestId(TID.inspTip)).toBeVisible();

    // A lane.
    await pickObject(page, 'Stock');
    await expect(crumb(page)).toHaveText(t('insp.crumb.lane'));
    await expect(page.getByTestId(TID.inspLaneCount)).toHaveText(
      t('insp.laneCount', { count: '1' })
    );
    // The breadcrumb's 図全体 goes back too.
    await backToRoot(page);
    await expect(page.getByTestId(TID.inspClose)).toHaveCount(0);

    // An arrow, from the node's list of connections.
    await pickObject(page, 'B');
    await page.getByTestId(TID.inspLink).filter({ hasText: 'Pick' }).click();
    await expect(crumb(page)).toHaveText(t('insp.crumb.edge'));
    await expect(page.getByTestId(TID.inspEdgeEnds)).toContainText('Check');
    await expect(page.getByTestId(TID.inspEdgeEnds)).toContainText('Pick');
  });

  test('shows a gantt task with its own rows', async ({ editPage, page }) => {
    await editPage.start(
      urlFor('gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec : a1, 2024-01-01, 3d')
    );
    await editPage.checkTextInView('Spec');
    await expect(page.getByTestId(TID.inspTip)).toHaveText(t('insp.tipGantt'));
    await pickObject(page, 'L3');
    await expect(crumb(page)).toHaveText(t('insp.crumb.task'));
    for (const key of ['start', 'after', 'days', 'status', 'crit', 'milestone']) {
      await expect(
        panel(page).locator(`[data-testid="${TID.inspField}"][data-key="${key}"]`)
      ).toBeVisible();
    }
  });

  test('renames in the 名前 field on a double click, and applies it on Enter', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await nodeByText(page, 'Order').dblclick();
    const name = page.getByTestId(TID.inspName);
    await expect(name).toBeFocused();
    // The old name is selected, so typing replaces it.
    await page.keyboard.type('受注');
    await expect(name).toHaveValue('受注');
    await page.keyboard.press('Enter');
    await expect.poll(() => stored(page)).toContain('A["受注"] --> B[Check]');
    await editPage.checkTextInView('受注');
  });

  test('F2 opens the rename, Escape drops it, a click on the diagram applies it', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await selectByText(page, 'Pick');
    await page.keyboard.press('F2');
    const name = page.getByTestId(TID.inspName);
    await expect(name).toBeFocused();
    await page.keyboard.type('捨てる名前');
    await page.keyboard.press('Escape');
    await expect(name).toHaveValue('Pick');
    expect(await stored(page)).toBe(flow);

    await page.keyboard.press('F2');
    await expect(name).toBeFocused();
    await page.keyboard.type('出庫');
    // A click elsewhere in the diagram applies what was typed to the node it was for.
    await nodeByText(page, 'Order').click();
    await expect.poll(() => stored(page)).toContain('C["出庫"]');
  });

  test('＋次 adds a node after the selection and opens its rename', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await pickObject(page, 'C');
    await page.getByTestId(TID.inspAddNext).click();
    const name = page.getByTestId(TID.inspName);
    await expect(name).toBeFocused();
    await expect(name).toHaveValue(t('sel.newNode'));
    await page.keyboard.type('出荷');
    await page.keyboard.press('Enter');
    await expect.poll(() => stored(page)).toContain('"出荷"');
    expect(await stored(page)).toMatch(/C --> n\d/);
    await editPage.checkTextInView('出荷');
  });

  test('＋追加 in a lane adds a node inside it', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await pickObject(page, 'Stock');
    await page.getByTestId(TID.inspLaneAdd).click();
    await expect(page.getByTestId(TID.inspName)).toBeFocused();
    await page.keyboard.type('梱包');
    await page.keyboard.press('Enter');
    await expect
      .poll(() => stored(page))
      .toMatch(/subgraph Stock\n {4}C\[Pick\]\n {4}n\d\["梱包"\]\n {2}end/);
  });

  test('矢印 joins the selection to the next node clicked', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await pickObject(page, 'A');
    await page.getByTestId(TID.inspConnect).click();
    await expect(page.getByTestId(TID.inspConnect)).toHaveAttribute('aria-pressed', 'true');
    await nodeByText(page, 'Pick').click();
    await expect.poll(() => stored(page)).toContain('A --> C');
  });

  test('stops editing while the code is broken, keeping the settings', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await pickObject(page, 'C');
    await editPage.typeInEditor('\n  X -->');
    const blocked = page.getByTestId(TID.inspBlocked);
    await expect(blocked).toBeVisible({ timeout: 10_000 });
    await expect(blocked).toContainText(t('insp.blocked'));
    await expect(page.getByTestId(TID.inspName)).toBeDisabled();
    await expect(page.getByTestId(TID.inspDelete)).toBeDisabled();
  });

  test('folds to its rail and comes back', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await page.getByTestId(TID.inspCollapse).click();
    await expect(page.getByTestId(TID.wsInspectorRail)).toBeVisible();
    await page.getByTestId(TID.wsInspectorExpand).click();
    await expect(page.getByTestId(TID.inspPanel)).toBeVisible();
  });

  test('the right-click menu’s 色を変える focuses the colour row', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await nodeByText(page, 'Pick').click({ button: 'right' });
    await page.getByTestId(`${TID.contextMenuItem}-color`).click();
    // Until the canvas stream's menu lands, its colour item opens a sub-menu instead.
    test.skip(
      await page.getByTestId(`${TID.contextMenuItem}-color-none`).isVisible(),
      'the right-click menu does not ask the inspector yet'
    );
    await expect(page.getByTestId(`${TID.inspColorTarget}-fill`)).toBeFocused();
  });
});
