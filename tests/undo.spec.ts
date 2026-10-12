import { TID } from '$/constants';
import { redo, toggleHistory, undo } from './helpers/shell';
import { expect, t, test } from './test';

const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order]
  end
  subgraph Shop
    C[Accept order]
  end
  A --> C`;
const restored = 'flowchart TD\n  R[Restored version]';
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const stored = async (page: import('@playwright/test').Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));

test.describe('Undo / redo', () => {
  test('the header buttons take back a change made outside the editor, then put it back', async ({
    editPage,
    page
  }) => {
    // A saved History entry: restoring it replaces the code at once, as the add bar and
    // the inspector do (one step of its own, not merged with typing).
    await page.evaluate(
      (code) =>
        localStorage.setItem(
          'manualHistoryStore',
          JSON.stringify([
            {
              id: 'm-1',
              name: 'restorable',
              state: { autoSync: true, code, mermaid: '{}', updateDiagram: false },
              time: 1,
              type: 'manual'
            }
          ])
        ),
      restored
    );
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    const undoButton = page.getByTestId(TID.undoButton);
    const redoButton = page.getByTestId(TID.redoButton);
    await expect(undoButton).toHaveAttribute('title', t('editor.undo'));
    await expect(redoButton).toHaveAttribute('title', t('editor.redo'));
    // The loaded diagram is the starting point, not a step back to what was there before.
    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeDisabled();

    await toggleHistory(page);
    await page
      .getByRole('button', { name: t('history.restoreVersion') })
      .first()
      .click();
    await toggleHistory(page);
    await expect.poll(() => stored(page)).toBe(restored);
    await editPage.checkTextInView('Restored version');
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();

    await undo(page);
    await expect.poll(() => stored(page)).toBe(lanes);
    await editPage.checkTextInView('Accept order');
    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeEnabled();

    await redo(page);
    await expect.poll(() => stored(page)).toBe(restored);
    await editPage.checkTextInView('Restored version');
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();
  });

  test('typing settles into one step and a new change drops the redo', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  A --> B'));
    await editPage.checkTextInView('B');
    const redoButton = page.getByTestId(TID.redoButton);

    await editPage.typeInEditor('\n  B --> C');
    await editPage.checkTextInView('C');
    await undo(page);
    await expect.poll(() => stored(page)).toBe('flowchart TD\n  A --> B');
    await expect(redoButton).toBeEnabled();

    await editPage.typeInEditor('\n  B --> D');
    await editPage.checkTextInView('D');
    await expect(redoButton).toBeDisabled();
    await expect(page.getByTestId(TID.undoButton)).toBeEnabled();
  });

  test('steps through the code from the 設定 JSON tab too', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A --> B'));
    await editPage.checkTextInView('B');
    await editPage.typeInEditor('\n  B --> Cat');
    await editPage.checkTextInView('Cat');
    await editPage.setEditorMode('Config');
    await undo(page);
    await expect.poll(() => stored(page)).toBe('flowchart TD\n  A --> B');
    await editPage.checkTextNotInView('Cat');
  });
});
