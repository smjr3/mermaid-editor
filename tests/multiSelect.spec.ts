import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { expect, t, test } from './test';

// Several things selected at once (selection.svelte.ts, SelectionLayer.svelte): Ctrl+click
// adds and removes, Ctrl+drag draws a rubber band, Ctrl+A takes everything, Delete removes
// them all in one undo step, Escape clears; edits are refused while the code is broken.
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const flow = 'flowchart TD\n  A[Start] -->|yes| B[Middle]\n  B --> C[End]\n  B --> D[Other]';

const code = (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code: string }).code
    )
    .then((text) => text.replaceAll('\r\n', '\n'));
const node = (page: Page, text: string) => page.locator('#view .node', { hasText: text }).first();
const outlines = (page: Page) => page.getByTestId(TID.selectionOutline);
/** The keys of the outlined items, in selection order. */
const selected = (page: Page) =>
  outlines(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-selected'))
  );
const primary = (page: Page) =>
  page.locator(`[data-testid="${TID.selectionOutline}"][data-primary="true"]`);
/** A click on the empty canvas (bottom-left corner of the view), with Ctrl held if asked. */
const clickCanvas = async (page: Page, ctrl = false) => {
  const view = await page.locator('#view').boundingBox();
  if (!view) throw new Error('view missing');
  // `page.mouse.click` has no modifiers option: the key is held around it.
  if (ctrl) await page.keyboard.down('Control');
  await page.mouse.click(view.x + 20, view.y + view.height - 20);
  if (ctrl) await page.keyboard.up('Control');
};

test.describe('Multi-select', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test.beforeEach(async ({ editPage }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
  });

  test('Ctrl+click adds to the selection and takes out again; a plain click replaces', async ({
    page
  }) => {
    await node(page, 'Start').click();
    await expect(outlines(page)).toHaveCount(1);
    await node(page, 'End').click({ modifiers: ['Control'] });
    await expect(outlines(page)).toHaveCount(2);
    expect(await selected(page)).toEqual(['A', 'C']);
    // The last one chosen is the primary.
    await expect(primary(page)).toHaveAttribute('data-selected', 'C');
    // Each outline sits on its node.
    const endBox = await node(page, 'End').boundingBox();
    const outlineBox = await page
      .locator(`[data-testid="${TID.selectionOutline}"][data-selected="C"]`)
      .boundingBox();
    if (!endBox || !outlineBox) throw new Error('boxes missing');
    expect(Math.abs(endBox.x - outlineBox.x)).toBeLessThan(8);

    await node(page, 'Other').click({ modifiers: ['Control'] });
    expect(await selected(page)).toEqual(['A', 'C', 'D']);
    // Ctrl+click on a selected item takes it out; the primary becomes the last left.
    await node(page, 'Other').click({ modifiers: ['Control'] });
    expect(await selected(page)).toEqual(['A', 'C']);
    await expect(primary(page)).toHaveAttribute('data-selected', 'C');
    await node(page, 'End').click({ modifiers: ['Control'] });
    expect(await selected(page)).toEqual(['A']);
    await expect(primary(page)).toHaveAttribute('data-selected', 'A');

    // An arrow joins too.
    await page.locator('#view g.edgeLabel', { hasText: 'yes' }).click({ modifiers: ['Control'] });
    expect(await selected(page)).toEqual(['A', 'edge-0']);

    // A plain click replaces the list.
    await node(page, 'Middle').click();
    expect(await selected(page)).toEqual(['B']);

    // Escape clears everything.
    await node(page, 'End').click({ modifiers: ['Control'] });
    await expect(outlines(page)).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(outlines(page)).toHaveCount(0);
  });

  test('Ctrl+drag draws a rubber band that selects what lies inside it', async ({ page }) => {
    const [start, middle, end, view] = await Promise.all([
      node(page, 'Start').boundingBox(),
      node(page, 'Middle').boundingBox(),
      node(page, 'End').boundingBox(),
      page.locator('#view').boundingBox()
    ]);
    if (!start || !middle || !end || !view) throw new Error('boxes missing');
    // From the empty canvas left of Start down to below Middle: Start, Middle and the
    // arrow between them lie inside; End and Other (beside and below) do not.
    const x0 = Math.max(view.x + 4, start.x - 40);
    const y0 = Math.max(view.y + 4, start.y - 20);
    const x1 = Math.max(start.x + start.width, middle.x + middle.width) + 12;
    const y1 = middle.y + middle.height + 12;
    expect(y1).toBeLessThan(end.y);
    await page.mouse.move(x0, y0);
    await page.keyboard.down('Control');
    await page.mouse.down();
    await page.mouse.move(x0 + 30, y0 + 30);
    await expect(page.getByTestId(TID.selectionBand)).toBeVisible();
    await page.mouse.move(x1, y1, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Control');
    await expect(page.getByTestId(TID.selectionBand)).toBeHidden();
    await expect(outlines(page)).toHaveCount(3);
    expect((await selected(page)).sort()).toEqual(['A', 'B', 'edge-0']);
    // The diagram did not pan: Start is where it was.
    const after = await node(page, 'Start').boundingBox();
    expect(Math.abs((after?.x ?? 0) - start.x)).toBeLessThan(2);

    // A plain drag on the canvas still pans, and does not change the selection.
    await page.mouse.move(view.x + 20, view.y + view.height - 20);
    await page.mouse.down();
    await page.mouse.move(view.x + 80, view.y + view.height - 60, { steps: 4 });
    await page.mouse.up();
    const panned = await node(page, 'Start').boundingBox();
    expect(Math.abs((panned?.x ?? 0) - start.x)).toBeGreaterThan(30);
    await expect(outlines(page)).toHaveCount(3);

    // A click on the empty canvas clears.
    await page.mouse.click(view.x + 20, view.y + view.height - 20);
    await expect(outlines(page)).toHaveCount(0);
  });

  test('Ctrl+A selects everything; Delete removes it all as one undo step', async ({
    editPage,
    page
  }) => {
    await clickCanvas(page);
    await page.keyboard.press('Control+a');
    await expect(outlines(page)).toHaveCount(7);
    expect((await selected(page)).sort()).toEqual([
      'A',
      'B',
      'C',
      'D',
      'edge-0',
      'edge-1',
      'edge-2'
    ]);

    // Delete on a part of it: both nodes and the arrow go together.
    await node(page, 'End').click();
    await node(page, 'Other').click({ modifiers: ['Control'] });
    await page.locator('#view g.edgeLabel', { hasText: 'yes' }).click({ modifiers: ['Control'] });
    await expect(outlines(page)).toHaveCount(3);
    await page.keyboard.press('Delete');
    await expect.poll(() => code(page)).toBe('flowchart TD\n  A[Start]\n  B[Middle]');
    await expect(outlines(page)).toHaveCount(0);
    await editPage.checkTextNotInView('End');

    // One Ctrl+Z brings all three back at once.
    await page.keyboard.press('Control+z');
    await expect.poll(() => code(page)).toBe(flow);
    await editPage.checkTextInView('End');
    // And one Ctrl+Y takes them away again.
    await page.keyboard.press('Control+y');
    await expect.poll(() => code(page)).toBe('flowchart TD\n  A[Start]\n  B[Middle]');

    // Ctrl+A in the code editor is the editor's.
    await page.keyboard.press('Control+z');
    await expect.poll(() => code(page)).toBe(flow);
    await editPage.editor.click();
    await page.keyboard.press('Control+a');
    await expect(outlines(page)).toHaveCount(0);
  });

  test('the right-click menu on one of several keeps them all', async ({ page }) => {
    await node(page, 'End').click();
    await node(page, 'Other').click({ modifiers: ['Control'] });
    await node(page, 'End').click({ button: 'right' });
    await expect(page.getByTestId(TID.contextMenu)).toBeVisible();
    await expect(outlines(page)).toHaveCount(2);
    await page.keyboard.press('Escape');
    // On an unselected item the menu selects that one alone.
    await node(page, 'Start').click({ button: 'right' });
    await expect(outlines(page)).toHaveCount(1);
    expect(await selected(page)).toEqual(['A']);
    await page.keyboard.press('Escape');
  });

  test('while the code is broken, Delete on several is refused and says so', async ({
    editPage,
    page
  }) => {
    await node(page, 'End').click();
    await node(page, 'Other').click({ modifiers: ['Control'] });
    await expect(outlines(page)).toHaveCount(2);
    await editPage.typeInEditor('\n  X -->');
    await expect(page.getByTestId(TID.diagramErrorNotice)).toBeVisible({ timeout: 10_000 });
    const broken = await code(page);
    expect(broken).toContain('X -->');
    // Focus back on the diagram (a Ctrl+click on the canvas keeps the selection), then Delete.
    await clickCanvas(page, true);
    await expect(outlines(page)).toHaveCount(2);
    await page.keyboard.press('Delete');
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(t('recover.blocked'));
    expect(await code(page)).toBe(broken);
    await expect(outlines(page)).toHaveCount(2);
  });
});
