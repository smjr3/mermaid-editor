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

/** Opens "New diagram" in the Samples card (the fixture may have folded the card). */
const openNewDiagram = async (page: Page) => {
  const toggle = page.getByTestId(TID.newDiagramToggle);
  if (!(await toggle.isVisible())) await page.getByTestId(TID.sampleDiagramsCard).click();
  await toggle.click();
};

// The types "New diagram" offers (newDiagram.ts, which loads mermaid and so stays out of
// Playwright's Node process), and whether each draws a title.
const starterKinds = [
  { id: 'flowchart', title: true },
  { id: 'swimlane', title: true },
  { id: 'architecture', title: false },
  { id: 'sequence', title: true },
  { id: 'state', title: true },
  { id: 'class', title: true },
  { id: 'er', title: true },
  { id: 'gantt', title: true },
  { id: 'mindmap', title: false },
  { id: 'kanban', title: false },
  { id: 'timeline', title: true },
  { id: 'pie', title: true },
  { id: 'c4', title: true },
  { id: 'block', title: false }
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
  kanban: 'タスク1',
  mindmap: 'アイデア1',
  pie: '項目A',
  sequence: '依頼',
  state: '待機中',
  swimlane: '担当者',
  timeline: '出来事1'
};

test.describe('New diagram', () => {
  test('builds a titled left-to-right flowchart from nothing, then grows it with Add', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  X[My own work] --> Y'));
    await editPage.checkTextInView('My own work');
    await openNewDiagram(page);
    await page.getByTestId(`${TID.newDiagramKind}-flowchart`).click();
    await page.getByTestId(TID.newDiagramTitle).fill('経費精算の流れ');
    await page.getByTestId(`${TID.newDiagramDirection}-LR`).click();

    // The code is the user's own, so the editor asks first; dismissing keeps it.
    page.once('dialog', (dialog) => void dialog.dismiss());
    await page.getByTestId(TID.newDiagramCreate).click();
    await expect.poll(() => stored(page)).toContain('My own work');

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe(t('new.confirm'));
      void dialog.accept();
    });
    await page.getByTestId(TID.newDiagramCreate).click();
    await expect
      .poll(() => stored(page))
      .toBe(
        '---\ntitle: "経費精算の流れ"\n---\nflowchart LR\n  n1(["開始"]) --> n2["作業"]\n  n2 --> n3(["終了"])'
      );
    await editPage.checkTextInView('経費精算の流れ');
    await editPage.checkTextInView('終了');
    await expect(page.getByTestId(TID.newDiagramMessage)).toHaveText(
      t('new.done', { name: t('new.kind.flowchart') })
    );

    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(TID.addNodeFrom).selectOption('n2');
    await page.getByTestId(TID.addNodeName).fill('承認');
    await page.getByTestId(TID.addNodeButton).click();
    await editPage.checkTextInView('承認');
    expect(await stored(page)).toContain('  n2 --> n4');
  });

  test('creates every type without asking while the code is a starter, and each renders', async ({
    editPage,
    page
  }) => {
    test.slow();
    // The first replaces code that is not a sample, so it asks; the rest do not.
    let asked = 0;
    page.on('dialog', (dialog) => {
      asked++;
      void dialog.accept();
    });
    await editPage.start(urlFor('pie\n  "a" : 1'));
    await openNewDiagram(page);
    for (const { id } of starterKinds) {
      await page.getByTestId(`${TID.newDiagramKind}-${id}`).click();
      // No dialog: a starter (or a sample) is replaced straight away.
      await page.getByTestId(TID.newDiagramCreate).click();
      await editPage.checkTextInView(placeholder[id]);
      await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
      await page.getByTestId(TID.newDiagramToggle).click();
    }
    expect(asked).toBe(1);
  });

  test('sets, changes and removes the title from the Layout card, where the type shows one', async ({
    editPage,
    page
  }) => {
    test.slow();
    page.on('dialog', (dialog) => void dialog.accept());
    for (const kind of starterKinds) {
      await editPage.start(urlFor('pie\n  "a" : 1'));
      await openNewDiagram(page);
      await page.getByTestId(`${TID.newDiagramKind}-${kind.id}`).click();
      await page.getByTestId(TID.newDiagramCreate).click();
      await editPage.checkTextInView(placeholder[kind.id]);
      await page.getByTestId(TID.layoutCard).click();
      if (!kind.title) {
        await expect(page.getByText(t('layout.titleUnsupported'))).toBeVisible();
        await expect(page.getByTestId(TID.layoutTitleInput)).toHaveCount(0);
        continue;
      }
      await page.getByTestId(TID.layoutTitleInput).fill(`題名 ${kind.id}`);
      await page.getByTestId(TID.layoutTitleSet).click();
      // Front matter (`title: "…"`), or the title statement of timeline and C4.
      await expect.poll(() => stored(page)).toMatch(new RegExp(`title:? "?題名 ${kind.id}`));
      // The title is drawn in the diagram, not only written in the code.
      await editPage.checkTextInView(`題名 ${kind.id}`);
      await page.getByTestId(TID.layoutTitleRemove).click();
      await expect.poll(() => stored(page)).not.toMatch(/^\s*title\b/m);
      await editPage.checkTextNotInView(`題名 ${kind.id}`);
    }
  });
});
