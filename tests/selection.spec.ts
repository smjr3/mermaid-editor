import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { expect, t, test } from './test';

// "Click the diagram, then change it": selecting objects and arrows in the drawing,
// the mini toolbar above the selection, the keys, and the right-click menu.
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const flow = 'flowchart TD\n  A[Start] -->|yes| B[Middle]\n  B --> C[End]';

const code = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code: string }).code
  );
const node = (page: Page, text: string) => page.locator('#view .node', { hasText: text }).first();

test.describe('Selection', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test.beforeEach(async ({ editPage }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
  });

  test('a click selects an object and shows the mini toolbar; Escape clears', async ({ page }) => {
    const toolbar = page.getByTestId(TID.selectionToolbar);
    const outline = page.getByTestId(TID.selectionOutline);
    await expect(toolbar).toBeHidden();
    await node(page, 'Middle').click();
    await expect(outline).toHaveAttribute('data-selected', 'B');
    await expect(toolbar).toBeVisible();
    // Floating just above the selection.
    const toolbarBox = await toolbar.boundingBox();
    const outlineBox = await outline.boundingBox();
    if (!toolbarBox || !outlineBox) throw new Error('boxes missing');
    expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(outlineBox.y);
    expect(toolbarBox.y + toolbarBox.height).toBeGreaterThan(outlineBox.y - 40);

    await page.keyboard.press('Escape');
    await expect(toolbar).toBeHidden();
    await expect(outline).toBeHidden();

    // A click on the empty canvas clears too.
    await node(page, 'Start').click();
    await expect(outline).toHaveAttribute('data-selected', 'A');
    const view = await page.locator('#view').boundingBox();
    if (!view) throw new Error('view missing');
    await page.mouse.click(view.x + 20, view.y + view.height - 20);
    await expect(outline).toBeHidden();
  });

  test('renames inline after a double click', async ({ editPage, page }) => {
    await node(page, 'Middle').dblclick();
    const input = page.getByTestId(TID.selectionRename);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Middle');
    await input.fill('Center');
    await page.keyboard.press('Enter');
    await expect.poll(() => code(page)).toMatch(/B\["?Center"?\]/);
    await editPage.checkTextInView('Center');
    // F2 opens it again on the selection.
    await node(page, 'Center').click();
    await page.keyboard.press('F2');
    await expect(page.getByTestId(TID.selectionRename)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.selectionRename)).toBeHidden();
    await expect(page.getByTestId(TID.selectionOutline)).toHaveAttribute('data-selected', 'B');
  });

  test('a colour and bold from the mini toolbar reach the code', async ({ page }) => {
    await node(page, 'Middle').click();
    await page.getByTestId(`${TID.selectionToolbar}-color`).click();
    await page.getByTestId(`${TID.selectionColor}-blue`).click();
    await expect.poll(() => code(page)).toContain('style B fill:#dde9fb,stroke:#3b73c9');
    await page.getByTestId(TID.selectionBold).click();
    await expect
      .poll(() => code(page))
      .toMatch(/style B fill:#dde9fb,stroke:#3b73c9.*font-weight:bold/);
    await page.getByTestId(TID.selectionSize).selectOption('large');
    await expect.poll(() => code(page)).toContain('font-size:18px');
  });

  test('"この後に追加" chains new nodes, each selected and named in place', async ({
    editPage,
    page
  }) => {
    await node(page, 'End').click();
    await page.getByTestId(TID.selectionAddAfter).click();
    await page.getByTestId(TID.selectionRename).fill('Step 4');
    await page.keyboard.press('Enter');
    await expect.poll(() => code(page)).toContain('n1["Step 4"]');
    await expect(page.getByTestId(TID.selectionOutline)).toHaveAttribute('data-selected', 'n1');

    await page.getByTestId(TID.selectionAddAfter).click();
    await page.getByTestId(TID.selectionRename).fill('Step 5');
    await page.keyboard.press('Enter');
    await expect.poll(() => code(page)).toContain('n2["Step 5"]');
    const result = await code(page);
    expect(result).toContain('C --> n1');
    expect(result).toContain('n1 --> n2');
    await editPage.checkTextInView('Step 5');
  });

  test('Enter adds after the selection, Tab adds a branch, Delete deletes', async ({
    editPage,
    page
  }) => {
    const outline = page.getByTestId(TID.selectionOutline);
    await node(page, 'Middle').click();
    await page.keyboard.press('Enter');
    await expect(outline).toHaveAttribute('data-selected', 'n1');
    // The new node's name is open for typing; Escape keeps the default.
    await page.keyboard.press('Escape');
    await expect.poll(() => code(page)).toContain('B --> n1');

    // Tab: a second node from where the selected one comes from (B).
    await page.keyboard.press('Tab');
    await expect(outline).toHaveAttribute('data-selected', 'n2');
    await page.keyboard.press('Escape');
    await expect.poll(() => code(page)).toContain('B --> n2');

    await page.keyboard.press('Delete');
    await expect.poll(() => code(page)).not.toContain('n2');
    await expect(outline).toBeHidden();

    // The arrow keys follow the arrows.
    await node(page, 'Start').click();
    await page.keyboard.press('ArrowDown');
    await expect(outline).toHaveAttribute('data-selected', 'B');
    await page.keyboard.press('ArrowUp');
    await expect(outline).toHaveAttribute('data-selected', 'A');

    // Keys typed in the code editor are the editor's.
    await editPage.editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect.poll(() => code(page)).not.toContain('n3');
  });

  test('the right-click menu deletes, and offers "ノードを追加" on the canvas', async ({
    editPage,
    page
  }) => {
    await node(page, 'End').click({ button: 'right' });
    const menu = page.getByTestId(TID.contextMenu);
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId(`${TID.contextMenuItem}-rename`)).toBeVisible();
    await menu.getByTestId(`${TID.contextMenuItem}-delete`).click();
    await expect(menu).toBeHidden();
    await expect.poll(() => code(page)).not.toContain('End');
    await editPage.checkTextNotInView('End');

    const view = await page.locator('#view').boundingBox();
    if (!view) throw new Error('view missing');
    await page.mouse.click(view.x + 30, view.y + view.height - 30, { button: 'right' });
    await expect(menu.getByTestId(`${TID.contextMenuItem}-fit`)).toBeVisible();
    await menu.getByTestId(`${TID.contextMenuItem}-add-node`).click();
    await expect(page.getByTestId(TID.selectionRename)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect.poll(() => code(page)).toContain(`n1["${t('sel.newNode')}"]`);
  });

  test('the right-click menu colours an object from its palette', async ({ page }) => {
    await node(page, 'Start').click({ button: 'right' });
    await page.getByTestId(`${TID.contextMenuItem}-color`).click();
    await page.getByTestId(`${TID.contextMenuItem}-color-green`).click();
    await expect.poll(() => code(page)).toContain('style A fill:#def5e1,stroke:#3f9b52');
  });

  test('an arrow is selected by its label and reversed from the toolbar', async ({ page }) => {
    await page.locator('#view g.edgeLabel', { hasText: 'yes' }).click();
    await expect(page.getByTestId(TID.selectionOutline)).toHaveAttribute('data-selected', 'edge-0');
    await expect(page.getByTestId(TID.selectionAddAfter)).toBeHidden();
    await page.getByTestId(TID.selectionEdgeReverse).click();
    await expect.poll(() => code(page)).toMatch(/B(?:\[Middle\])? -->\|yes\| A/);
    await page.getByTestId(TID.selectionEdgeStyle).selectOption('dotted');
    await expect.poll(() => code(page)).toContain('-.->|yes|');
  });

  test('"ここから矢印" joins the selection to the next node clicked', async ({ page }) => {
    await node(page, 'Start').click();
    await page.getByTestId(TID.selectionConnect).click();
    await expect(page.getByText(t('sel.connecting'))).toBeVisible();
    await node(page, 'End').click();
    await expect.poll(() => code(page)).toContain('A --> C');
    await expect(page.getByTestId(TID.selectionOutline)).toHaveAttribute('data-selected', 'C');
  });

  test('the 直す tab shows the selection with its full controls', async ({ page }) => {
    await page.getByTestId(`${TID.toolsTab}-fix`).click();
    const panel = page.getByTestId(TID.selectionPanel);
    await expect(panel).toContainText(t('sel.hint'));
    await expect(page.getByTestId(TID.selectionHint)).toHaveAttribute('title', t('sel.keys'));
    await node(page, 'Middle').click();
    await expect(page.getByTestId(`${TID.selectionPanel}-name`)).toContainText('Middle');
    await page.getByTestId(`${TID.selectionPanel}-shape`).selectOption('rounded');
    await expect.poll(() => code(page)).toContain('B(Middle)');
  });

  test('works in other diagram types: a state diagram', async ({ editPage, page }) => {
    await editPage.start(urlFor('stateDiagram-v2\n  [*] --> s1\n  s1 --> s2'));
    await editPage.checkTextInView('s2');
    await page.locator('#view .node', { hasText: 's2' }).first().click();
    await expect(page.getByTestId(TID.selectionOutline)).toHaveAttribute('data-selected', 's2');
    await page.keyboard.press('Enter');
    await page.getByTestId(TID.selectionRename).fill('Done');
    await page.keyboard.press('Enter');
    await expect.poll(() => code(page)).toContain('s2 --> s3');
    await editPage.checkTextInView('Done');
  });
});
