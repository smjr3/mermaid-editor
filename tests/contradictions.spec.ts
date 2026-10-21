import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { formField, formMessage, openForm, submitForm } from './helpers/canvas';
import { expectAtRoot } from './helpers/inspector';
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

  test('the code switched to another diagram type under a selection: the inspector follows it', async ({
    page
  }) => {
    await node(page, 'B').click();
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Middle');
    // Pasted over the whole code, as someone replacing the diagram would.
    const paste = async (code: string) => {
      await page.locator('.monaco-editor').first().click();
      await page.keyboard.press('Control+a');
      await page.evaluate((text) => navigator.clipboard.writeText(text), code);
      await page.keyboard.press('Control+v');
      // Monaco may keep the indentation it pasted at and write CRLF: compare the text.
      const text = async () =>
        (await readCode(page)).replaceAll('\r\n', '\n').replaceAll(/[ \t]+$/gm, '');
      await expect.poll(text).toBe(code);
    };
    // A sequence diagram that also has a B: the inspector shows that participant.
    await paste(
      'sequenceDiagram\n  participant A as Client\n  participant B as Server\n  A->>B: hello'
    );
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Server');
    await assertInvariants(page, errors, { label: 'flowchart → sequence' });
    // One without it: the selection goes, rather than pointing at nothing.
    await paste('pie title Pets\n  "Dogs" : 3\n  "Cats" : 2');
    await expectAtRoot(page);
    await expect(outline(page)).toBeHidden();
    await assertInvariants(page, errors, { label: 'sequence → pie' });
    // Back to a flowchart: nothing is selected until clicked, and clicking still works.
    await paste(flow);
    await expect(page.locator('#view')).toContainText('Middle', { timeout: 15_000 });
    // The type's own theme is filled in after the first drawing, which draws it again: a
    // click during that second drawing lands on the picture being replaced.
    await expect(async () => {
      await node(page, 'C').click();
      await expect(outline(page)).toHaveAttribute('data-selected', 'C', { timeout: 1000 });
    }).toPass();
    await expect(page.getByTestId(TID.inspName)).toHaveValue('End');
    await assertInvariants(page, errors, { label: 'pie → flowchart' });
  });

  test('folding the inspector in the middle of a rename applies the name; unfolding shows it', async ({
    page
  }) => {
    const before = await readCode(page);
    await node(page, 'A').click();
    await page.keyboard.press('F2');
    await page.keyboard.insertText('Half typed');
    await page.getByTestId(TID.inspCollapse).click();
    await expect.poll(() => readCode(page)).toContain('A["Half typed"]');
    await page.getByTestId(TID.wsInspectorExpand).click();
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Half typed');
    await expect(outline(page)).toHaveAttribute('data-selected', 'A');
    await assertInvariants(page, errors, { before, label: 'fold mid-rename' });
  });

  test('keys typed in an add-bar form do not act on the selection behind it', async ({ page }) => {
    const before = await readCode(page);
    await node(page, 'B').click();
    await openForm(page, 'laneForm');
    await formField(page, 'name').click();
    await page.keyboard.type('abc');
    for (const key of ['Delete', 'Backspace', 'F2', 'Enter', 'ArrowDown', 'Tab']) {
      await page.keyboard.press(key);
    }
    // Enter submitted the form (a group named ab); the node behind was neither deleted,
    // renamed nor given a next node.
    await expect.poll(() => readCode(page)).toContain('ab');
    const code = await readCode(page);
    expect(code).toContain('B[Middle]');
    expect(code.split('\n').filter((line) => line.includes('-->'))).toHaveLength(2);
    await assertInvariants(page, errors, { before, label: 'keys in a form' });
  });

  test('a burst of inspector edits undoes back to the start and redoes to the end', async ({
    page
  }) => {
    const start = await readCode(page);
    await node(page, 'A').click();
    for (const colour of ['blue', 'red', 'green']) {
      await page.getByTestId(`${TID.inspColor}-${colour}`).click();
    }
    await page.getByTestId(TID.inspTextBold).click();
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('Next');
    await page.keyboard.press('Enter');
    await expect.poll(() => readCode(page)).toContain('Next');
    await page.keyboard.press('Tab');
    await expect.poll(() => readCode(page)).toMatch(/新しい図形|New/);
    await page.keyboard.press('Escape');
    const end = await assertInvariants(page, errors, { label: 'burst' });
    const undo = page.getByTestId(TID.undoButton);
    while (await undo.isEnabled()) await undo.click();
    await expect.poll(() => readCode(page)).toBe(start);
    const redo = page.getByTestId(TID.redoButton);
    while (await redo.isEnabled()) await redo.click();
    await expect.poll(() => readCode(page)).toBe(end);
    await assertInvariants(page, errors, { label: 'undo all, redo all' });
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
