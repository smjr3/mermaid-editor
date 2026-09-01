import { t, test } from './test';

test.describe('Error display tests', () => {
  // Upstream shows an AI Repair button beside a Code-tab syntax error, which links
  // out to Mermaid Chart. This fork disables AI affordances for organisational use
  // (MERMAID_IS_ENABLED_AI_FEATURES / MERMAID_IS_ENABLED_MERMAID_CHART_LINKS), so the
  // error itself must still surface while the AI affordance stays away.
  test('should report a Code tab syntax error without offering AI Repair', async ({ editPage }) => {
    // Enter code with syntax error
    await editPage.clearEditor();
    await editPage.typeInEditor('graph TD\nA --> B -->');

    // The error itself must still be reported to the user
    await editPage.checkError(t('editor.syntaxError'));

    // ...but no AI Repair button or help text
    await editPage.checkAIHelperVisibility(false);
  });

  test('should not show AI Repair button for errors in Config tab', async ({ editPage }) => {
    // First enter valid diagram
    await editPage.clearEditor();
    await editPage.typeInEditor('graph TD\nA --> B');

    // Switch to Config tab
    await editPage.setEditorMode('Config');

    // Enter invalid JSON in config
    await editPage.clearEditor();
    await editPage.typeInEditor('{\n  "theme": "default",\n  invalid json');

    // Verify error is displayed
    await editPage.checkError(t('editor.syntaxError'));

    // Verify AI Repair button and help text is NOT shown in Config tab
    await editPage.checkAIHelperVisibility(false);
  });
});
