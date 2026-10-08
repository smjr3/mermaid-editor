import { TID } from '$/constants';
import type { Page } from '@playwright/test';
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

/** Opens "New diagram" in the Templates card (the fixture may have folded the card). */
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
  { id: 'block', title: false },
  { id: 'journey', title: true },
  { id: 'xychart', title: true },
  { id: 'quadrant', title: true },
  { id: 'sankey', title: false },
  { id: 'git', title: true },
  { id: 'packet', title: true },
  // Last: leaving a ZenUML diagram reloads the page (state.svelte.ts).
  { id: 'zenuml', title: true }
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

/** The link "Create in a new tab" opens (a share-style hash URL). */
const createHref = async (page: Page) => {
  const link = page.getByTestId(TID.newDiagramCreate);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  const href = await link.getAttribute('href');
  expect(href).toMatch(/\/edit#pako:/);
  return href ?? '';
};

// User feedback (2026-10-08): "New diagram" opens in a new tab, so the diagram in the
// current tab stays as it is (and nothing has to ask before replacing it).
test.describe('New diagram', () => {
  test('builds a titled left-to-right flowchart in a new tab, then grows it with Add', async ({
    context,
    editPage,
    page
  }) => {
    page.on('dialog', () => {
      throw new Error('a new diagram must not ask anything');
    });
    await editPage.start(urlFor('flowchart TD\n  X[My own work] --> Y'));
    await editPage.checkTextInView('My own work');
    await openNewDiagram(page);
    await page.getByTestId(`${TID.newDiagramKind}-flowchart`).click();
    await page.getByTestId(TID.newDiagramTitle).fill('経費精算の流れ');
    await page.getByTestId(`${TID.newDiagramDirection}-LR`).click();
    await createHref(page);

    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.getByTestId(TID.newDiagramCreate).click()
    ]);
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
    await expect(page.getByTestId(TID.newDiagramMessage)).toHaveText(
      t('new.openedInTab', { name: t('new.kind.flowchart') })
    );

    await popup.getByTestId(TID.addCard).click();
    await popup.getByTestId(TID.addNodeFrom).selectOption('n2');
    await popup.getByTestId(TID.addNodeName).fill('承認');
    await popup.getByTestId(TID.addNodeButton).click();
    await other.checkTextInView('承認');
    expect(await stored(popup)).toContain('  n2 --> n4');
  });

  test('every type opens as a starter that renders', async ({ context, editPage, page }) => {
    test.slow();
    page.on('dialog', () => {
      throw new Error('a new diagram must not ask anything');
    });
    await editPage.start(urlFor('pie\n  "a" : 1'));
    await openNewDiagram(page);
    const other = new EditorPage(await context.newPage());
    for (const { id } of starterKinds) {
      await page.getByTestId(`${TID.newDiagramKind}-${id}`).click();
      await other.start(await createHref(page));
      await other.checkTextInView(placeholder[id]);
      await expect(other.page.getByTestId(TID.errorContainer)).toHaveCount(0);
    }
  });

  test('sets, changes and removes the title from the Layout card, where the type shows one', async ({
    editPage,
    page
  }) => {
    test.slow();
    await editPage.start(urlFor('pie\n  "a" : 1'));
    await openNewDiagram(page);
    const hrefs: [(typeof starterKinds)[number], string][] = [];
    for (const kind of starterKinds) {
      await page.getByTestId(`${TID.newDiagramKind}-${kind.id}`).click();
      hrefs.push([kind, await createHref(page)]);
    }
    for (const [kind, href] of hrefs) {
      await editPage.start(href);
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
