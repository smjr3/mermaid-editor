import { C, TID } from '$/constants';
import { createTranslator, resolveLocale } from '$/i18n/translate';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { downloadPNG, downloadSVG, openExport } from './helpers/exportDlg';
import { loadSample, openNewDialog } from './helpers/newDlg';
import type { EditorOptions } from './utils';

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

  /** Opens the 書き出す dialog (helpers/exportDlg.ts). */
  async toggleActions() {
    await openExport(this.page);
  }

  /** Opens the 新規 dialog on its サンプル tab (helpers/newDlg.ts). */
  async toggleSampleDiagrams() {
    await openNewDialog(this.page, 'sample');
  }

  async checkAndDownloadPNG(expectedSize: number) {
    return await downloadPNG(this.page, expectedSize);
  }

  async downloadSVG(expectedSize: number) {
    return await downloadSVG(this.page, expectedSize);
  }

  /**
   * Loads a sample through the 新規 dialog's サンプル tab and opens it in this page
   * (helpers/newDlg.ts). `diagramName` is the group's catalogue key ('Pie', 'Swimlane',
   * '業務テンプレート'); `title` picks another of its samples.
   */
  async loadSampleDiagram(diagramName: string, title?: string) {
    await loadSample(this, diagramName, title);
  }

  /**
   * Runs `action` with `window.open` (and links that open a new tab) caught, and returns
   * the absolute URL the page tried to open instead of opening it.
   */
  async captureWindowOpen(action: () => Promise<unknown>): Promise<string> {
    await this.page.evaluate(() => {
      const target = window as unknown as { __capturedOpen?: string[] };
      target.__capturedOpen = [];
      const record = (url: string) => target.__capturedOpen?.push(url);
      window.open = (url?: string | URL) => {
        record(String(url ?? ''));
        return null;
      };
      if (!(window as unknown as { __captureLinks?: boolean }).__captureLinks) {
        (window as unknown as { __captureLinks?: boolean }).__captureLinks = true;
        document.addEventListener(
          'click',
          (event) => {
            const link = (event.target as Element | null)?.closest?.('a[target="_blank"]');
            if (!(link instanceof HTMLAnchorElement) || !target.__capturedOpen) return;
            event.preventDefault();
            record(link.href);
          },
          true
        );
      }
    });
    await action();
    const handle = await this.page.waitForFunction(
      () => (window as unknown as { __capturedOpen?: string[] }).__capturedOpen?.[0]
    );
    const url = (await handle.jsonValue()) as string;
    return new URL(url, this.page.url()).href;
  }

  /** Opens `url` in this page with a full load (through about:blank, as `start` does). */
  async openUrlHere(url: string) {
    await this.page.goto('about:blank');
    await this.page.goto(url);
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
    await this.page.getByTestId(`${TID.wsCodeTab}-${mode === 'Code' ? 'code' : 'config'}`).click();
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

export const test = base.extend<{
  editPage: EditorPage;
  guideSeen: boolean;
}>({
  // The first-visit guide floats over the page, so every spec starts with it already seen;
  // onboarding.spec.ts opts out with `test.use({ guideSeen: false })`.
  context: async ({ context, guideSeen }, use) => {
    await context.addInitScript(
      ({ guideKey, seen }) => {
        try {
          if (seen) window.localStorage.setItem(guideKey, 'true');
        } catch {
          // about:blank and opaque origins have no storage.
        }
      },
      { guideKey: C.guideDoneKey, seen: guideSeen }
    );
    await use(context);
  },
  guideSeen: [true, { option: true }],
  editPage: async ({ page }, use) => {
    // Dismiss the editor chooser modal so it doesn't block interactions
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, C.editorChooserDismissedKey);
    const editorPage = new EditorPage(page);
    await editorPage.start();
    await use(editorPage);
  }
});

export { expect } from '@playwright/test';
