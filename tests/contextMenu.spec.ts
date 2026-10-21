import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { menuChoice, menuItem, menuSub, menuSubPanel, openMenuSub } from './helpers/canvas';
import { expect, t, test } from './test';

// The right-click menu over the diagram, built from the command registry: every row
// completes its action in place — colours and shapes from a submenu, an arrow's line
// style and head, 「同じものを選ぶ」, several selected items at once — with the keyboard,
// while the code is broken (refused, and said so), and inside the viewport.
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const flow = 'flowchart TD\n  A[Start] -->|yes| B(Middle)\n  B --> C[End]\n  B --> D[Other]';

const code = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code: string }).code
  );
const node = (page: Page, text: string) => page.locator('#view .node', { hasText: text }).first();
const edgeLabel = (page: Page, text: string) =>
  page.locator('#view g.edgeLabel', { hasText: text }).first();
const outlines = (page: Page) => page.getByTestId(TID.selectionOutline);
const selected = (page: Page) =>
  outlines(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-selected')).sort()
  );
const menu = (page: Page) => page.getByTestId(TID.contextMenu);
const header = (page: Page) => page.getByTestId(`${TID.contextMenu}-name`);

test.describe('Context menu', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test.beforeEach(async ({ editPage }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
  });

  test('色 ▸ 塗り recolours the node from a swatch, in place', async ({ page }) => {
    await node(page, 'Start').click({ button: 'right' });
    await expect(header(page)).toHaveText('Start');
    await openMenuSub(page, 'color');
    const panel = menuSubPanel(page, 'color');
    // Three lines: 塗り / 枠 / 文字, each a row of dots with 「テーマ標準」 first.
    await expect(panel).toContainText(t('insp.colorFill'));
    await expect(panel).toContainText(t('insp.colorStroke'));
    await expect(panel).toContainText(t('insp.colorText'));
    await expect(menuChoice(page, 'fillColor', 'none')).toHaveText(t('colors.lineDefault'));
    await expect(menuChoice(page, 'fillColor', 'none')).toHaveAttribute('aria-checked', 'true');
    await menuChoice(page, 'fillColor', 'blue').click();
    await expect(menu(page)).toBeHidden();
    await expect.poll(() => code(page)).toMatch(/style A fill:#dde9fb,stroke:#3b73c9/);

    // The swatch is checked next time; 枠 writes the stroke alone; 文字 the text colour.
    await node(page, 'Start').click({ button: 'right' });
    await openMenuSub(page, 'color');
    await expect(menuChoice(page, 'fillColor', 'blue')).toHaveAttribute('aria-checked', 'true');
    await menuChoice(page, 'strokeColor', '#d64545').click();
    await expect.poll(() => code(page)).toMatch(/style A fill:#dde9fb,stroke:#d64545/);
    await node(page, 'Start').click({ button: 'right' });
    await openMenuSub(page, 'color');
    await menuChoice(page, 'textColor', '#3f9b52').click();
    await expect.poll(() => code(page)).toMatch(/style A [^\n]*color:#3f9b52/);
    // 「テーマ標準」 takes the fill away again.
    await node(page, 'Start').click({ button: 'right' });
    await openMenuSub(page, 'color');
    await menuChoice(page, 'fillColor', 'none').click();
    await expect.poll(() => code(page)).not.toMatch(/style A [^\n]*fill:/);
  });

  test('no row ends in whitespace: the key follows the label, or nothing does', async ({
    page
  }) => {
    // The raw text, not Playwright's normalised one: a trailing space is the finding.
    const rowTexts = () =>
      menu(page)
        .getByRole('menuitem')
        .evaluateAll((elements) => elements.map((element) => element.textContent ?? ''));
    const expectTrimmed = async () => {
      const texts = await rowTexts();
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) {
        expect(text, `row "${text}"`).toBe(text.trimEnd());
        expect(text.trimEnd().length).toBeGreaterThan(0);
      }
    };
    // A node: rows with a key (削除 Del) and without (形 ▸).
    await node(page, 'Start').click({ button: 'right' });
    await expectTrimmed();
    await expect(menuItem(page, 'delete')).toHaveText(`${t('sel.delete')} Del`);
    await page.keyboard.press('Escape');
    // An arrow: 向きを反転 has no key.
    await edgeLabel(page, 'yes').click({ button: 'right' });
    await expectTrimmed();
    await expect(menuItem(page, 'reverse')).toHaveText(t('insp.edgeReverse'));
    await page.keyboard.press('Escape');
    // The empty canvas: neither row has a key.
    await page.locator('#view').click({ button: 'right', position: { x: 10, y: 10 } });
    await expectTrimmed();
    await expect(menuItem(page, 'fit')).toHaveText(t('sel.fit'));
  });

  test('形 ▸ changes the shape; the current one is checked', async ({ page }) => {
    await node(page, 'Middle').click({ button: 'right' });
    await openMenuSub(page, 'shape');
    await expect(menuChoice(page, 'shape', 'rounded')).toHaveAttribute('aria-checked', 'true');
    await expect(menuChoice(page, 'shape', 'rect')).toHaveAttribute('aria-checked', 'false');
    // One line per choice.
    for (const height of await menuSubPanel(page, 'shape')
      .getByRole('menuitemradio')
      .evaluateAll((elements) =>
        elements.slice(0, 8).map((element) => element.getBoundingClientRect().height)
      )) {
      expect(height).toBeLessThan(36);
    }
    await menuChoice(page, 'shape', 'diam').click();
    await expect(menu(page)).toBeHidden();
    await expect.poll(() => code(page)).toContain('B{Middle}');
    await node(page, 'Middle').click({ button: 'right' });
    await openMenuSub(page, 'shape');
    await expect(menuChoice(page, 'shape', 'diam')).toHaveAttribute('aria-checked', 'true');
    await menuChoice(page, 'shape', 'cyl').click();
    await expect.poll(() => code(page)).toMatch(/B@\{ shape: cyl, label: "Middle" \}/);
  });

  test('on an arrow: 線の種類 ▸ 点線, 矢じり ▸ なし, 長さ ▸ 長め', async ({ page }) => {
    await edgeLabel(page, 'yes').click({ button: 'right' });
    await expect(header(page)).toContainText(t('sel.edge'));
    await openMenuSub(page, 'lineStyle');
    await expect(menuChoice(page, 'lineStyle', 'solid')).toHaveAttribute('aria-checked', 'true');
    await menuChoice(page, 'lineStyle', 'dotted').click();
    await expect(menu(page)).toBeHidden();
    await expect.poll(() => code(page)).toMatch(/A(?:\[Start\])? -\.->\|yes\| B/);
    // The arrow stays selected; the inspector shows the new style once the lists caught up.
    await expect(page.getByTestId(`${TID.inspEdgeStyle}-dotted`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await edgeLabel(page, 'yes').click({ button: 'right' });
    await openMenuSub(page, 'arrowHead');
    await expect(menuChoice(page, 'arrowHead', 'end')).toHaveAttribute('aria-checked', 'true');
    await menuChoice(page, 'arrowHead', 'none').click();
    await expect.poll(() => code(page)).toMatch(/A(?:\[Start\])? -\.-\|yes\| B/);
    await expect(page.getByTestId(`${TID.inspEdgeHead}-none`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await edgeLabel(page, 'yes').click({ button: 'right' });
    await openMenuSub(page, 'edgeLength');
    await menuChoice(page, 'edgeLength', '2').click();
    await expect.poll(() => code(page)).toMatch(/A(?:\[Start\])? -\.\.-\|yes\| B/);
  });

  test('同じものを選ぶ ▸ 同じ形 / すべての矢印 builds the selection', async ({ page }) => {
    await node(page, 'Start').click({ button: 'right' });
    await openMenuSub(page, 'selectSame');
    await menuChoice(page, 'selectSame', 'shape').click();
    await expect(menu(page)).toBeHidden();
    // Start, End and Other are rectangles; Middle is rounded.
    await expect(outlines(page)).toHaveCount(3);
    expect(await selected(page)).toEqual(['A', 'C', 'D']);

    await node(page, 'Middle').click({ button: 'right' });
    await openMenuSub(page, 'selectSame');
    await menuChoice(page, 'selectSame', 'edges').click();
    await expect(outlines(page)).toHaveCount(3);
    expect(await selected(page)).toEqual(['edge-0', 'edge-1', 'edge-2']);
  });

  test('several selected: the header counts them and 色 applies to all', async ({ page }) => {
    await node(page, 'End').click();
    await node(page, 'Other').click({ modifiers: ['Control'] });
    await node(page, 'Start').click({ modifiers: ['Control'] });
    await expect(outlines(page)).toHaveCount(3);
    await node(page, 'End').click({ button: 'right' });
    await expect(outlines(page)).toHaveCount(3);
    await expect(header(page)).toHaveText(t('sel.cmd.count', { count: '3' }));
    // What needs a single item is not offered.
    await expect(menuItem(page, 'rename')).toHaveCount(0);
    await expect(menuItem(page, 'add-after')).toHaveCount(0);
    await expect(menuItem(page, 'addBranch')).toHaveCount(0);
    await expect(menuItem(page, 'connect')).toHaveCount(0);
    await openMenuSub(page, 'color');
    await menuChoice(page, 'fillColor', 'green').click();
    await expect(menu(page)).toBeHidden();
    await expect.poll(() => code(page)).toMatch(/style A fill:#def5e1/);
    expect(await code(page)).toMatch(/style C fill:#def5e1/);
    expect(await code(page)).toMatch(/style D fill:#def5e1/);
    expect(await code(page)).not.toMatch(/style B /);
    // One undo step takes them all back.
    await page.keyboard.press('Control+z');
    await expect.poll(() => code(page)).toBe(flow);

    // Differing values: 「まちまち」 in the submenu.
    await node(page, 'Middle').click({ button: 'right' });
    await openMenuSub(page, 'color');
    await menuChoice(page, 'fillColor', 'red').click();
    await expect.poll(() => code(page)).toMatch(/style B fill:#fde2e1/);
    await node(page, 'Middle').click();
    await node(page, 'End').click({ modifiers: ['Control'] });
    await node(page, 'End').click({ button: 'right' });
    await expect(header(page)).toHaveText(t('sel.cmd.count', { count: '2' }));
    await openMenuSub(page, 'color');
    await expect(menuSubPanel(page, 'color')).toContainText(t('sel.cmd.mixed'));
    await openMenuSub(page, 'shape');
    await expect(menuSubPanel(page, 'shape')).toContainText(t('sel.cmd.mixed'));
    await expect(menuSubPanel(page, 'color')).toBeHidden();
  });

  test('while the code is broken the menu opens, but its actions refuse and say so', async ({
    editPage,
    page
  }) => {
    await editPage.typeInEditor('\n  X -->');
    await expect(page.getByTestId(TID.diagramErrorNotice)).toBeVisible({ timeout: 10_000 });
    const broken = await code(page);
    expect(broken).toContain('X -->');
    await node(page, 'End').click({ button: 'right' });
    await expect(menu(page)).toBeVisible();
    await openMenuSub(page, 'color');
    await menuChoice(page, 'fillColor', 'blue').click();
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(t('recover.blocked'));
    expect(await code(page)).toBe(broken);
    await node(page, 'End').click({ button: 'right' });
    await openMenuSub(page, 'shape');
    await menuChoice(page, 'shape', 'circle').click();
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(t('recover.blocked'));
    expect(await code(page)).toBe(broken);
    await node(page, 'End').click({ button: 'right' });
    await menuItem(page, 'delete').click();
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(t('recover.blocked'));
    expect(await code(page)).toBe(broken);
  });

  test('keyboard: arrows move, ArrowRight opens a submenu, ArrowLeft closes it, Escape closes', async ({
    page
  }) => {
    await node(page, 'Start').click({ button: 'right' });
    await expect(menuItem(page, 'add-after')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menuItem(page, 'delete')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menuItem(page, 'add-after')).toBeFocused();
    // ArrowRight on a plain row does nothing; on 形 ▸ it opens the submenu.
    await page.keyboard.press('ArrowRight');
    await expect(menuSubPanel(page, 'shape')).toBeHidden();
    await menuSub(page, 'shape').focus();
    await page.keyboard.press('ArrowRight');
    await expect(menuSubPanel(page, 'shape')).toBeVisible();
    await expect(menuSub(page, 'shape')).toHaveAttribute('aria-expanded', 'true');
    await expect(menuChoice(page, 'shape', 'rect')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menuChoice(page, 'shape', 'rounded')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(menuSubPanel(page, 'shape')).toBeHidden();
    await expect(menuSub(page, 'shape')).toBeFocused();
    // Enter chooses: open again and pick 角丸 with the keyboard.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(menu(page)).toBeHidden();
    await expect.poll(() => code(page)).toContain('A(Start)');

    await node(page, 'Start').click({ button: 'right' });
    await menuSub(page, 'color').focus();
    await page.keyboard.press('ArrowRight');
    await expect(menuSubPanel(page, 'color')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    await expect(outlines(page)).toHaveCount(1);
    expect(await code(page)).toContain('A(Start)');
  });

  test('the menu and its submenus stay inside the view, flipping near the right edge', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart LR\n  A[One] --> B[Two] --> C[Three] --> D[Four]'));
    await editPage.checkTextInView('Four');
    const view = await page.locator('#view').boundingBox();
    if (!view) throw new Error('view missing');
    const inside = (box: { x: number; y: number; width: number; height: number } | null) => {
      if (!box) throw new Error('box missing');
      expect(box.x).toBeGreaterThanOrEqual(view.x - 1);
      expect(box.y).toBeGreaterThanOrEqual(view.y - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(view.y + view.height + 1);
    };
    // Right-click at the far right edge of the view, on the last node.
    const last = await node(page, 'Four').boundingBox();
    if (!last) throw new Error('node missing');
    await page.mouse.click(last.x + last.width - 2, last.y + last.height / 2, { button: 'right' });
    await expect(menu(page)).toBeVisible();
    inside(await menu(page).boundingBox());
    await openMenuSub(page, 'shape');
    const panel = menuSubPanel(page, 'shape');
    inside(await panel.boundingBox());
    const menuBox = await menu(page).boundingBox();
    const panelBox = await panel.boundingBox();
    if (!menuBox || !panelBox) throw new Error('boxes missing');
    if (menuBox.x + menuBox.width + panelBox.width > view.x + view.width) {
      await expect(panel).toHaveAttribute('data-side', 'left');
      expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(menuBox.x + 1);
    }
    // Near the bottom edge the same.
    await page.keyboard.press('Escape');
    await page.mouse.click(view.x + view.width / 2, view.y + view.height - 10, { button: 'right' });
    await expect(menu(page)).toBeVisible();
    inside(await menu(page).boundingBox());
  });
});
