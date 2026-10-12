import { TID } from '$/constants';
import { businessTemplatesName, localSamples } from '$/util/localSamples';
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, t, test } from './test';

const samples = (page: Page) => page.getByTestId(TID.newDlgSample);

// The Japanese business templates: each starts from the 新規 dialog's サンプル tab (one
// picker with a search box and categories, NewDiagramDialog.svelte) in a new tab and renders
// without an error. Set TEMPLATE_SCREENSHOTS to a directory to also save a picture of
// each rendered template for review.
const templates = localSamples[businessTemplatesName];
const screenshots = process.env.TEMPLATE_SCREENSHOTS;

// A piece of text each template must show once rendered.
const shown = new Map([
  ['スイムレーン業務フロー', '差戻し'],
  ['稟議・承認フロー', '役員が審議'],
  ['問い合わせ対応フロー', '原因を調査'],
  ['採用プロセス', '一次面接'],
  ['システム構成図', 'ファイアウォール'],
  ['プロジェクト工程表', '本番リリース'],
  ['組織図', '品質保証部'],
  ['月次決算フロー', '月次試算表'],
  ['業務分担表', '確認待ち']
]);

test.describe('Business templates', () => {
  test.beforeEach(async ({ editPage }) => {
    await editPage.toggleSampleDiagrams();
  });

  test('cover every template in the group', () => {
    expect(templates.map(({ title }) => title).sort()).toEqual([...shown.keys()].sort());
  });

  test('lead the sample list, each tagged as fillable', async ({ page }) => {
    const picks = samples(page);
    await expect(picks.first()).toHaveAttribute('data-group', businessTemplatesName);
    for (const [index, { title }] of templates.entries()) {
      await expect(picks.nth(index)).toHaveAttribute('data-title', title);
      // Every business template here has a form.
      await expect(picks.nth(index).getByText(t('newDlg.formTag'))).toBeVisible();
    }
    await expect(page.getByText(t('newDlg.formTag'))).toHaveCount(9);
  });

  test('one picker: search and category narrow the list', async ({ editPage, page }) => {
    const picks = samples(page);
    const all = await picks.count();
    expect(all).toBeGreaterThan(40);
    await page.getByTestId(TID.newDlgSearch).fill('組織');
    await expect(picks).toHaveCount(1);
    await expect(picks.first()).toHaveAttribute('data-title', '組織図');
    await page.getByTestId(TID.newDlgSearch).fill('zzzzzz');
    await expect(picks).toHaveCount(0);
    await expect(page.getByText(t('preset.noMatch'))).toBeVisible();
    await page.getByTestId(TID.newDlgSearch).fill('');
    await page.locator(`[data-testid="${TID.newDlgCategory}"][data-category="Pie"]`).click();
    await expect(picks.first()).toHaveAttribute('data-group', 'Pie');
    expect(await picks.evaluateAll((list) => list.map((pick) => pick.dataset.group))).toEqual(
      Array.from({ length: await picks.count() }, () => 'Pie')
    );
    // The first sample of the category is chosen, with a rendered preview.
    await expect(picks.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId(TID.newDlgPreview).locator('svg')).toBeVisible();
    const url = await editPage.captureWindowOpen(() =>
      page.getByTestId(TID.newDlgSampleStart).click()
    );
    await editPage.openUrlHere(url);
    await editPage.checkTextInView('Dogs');
  });

  test('starts in a new tab and leaves this diagram alone', async ({ context, editPage, page }) => {
    page.on('dialog', () => {
      throw new Error('a sample must not ask anything');
    });
    const before = await editPage.editor.innerText();
    expect(before).not.toBe('');
    await samples(page).filter({ hasText: '組織図' }).click();
    // The form button is offered for a template that has one.
    await expect(page.getByTestId(TID.newDlgSampleForm)).toBeVisible();
    const start = page.getByTestId(TID.newDlgSampleStart);
    await expect(start).toHaveAttribute('target', '_blank');
    const [popup] = await Promise.all([context.waitForEvent('page'), start.click()]);
    await popup.waitForLoadState();
    await expect(popup.locator('#view')).toContainText('品質保証部', { timeout: 15_000 });
    expect(await editPage.editor.innerText()).toBe(before);
    await expect(page.getByTestId(TID.newDlgMessage)).toHaveText(
      t('newDlg.opened', { name: '組織図' })
    );
  });

  test('a sample without a form offers none', async ({ page }) => {
    await page.locator(`[data-testid="${TID.newDlgCategory}"][data-category="Pie"]`).click();
    await expect(page.getByTestId(TID.newDlgSampleStart)).toBeVisible();
    await expect(page.getByTestId(TID.newDlgSampleForm)).toHaveCount(0);
  });

  for (const [index, { title }] of templates.entries()) {
    test(`${title} starts from the dialog and renders`, async ({ editPage, page }) => {
      await editPage.loadSampleDiagram(businessTemplatesName, title);
      await editPage.checkTextInView(shown.get(title) ?? title);
      await expect(page.locator('#view svg').first()).toBeVisible();
      await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
      if (screenshots) {
        mkdirSync(screenshots, { recursive: true });
        await editPage.view.screenshot({ path: `${screenshots}/${index + 1}-${title}.png` });
      }
    });
  }
});
