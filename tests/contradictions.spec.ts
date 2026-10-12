import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { formField, formMessage, openForm, submitForm } from './helpers/canvas';
import { assertInvariants, readCode, urlFor, watchErrors } from './invariants';
import { expect, t, test } from './test';

// Users do not work in the order the tools expect: they connect what is already
// connected, undo from the keyboard after deleting with it, click away mid-rename,
// press old shortcuts over a dialog. Each test is a sequence that once broke something;
// every step is followed by the shared invariants (tests/invariants.ts).
const flow = 'flowchart TD\n  A[Start] -->|yes| B[Middle]\n  B --> C[End]';
const node = (page: Page, id: string) =>
  page.locator(`#view g.node[id*="flowchart-${id}-"]`).first();
const outline = (page: Page) => page.getByTestId(TID.selectionOutline);

test.describe('Contradictory and out-of-order operations', () => {
  let errors: string[];

  test.beforeEach(async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
    errors = watchErrors(page);
  });

  test('Ctrl+Z after deleting with the Delete key brings the node back; Ctrl+Y deletes again', async ({
    page
  }) => {
    const before = await readCode(page);
    await node(page, 'B').click();
    await page.keyboard.press('Delete');
    await expect.poll(() => readCode(page)).not.toContain('Middle');
    const deleted = await assertInvariants(page, errors, { label: 'delete' });

    await page.keyboard.press('Control+z');
    await expect.poll(() => readCode(page)).toBe(before);
    await page.keyboard.press('Control+y');
    await expect.poll(() => readCode(page)).toBe(deleted);
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(() => readCode(page)).toBe(deleted);
    await page.keyboard.press('Control+z');
    await expect.poll(() => readCode(page)).toBe(before);
    await assertInvariants(page, errors, { label: 'undo' });
  });

  test('two quick edits from the inspector are undone one at a time', async ({ page }) => {
    const before = await readCode(page);
    await node(page, 'B').click();
    await page.getByTestId(`${TID.inspColor}-blue`).click();
    await expect.poll(() => readCode(page)).toContain('style B fill:#dde9fb');
    const coloured = await readCode(page);
    // Well within the history's 500 ms typing pause.
    await page.getByTestId(TID.inspTextBold).click();
    await expect.poll(() => readCode(page)).toContain('font-weight:bold');

    await page.getByTestId(TID.undoButton).click();
    await expect.poll(() => readCode(page)).toBe(coloured);
    await page.getByTestId(TID.undoButton).click();
    await expect.poll(() => readCode(page)).toBe(before);
    await assertInvariants(page, errors, { label: 'undo twice' });
  });

  test('the same arrow is not added twice, from the selection or the add bar', async ({ page }) => {
    let before = await readCode(page);
    await node(page, 'A').click();
    await page.getByTestId(TID.inspConnect).click();
    await node(page, 'C').click();
    await expect.poll(() => readCode(page)).toContain('A --> C');
    before = await assertInvariants(page, errors, { before, label: 'A → C' });

    await node(page, 'A').click();
    await page.getByTestId(TID.inspConnect).click();
    await node(page, 'C').click();
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(
      t('sel.alreadyConnected', { from: 'Start', to: 'End' })
    );
    expect(await readCode(page)).toBe(before);
    // Clicking the node it starts from just stops waiting.
    await node(page, 'A').click();
    await page.getByTestId(TID.inspConnect).click();
    await node(page, 'A').click();
    await expect(page.getByTestId(TID.canvasConnectBanner)).toBeHidden();
    await assertInvariants(page, errors, { label: 'A → C again' });

    // The add bar's arrow form says so too, unless the second arrow has another label.
    await openForm(page, 'edge');
    await formField(page, 'from').selectOption('B');
    await formField(page, 'to').selectOption('C');
    await submitForm(page);
    await expect(formMessage(page)).toHaveText(
      t('sel.alreadyConnected', { from: 'Middle', to: 'End' })
    );
    expect(await readCode(page)).toBe(before);
    await formField(page, 'label').fill('retry');
    await submitForm(page);
    await expect.poll(() => readCode(page)).toContain('retry');
    await assertInvariants(page, errors, { before, label: 'labelled second arrow' });
  });

  test('a name typed in the 名前 field is kept when another node is clicked', async ({ page }) => {
    const before = await readCode(page);
    await node(page, 'B').dblclick();
    await page.getByTestId(TID.inspName).fill('Typed');
    await node(page, 'A').click();
    await expect.poll(() => readCode(page)).toMatch(/B\["?Typed"?\]/);
    // The click still selects what it landed on, and Start keeps its name.
    await expect(outline(page)).toHaveAttribute('data-selected', 'A');
    expect(await readCode(page)).toContain('A[Start]');
    await assertInvariants(page, errors, { before, label: 'rename then click' });

    // Escape still throws the text away, also when another node is clicked afterwards.
    await node(page, 'C').dblclick();
    const name = page.getByTestId(TID.inspName);
    await name.fill('Dropped');
    await page.keyboard.press('Escape');
    await expect(name).toHaveValue('End');
    await node(page, 'A').click();
    expect(await readCode(page)).not.toContain('Dropped');
  });

  test('an empty name is refused with a message, not silently', async ({ page }) => {
    await node(page, 'B').dblclick();
    await page.getByTestId(TID.inspName).fill('   ');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(t('sel.emptyName'));
    expect(await readCode(page)).toContain('B[Middle]');
    await assertInvariants(page, errors, { label: 'empty name' });
  });

  test('Ctrl+K over the help dialog opens nothing (no command search any more)', async ({
    page
  }) => {
    await page.getByTestId(TID.helpButton).click();
    await expect(page.getByTestId(TID.helpDialog)).toBeVisible();
    await page.keyboard.press('Control+k');
    // The removed command palette's input.
    await expect(page.getByTestId('command-input')).toHaveCount(0);
    await assertInvariants(page, errors, { label: 'help + Ctrl+K' });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.helpDialog)).toBeHidden();
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-input')).toHaveCount(0);
    await expect(page.getByTestId(TID.helpDialog)).toHaveCount(0);
  });

  test('the right-click menu closes when the wheel zooms the diagram under it', async ({
    page
  }) => {
    await node(page, 'B').click({ button: 'right' });
    await expect(page.getByTestId(TID.contextMenu)).toBeVisible();
    // Over the diagram, away from the menu (which now opens under the pointer).
    const view = await page.locator('#view').boundingBox();
    if (!view) throw new Error('view missing');
    await page.mouse.move(view.x + 30, view.y + view.height - 30);
    await page.mouse.wheel(0, 200);
    await expect(page.getByTestId(TID.contextMenu)).toBeHidden();
    await assertInvariants(page, errors, { label: 'menu + wheel' });
  });

  test('turning an arrow round when the opposite arrow exists is refused, not doubled', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  C[Ask] -->|why| D[Answer]\n  D -->|why| C'));
    await editPage.checkTextInView('Answer');
    errors = watchErrors(page);
    const before = await readCode(page);
    await page.locator('#view g.edgeLabel', { hasText: 'why' }).first().click();
    await expect(outline(page)).toHaveAttribute('data-selected', 'edge-0');
    await page.getByTestId(TID.inspEdgeReverse).click();
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(t('sel.reverseDuplicate'));
    expect(await readCode(page)).toBe(before);
    await assertInvariants(page, errors, { label: 'reverse onto its opposite' });
  });
});
