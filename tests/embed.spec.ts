import { defaultState, TID } from '$/constants';
import type { State } from '$/types';
import { serializeState } from '$/util/serde';
import { expect, test as base, type Page } from '@playwright/test';
import { t, test as editorTest } from './test';

const embedHash = (state: Partial<State>): string => serializeState({ ...defaultState, ...state });

const failOnDialog = (page: Page): void => {
  page.on('dialog', (dialog) => {
    throw new Error(`Unexpected dialog on /embed: ${dialog.message()}`);
  });
};

base.describe('Embed page', () => {
  base(
    'should render a diagram from the URL hash with footer links',
    { tag: '@smoke' },
    async ({ page }) => {
      failOnDialog(page);
      await page.goto(`/embed#${embedHash({ code: 'graph TD\n  A[Hello embed] --> B[World]' })}`);
      await expect(page.locator('#embed-container svg')).toBeVisible();
      await expect(page.locator('#embed-view')).toContainText('Hello embed');
      await expect(page.getByTestId(TID.embedFooter)).toBeVisible();
      await expect(page.getByTestId(TID.embedEditLink)).toHaveAttribute('href', /\/edit#pako:/);
    }
  );

  base('should hide the toolbar and mode toggle with ?controls=0', async ({ page }) => {
    failOnDialog(page);
    await page.goto('/embed?controls=0');
    await expect(page.locator('#embed-container svg')).toBeVisible();
    await expect(page.getByTestId(TID.embedToolbar)).toHaveCount(0);
    await expect(page.getByTestId(TID.embedModeToggle)).toHaveCount(0);
  });

  base('should apply and toggle dark mode', async ({ page }) => {
    failOnDialog(page);
    await page.goto('/embed?mode=dark');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByTestId(TID.embedModeToggle).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  base('should show an error card for a malformed hash', async ({ page }) => {
    failOnDialog(page);
    await page.goto('/embed#pako:garbage');
    await expect(page.getByTestId(TID.embedErrorCard)).toBeVisible();
    await expect(page.locator('#embed-container svg')).toHaveCount(0);
  });

  base('should silently strip unsafe config and stay isolated', async ({ page }) => {
    failOnDialog(page);
    await page.goto(
      `/embed#${embedHash({
        code: 'graph TD\n  S[Sanitized]',
        mermaid: JSON.stringify({
          securityLevel: 'loose',
          themeVariables: { nodeBorder: '<script>alert(1)</script>' }
        })
      })}`
    );
    await expect(page.locator('#embed-view')).toContainText('Sanitized');
    const codeStore = await page.evaluate(() => localStorage.getItem('codeStore'));
    expect(codeStore).toBeNull();
  });

  base('should serve the web component loader at /embed.js', async ({ page }) => {
    const response = await page.request.get('/embed.js');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('mermaid-embed');
    expect(body).toContain(
      'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
    );
  });

  base('should render inside the sandboxed iframe the snippets use', async ({ page, baseURL }) => {
    failOnDialog(page);
    const embedSrc = `/embed#code:${encodeURIComponent('graph TD\n  A[Sandboxed]-->B')}`;
    // The iframe needs the server's real origin, whatever port the run uses.
    const origin = new URL(baseURL ?? 'http://localhost:3000').origin;
    await page.setContent(
      `<!doctype html><iframe id="embed" title="embed"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        src="${origin}${embedSrc}"
        style="width:800px;height:500px;border:0"></iframe>`
    );
    const frame = page.frameLocator('#embed');
    await expect(frame.locator('#embed-container svg')).toBeVisible({ timeout: 20_000 });
    await expect(frame.locator('#embed-view')).toContainText('Sandboxed');
    // Code-level isolation: the embed document must not write the editor store.
    const codeStore = await frame.locator('html').evaluate(() => localStorage.getItem('codeStore'));
    expect(codeStore).toBeNull();
  });

  base('should load #code: hashes from the web component path', async ({ page }) => {
    failOnDialog(page);
    await page.goto(
      `/embed?theme=forest#code:${encodeURIComponent('graph TD\n  A[HashCode]-->B')}`
    );
    await expect(page.locator('#embed-view')).toContainText('HashCode');
  });
});

// The header's 共有 dialog: the edit and view links, and the embed code.
const openShareDialog = async (page: Page) => {
  await page.getByTestId(TID.wsShareButton).click();
  await expect(page.getByTestId(TID.shareDlg)).toBeVisible();
};

editorTest.describe('Share dialog', () => {
  editorTest('offers the edit link, the view link and the embed', async ({ editPage, page }) => {
    void editPage;
    await openShareDialog(page);
    const dialog = page.getByTestId(TID.shareDlg);
    await expect(page.getByTestId(TID.shareDlgEditLink)).toHaveValue(/\/edit#pako:/);
    await expect(page.getByTestId(TID.shareDlgViewLink)).toHaveValue(/\/view#pako:/);
    await expect(dialog).toContainText(t('share.embedHeading'));
    // No button opens the view page, and the retired Playground is not offered.
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await expect(dialog).not.toContainText('Playground');
  });

  editorTest('copies each link', async ({ editPage, page, context, browserName }) => {
    void editPage;
    editorTest.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openShareDialog(page);
    for (const [copy, field] of [
      [TID.shareDlgEditCopy, TID.shareDlgEditLink],
      [TID.shareDlgViewCopy, TID.shareDlgViewLink]
    ] as const) {
      await page.getByTestId(copy).click();
      await expect(page.getByTestId(copy)).toHaveAttribute('data-copy-state', 'done');
      const value = await page.getByTestId(field).inputValue();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(value);
    }
  });

  editorTest('offers iframe and web component snippets', async ({ editPage, page }) => {
    void editPage;
    await openShareDialog(page);
    const snippet = page.getByTestId(TID.shareDlgSnippet);
    await expect(snippet).toBeVisible();
    await expect(snippet).toHaveValue(/\/embed\?.*#pako:/);
    await expect(snippet).toHaveValue(/<iframe/);
    await expect(snippet).toHaveValue(/sandbox="allow-scripts allow-same-origin/);
    await page.getByTestId(`${TID.shareDlgEmbedMode}-wc`).click();
    await expect(snippet).toHaveValue(/<mermaid-embed/);
    await expect(snippet).toHaveValue(/<script src="[^"]*\/embed\.js"/);
  });

  editorTest('the size, grid, theme and frame go into the snippet', async ({ editPage, page }) => {
    void editPage;
    await openShareDialog(page);
    const snippet = page.getByTestId(TID.shareDlgSnippet);
    await page.getByTestId(TID.shareDlgWidth).fill('640px');
    await page.getByTestId(TID.shareDlgHeight).fill('300');
    await expect(snippet).toHaveValue(/width="640px" height="300"/);
    await page.getByTestId(TID.shareDlgGrid).click();
    await expect(snippet).toHaveValue(/grid=0/);
    await page.getByTestId(TID.shareDlgTheme).selectOption('forest');
    await expect(snippet).toHaveValue(/theme=forest/);
    await page.getByTestId(`${TID.shareDlgChrome}-dark`).click();
    await expect(snippet).toHaveValue(/mode=dark/);
    await page.getByTestId(TID.shareDlgControls).click();
    await expect(snippet).toHaveValue(/controls=0/);
    // A size that is not a CSS length falls back to the default.
    await page.getByTestId(TID.shareDlgWidth).fill('"><script>');
    await expect(snippet).toHaveValue(/width="100%"/);
  });

  editorTest(
    'previews the embed and copies the code',
    async ({ editPage, page, context, browserName }) => {
      void editPage;
      editorTest.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await openShareDialog(page);
      await expect(page.getByTestId(TID.embedPreview)).toHaveCount(0);
      await page.getByTestId(TID.shareDlgPreview).click();
      const preview = page.getByTestId(TID.embedPreview);
      await expect(preview).toHaveAttribute('src', /\/embed\?.*#pako:/);
      await expect(
        page.frameLocator(`[data-testid="${TID.embedPreview}"]`).locator('#embed-container svg')
      ).toBeVisible({ timeout: 20_000 });
      await page.getByTestId(TID.shareDlgSnippetCopy).click();
      const snippet = await page.getByTestId(TID.shareDlgSnippet).inputValue();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(snippet);
    }
  );
});
