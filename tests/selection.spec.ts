import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { menuItem, resetView, zoomIn } from './helpers/canvas';
import { expect, t, test } from './test';

// "Click the diagram, then change it", the diagram's side: selecting objects and arrows
// in the drawing, the outline, the keys, the right-click menu, drawing an arrow from the
// selection, and the zoom controls. (What the inspector shows for the selection, and the
// rename field it holds, are the inspector's specs.)
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const flow = 'flowchart TD\n  A[Start] -->|yes| B[Middle]\n  B --> C[End]';

const code = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code: string }).code
  );
const node = (page: Page, text: string) => page.locator('#view .node', { hasText: text }).first();
/** A flowchart node by its id (`flowchart-n2-…`), for nodes that show the same text. */
const nodeById = (page: Page, id: string) => page.locator(`#view g.node[id*="-${id}-"]`).first();
const outline = (page: Page) => page.getByTestId(TID.selectionOutline);

test.describe('Selection', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test.beforeEach(async ({ editPage }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
  });

  test('a click selects an object and outlines it; Escape or the canvas clears', async ({
    page
  }) => {
    await expect(outline(page)).toBeHidden();
    await node(page, 'Middle').click();
    await expect(outline(page)).toHaveAttribute('data-selected', 'B');
    // The outline sits on the drawn node.
    const nodeBox = await node(page, 'Middle').boundingBox();
    const outlineBox = await outline(page).boundingBox();
    if (!nodeBox || !outlineBox) throw new Error('boxes missing');
    expect(Math.abs(nodeBox.x - outlineBox.x)).toBeLessThan(8);
    expect(Math.abs(nodeBox.width - outlineBox.width)).toBeLessThan(12);
    // No toolbar floats over the diagram any more.
    await expect(page.getByTestId('selection-toolbar')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(outline(page)).toBeHidden();

    // A click on the empty canvas clears too.
    await node(page, 'Start').click();
    await expect(outline(page)).toHaveAttribute('data-selected', 'A');
    const view = await page.locator('#view').boundingBox();
    if (!view) throw new Error('view missing');
    await page.mouse.click(view.x + 20, view.y + view.height - 20);
    await expect(outline(page)).toBeHidden();
  });

  test('Enter adds after the selection, Tab adds a branch, Delete deletes', async ({
    editPage,
    page
  }) => {
    await node(page, 'Middle').click();
    await page.keyboard.press('Enter');
    await expect(outline(page)).toHaveAttribute('data-selected', 'n1');
    await expect.poll(() => code(page)).toContain('B --> n1');
    expect(await code(page)).toContain(`n1["${t('sel.newNode')}"]`);
    await editPage.checkTextInView(t('sel.newNode'));

    // Tab: a second node from where the selected one comes from (B).
    await nodeById(page, 'n1').click();
    await expect(outline(page)).toHaveAttribute('data-selected', 'n1');
    await page.keyboard.press('Tab');
    await expect(outline(page)).toHaveAttribute('data-selected', 'n2');
    await expect.poll(() => code(page)).toContain('B --> n2');

    await nodeById(page, 'n2').click();
    await page.keyboard.press('Delete');
    await expect.poll(() => code(page)).not.toContain('n2');
    await expect(outline(page)).toBeHidden();

    // The arrow keys follow the arrows.
    await node(page, 'Start').click();
    await page.keyboard.press('ArrowDown');
    await expect(outline(page)).toHaveAttribute('data-selected', 'B');
    await page.keyboard.press('ArrowUp');
    await expect(outline(page)).toHaveAttribute('data-selected', 'A');

    // Ctrl+Z outside the fields is the diagram's undo.
    await page.keyboard.press('Control+z');
    await expect.poll(() => code(page)).toContain('n2');

    // Keys typed in the code editor are the editor's.
    await editPage.editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect.poll(() => code(page)).not.toContain('n3');
  });

  test('the right-click menu lists the registry’s commands, one line each, and deletes', async ({
    editPage,
    page
  }) => {
    await node(page, 'End').click({ button: 'right' });
    const menu = page.getByTestId(TID.contextMenu);
    await expect(menu).toBeVisible();
    await expect(outline(page)).toHaveAttribute('data-selected', 'C');
    const items = menu.getByRole('menuitem');
    // Actions are rows, choices are submenus (色 ▸ gathers the three colour commands);
    // 削除 is last.
    expect(
      await items.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-testid'))
      )
    ).toEqual([
      `${TID.contextMenuItem}-add-after`,
      `${TID.contextMenuItem}-addBranch`,
      `${TID.contextMenuItem}-connect`,
      `${TID.contextMenuItem}-rename`,
      `${TID.contextMenuSub}-color`,
      `${TID.contextMenuSub}-shape`,
      `${TID.contextMenuSub}-textSize`,
      `${TID.contextMenuItem}-bold`,
      `${TID.contextMenuSub}-selectSame`,
      `${TID.contextMenuItem}-delete`
    ]);
    await expect(items).toHaveText([
      `${t('insp.addNext')} Enter`,
      `${t('insp.addBranch')} Tab`,
      t('sel.connect'),
      `${t('canvas.menuRename')} F2`,
      `${t('sel.color')} ▸`,
      `${t('sel.shape')} ▸`,
      `${t('sel.size')} ▸`,
      t('sel.bold'),
      `${t('sel.cmd.selectSame')} ▸`,
      `${t('sel.delete')} Del`
    ]);
    // Each item is a single line.
    for (const box of await items.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height)
    )) {
      expect(box).toBeLessThan(36);
    }

    await menuItem(page, 'delete').click();
    await expect(menu).toBeHidden();
    await expect.poll(() => code(page)).not.toContain('End');
    await editPage.checkTextNotInView('End');

    const view = await page.locator('#view').boundingBox();
    if (!view) throw new Error('view missing');
    await page.mouse.click(view.x + 30, view.y + view.height - 30, { button: 'right' });
    await expect(menuItem(page, 'fit')).toBeVisible();
    await menuItem(page, 'add-node').click();
    await expect.poll(() => code(page)).toContain(`n1["${t('sel.newNode')}"]`);
    await expect(outline(page)).toHaveAttribute('data-selected', 'n1');
  });

  test('色 and 形 change the diagram in place; the inspector stays folded', async ({ page }) => {
    await page.getByTestId(TID.inspCollapse).click();
    await expect(page.getByTestId(TID.wsInspectorRail)).toBeVisible();
    await node(page, 'Start').click({ button: 'right' });
    await page.getByTestId(`${TID.contextMenuSub}-color`).hover();
    await page.getByTestId(`${TID.contextMenuChoice}-fillColor-blue`).click();
    await expect(page.getByTestId(TID.contextMenu)).toBeHidden();
    await expect.poll(() => code(page)).toMatch(/style A fill:#dde9fb/);
    await node(page, 'Start').click({ button: 'right' });
    await page.getByTestId(`${TID.contextMenuSub}-shape`).hover();
    await page.getByTestId(`${TID.contextMenuChoice}-shape-circle`).click();
    await expect.poll(() => code(page)).toContain('A((Start))');
    // Neither asked the inspector to unfold.
    await expect(page.getByTestId(TID.wsInspectorRail)).toBeVisible();
  });

  test('次の処理を追加 from the menu adds after the node', async ({ page }) => {
    await node(page, 'End').click({ button: 'right' });
    await menuItem(page, 'add-after').click();
    await expect.poll(() => code(page)).toContain('C --> n1');
    await expect(outline(page)).toHaveAttribute('data-selected', 'n1');
  });

  test('an arrow is selected by its label; its menu turns it round', async ({ page }) => {
    await page.locator('#view g.edgeLabel', { hasText: 'yes' }).click();
    await expect(outline(page)).toHaveAttribute('data-selected', 'edge-0');
    await page.locator('#view g.edgeLabel', { hasText: 'yes' }).click({ button: 'right' });
    const items = page.getByTestId(TID.contextMenu).getByRole('menuitem');
    await expect(items).toHaveText([
      // An arrow's name is its label (selectionCommands.ts).
      `${t('sel.renameLabel')} F2`,
      `${t('sel.color')} ▸`,
      `${t('insp.edgeStyle')} ▸`,
      `${t('sel.head')} ▸`,
      `${t('edge.length')} ▸`,
      t('insp.edgeReverse'),
      `${t('sel.cmd.selectSame')} ▸`,
      `${t('sel.delete')} Del`
    ]);
    await menuItem(page, 'reverse').click();
    await expect.poll(() => code(page)).toMatch(/B(?:\[Middle\])? -->\|yes\| A/);
  });

  test('"ここから矢印を引く" joins the selection to the next node clicked', async ({ page }) => {
    await node(page, 'Start').click({ button: 'right' });
    await menuItem(page, 'connect').click();
    const banner = page.getByTestId(TID.canvasConnectBanner);
    await expect(banner).toHaveAttribute('data-step', 'target');
    await expect(banner).toContainText(t('canvas.connectTarget'));
    await node(page, 'End').click();
    await expect.poll(() => code(page)).toContain('A --> C');
    await expect(outline(page)).toHaveAttribute('data-selected', 'C');
    await expect(banner).toBeHidden();

    // The same arrow again is refused, and says so over the diagram.
    await node(page, 'Start').click({ button: 'right' });
    await menuItem(page, 'connect').click();
    await node(page, 'End').click();
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(
      t('sel.alreadyConnected', { from: 'Start', to: 'End' })
    );
  });

  test('the zoom controls zoom, fit and switch the grid', async ({ page }) => {
    const level = page.getByTestId(TID.canvasZoomLevel);
    const percent = async () => Number.parseInt((await level.textContent()) ?? '', 10);
    await expect(level).toHaveText(/^\d+%$/);
    const fitted = await percent();
    await zoomIn(page);
    await expect.poll(percent).toBeGreaterThan(fitted);
    await resetView(page);
    await expect.poll(async () => Math.abs((await percent()) - fitted)).toBeLessThanOrEqual(2);
    await page.getByTestId(TID.zoomOutButton).click();
    await expect.poll(percent).toBeLessThan(fitted);
    const grid = page.getByTestId(TID.gridToggle);
    await expect(grid).toHaveAttribute('aria-pressed', 'true');
    await grid.click();
    await expect(grid).toHaveAttribute('aria-pressed', 'false');
    await expect
      .poll(() =>
        page.evaluate(
          () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { grid?: boolean }).grid
        )
      )
      .toBe(false);
    // The old bar over the diagram is gone: no new-tab view, no hand-drawn toggle here.
    await expect(page.getByTestId('diagram-toolbar')).toHaveCount(0);
    await expect(page.getByTestId('full-screen-button')).toHaveCount(0);
  });

  test('works in other diagram types: a state diagram', async ({ editPage, page }) => {
    await editPage.start(urlFor('stateDiagram-v2\n  [*] --> s1\n  s1 --> s2'));
    await editPage.checkTextInView('s2');
    await page.locator('#view .node', { hasText: 's2' }).first().click();
    await expect(outline(page)).toHaveAttribute('data-selected', 's2');
    await page.keyboard.press('Enter');
    await expect.poll(() => code(page)).toContain('s2 --> s3');
    await expect(outline(page)).toHaveAttribute('data-selected', 's3');
    // The menu offers ＋次 with its key outside flowcharts too.
    await page.locator('#view .node', { hasText: 's1' }).first().click({ button: 'right' });
    await expect(menuItem(page, 'add-after')).toHaveText(`${t('insp.addNext')} Enter`);
  });
});
