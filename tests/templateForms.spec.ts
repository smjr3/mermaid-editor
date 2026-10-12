import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { openNewDialog } from './helpers/newDlg';
import { EditorPage, expect, t, test } from './test';

const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
// Monaco may write CRLF line endings; compare the lines, not the separator.
const stored = async (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));

// The business templates that have a form: the form's id, and the sample it belongs to.
const forms = [
  { id: 'expense', title: 'スイムレーン業務フロー' },
  { id: 'approval', title: '稟議・承認フロー' },
  { id: 'support', title: '問い合わせ対応フロー' },
  { id: 'hiring', title: '採用プロセス' },
  { id: 'architecture', title: 'システム構成図' },
  { id: 'gantt', title: 'プロジェクト工程表' },
  { id: 'org', title: '組織図' },
  { id: 'closing', title: '月次決算フロー' },
  { id: 'kanban', title: '業務分担表' }
];

/** Opens the サンプル tab, chooses the sample and opens its form. */
const openForm = async (page: Page, title: string) => {
  await openNewDialog(page, 'sample');
  await page.locator(`[data-testid="${TID.newDlgSample}"][data-title="${title}"]`).first().click();
  await page.getByTestId(TID.newDlgSampleForm).click();
  await expect(page.getByTestId(TID.templateFormsDialog)).toBeVisible();
};
const field = (page: Page, ...path: (string | number)[]) =>
  page.getByTestId([TID.templateFormsField, ...path].join('-'));

test.describe('Create from a template', () => {
  test('every business template offers its form, with a rendered preview', async ({
    editPage,
    page
  }) => {
    test.slow();
    await editPage.start(urlFor('pie\n  "a" : 1'));
    await openNewDialog(page, 'sample');
    for (const { id, title } of forms) {
      await page
        .locator(`[data-testid="${TID.newDlgSample}"][data-title="${title}"]`)
        .first()
        .click();
      await expect(page.getByTestId(TID.newDlgSampleForm)).toHaveAttribute('data-form', id);
    }
    await page.getByTestId(TID.newDlgSampleForm).click();
    await expect(page.getByTestId(TID.templateFormsDialog)).toBeVisible();
    await expect(page.getByTestId(`${TID.templateFormsItem}-preview`).locator('svg')).toBeVisible();
  });

  test('fills the expense flow form with a new lane and step, and opens it in a new tab', async ({
    context,
    editPage,
    page
  }) => {
    page.on('dialog', () => {
      throw new Error('a form must not ask anything');
    });
    await editPage.start(urlFor('flowchart TD\n  X[My own work] --> Y'));
    await editPage.checkTextInView('My own work');
    await openForm(page, 'スイムレーン業務フロー');

    await expect(field(page, 'title')).toHaveValue('経費精算フロー');
    await page.getByTestId(`${TID.templateFormsAddRow}-lanes`).click();
    await field(page, 'lanes', 3, 'name').fill('監査室');
    await page.getByTestId(`${TID.templateFormsAddRow}-steps`).click();
    await field(page, 'steps', 6, 'text').fill('監査記録を残す');
    // The new lane is offered by name in the step's lane choice.
    await field(page, 'steps', 6, 'lane').selectOption({ label: '監査室' });
    await field(page, 'title').fill('出張旅費の精算');

    const url = await editPage.captureWindowOpen(() =>
      page.getByTestId(TID.templateFormsCreate).click()
    );
    expect(url).toMatch(/\/edit#pako:/);
    await expect(page.getByTestId(TID.templateFormsDialog)).toHaveCount(0);
    // This tab keeps its own diagram; the dialog says where the new one went.
    await expect(page.getByTestId(TID.newDlgMessage)).toHaveText(
      t('template.done', { name: 'スイムレーン業務フロー' })
    );
    await editPage.checkTextInView('My own work');

    const other = new EditorPage(await context.newPage());
    await other.start(url);
    await other.checkTextInView('監査室');
    await other.checkTextInView('監査記録を残す');
    await other.checkTextInView('出張旅費の精算');
    await expect(other.page.getByTestId(TID.errorContainer)).toHaveCount(0);
    expect(await stored(other.page)).toMatch(/subgraph g4 \["監査室"\]\n\s+n7\["監査記録を残す"\]/);
  });

  test('changes a gantt task and draws it, with the dialog still open for the next one', async ({
    context,
    editPage,
    page
  }) => {
    test.slow();
    page.on('dialog', () => {
      throw new Error('a form must not ask anything');
    });
    await editPage.start(urlFor('pie\n  "a" : 1'));
    const other = new EditorPage(await context.newPage());

    await openForm(page, '業務分担表');
    let url = await editPage.captureWindowOpen(() =>
      page.getByTestId(TID.templateFormsCreate).click()
    );
    await other.start(url);
    await other.checkTextInView('月次レポートの作成');

    // The 新規 dialog is still there for the next template.
    await expect(page.getByTestId(TID.newDlg)).toBeVisible();
    await page
      .locator(`[data-testid="${TID.newDlgSample}"][data-title="プロジェクト工程表"]`)
      .first()
      .click();
    await page.getByTestId(TID.newDlgSampleForm).click();
    await field(page, 'tasks', 0, 'name').fill('キックオフ会議');
    await field(page, 'tasks', 0, 'days').fill('3');
    await field(page, 'tasks', 0, 'start').fill('2026-06-01');
    url = await editPage.captureWindowOpen(() => page.getByTestId(TID.templateFormsCreate).click());
    await other.start(url);
    await other.checkTextInView('キックオフ会議');
    await expect(other.page.getByTestId(TID.errorContainer)).toHaveCount(0);
    expect(await stored(other.page)).toContain('キックオフ会議 :done, t1, 2026-06-01, 3d');

    // The other tab came to the front while it loaded; Playwright's stability check needs this one drawing.
    await page.bringToFront();
    // Cancel closes the form without opening anything; the sample picker is still there.
    await page.locator(`[data-testid="${TID.newDlgSample}"][data-title="組織図"]`).first().click();
    await page.getByTestId(TID.newDlgSampleForm).click();
    await expect(page.getByTestId(TID.templateFormsDialog)).toBeVisible();
    await page.getByTestId(TID.templateFormsBack).click();
    await expect(page.getByTestId(TID.templateFormsDialog)).toHaveCount(0);
    await expect(page.getByTestId(TID.newDlgSampleForm)).toBeVisible();
    // This tab's diagram is untouched.
    await expect(editPage.editor).toContainText('"a" : 1');
  });
});
