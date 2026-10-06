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

const row = (page: Page, index: number) => page.getByTestId(TID.tableRow).nth(index);
const cell = (page: Page, index: number, key: string) =>
  row(page, index).getByTestId(`${TID.tableCell}-${key}`);

/** Opens the Edit card, where the table sits under the per-object forms. */
const openTable = async (page: Page) => {
  await page.getByTestId(TID.editCard).click();
  await expect(page.getByTestId(TID.tableEditor)).toBeVisible();
};

/** Pastes text into the table as Excel's clipboard would. */
const paste = async (page: Page, text: string) => {
  await page
    .getByTestId(TID.tableEditor)
    .getByRole('region')
    .evaluate((element, data) => {
      const transfer = new DataTransfer();
      transfer.setData('text/plain', data);
      element.dispatchEvent(
        new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer })
      );
    }, text);
};

const gantt = `gantt
    title 工程表
    dateFormat YYYY-MM-DD
    section 計画
        要件定義 :done, reqs, 2024-04-01, 10d
        基本設計 :active, design, after reqs, 7d
    section 開発
        実装 :impl, after design, 14d`;

test.describe('Table editor', () => {
  test('edits gantt tasks inline, adds a row and reorders', async ({ editPage, page }) => {
    await editPage.start(urlFor(gantt));
    await editPage.checkTextInView('基本設計');
    await openTable(page);
    await expect(page.getByTestId(TID.tableRow)).toHaveCount(3);
    await expect(cell(page, 1, 'task')).toHaveValue('基本設計');
    await expect(cell(page, 0, 'start')).toHaveValue('2024-04-01');

    // A name applies on Enter, days on leaving the cell.
    await cell(page, 1, 'task').fill('外部設計');
    await cell(page, 1, 'task').press('Enter');
    await expect.poll(() => stored(page)).toContain('外部設計 : active, design, after reqs, 7d');
    await editPage.checkTextInView('外部設計');
    await cell(page, 1, 'days').fill('12');
    await cell(page, 1, 'days').blur();
    await expect.poll(() => stored(page)).toContain('外部設計 : active, design, after reqs, 12d');
    await expect(page.getByTestId(TID.tableMessage)).toHaveText(t('table.updated'));

    await page.getByTestId(TID.tableAddRow).click();
    await expect(page.getByTestId(TID.tableRow)).toHaveCount(4);
    await expect(cell(page, 3, 'task')).toHaveValue(t('table.newTask'));
    await editPage.checkTextInView(t('table.newTask'));

    // The new task goes above 実装, in the code too.
    await row(page, 3).getByTestId(TID.tableMoveUp).click();
    await expect(cell(page, 2, 'task')).toHaveValue(t('table.newTask'));
    await expect(cell(page, 3, 'task')).toHaveValue('実装');
    const code = await stored(page);
    expect(code.indexOf(t('table.newTask'))).toBeLessThan(code.indexOf('実装'));
    await editPage.checkTextInView('実装');

    // A change that breaks the diagram is refused, and the cell shows the code again.
    await cell(page, 0, 'days').fill('');
    await cell(page, 0, 'days').blur();
    await expect(page.getByTestId(TID.tableMessage)).toHaveText(t('edit.breaks'));
    await expect(cell(page, 0, 'days')).toHaveValue('10');
  });

  test('moves a kanban card to another column', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(`kanban
  todo[未着手]
    a[見積作成]@{ assigned: '山田' }
    b[契約書確認]
  doing[対応中]
  done[完了]`)
    );
    await editPage.checkTextInView('見積作成');
    await openTable(page);
    await expect(cell(page, 0, 'assignee')).toHaveValue('山田');
    await cell(page, 0, 'column').selectOption({ label: '対応中' });
    await expect
      .poll(() => stored(page))
      .toContain("doing[対応中]\n    a[見積作成]@{ assigned: '山田' }\n  done[完了]");
    await expect(cell(page, 1, 'card')).toHaveValue('見積作成');
    await cell(page, 1, 'priority').selectOption('High');
    await expect
      .poll(() => stored(page))
      .toContain("a[見積作成]@{ assigned: '山田', priority: 'High' }");
    await editPage.checkTextInView('見積作成');
  });

  test('changes a pie value', async ({ editPage, page }) => {
    await editPage.start(urlFor('pie showData title 内訳\n    "開発" : 60\n    "会議" : 25'));
    await editPage.checkTextInView('開発');
    await openTable(page);
    await cell(page, 1, 'value').fill('40');
    await cell(page, 1, 'value').press('Enter');
    await expect.poll(() => stored(page)).toContain('"会議" : 40');
    await editPage.checkTextInView('40');
  });

  test('adds an attribute to the chosen ER entity', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(`erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string id PK
    }`)
    );
    await editPage.checkTextInView('CUSTOMER');
    await openTable(page);
    await expect(page.getByTestId(TID.tableEntity)).toHaveValue('CUSTOMER');
    await page.getByTestId(TID.tableEntity).selectOption('ORDER');
    await expect(page.getByTestId(TID.tableRow)).toHaveCount(0);
    await page.getByTestId(TID.tableAddRow).click();
    await expect(page.getByTestId(TID.tableRow)).toHaveCount(1);
    await cell(page, 0, 'name').fill('order_no');
    await cell(page, 0, 'name').blur();
    await cell(page, 0, 'key').selectOption('PK');
    await expect.poll(() => stored(page)).toMatch(/ORDER \{\n\s+string order_no PK\n\s+\}/);
    await editPage.checkTextInView('order_no');
  });

  test('appends rows pasted from Excel', async ({ editPage, page }) => {
    await editPage.start(urlFor(gantt));
    await editPage.checkTextInView('実装');
    await openTable(page);
    await paste(
      page,
      '開発\t結合テスト\t\t5\t完了\t実装\r\n運用\t移行: 本番\t2024/06/03\t2\tcrit\t\r\n'
    );
    await expect(page.getByTestId(TID.tableRow)).toHaveCount(5);
    await expect(page.getByTestId(TID.tableMessage)).toHaveText(t('table.pasted', { count: '2' }));
    await expect(cell(page, 3, 'task')).toHaveValue('結合テスト');
    await expect(cell(page, 4, 'task')).toHaveValue('移行 本番');
    await expect(cell(page, 4, 'start')).toHaveValue('2024-06-03');
    await expect.poll(() => stored(page)).toContain('section 運用');
    await editPage.checkTextInView('移行 本番');
  });
});
