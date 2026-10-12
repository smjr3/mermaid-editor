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

// The types the 形式 tab offers (newDiagram.ts, which loads mermaid and so stays out of
// Playwright's Node process), whether each draws a title, and whether it has a direction.
const starterKinds = [
  { direction: true, id: 'flowchart', title: true },
  { direction: true, id: 'swimlane', title: true },
  { direction: false, id: 'architecture', title: false },
  { direction: false, id: 'sequence', title: true },
  { direction: true, id: 'state', title: true },
  { direction: true, id: 'class', title: true },
  { direction: true, id: 'er', title: true },
  { direction: false, id: 'gantt', title: true },
  { direction: false, id: 'mindmap', title: false },
  { direction: false, id: 'kanban', title: false },
  { direction: false, id: 'timeline', title: true },
  { direction: false, id: 'pie', title: true },
  { direction: false, id: 'c4', title: true },
  { direction: false, id: 'block', title: false },
  { direction: false, id: 'journey', title: true },
  { direction: false, id: 'xychart', title: true },
  { direction: false, id: 'quadrant', title: true },
  { direction: false, id: 'sankey', title: false },
  { direction: false, id: 'git', title: true },
  { direction: false, id: 'packet', title: true },
  // Last: leaving a ZenUML diagram reloads the page (state.svelte.ts).
  { direction: false, id: 'zenuml', title: true }
];

// A placeholder each starter draws, to know its render arrived.
const placeholder: Record<string, string> = {
  architecture: 'サーバー',
  block: 'ブロック1',
  c4: '利用者',
  class: '顧客',
  er: '顧客',
  flowchart: '作業',
  gantt: '作業1',
  git: '最初の版',
  journey: '出社する',
  kanban: 'タスク1',
  mindmap: 'アイデア1',
  packet: '送信元ポート',
  pie: '項目A',
  quadrant: 'タスクA',
  sankey: 'Sales',
  sequence: '依頼',
  state: '待機中',
  swimlane: '担当者',
  timeline: '出来事1',
  xychart: '4月',
  zenuml: '注文する'
};

const kindCard = (page: Page, id: string) =>
  page.locator(`[data-testid="${TID.newDlgKind}"][data-kind="${id}"]`);

// User feedback (2026-10-08): "New diagram" opens in a new tab, so the diagram in the
// current tab stays as it is (and nothing has to ask before replacing it).
test.describe('New diagram dialog: from a type', () => {
  test('lists the 21 types and opens from the header menu', async ({ editPage, page }) => {
    await editPage.start(urlFor('pie\n  "a" : 1'));
    await openNewDialog(page, 'type');
    await expect(page.getByTestId(TID.newDlgKind)).toHaveCount(starterKinds.length);
    for (const { id } of starterKinds) await expect(kindCard(page, id)).toBeVisible();
    await expect(page.getByTestId(TID.newDlgCreate)).toHaveText(
      t('newDlg.createType', { name: t('new.kind.flowchart') })
    );
  });

  test('builds a titled left-to-right flowchart in a new tab and leaves this one alone', async ({
    context,
    editPage,
    page
  }) => {
    page.on('dialog', () => {
      throw new Error('a new diagram must not ask anything');
    });
    await editPage.start(urlFor('flowchart TD\n  X[My own work] --> Y'));
    await editPage.checkTextInView('My own work');
    await openNewDialog(page, 'type');
    await kindCard(page, 'flowchart').click();
    await page.getByTestId(TID.newDlgTitle).fill('経費精算の流れ');
    await page.getByTestId(`${TID.newDlgDirection}-LR`).click();
    // A real link to a new tab: it keeps working where pop-ups are blocked.
    const create = page.getByTestId(TID.newDlgCreate);
    await expect(create).toHaveAttribute('target', '_blank');
    await expect(create).toHaveAttribute('rel', /noopener/);
    await expect(create).toHaveAttribute('href', /\/edit#pako:/);

    const [popup] = await Promise.all([context.waitForEvent('page'), create.click()]);
    const other = new EditorPage(popup);
    await other.checkTextInView('経費精算の流れ');
    await other.checkTextInView('終了');
    await expect
      .poll(() => stored(popup))
      .toBe(
        '---\ntitle: "経費精算の流れ"\n---\nflowchart LR\n  n1(["開始"]) --> n2["作業"]\n  n2 --> n3(["終了"])'
      );
    // This tab keeps its own diagram.
    await editPage.checkTextInView('My own work');
    await expect(editPage.editor).toContainText('My own work');
    await expect(page.getByTestId(TID.newDlgMessage)).toHaveText(
      t('newDlg.opened', { name: t('new.kind.flowchart') })
    );
  });

  test('shows the title and direction only where the type has them, swimlane starting left to right', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('pie\n  "a" : 1'));
    await openNewDialog(page, 'type');
    for (const { direction, id, title } of starterKinds) {
      await kindCard(page, id).click();
      await expect(kindCard(page, id)).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId(TID.newDlgTitle)).toHaveCount(title ? 1 : 0);
      await expect(page.getByTestId(`${TID.newDlgDirection}-TB`)).toHaveCount(direction ? 1 : 0);
      await expect(page.getByTestId(`${TID.newDlgDirection}-LR`)).toHaveCount(direction ? 1 : 0);
      if (!title) await expect(page.getByText(t('layout.titleUnsupported'))).toBeVisible();
      await expect(page.getByTestId(TID.newDlgCreate)).toHaveText(
        t('newDlg.createType', { name: t(`new.kind.${id}` as 'new.kind.flowchart') })
      );
      if (id === 'swimlane') {
        await expect(page.getByTestId(`${TID.newDlgDirection}-LR`)).toHaveAttribute(
          'aria-pressed',
          'true'
        );
      }
    }
  });

  test('every type opens as a starter that renders', async ({ context, editPage, page }) => {
    test.slow();
    page.on('dialog', () => {
      throw new Error('a new diagram must not ask anything');
    });
    await editPage.start(urlFor('pie\n  "a" : 1'));
    await openNewDialog(page, 'type');
    const other = new EditorPage(await context.newPage());
    for (const { id } of starterKinds) {
      await kindCard(page, id).click();
      const url = await editPage.captureWindowOpen(() =>
        page.getByTestId(TID.newDlgCreate).click()
      );
      expect(url).toMatch(/\/edit#pako:/);
      await other.start(url);
      await other.checkTextInView(placeholder[id]);
      await expect(other.page.getByTestId(TID.errorContainer)).toHaveCount(0);
    }
    // This tab still has its own diagram.
    await expect(editPage.editor).toContainText('"a" : 1');
  });
});
