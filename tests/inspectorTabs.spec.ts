import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { selectByText } from './helpers/canvas';
import {
  activeTab,
  closeLook,
  crumb,
  expectAtRoot,
  expectSelected,
  openLook,
  openTab,
  panel,
  pickItem,
  pickObject,
  tab
} from './helpers/inspector';
import { expect, t, test } from './test';

// The inspector's first row, the target switcher (図全体 / 図形 / 矢印 / …, per diagram
// type), the lists its tabs open, the 見た目 row with its popover, and the connection rows
// that select a neighbour or an arrow (inspectorTabs.ts, Inspector.svelte, LookRow.svelte,
// NodeSection.svelte).
const flow = `flowchart LR
  A[Order] -->|yes| B[Check]
  B --> C[Pick]
  subgraph S [Stock]
    C
  end`;
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const stored = async (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));
const config = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(
        (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { mermaid?: string }).mermaid ??
          '{}'
      ) as { theme?: string; themeCSS?: string }
  );
const tabLabels = (page: Page) => panel(page).getByTestId(TID.inspTab).allTextContents();

test.describe('Inspector tabs', () => {
  test('offers the kinds of each diagram type, 図全体 first', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    expect(await tabLabels(page)).toEqual(
      ['ws.inspectorRoot', 'insp.tab.node', 'insp.tab.group', 'insp.tab.edge'].map((key) =>
        t(key as 'insp.tab.node')
      )
    );
    await expectAtRoot(page);

    await editPage.start(urlFor('swimlane-beta LR\n  subgraph Sales\n    A[Order]\n  end'));
    await editPage.checkTextInView('Order');
    expect(await tabLabels(page)).toEqual(
      ['ws.inspectorRoot', 'insp.tab.node', 'insp.tab.lane', 'insp.tab.edge'].map((key) =>
        t(key as 'insp.tab.node')
      )
    );

    await editPage.start(urlFor('sequenceDiagram\n  A->>B: hi'));
    await editPage.checkTextInView('hi');
    expect(await tabLabels(page)).toEqual(
      ['ws.inspectorRoot', 'insp.tab.participant', 'insp.tab.message'].map((key) =>
        t(key as 'insp.tab.node')
      )
    );

    // A gantt's 区分 only with a section.
    await editPage.start(urlFor('gantt\n  dateFormat YYYY-MM-DD\n  Spec : 2024-01-01, 3d'));
    await editPage.checkTextInView('Spec');
    expect(await tabLabels(page)).toEqual(
      ['ws.inspectorRoot', 'insp.tab.task'].map((key) => t(key as 'insp.tab.node'))
    );
    await editPage.start(
      urlFor('gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec : 2024-01-01, 3d')
    );
    await editPage.checkTextInView('Spec');
    expect(await tabLabels(page)).toEqual(
      ['ws.inspectorRoot', 'insp.tab.task', 'insp.tab.section'].map((key) =>
        t(key as 'insp.tab.node')
      )
    );

    await editPage.start(urlFor('pie\n  "Dogs" : 3\n  "Cats" : 2'));
    await editPage.checkTextInView('Dogs');
    expect(await tabLabels(page)).toEqual(
      ['ws.inspectorRoot', 'insp.tab.item'].map((key) => t(key as 'insp.tab.node'))
    );
    // Only the tabs: the old 要素 / 矢印 selects are gone from 図全体.
    await expect(page.getByTestId(TID.inspPicker)).toHaveCount(0);
  });

  test('a tab lists its items, a click selects one, and 図全体 clears', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await openTab(page, 'object');
    // The shapes, not the subgraph.
    await expect(page.getByTestId(TID.inspPickItem)).toHaveCount(3);
    await expect(pickItem(page, 'S')).toHaveCount(0);
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'object');
    await pickItem(page, 'B').click();
    await expect(page.getByTestId(TID.inspPicker)).toHaveCount(0);
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Check');
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.node');
    await expect(page.getByTestId(TID.selectionOutline)).toBeVisible();

    // The group tab lists the subgraph, with the lane's rows.
    await openTab(page, 'group');
    await expect(page.getByTestId(TID.inspPickItem)).toHaveCount(1);
    await pickItem(page, 'S').click();
    await expect(page.getByTestId(TID.inspLaneCount)).toHaveText(
      t('insp.laneCount', { count: '1' })
    );
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'group');

    // The arrows, by their titles.
    await openTab(page, 'edge');
    await expect(page.getByTestId(TID.inspPickItem)).toHaveCount(2);
    await page.locator(`[data-testid="${TID.inspPickItem}"][data-index="1"]`).click();
    await expect(page.getByTestId(TID.inspEdgeEnds)).toContainText('Pick');
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'edge');

    // 図全体 clears the selection, as Esc does.
    await tab(page, 'all').click();
    await expectAtRoot(page);
    await expect(page.getByTestId(TID.selectionOutline)).toBeHidden();
    await expect(page.getByTestId(TID.inspTip)).toBeVisible();
    await selectByText(page, 'Order');
    await expectSelected(page);
    await page.keyboard.press('Escape');
    await expectAtRoot(page);
  });

  test('the tab of what is clicked in the diagram is active, and the tabs work from the keyboard', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await selectByText(page, 'Order');
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'object');
    await expect(activeTab(page)).toHaveText(t('insp.tab.node'));
    // A list opened over the selection, then the selection's rows again through its item.
    await openTab(page, 'edge');
    await page.locator(`[data-testid="${TID.inspPickItem}"][data-index="0"]`).click();
    await expect(page.getByTestId(TID.inspEdgeLabel)).toHaveValue('yes');

    // ← → move along the tabs and open the one reached; back at 図全体 the selection goes.
    await selectByText(page, 'Order');
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'object');
    await activeTab(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId(TID.inspPicker)).toHaveAttribute('data-tab', 'group');
    await expect(activeTab(page)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expectAtRoot(page);
    await expect(page.getByTestId(TID.selectionOutline)).toBeHidden();
  });
});

test.describe('Inspector 見た目 row', () => {
  test('names the theme, and 変更… opens the controls, which persist', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await expect(page.getByTestId(TID.inspLookName)).toHaveText(t('themePreset.standard'));
    // The theme controls are not in the panel until asked for.
    await expect(page.getByTestId(TID.inspThemePreset)).toHaveCount(0);
    await expect(page.getByTestId(TID.inspFont)).toHaveCount(0);
    await expect(page.getByTestId(TID.roughToggle)).toHaveCount(0);

    await openLook(page);
    await expect(page.getByTestId(TID.inspThemePreset).locator('button')).toHaveCount(12);
    await expect(page.getByTestId(TID.inspBuiltinTheme)).toBeVisible();
    await expect(page.getByTestId(TID.inspFont)).toBeVisible();
    await expect(page.getByTestId(TID.roughToggle)).toBeVisible();
    await expect(page.getByTestId(`${TID.inspLineColor}-none`)).toBeVisible();
    await page.getByTestId(`${TID.inspThemePreset}-neon`).click();
    await expect
      .poll(async () => (await config(page)).themeCSS ?? '')
      .toContain('theme-preset: neon');
    await closeLook(page);
    await expect(page.getByTestId(TID.inspLookName)).toHaveText(t('themePreset.neon'));

    // A built-in theme is named too.
    await openLook(page);
    await page.getByTestId(TID.inspBuiltinTheme).selectOption('forest');
    await expect.poll(async () => (await config(page)).theme).toBe('forest');
    await closeLook(page);
    await expect(page.getByTestId(TID.inspLookName)).toHaveText(t('colors.theme.forest'));

    // From the keyboard: Enter on 変更… opens it, Escape closes it and returns there.
    await page.getByTestId(TID.lookPopover).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId(TID.inspLookContent)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.inspLookContent)).toBeHidden();
    await expect(page.getByTestId(TID.lookPopover)).toBeFocused();

    // And it persists over a reload.
    await page.reload();
    await editPage.checkTextInView('Pick');
    await expect(page.getByTestId(TID.inspLookName)).toHaveText(t('colors.theme.forest'));
  });

  test('the row stays one line and the rows for working come first', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    const look = page.getByTestId(TID.lookPopover);
    const direction = page.getByTestId(TID.inspDirection);
    const [lookBox, directionBox] = await Promise.all([
      look.boundingBox(),
      direction.boundingBox()
    ]);
    if (!lookBox || !directionBox) throw new Error('rows missing');
    // 向き is right under 見た目: nothing else sits between them.
    expect(directionBox.y - (lookBox.y + lookBox.height)).toBeLessThan(24);
    // The name is on the same line as the button.
    const name = await page.getByTestId(TID.inspLookName).boundingBox();
    expect(
      Math.abs((name?.y ?? 0) + (name?.height ?? 0) / 2 - (lookBox.y + lookBox.height / 2))
    ).toBeLessThan(4);
  });
});

test.describe('Inspector connection rows', () => {
  test('the name selects the neighbour, the glyph or label the arrow', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await pickObject(page, 'B');
    const rows = page.getByTestId(TID.inspLinks).getByTestId(TID.inspLink);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Order');
    await expect(rows.nth(0)).toContainText('yes');
    await expect(rows.nth(1)).toContainText('Pick');
    // Every part is a button with a title.
    for (const button of await rows.locator('button').all()) {
      await expect(button).toHaveAttribute('title', /.+/);
      expect(await button.evaluate((element) => getComputedStyle(element).cursor)).toBe('pointer');
    }

    // The neighbour's name: that node.
    await rows.nth(1).getByTestId(TID.inspLinkNode).click();
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Pick');
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'object');

    // The label: that arrow.
    await pickObject(page, 'B');
    await rows.nth(0).getByTestId(TID.inspLinkEdge).last().click();
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.edge');
    await expect(page.getByTestId(TID.inspEdgeLabel)).toHaveValue('yes');

    // The glyph, from the keyboard (Space: Enter on a selection is ＋次): that arrow.
    await pickObject(page, 'B');
    await rows.nth(1).getByTestId(TID.inspLinkEdge).first().focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId(TID.inspEdgeEnds)).toContainText('Pick');
  });
});

test.describe('Inspector tabs while the code is broken', () => {
  test('the tabs and lists still work, the edits refuse, 見た目 stays usable', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await editPage.typeInEditor('\n  X -->');
    await expect(page.getByTestId(TID.inspBlocked)).toBeVisible({ timeout: 10_000 });
    // The lists come from the last valid code.
    await openTab(page, 'object');
    await expect(page.getByTestId(TID.inspPickItem)).toHaveCount(3);
    await pickItem(page, 'B').click();
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Check');
    await expect(page.getByTestId(TID.inspName)).toBeDisabled();
    await expect(page.getByTestId(TID.inspDelete)).toBeDisabled();
    const before = await stored(page);
    // The arrow list still works; the arrow's rows refuse too.
    await openTab(page, 'edge');
    await page.locator(`[data-testid="${TID.inspPickItem}"][data-index="0"]`).click();
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.edge');
    await expect(page.getByTestId(TID.inspEdgeReverse)).toBeDisabled();
    await tab(page, 'all').click();
    await expectAtRoot(page);
    expect(await stored(page)).toBe(before);
    // 見た目 is config: it applies while the code is broken.
    await openLook(page);
    await page.getByTestId(`${TID.inspThemePreset}-neon`).click();
    await expect
      .poll(async () => (await config(page)).themeCSS ?? '')
      .toContain('theme-preset: neon');
  });
});
