import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { expect, t, test } from './test';

const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
// Monaco may write CRLF line endings; compare the lines, not the separator.
const stored = async (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));

/**
 * Shows the Templates card (the fixture may have folded it), where each business template
 * has a "Fill in a form…" button (`templateFormsItem-<id>`) that opens its form.
 */
const openTemplates = async (page: Page) => {
  const search = page.getByTestId(TID.templateSearch);
  if (!(await search.isVisible())) await page.getByTestId(TID.sampleDiagramsCard).click();
  await expect(search).toBeVisible();
};
const field = (page: Page, ...path: (string | number)[]) =>
  page.getByTestId([TID.templateFormsField, ...path].join('-'));

test.describe('Create from a template', () => {
  test('fills the expense flow form with a new lane and step, then continues in Add', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  X[My own work] --> Y'));
    await editPage.checkTextInView('My own work');
    await openTemplates(page);
    // Every template is offered, with a rendered preview.
    await expect(page.locator(`[data-testid^="${TID.templateFormsItem}-"]`)).toHaveCount(9);
    await page.getByTestId(`${TID.templateFormsItem}-expense`).click();
    // The form shows a rendered preview of the template.
    await expect(page.getByTestId(TID.templateFormsDialog)).toBeVisible();
    await expect(page.getByTestId(`${TID.templateFormsItem}-preview`).locator('svg')).toBeVisible();

    await expect(field(page, 'title')).toHaveValue('経費精算フロー');
    await page.getByTestId(`${TID.templateFormsAddRow}-lanes`).click();
    await field(page, 'lanes', 3, 'name').fill('監査室');
    await page.getByTestId(`${TID.templateFormsAddRow}-steps`).click();
    await field(page, 'steps', 6, 'text').fill('監査記録を残す');
    // The new lane is offered by name in the step's lane choice.
    await field(page, 'steps', 6, 'lane').selectOption({ label: '監査室' });
    await field(page, 'title').fill('出張旅費の精算');

    // The code is the user's own, so the editor asks first.
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe(t('template.confirm'));
      void dialog.accept();
    });
    await page.getByTestId(TID.templateFormsCreate).click();
    await expect(page.getByTestId(TID.templateFormsDialog)).toHaveCount(0);

    await editPage.checkTextInView('監査室');
    await editPage.checkTextInView('監査記録を残す');
    await editPage.checkTextInView('出張旅費の精算');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
    const code = await stored(page);
    expect(code).toMatch(/subgraph g4 \["監査室"\]\n\s+n7\["監査記録を残す"\]/);
    await expect(page.getByTestId(TID.templateFormsMessage)).toHaveText(
      t('template.done', { name: 'スイムレーン業務フロー' })
    );
    // The Add card is open for what comes next.
    await expect(page.getByTestId(TID.addLaneName)).toBeVisible();
  });

  test('changes a gantt task and draws it, without asking over a template', async ({
    editPage,
    page
  }) => {
    let asked = 0;
    page.on('dialog', (dialog) => {
      asked++;
      void dialog.accept();
    });
    await editPage.start(urlFor('pie\n  "a" : 1'));
    // `pie` is the user's own code, so this asks once.
    await openTemplates(page);
    await page.getByTestId(`${TID.templateFormsItem}-kanban`).click();
    await page.getByTestId(TID.templateFormsCreate).click();
    await editPage.checkTextInView('月次レポートの作成');

    // A diagram made from a template unchanged is replaced without asking.
    await openTemplates(page);
    await page.getByTestId(`${TID.templateFormsItem}-gantt`).click();
    await field(page, 'tasks', 0, 'name').fill('キックオフ会議');
    await field(page, 'tasks', 0, 'days').fill('3');
    await field(page, 'tasks', 0, 'start').fill('2026-06-01');
    await page.getByTestId(TID.templateFormsCreate).click();
    await editPage.checkTextInView('キックオフ会議');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
    expect(await stored(page)).toContain('キックオフ会議 :done, t1, 2026-06-01, 3d');
    expect(asked).toBe(1);

    await openTemplates(page);
    await page.getByTestId(`${TID.templateFormsItem}-org`).click();
    await expect(page.getByTestId(TID.templateFormsDialog)).toBeVisible();
    // Cancel closes the form without touching the diagram; the picker is still there.
    await page.getByTestId(TID.templateFormsBack).click();
    await expect(page.getByTestId(TID.templateFormsDialog)).toHaveCount(0);
    expect(await stored(page)).toContain('キックオフ会議');
    await expect(page.getByTestId(`${TID.templateFormsItem}-org`)).toBeVisible();
  });
});
