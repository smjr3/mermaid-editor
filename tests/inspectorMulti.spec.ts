import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { nodeByText } from './helpers/canvas';
import { activeTab, expectAtRoot, openTab, panel, pickItem, tab } from './helpers/inspector';
import { expect, t, test } from './test';

// The inspector for several selected items (MultiSection.svelte, SelectSameRow.svelte,
// TargetPicker.svelte): the count row, the value rows from the command registry with
// 「まちまち」 where the items differ, one undo step for all, 「同じものを選ぶ」 from one item,
// Ctrl+click and 「すべて選ぶ」 in a tab's list, and the refusal while the code is broken.
const flow = 'flowchart TD\n  A[Start] --> B[Middle]\n  B --> C[End]\n  B --> D{Pick}';
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

const code = (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code: string }).code
    )
    .then((text) => text.replaceAll('\r\n', '\n'));
const node = (page: Page, text: string) => page.locator('#view .node', { hasText: text }).first();
const outlines = (page: Page) => page.getByTestId(TID.selectionOutline);
const count = (page: Page) => page.getByTestId(TID.inspMultiCount);
const row = (page: Page, key: string) =>
  panel(page).locator(`[data-testid="${TID.inspMultiRow}"][data-key="${key}"]`);
const control = (page: Page, key: string, value?: string) =>
  page.getByTestId(
    value ? `${TID.inspMultiControl}-${key}-${value}` : `${TID.inspMultiControl}-${key}`
  );
const same = (page: Page, value: string) =>
  panel(page).locator(`[data-testid="${TID.inspSelectSame}"][data-value="${value}"]`);
/** A Ctrl+click on the empty canvas: focus goes to the diagram, the selection stays. */
const focusCanvas = async (page: Page) => {
  const view = await page.locator('#view').boundingBox();
  if (!view) throw new Error('view missing');
  await page.keyboard.down('Control');
  await page.mouse.click(view.x + 20, view.y + view.height - 20);
  await page.keyboard.up('Control');
};
const selectTwo = async (page: Page, first: string, second: string) => {
  await node(page, first).click();
  await node(page, second).click({ modifiers: ['Control'] });
  await expect(outlines(page)).toHaveCount(2);
  await expect(count(page)).toHaveAttribute('data-count', '2');
};

test.describe('Inspector: several items', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test.beforeEach(async ({ editPage }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
  });

  test('Ctrl+click on two nodes shows the count and the rows for both; ✕ clears', async ({
    page
  }) => {
    await selectTwo(page, 'Start', 'End');
    await expect(count(page)).toHaveText(t('sel.cmd.count', { count: '2' }));
    // Both are nodes: the 図形 tab heads the panel.
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'object');
    // No single-object rows.
    await expect(page.getByTestId(TID.inspName)).toHaveCount(0);
    await expect(page.getByTestId(TID.inspId)).toHaveCount(0);
    await expect(page.getByTestId(TID.inspIcon)).toHaveCount(0);
    // The value rows, in registry order: colours, shape, text, lane.
    const keys = await panel(page)
      .getByTestId(TID.inspMultiRow)
      .evaluateAll((rows) => rows.map((element) => element.getAttribute('data-key')));
    expect(keys).toEqual(['fillColor', 'strokeColor', 'textColor', 'shape', 'textSize', 'bold']);
    await expect(page.getByTestId(TID.inspSelectSameRow)).toBeVisible();
    await expect(page.getByTestId(TID.inspMultiDelete)).toBeVisible();

    await page.getByTestId(TID.inspMultiClear).click();
    await expect(outlines(page)).toHaveCount(0);
    await expectAtRoot(page);
  });

  test('a 塗り swatch colours both, and one Ctrl+Z takes both back', async ({ page }) => {
    await selectTwo(page, 'Start', 'End');
    // Neither has a colour: the theme's button is pressed, no 「まちまち」.
    await expect(control(page, 'fillColor', 'none')).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, 'fillColor').getByTestId(TID.inspMultiMixed)).toHaveCount(0);
    await control(page, 'fillColor', 'green').click();
    await expect.poll(() => code(page)).toContain('style A fill:#def5e1,stroke:#3f9b52');
    expect(await code(page)).toContain('style C fill:#def5e1,stroke:#3f9b52');
    expect((await code(page)).match(/^\s*style /gm)).toHaveLength(2);
    await expect(control(page, 'fillColor', 'green')).toHaveAttribute('aria-pressed', 'true');
    // The selection stays on both.
    await expect(count(page)).toHaveAttribute('data-count', '2');

    // One undo step for the two lines.
    await focusCanvas(page);
    await expect(outlines(page)).toHaveCount(2);
    await page.keyboard.press('Control+z');
    await expect.poll(() => code(page)).toBe(flow);
    await expect(control(page, 'fillColor', 'none')).toHaveAttribute('aria-pressed', 'true');

    // A third with another colour: 「まちまち」 shows up as the first, disabled-looking state.
    await control(page, 'fillColor', 'blue').click();
    await expect.poll(() => code(page)).toContain('style A fill:#dde9fb');
    await nodeByText(page, 'Middle').click({ modifiers: ['Control'] });
    await expect(count(page)).toHaveAttribute('data-count', '3');
    await expect(control(page, 'fillColor', 'blue')).toHaveAttribute('aria-pressed', 'false');
    await expect(control(page, 'fillColor', 'none')).toHaveAttribute('aria-pressed', 'false');
  });

  test('mixed shapes say まちまち; a shape chosen applies to both', async ({ page }) => {
    await selectTwo(page, 'Start', 'Pick');
    const shape = control(page, 'shape');
    await expect(shape).toHaveValue('mixed');
    const first = shape.locator('option').first();
    await expect(first).toHaveText(t('sel.cmd.mixed'));
    await expect(first).toBeDisabled();
    await shape.selectOption('stadium');
    await expect.poll(() => code(page)).toContain('A([Start])');
    expect(await code(page)).toContain('D([Pick])');
    await expect(shape).toHaveValue('stadium');
    await expect(shape.locator('option[value="mixed"]')).toHaveCount(0);
    // Both still selected; one Ctrl+Z reverts both.
    await expect(count(page)).toHaveAttribute('data-count', '2');
    await focusCanvas(page);
    await page.keyboard.press('Control+z');
    await expect.poll(() => code(page)).toBe(flow);
  });

  test('two arrows from the 矢印 list (Ctrl+click) take 線の種類 点線 together', async ({
    page
  }) => {
    await openTab(page, 'edge');
    const item = (index: number) =>
      page.locator(`[data-testid="${TID.inspPickItem}"][data-index="${index}"]`);
    await item(0).click({ modifiers: ['Control'] });
    // The list stays open; the item is pressed.
    await expect(page.getByTestId(TID.inspPicker)).toHaveAttribute('data-tab', 'edge');
    await expect(item(0)).toHaveAttribute('aria-pressed', 'true');
    await item(1).click({ modifiers: ['Control'] });
    await expect(item(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(outlines(page)).toHaveCount(2);
    // A Ctrl+click on a pressed item takes it out again.
    await item(1).click({ modifiers: ['Control'] });
    await expect(item(1)).toHaveAttribute('aria-pressed', 'false');
    await item(1).click({ modifiers: ['Control'] });
    // The tab closes its list: the rows for both arrows.
    await tab(page, 'edge').click();
    await expect(page.getByTestId(TID.inspPicker)).toHaveCount(0);
    await expect(count(page)).toHaveAttribute('data-count', '2');
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'edge');
    await expect(control(page, 'lineStyle', 'solid')).toHaveAttribute('aria-pressed', 'true');
    await control(page, 'lineStyle', 'dotted').click();
    await expect.poll(() => code(page)).toContain('A[Start] -.-> B[Middle]');
    expect(await code(page)).toContain('B -.-> C[End]');
    expect(await code(page)).toContain('B --> D{Pick}');
    await expect(control(page, 'lineStyle', 'dotted')).toHaveAttribute('aria-pressed', 'true');

    // A node joins the two arrows: a mixed selection, 「選択」 beside 図全体; the arrow rows
    // stay (線の種類 for the arrows, 枠 for both kinds), the node-only ones do not.
    await nodeByText(page, 'Pick').click({ modifiers: ['Control'] });
    await expect(count(page)).toHaveAttribute('data-count', '3');
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'selection');
    await expect(tab(page, 'selection')).toHaveText(t('insp.tab.selection'));
    await expect(row(page, 'lineStyle')).toHaveCount(1);
    await expect(row(page, 'strokeColor')).toHaveCount(1);
    await expect(row(page, 'shape')).toHaveCount(1);
    await expect(control(page, 'lineStyle', 'dotted')).toHaveAttribute('aria-pressed', 'true');
  });

  test('同じ形 from one node selects every node of that shape', async ({ page }) => {
    await node(page, 'Start').click();
    await expect(outlines(page)).toHaveCount(1);
    await expect(page.getByTestId(TID.inspSelectSameRow)).toBeVisible();
    await same(page, 'shape').click();
    // Start, Middle and End are rectangles; Pick is a diamond.
    await expect(outlines(page)).toHaveCount(3);
    await expect(count(page)).toHaveAttribute('data-count', '3');
    await expect(count(page)).toHaveText(t('sel.cmd.count', { count: '3' }));
    // The shared shape, no 「まちまち」.
    await expect(control(page, 'shape')).toHaveValue('rect');

    // From the multi view: 矢印すべて.
    await same(page, 'edges').click();
    await expect(count(page)).toHaveAttribute('data-count', '3');
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'edge');

    // From an arrow's rows too: ここから先 is not offered for an arrow, 矢印すべて is.
    await page.getByTestId(TID.inspMultiClear).click();
    await node(page, 'Middle').click();
    await expect(same(page, 'downstream')).toBeVisible();
    await same(page, 'downstream').click();
    // Middle, its two arrows, End and Pick.
    await expect(count(page)).toHaveAttribute('data-count', '5');
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'selection');
  });

  test('「すべて選ぶ」 in a tab’s list selects everything it lists', async ({ page }) => {
    await openTab(page, 'object');
    await expect(pickItem(page, 'A')).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId(TID.inspPickAll).click();
    await expect(page.getByTestId(TID.inspPicker)).toHaveCount(0);
    await expect(count(page)).toHaveAttribute('data-count', '4');
    await expect(outlines(page)).toHaveCount(4);
    await expect(activeTab(page)).toHaveAttribute('data-tab', 'object');
    // The list shows them all pressed.
    await tab(page, 'object').click();
    await expect(pickItem(page, 'A')).toHaveAttribute('aria-pressed', 'true');
    await expect(pickItem(page, 'D')).toHaveAttribute('aria-pressed', 'true');
    // A plain click on one selects it alone, as before.
    await pickItem(page, 'B').click();
    await expect(outlines(page)).toHaveCount(1);
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Middle');
  });

  test('deletes them all in one step', async ({ editPage, page }) => {
    await selectTwo(page, 'End', 'Pick');
    await page.getByTestId(TID.inspMultiDelete).click();
    await expect.poll(() => code(page)).toBe('flowchart TD\n  A[Start] --> B[Middle]');
    await editPage.checkTextNotInView('End');
    await expect(outlines(page)).toHaveCount(0);
    await focusCanvas(page);
    await page.keyboard.press('Control+z');
    await expect.poll(() => code(page)).toBe(flow);
  });

  test('while the code is broken the rows refuse; the count and 同じものを選ぶ still work', async ({
    editPage,
    page
  }) => {
    await selectTwo(page, 'Start', 'End');
    await editPage.typeInEditor('\n  X -->');
    await expect(page.getByTestId(TID.inspBlocked)).toBeVisible({ timeout: 10_000 });
    const broken = await code(page);
    expect(broken).toContain('X -->');
    await expect(count(page)).toHaveAttribute('data-count', '2');
    await expect(control(page, 'fillColor', 'green')).toBeDisabled();
    await expect(control(page, 'shape')).toBeDisabled();
    await expect(page.getByTestId(TID.inspMultiDelete)).toBeDisabled();
    // The lists are the last valid code's: 同じ形 still selects.
    await same(page, 'shape').click();
    await expect(count(page)).toHaveAttribute('data-count', '3');
    expect(await code(page)).toBe(broken);
  });
});
