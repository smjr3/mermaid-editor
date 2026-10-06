import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { expect, t, test } from './test';

// When the code has a mistake, nobody is left stuck: the last picture stays, a plain
// notice by the diagram and in the tools names the line, one click goes back to the
// last valid state, the tools refuse rather than write into broken code, and nothing
// a tool writes, a link holds or the browser stored can leave the page blank.

const urlFor = (code: string, mermaid = '{}') =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid })).toString('base64')}`;
const pakoFor = (state: unknown) =>
  `/edit#pako:${deflateSync(Buffer.from(JSON.stringify(state))).toString('base64url')}`;
const stored = (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));

const flow = 'flowchart TD\n  A[Start] --> B[Middle]\n  B --> C[Finish]';
const notice = (page: Page) => page.getByTestId(TID.diagramErrorNotice);
const toolsNotice = (page: Page) => page.getByTestId(TID.toolsErrorNotice);
const node = (page: Page, text: string) => page.locator('#view .node', { hasText: text }).first();

/**
 * Types an arrow with no target at the end of the last line, which then stops
 * part-way. No prefix of "-->" parses there, so the last valid code stays `flow`.
 */
const breakCode = async (page: Page) => {
  await page.locator('.monaco-editor').first().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('-->', { delay: 10 });
  await expect(notice(page)).toBeVisible({ timeout: 10_000 });
  // Out of the editor, so the selection keys below reach the diagram.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
};
const brokenFlow = `${flow}-->`;

// Every test here also checks that nothing was thrown that the page did not catch.
let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
});
test.afterEach(() => {
  // The fixture's init script also runs on about:blank, which has no storage.
  expect(pageErrors.filter((message) => !message.includes('Access is denied'))).toEqual([]);
});

test.describe('Error recovery: a mistake in the code', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test.beforeEach(async ({ editPage }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
  });

  test('names the line in plain words, keeps the last picture and reverts in one click', async ({
    editPage,
    page
  }) => {
    await breakCode(page);
    const unfinished = t('recover.unfinished', { line: '3' });
    await expect(notice(page)).toContainText(unfinished);
    await expect(notice(page)).toContainText(t('recover.showingLast'));
    await expect(toolsNotice(page)).toContainText(unfinished);
    await editPage.checkError(unfinished);
    // The last valid picture is still there.
    await editPage.checkTextInView('Finish');

    await notice(page).getByTestId(TID.revertToValid).click();
    await expect.poll(() => stored(page)).toBe(flow);
    await expect(notice(page)).toBeHidden();
    await expect(toolsNotice(page)).toBeHidden();

    // Revert is one more step: Undo brings the broken code back, and the notice with it.
    await page.getByTestId(TID.undoButton).click();
    await expect.poll(() => stored(page)).toBe(brokenFlow);
    await expect(notice(page)).toBeVisible({ timeout: 10_000 });
    await toolsNotice(page).getByTestId(TID.revertToValid).click();
    await expect.poll(() => stored(page)).toBe(flow);
  });

  test('is shown by the diagram even with the code pane folded', async ({ page }) => {
    await breakCode(page);
    await page.getByTestId(TID.editorPaneToggle).click();
    await expect(page.getByTestId(TID.editorRail)).toBeVisible();
    await expect(notice(page)).toBeVisible();
    await notice(page).getByTestId(TID.revertToValid).click();
    await expect.poll(() => stored(page)).toBe(flow);
  });

  test('the tools keep their lists but refuse to edit, and say why', async ({ page }) => {
    await breakCode(page);
    const blocked = t('recover.blocked');

    // Edit: the objects are still listed (from the last valid code); renaming is refused.
    await page.getByTestId(TID.editCard).click();
    await expect(page.getByTestId(TID.editObjectSelect).locator('option')).toHaveCount(3);
    await page.getByTestId(TID.editRenameInput).fill('Renamed');
    await page.getByTestId(TID.editRenameButton).click();
    await expect(page.getByTestId(TID.editMessage)).toHaveText(blocked);

    // Add: refused too.
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(TID.addLaneName).fill('Lane');
    await page.getByTestId(TID.addLaneButton).click();
    await expect(page.getByTestId(TID.addMessage)).toHaveText(blocked);

    // Colours: "colour them all" is refused with a message.
    await page.getByTestId(TID.colorsCard).click();
    await page.getByTestId(TID.colorsNodesAuto).click();
    await expect(page.getByText(blocked).first()).toBeVisible();

    expect(await stored(page)).toBe(brokenFlow);
  });

  test('selection keys and the mini toolbar do not change broken code', async ({ page }) => {
    await breakCode(page);
    await node(page, 'Middle').click();
    await expect(page.getByTestId(TID.selectionOutline)).toHaveAttribute('data-selected', 'B');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await node(page, 'Finish').click({ button: 'right' });
    await expect(page.getByTestId(TID.contextMenu)).toBeVisible();
    await page.keyboard.press('Escape');
    await node(page, 'Start').click();
    await page.getByTestId(TID.selectionDelete).click();
    await expect(page.getByText(t('recover.blocked')).first()).toBeVisible();
    expect(await stored(page)).toBe(brokenFlow);
  });

  test('an emptied editor says so and offers the last valid state', async ({ editPage, page }) => {
    await editPage.clearEditor();
    await expect(notice(page)).toContainText(t('recover.empty'), { timeout: 10_000 });
    await editPage.checkTextInView('Finish');
    await notice(page).getByTestId(TID.revertToValid).click();
    await expect.poll(() => stored(page)).toBe(flow);
  });

  test('undo after a sample and after a new diagram never leaves a blank page', async ({
    editPage,
    page
  }) => {
    await editPage.loadSampleDiagram('Pie');
    await editPage.checkTextInView('Dogs');
    await page.getByTestId(TID.undoButton).click();
    await expect.poll(() => stored(page)).toBe(flow);
    await editPage.checkTextInView('Middle');
    await breakCode(page);
    // A sample replaces broken code: it is a way out, not blocked.
    await editPage.loadSampleDiagram('Pie');
    await editPage.checkTextInView('Dogs');
    await expect(notice(page)).toBeHidden();
    await page.getByTestId(TID.undoButton).click();
    await expect(notice(page)).toBeVisible({ timeout: 10_000 });
    await editPage.checkTextInView('Dogs');
  });
});

test.describe('Error recovery: what a tool writes always parses', () => {
  test('an arrow label with brackets is quoted', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(TID.addEdgeFrom).selectOption('C');
    await page.getByTestId(TID.addEdgeTo).selectOption('A');
    await page.getByTestId(TID.addEdgeLabel).fill('retry (max 3) ]');
    await page.getByTestId(TID.addEdgeButton).click();
    await expect.poll(() => stored(page)).toContain('C -->|"retry (max 3) ]"| A');
    await editPage.checkTextInView('retry (max 3) ]');
    await expect(notice(page)).toBeHidden();
  });

  test('a mindmap topic renamed with a bracket keeps the mindmap valid', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('mindmap\n  root((Centre))\n    Alpha\n    Beta'));
    await editPage.checkTextInView('Alpha');
    await page.getByTestId(TID.editCard).click();
    await page.getByTestId(TID.editObjectSelect).selectOption({ label: '  Alpha' });
    await page.getByTestId(TID.editRenameInput).fill('Alpha (draft)');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain('Alpha["Alpha (draft)"]');
    await editPage.checkTextInView('Alpha (draft)');
  });
});

test.describe('Error recovery: the config', () => {
  test('a broken config is reported and reset from the notice', async ({ editPage, page }) => {
    await editPage.checkTextInView('Car');
    await editPage.setEditorMode('Config');
    await editPage.clearEditor();
    await editPage.typeInEditor('{ "theme": ', { bottom: false });
    await expect(notice(page)).toContainText(t('recover.config'), { timeout: 10_000 });
    await editPage.checkTextInView('Car');
    page.once('dialog', (dialog) => void dialog.accept());
    await notice(page).getByTestId(TID.noticeResetConfig).click();
    await expect(notice(page)).toBeHidden();
    await expect(page.getByTestId(TID.errorContainer)).toBeHidden();
  });
});

test.describe('Error recovery: links and stored state', () => {
  test('a stored state without its newer fields opens normally', async ({ editPage, page }) => {
    await page.evaluate(() =>
      localStorage.setItem('codeStore', JSON.stringify({ code: 'flowchart TD\n  Kept --> Too' }))
    );
    // Without a hash: a reload would load the diagram the URL already carries. (The view
    // used to draw the stored state for a moment before the linked one, which hid that.)
    await page.goto('/edit');
    await expect(page.locator('.monaco-editor')).toBeVisible();
    await editPage.checkTextInView('Kept');
  });

  test('stored code with a mistake opens with the notice and a way to start over', async ({
    editPage,
    page
  }) => {
    await page.evaluate(() =>
      localStorage.setItem(
        'codeStore',
        JSON.stringify({ code: 'flowchart TD\n  A -->', mermaid: '{}', rough: false })
      )
    );
    await page.goto('/edit');
    await expect(notice(page)).toContainText(t('recover.unfinished', { line: '2' }), {
      timeout: 10_000
    });
    await notice(page).getByTestId(TID.revertToValid).click();
    await editPage.checkTextInView('Christmas');
  });

  test('a link that is not a diagram state shows the "link could not be read" diagram', async ({
    editPage
  }) => {
    for (const url of [
      pakoFor({ code: 42, mermaid: '{}' }),
      pakoFor(null),
      '/edit#pako:eNqrVkpJTVSyUlAqzsgvyklRqgUAPf0GaQ!!!'
    ]) {
      await editPage.start(url);
      await editPage.checkTextInView('URL');
    }
  });

  test('a link with an unknown diagram type opens with the notice', async ({ editPage, page }) => {
    await editPage.start(pakoFor({ code: 'foobarDiagram\n  x', mermaid: '{}' }));
    await expect(notice(page)).toContainText(t('recover.noType', { line: '1' }), {
      timeout: 10_000
    });
  });

  test('a state inside itself is reported instead of hanging the page', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('stateDiagram-v2\n  [*] --> A\n  state A {\n    [*] --> A\n  }'));
    await expect(notice(page)).toContainText(t('recover.selfNested', { line: '4', name: 'A' }), {
      timeout: 10_000
    });
    // The page still answers, and starting over works.
    await notice(page).getByTestId(TID.revertToValid).click();
    await editPage.checkTextInView('Christmas');
  });
});

test.describe('Error recovery: a diagram that cannot be drawn', () => {
  test('is reported, leaves no half-drawn element, and reverts to the last picture', async ({
    editPage,
    page
  }) => {
    const gantt = 'gantt\n  dateFormat YYYY-MM-DD\n  section S\n    Plan :a1, 2026-01-05, 3d';
    await editPage.start(urlFor(gantt));
    await editPage.checkTextInView('Plan');
    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Bad :a2, 2026-99-99, 3d', { delay: 5 });
    await expect(notice(page)).toContainText(t('recover.render'), { timeout: 10_000 });
    await editPage.checkTextInView('Plan');
    expect(
      await page.evaluate(
        () => [...document.body.children].filter((element) => /^dgraph-/.test(element.id)).length
      )
    ).toBe(0);
    // Back to the last code that was drawn (part of the new line may have been).
    await notice(page).getByTestId(TID.revertToValid).click();
    await expect.poll(() => stored(page)).not.toContain('2026-99-99');
    await expect(notice(page)).toBeHidden();
    await editPage.checkTextInView('Plan');
  });
});
