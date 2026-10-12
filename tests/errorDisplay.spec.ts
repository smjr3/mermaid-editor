import { TID } from '$/constants';
import { expect, t, test } from './test';

test.describe('Error display tests', () => {
  test('the code pane footer names the error; with none, it points at F2', async ({
    editPage,
    page
  }) => {
    const footer = page.getByTestId(TID.wsCodeFooter);
    await expect(footer).toHaveText(t('ws.codeFooterOk'));
    await expect(footer).toHaveAttribute('data-error', 'false');

    await editPage.clearEditor();
    await editPage.typeInEditor('graph TD\nA --> B -->');
    await expect(footer).toHaveAttribute('data-error', 'true');
    // The same plain description as the notice over the diagram, in one line.
    await expect(footer).toContainText('2');
    await expect(footer).not.toHaveText(t('ws.codeFooterOk'));
    // mermaid's own message, in full, under the editor.
    await editPage.checkError('Parse error');

    await editPage.typeInEditor(' C');
    await expect(footer).toHaveText(t('ws.codeFooterOk'));
    await expect(page.getByTestId(TID.errorContainer)).toBeHidden();
  });

  // Upstream shows an AI Repair button beside a Code-tab syntax error, which links
  // out to Mermaid Chart. This fork disables AI affordances by default
  // (MERMAID_IS_ENABLED_AI_FEATURES / MERMAID_IS_ENABLED_MERMAID_CHART_LINKS), so the
  // error itself must still surface while the AI affordance stays away.
  test('should report a Code tab syntax error without offering AI Repair', async ({ editPage }) => {
    await editPage.clearEditor();
    await editPage.typeInEditor('graph TD\nA --> B -->');

    // The error itself must still be reported to the user
    await editPage.checkError(t('editor.syntaxError'));

    // ...but no AI Repair button or help text
    await editPage.checkAIHelperVisibility(false);
  });

  test('should not show AI Repair button for errors in Config tab', async ({ editPage, page }) => {
    await editPage.clearEditor();
    await editPage.typeInEditor('graph TD\nA --> B');

    await editPage.setEditorMode('Config');
    await editPage.clearEditor();
    await editPage.typeInEditor('{\n  "theme": "default",\n  invalid json');

    await editPage.checkError(t('editor.syntaxError'));
    await expect(page.getByTestId(TID.wsCodeFooter)).toHaveText(t('recover.config'));
    await editPage.checkAIHelperVisibility(false);
  });
});
