import { TID } from '$/constants';
import { businessTemplatesName, localSamples } from '$/util/localSamples';
import { mkdirSync } from 'node:fs';
import { expect, t, test } from './test';

// The Japanese business templates: each loads from the "Templates" card (one picker
// with a search box and categories, Preset.svelte) and renders without an error. Set TEMPLATE_SCREENSHOTS to a directory to also
// save a picture of each rendered template for review.
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

  test('lead the template list, each with its form', async ({ page }) => {
    const picks = page.getByTestId(TID.templatePick);
    await expect(picks.first()).toHaveAttribute('data-group', businessTemplatesName);
    for (const [index, { title }] of templates.entries()) {
      await expect(picks.nth(index)).toHaveAttribute('data-title', title);
    }
    // Every business template here has a form.
    await expect(page.locator(`[data-testid^="${TID.templateFormsItem}-"]`)).toHaveCount(9);
  });

  test('one picker: search and category narrow the list', async ({ editPage, page }) => {
    const picks = page.getByTestId(TID.templatePick);
    const all = await picks.count();
    expect(all).toBeGreaterThan(40);
    await page.getByTestId(TID.templateSearch).fill('組織');
    await expect(picks).toHaveCount(1);
    await expect(picks.first()).toHaveAttribute('data-title', '組織図');
    await page.getByTestId(TID.templateSearch).fill('zzzzzz');
    await expect(picks).toHaveCount(0);
    await expect(page.getByText(t('preset.noMatch'))).toBeVisible();
    await page.getByTestId(TID.templateSearch).fill('');
    await page.getByTestId(TID.templateCategory).selectOption('Pie');
    await expect(picks.first()).toHaveAttribute('data-group', 'Pie');
    expect(await picks.evaluateAll((list) => list.map((pick) => pick.dataset.group))).toEqual(
      Array.from({ length: await picks.count() }, () => 'Pie')
    );
    await picks.first().click();
    await editPage.checkTextInView('Dogs');
    await expect(page.getByTestId(TID.templatePickMessage)).toBeVisible();
    // upstream's grid of sample chips is gone.
    await expect(page.getByLabel(t('preset.chooseExample', { sample: 'Pie' }))).toHaveCount(0);
  });

  for (const [index, { title }] of templates.entries()) {
    test(`${title} loads from the card and renders`, async ({ editPage, page }) => {
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
