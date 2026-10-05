import { C, TID } from '$/constants';
import { createTranslator, resolveLocale } from '$/i18n/translate';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { verifyFileSizeGreaterThan, type EditorOptions } from './utils';

// The app resolves its locale from import.meta.env, which does not exist in
// Playwright's Node process, so read the same build-time variable directly and
// resolve it with the app's own function.
/** Look up the UI string the build under test actually renders. */
export const t = createTranslator(resolveLocale(process.env.MERMAID_LOCALE));

export class EditorPage {
  readonly editor: Locator;
  readonly markdownInput: Locator;
  readonly view: Locator;

  constructor(readonly page: Page) {
    this.editor = page.locator('css=.monaco-editor');
    this.markdownInput = page.getByTestId(TID.copyMarkdown);
    this.view = page.locator('#view');
  }

  async start(url = '/edit') {
    // A full page load: changing only the hash of the already open editor can
    // lose to the editor writing its previous state back into the URL.
    if (url.includes('#') && this.page.url() !== 'about:blank') {
      await this.page.goto('about:blank');
    }
    await this.page.goto(url);
    await expect(this.page)
      .toHaveURL(/.*\/edit#pako/)
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      .catch(() => {});
  }

  async typeInEditor(text: string, { bottom = true, newline = false }: EditorOptions = {}) {
    await this.editor.click();
    if (bottom) {
      await this.page.keyboard.press('PageDown');
    }
    if (newline) {
      await this.page.keyboard.press('Enter');
    }
    await this.page.keyboard.type(text, { delay: 10 });
  }

  async clearEditor() {
    await this.editor.click();
    await this.page.keyboard.press('Control+KeyA');
    await this.page.keyboard.press('Backspace');
  }

  async toggleActions() {
    await this.page.getByTestId(TID.actionsCard).click();
  }

  async toggleSampleDiagrams() {
    await this.page.getByTestId(TID.sampleDiagramsCard).click();
  }

  async checkAndDownloadPNG(expectedSize: number) {
    const downloadPNGPromise = verifyFileSizeGreaterThan(this.page, 'diagram', 'png', expectedSize);
    await this.page.getByTestId(TID.downloadPNG).click();
    return await downloadPNGPromise;
  }

  async downloadSVG(expectedSize: number) {
    const downloadSVGPromise = verifyFileSizeGreaterThan(this.page, 'diagram', 'svg', expectedSize);
    await this.page.getByTestId(TID.downloadSVG).click();
    return await downloadSVGPromise;
  }

  // The Samples card shows a few catalogue keys under a translated name (Preset.svelte).
  async loadSampleDiagram(diagramName: string) {
    const shown: Record<string, string> = {
      'Entity Relationship': t('preset.name.er'),
      Packet: t('preset.name.packet'),
      XY: t('preset.name.xy')
    };
    await this.page.getByText(shown[diagramName] ?? diagramName, { exact: true }).click();
  }

  /**
   * The view renders asynchronously — a debounced state update, then an async
   * mermaid parse, then the render itself — and the app deliberately defers
   * rendering for large diagrams. Playwright's default 5s expect timeout races
   * all of that, which is what made three separate tests flake under CI's
   * parallel workers while passing locally. `test.slow()` does not help: it
   * extends the test's overall budget, not the per-assertion timeout.
   *
   * A longer window costs nothing when the text does appear, because the
   * assertion polls and returns immediately; it only changes how long a
   * genuinely broken render takes to report. `checkError` below already
   * carries a raised timeout for the same reason.
   */
  async checkTextInView(text: string) {
    await expect(this.view).toContainText(text, { timeout: 15_000 });
  }

  async checkTextNotInView(text: string) {
    await expect(this.view).not.toContainText(text);
  }

  async checkError(text: string) {
    await expect(this.page.getByTestId(TID.errorContainer)).toContainText(text, {
      timeout: 10_000
    });
  }

  async checkInEditor(text: string) {
    await expect(this.editor).toContainText(text);
  }

  async toggleComment(text: string) {
    await this.editor.getByText(text).click();
    await this.page.keyboard.press('Control+/');
  }

  async setEditorMode(mode: 'Code' | 'Config') {
    const label = mode === 'Code' ? t('editor.textTab') : t('editor.configTab');
    await this.page.getByRole('tab').getByText(label).click();
  }

  async checkDocURL(url: string | RegExp) {
    await expect(this.page.getByTestId(TID.diagramDocumentationButton)).toHaveAttribute(
      'href',
      url
    );
  }

  async toggleTheme() {
    await this.page.getByTestId(TID.themeToggleButton).click();
  }

  async checkTheme(theme: 'light' | 'dark') {
    await expect(this.page.getByTestId(TID.themeToggleButton)).toHaveAttribute(
      'title',
      theme === 'light' ? t('toolbar.switchToDark') : t('toolbar.switchToLight')
    );
  }

  async checkAIHelperVisibility(shouldBeVisible: boolean) {
    const button = this.page.getByTestId(TID.aiRepairButton);
    const helpText = this.page.getByTestId(TID.aiHelpText);
    await expect(button)[shouldBeVisible ? 'toBeVisible' : 'toBeHidden']();
    await expect(helpText)[shouldBeVisible ? 'toBeVisible' : 'toBeHidden']();
  }
}

export const test = base.extend<{ editPage: EditorPage }>({
  editPage: async ({ page }, use) => {
    // Dismiss the editor chooser modal so it doesn't block interactions
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, C.editorChooserDismissedKey);
    const editorPage = new EditorPage(page);
    await editorPage.start();
    await editorPage.toggleSampleDiagrams();
    await use(editorPage);
  }
});

export { expect } from '@playwright/test';
