import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { deflateSync, inflateSync } from 'node:zlib';
import { formField, openForm, submitForm } from './helpers/canvas';
import { closeNewDialog, openNewDialog } from './helpers/newDlg';
import { EditorPage, expect, t, test } from './test';

// When the code has a mistake, nobody is left stuck: the last picture stays, a plain
// notice over the diagram names the line, one click goes back to the last valid state,
// the add bar says to fix the code first and the tools refuse rather than write into
// broken code, and nothing a tool writes, a link holds or the browser stored can leave
// the page blank.

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
    // One notice, over the diagram.
    await expect(page.getByTestId(TID.diagramErrorNotice)).toHaveCount(1);
    // The code pane's footer says it in the same words.
    await expect(page.getByTestId(TID.wsCodeFooter)).toContainText(unfinished);
    // The last valid picture is still there.
    await editPage.checkTextInView('Finish');

    await notice(page).getByTestId(TID.revertToValid).click();
    await expect.poll(() => stored(page)).toBe(flow);
    await expect(notice(page)).toBeHidden();

    // Revert is one more step: Undo brings the broken code back, and the notice with it.
    await page.getByTestId(TID.undoButton).click();
    await expect.poll(() => stored(page)).toBe(brokenFlow);
    await expect(notice(page)).toBeVisible({ timeout: 10_000 });
    await notice(page).getByTestId(TID.revertToValid).click();
    await expect.poll(() => stored(page)).toBe(flow);
  });

  test('is shown by the diagram even with the code pane folded', async ({ page }) => {
    await breakCode(page);
    await page.getByTestId(TID.wsCodeCollapse).click();
    await expect(page.getByTestId(TID.wsCodeRail)).toBeVisible();
    await expect(notice(page)).toBeVisible();
    await notice(page).getByTestId(TID.revertToValid).click();
    await expect.poll(() => stored(page)).toBe(flow);
  });

  test('the add bar says to fix the code first, and comes back when it is fixed', async ({
    page
  }) => {
    const bar = page.getByTestId(TID.canvasInsertBar);
    await expect(bar.getByTestId(TID.canvasInsertItem).first()).toBeVisible();
    await breakCode(page);
    await expect(page.getByTestId(TID.canvasInsertBlocked)).toHaveText(t('canvas.blocked'));
    await expect(bar.getByTestId(TID.canvasInsertItem)).toHaveCount(0);
    await notice(page).getByTestId(TID.revertToValid).click();
    await expect(page.getByTestId(TID.canvasInsertBlocked)).toBeHidden();
    await expect(bar.getByTestId(TID.canvasInsertItem).first()).toBeVisible();
  });

  test('selection keys and the right-click menu do not change broken code', async ({ page }) => {
    await breakCode(page);
    await node(page, 'Middle').click();
    await expect(page.getByTestId(TID.selectionOutline)).toHaveAttribute('data-selected', 'B');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await node(page, 'Finish').click({ button: 'right' });
    await expect(page.getByTestId(TID.contextMenu)).toBeVisible();
    await page.getByTestId(`${TID.contextMenuItem}-delete`).click();
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(t('recover.blocked'));
    expect(await stored(page)).toBe(brokenFlow);
  });

  test('the table refuses a change to broken code, and says why', async ({ editPage, page }) => {
    const gantt = 'gantt\n  dateFormat YYYY-MM-DD\n  section S\n    Plan :a1, 2026-01-05, 3d';
    await editPage.start(urlFor(gantt));
    await editPage.checkTextInView('Plan');
    await page.getByTestId(`${TID.canvasViewMode}-both`).click();
    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('no colon here', { delay: 5 });
    await expect(notice(page)).toBeVisible({ timeout: 10_000 });
    // The table still shows the last valid code, and refuses to write into the broken one.
    const cell = page.getByTestId(`${TID.tableCell}-task`).first();
    await expect(cell).toHaveValue('Plan');
    await cell.fill('Changed');
    await cell.press('Enter');
    await expect(page.getByTestId(TID.tableMessage)).toHaveText(t('recover.blocked'));
    expect(await stored(page)).not.toContain('Changed');
  });

  test('the inspector and the add bar say why they do not edit', async ({ page }) => {
    await breakCode(page);
    await expect(page.getByTestId(TID.inspBlocked)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(TID.inspBlocked)).toContainText(t('insp.blocked'));
    await expect(page.getByTestId(TID.canvasInsertBlocked)).toBeVisible();
    // The theme rows stay usable: settings are not blocked.
    await expect(page.locator(`[data-testid^="${TID.inspThemePreset}-"]`).first()).toBeEnabled();
  });

  test('an emptied editor says so and offers the last valid state', async ({ editPage, page }) => {
    await editPage.clearEditor();
    await expect(notice(page)).toContainText(t('recover.empty'), { timeout: 10_000 });
    await editPage.checkTextInView('Finish');
    await notice(page).getByTestId(TID.revertToValid).click();
    await expect.poll(() => stored(page)).toBe(flow);
  });

  test('a sample is a way out of broken code: it opens in a new tab that starts clean', async ({
    context,
    editPage,
    page
  }) => {
    await breakCode(page);
    const broken = await stored(page);
    // A sample is not blocked by the broken code; it opens in a new tab.
    await openNewDialog(page, 'sample');
    const dialog = page.getByTestId(TID.newDlg);
    await dialog.locator(`[data-testid="${TID.newDlgSample}"][data-group="Pie"]`).first().click();
    const url = await editPage.captureWindowOpen(() =>
      dialog.getByTestId(TID.newDlgSampleStart).click()
    );
    await closeNewDialog(page);
    // This tab keeps its code, broken as it is, with the notice and the last picture.
    expect(await stored(page)).toBe(broken);
    await expect(notice(page)).toBeVisible();
    await editPage.checkTextInView('Middle');
    // The new tab draws the sample, with nothing to undo into a blank page.
    const other = new EditorPage(await context.newPage());
    await other.start(url);
    await other.checkTextInView('Dogs');
    await expect(other.page.getByTestId(TID.diagramErrorNotice)).toBeHidden();
    await expect(other.page.getByTestId(TID.undoButton)).toBeDisabled();
  });
});

test.describe('Error recovery: what a tool writes always parses', () => {
  test('an arrow label with brackets is quoted', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
    await openForm(page, 'edge');
    await formField(page, 'from').selectOption('C');
    await formField(page, 'to').selectOption('A');
    await formField(page, 'label').fill('retry (max 3) ]');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('C -->|"retry (max 3) ]"| A');
    await editPage.checkTextInView('retry (max 3) ]');
    await expect(notice(page)).toBeHidden();
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

// R03: a browser that will not save (full storage, blocked site data) must still let
// the diagram be edited, drawn and shared; it says once that nothing is being saved.
test.describe('Error recovery: a browser that does not save', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  const linkedCode = (url: string) => {
    const [, data = ''] = /#pako:(.+)$/.exec(url) ?? [];
    if (!data) return '';
    const state = JSON.parse(inflateSync(Buffer.from(data, 'base64url')).toString()) as {
      code?: string;
    };
    return (state.code ?? '').replaceAll('\r\n', '\n');
  };
  const addLine = async (page: Page) => {
    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n  C --> D[Kept in the link]', { delay: 10 });
  };

  test('with full storage the diagram is edited, drawn and linked, and it says so once', async ({
    editPage,
    page
  }) => {
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'codeStore') {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        }
        setItem.call(this, key, value);
      };
    });
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
    await addLine(page);
    await editPage.checkTextInView('Kept in the link');
    await expect.poll(() => linkedCode(page.url())).toContain('D[Kept in the link]');
    await expect(page.getByText(t('storage.notSaving'))).toHaveCount(1);
  });

  test('with blocked storage the page opens, draws and follows the edits', async ({
    editPage,
    page
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        }
      });
    });
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Middle');
    // Nothing remembers that the first-visit guide was seen.
    await page.keyboard.press('Escape');
    await addLine(page);
    await editPage.checkTextInView('Kept in the link');
    await expect.poll(() => linkedCode(page.url())).toContain('D[Kept in the link]');
    await expect(page.getByText(t('storage.notSaving'))).toHaveCount(1);
  });
});
