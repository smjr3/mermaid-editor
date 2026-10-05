import { TID } from '$/constants';
import { businessTemplatesName, localSamples } from '$/util/localSamples';
import { mkdirSync } from 'node:fs';
import { expect, t, test } from './test';

// The Japanese business templates: each loads from the "Sample Diagrams" card
// (the group button for the default, the group's menu for the rest) and
// renders without an error. Set TEMPLATE_SCREENSHOTS to a directory to also
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

  test('lead the sample list', async ({ page }) => {
    const card = page.getByTestId(TID.sampleDiagramsCard).locator('..');
    // The first sample button; "New diagram" and "From a template" sit above the samples.
    const above = [TID.newDiagramToggle, TID.templateFormsButton]
      .map((id) => `:not([data-testid="${id}"])`)
      .join('');
    await expect(card.locator(`button${above}`).first()).toHaveText(businessTemplatesName);
  });

  for (const [index, { title, isDefault }] of templates.entries()) {
    test(`${title} loads from the card and renders`, async ({ editPage, page }) => {
      if (isDefault) {
        await editPage.loadSampleDiagram(businessTemplatesName);
      } else {
        await page.getByLabel(t('preset.chooseExample', { sample: businessTemplatesName })).click();
        await page.getByText(title, { exact: true }).click();
      }
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
