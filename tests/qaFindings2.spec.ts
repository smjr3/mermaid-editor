import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { expect, t, test } from './test';

// Regressions from the second exploratory pass (someone who only uses the tools and
// never types code): the chart types made from zero, arrows of C4 and block diagrams,
// the history beside the diagram, picking lanes, groups, messages and relationships,
// and the wording of names and samples.
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const stored = (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));
const field = (action: string, key: string) => `${TID.addAction}-${action}-${key}`;

/** Creates a diagram from "新しい図を作る" (the starting code is a sample, so it does not ask). */
const create = async (page: Page, kind: string) => {
  const toggle = page.getByTestId(TID.newDiagramToggle);
  if (!(await toggle.isVisible())) await page.getByTestId(TID.sampleDiagramsCard).click();
  await toggle.click();
  await page.getByTestId(`${TID.newDiagramKind}-${kind}`).click();
  // "Create" opens the starter in a new tab; follow its link in this one instead.
  const href = await page.getByTestId(TID.newDiagramCreate).getAttribute('href');
  await page.goto('about:blank');
  await page.goto(href ?? '');
};

const openAdd = (page: Page) => page.getByTestId(TID.addCard).click();
const openEdit = (page: Page) => page.getByTestId(TID.editCard).click();
const addMessage = (page: Page) => page.getByTestId(TID.addMessage);

/** Chooses an object in the Edit card by the text its list shows, and renames it. */
const renameInEdit = async (page: Page, shown: string, name: string) => {
  const select = page.getByTestId(TID.editObjectSelect);
  const value = await select
    .locator('option')
    .filter({ hasText: shown })
    .first()
    .getAttribute('value');
  await select.selectOption(value ?? '');
  await page.getByTestId(TID.editRenameInput).fill(name);
  await page.getByTestId(TID.editRenameButton).click();
};

test.describe('QA findings, second pass', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test.describe('chart types made from zero', () => {
    test('user journey: a step with score and people, renamed, and its score in the table', async ({
      editPage,
      page
    }) => {
      await create(page, 'journey');
      await editPage.checkTextInView('出社する');
      await openAdd(page);
      await page.getByTestId(field('task', 'button')).click();
      await expect(addMessage(page)).toHaveText(t('add.journey.needTask'));
      await page.getByTestId(field('task', 'name')).fill('日報を書く');
      await page.getByTestId(field('task', 'score')).selectOption('5');
      await page.getByTestId(field('task', 'actors')).fill('自分, 上司');
      await page.getByTestId(field('task', 'button')).click();
      await editPage.checkTextInView('日報を書く');
      await expect.poll(() => stored(page)).toContain('日報を書く: 5: 自分, 上司');

      await openEdit(page);
      await renameInEdit(page, '出社する', '在宅で始業');
      await editPage.checkTextInView('在宅で始業');
      const score = page.getByTestId(TID.tableEditor).getByTestId(`${TID.tableCell}-score`).first();
      await score.selectOption('1');
      await expect.poll(() => stored(page)).toContain('在宅で始業: 1: 自分');
    });

    test('XY chart: axes and a series, and a series value in the table', async ({
      editPage,
      page
    }) => {
      await create(page, 'xychart');
      await editPage.checkTextInView('4月');
      await openAdd(page);
      await page.getByTestId(field('axes', 'categories')).fill('1Q, 2Q, 3Q, 4Q');
      await page.getByTestId(field('axes', 'button')).click();
      await editPage.checkTextInView('4Q');
      await page.getByTestId(field('series', 'values')).fill('1, x');
      await page.getByTestId(field('series', 'button')).click();
      await expect(addMessage(page)).toHaveText(t('add.xy.badValues'));
      await page.getByTestId(field('series', 'name')).fill('予測');
      await page.getByTestId(field('series', 'values')).fill('10, 20, 30, 40');
      await page.getByTestId(field('series', 'button')).click();
      await expect.poll(() => stored(page)).toContain('bar "予測" [10, 20, 30, 40]');

      await openEdit(page);
      const values = page
        .getByTestId(TID.tableEditor)
        .getByTestId(`${TID.tableCell}-values`)
        .last();
      await values.fill('5, 5, 5, 5');
      await values.press('Enter');
      await expect.poll(() => stored(page)).toContain('bar "予測" [5, 5, 5, 5]');
      await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
    });

    test('quadrant chart: a point and an axis, then moved in the table', async ({
      editPage,
      page
    }) => {
      await create(page, 'quadrant');
      await editPage.checkTextInView('タスクA');
      await openAdd(page);
      await page.getByTestId(field('point', 'name')).fill('新規案件');
      await page.getByTestId(field('point', 'x')).fill('1.5');
      await page.getByTestId(field('point', 'button')).click();
      await expect(addMessage(page)).toHaveText(t('add.quad.badPoint'));
      await page.getByTestId(field('point', 'x')).fill('0.2');
      await page.getByTestId(field('point', 'y')).fill('0.3');
      await page.getByTestId(field('point', 'button')).click();
      await editPage.checkTextInView('新規案件');
      await page.getByTestId(field('axes', 'q1')).fill('最優先');
      await page.getByTestId(field('axes', 'button')).click();
      await editPage.checkTextInView('最優先');

      await openEdit(page);
      const x = page.getByTestId(TID.tableEditor).getByTestId(`${TID.tableCell}-x`).last();
      await x.fill('0.9');
      await x.press('Enter');
      await expect.poll(() => stored(page)).toContain('新規案件: [0.9, 0.3]');
    });

    test('sankey: a flow, a Japanese name refused with a reason, a value in the table', async ({
      editPage,
      page
    }) => {
      await create(page, 'sankey');
      await editPage.checkTextInView('Profit');
      await openAdd(page);
      await page.getByTestId(field('flow', 'from')).fill('売上');
      await page.getByTestId(field('flow', 'to')).fill('Tax');
      await page.getByTestId(field('flow', 'button')).click();
      await expect(addMessage(page)).toHaveText(t('add.sankey.ascii'));
      await page.getByTestId(field('flow', 'from')).fill('Profit');
      await page.getByTestId(field('flow', 'value')).fill('15');
      await page.getByTestId(field('flow', 'button')).click();
      await editPage.checkTextInView('Tax');

      await openEdit(page);
      const value = page.getByTestId(TID.tableEditor).getByTestId(`${TID.tableCell}-value`).last();
      await value.fill('12');
      await value.press('Enter');
      await expect.poll(() => stored(page)).toContain('Profit,Tax,12');
    });

    test('git graph: a branch with a Japanese name, a commit on it and a merge', async ({
      editPage,
      page
    }) => {
      await create(page, 'git');
      await editPage.checkTextInView('最初の版');
      await openAdd(page);
      await page.getByTestId(field('branch', 'name')).fill('修正');
      await page.getByTestId(field('branch', 'from')).selectOption('main');
      await page.getByTestId(field('branch', 'button')).click();
      // The new branch is chosen for the next commit.
      await expect(page.getByTestId(field('commit', 'branch'))).toHaveValue('修正');
      await page.getByTestId(field('commit', 'name')).fill('不具合を直す');
      await page.getByTestId(field('commit', 'button')).click();
      await editPage.checkTextInView('不具合を直す');
      await page.getByTestId(field('merge', 'from')).selectOption('修正');
      await page.getByTestId(field('merge', 'into')).selectOption('main');
      await page.getByTestId(field('merge', 'button')).click();
      await expect.poll(() => stored(page)).toContain('  checkout main\n  merge "修正"');
      await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);

      await openEdit(page);
      await renameInEdit(page, '不具合を直す', 'バグ修正');
      await editPage.checkTextInView('バグ修正');
    });

    test('packet: a field after the last, renumbered when a width changes', async ({
      editPage,
      page
    }) => {
      await create(page, 'packet');
      await editPage.checkTextInView('送信元ポート');
      await openAdd(page);
      await page.getByTestId(field('field', 'name')).fill('ウィンドウ');
      await page.getByTestId(field('field', 'bits')).fill('16');
      await page.getByTestId(field('field', 'button')).click();
      await editPage.checkTextInView('ウィンドウ');
      await expect.poll(() => stored(page)).toContain('64-79: "ウィンドウ"');

      await openEdit(page);
      const bits = page.getByTestId(TID.tableEditor).getByTestId(`${TID.tableCell}-bits`).first();
      await bits.fill('8');
      await bits.press('Enter');
      await expect.poll(() => stored(page)).toContain('0-7: "送信元ポート"\n  8-23: "宛先ポート"');
    });

    test('ZenUML: a participant and a message', async ({ editPage, page }) => {
      await create(page, 'zenuml');
      await editPage.checkTextInView('注文する');
      await openAdd(page);
      await page.getByTestId(field('participant', 'name')).fill('在庫DB');
      await page.getByTestId(field('participant', 'kind')).selectOption('Database');
      await page.getByTestId(field('participant', 'button')).click();
      await page.getByTestId(field('message', 'from')).selectOption('システム');
      await page.getByTestId(field('message', 'to')).selectOption('在庫DB');
      await page.getByTestId(field('message', 'button')).click();
      await expect(addMessage(page)).toHaveText(t('add.zen.needText'));
      await page.getByTestId(field('message', 'text')).fill('在庫を確認');
      await page.getByTestId(field('message', 'button')).click();
      await editPage.checkTextInView('在庫を確認');
    });
  });

  test('C4 and block arrows are relabelled, reversed and deleted from the Edit card', async ({
    editPage,
    page
  }) => {
    // The edited C4 diagram is the user's own: replacing it asks first.
    page.on('dialog', (dialog) => void dialog.accept());
    await create(page, 'c4');
    await editPage.checkTextInView('使う');
    await openEdit(page);
    await expect(page.getByTestId(TID.editEdgeSelect)).toBeVisible();
    await page.getByTestId(TID.editEdgeLabel).fill('閲覧する');
    await page.getByTestId(TID.editEdgeLabelButton).click();
    await editPage.checkTextInView('閲覧する');
    await page.getByTestId(TID.editEdgeReverse).click();
    await expect.poll(() => stored(page)).toContain('Rel(el2, el1, "閲覧する")');

    await create(page, 'block');
    await editPage.checkTextInView('ブロック1');
    await openEdit(page);
    await page.getByTestId(TID.editEdgeLabel).fill('送る');
    await page.getByTestId(TID.editEdgeLabelButton).click();
    await expect.poll(() => stored(page)).toContain('blk1 -- "送る" --> blk2');
    await page.getByTestId(TID.editEdgeDelete).click();
    await expect.poll(() => stored(page)).not.toContain('-->');
  });

  test('a C4 relationship is selected by clicking its text, then turned round', async ({
    editPage,
    page
  }) => {
    await create(page, 'c4');
    await editPage.checkTextInView('使う');
    await page.locator('#view svg text', { hasText: '使う' }).click();
    await expect(page.getByTestId(`${TID.selectionPanel}-name`)).toContainText('利用者 → システム');
    await page.getByTestId(TID.selectionEdgeReverse).click();
    await expect.poll(() => stored(page)).toContain('Rel(el2, el1, "使う")');
  });

  test.describe('history at 1280px', () => {
    test.use({ viewport: { height: 800, width: 1280 } });

    test('opens over the code pane and leaves the diagram its width', async ({
      editPage,
      page
    }) => {
      await editPage.checkTextInView('Car');
      const view = page.locator('#pane-view');
      const before = (await view.boundingBox())?.width ?? 0;
      await page
        .getByRole('button', { exact: true, name: t('editor.historyToggle') })
        .first()
        .click();
      await expect(page.getByTestId(TID.historyPanel)).toBeVisible();
      const after = (await view.boundingBox())?.width ?? 0;
      expect(after).toBeGreaterThanOrEqual(1280 * 0.4);
      expect(after).toBeGreaterThanOrEqual(before - 1);
      // The diagram toolbar stays on one row.
      const toolbar = await page.getByTestId(TID.fullScreenButton).boundingBox();
      const zoom = await page.getByTestId(TID.gridToggle).boundingBox();
      expect(Math.abs((toolbar?.y ?? 0) - (zoom?.y ?? 100))).toBeLessThan(8);
      await page
        .getByRole('button', { exact: true, name: t('editor.historyToggle') })
        .first()
        .click();
      await expect(page.getByTestId(TID.historyPanel)).toHaveCount(0);
    });
  });

  test.describe('picking in the picture', () => {
    test('a swimlane lane and an architecture group are selected by a click', async ({
      editPage,
      page
    }) => {
      await create(page, 'swimlane');
      await editPage.checkTextInView('担当者');
      await page
        .locator('#view g.cluster', { hasText: '承認者' })
        .locator('rect')
        .first()
        .click({
          position: { x: 8, y: 8 }
        });
      await expect(page.getByTestId(`${TID.selectionPanel}-name`)).toContainText('承認者');

      await create(page, 'architecture');
      await editPage.checkTextInView('サーバー');
      const group = await page.locator('#view rect[id$="-group-grp1"]').boundingBox();
      if (!group) throw new Error('no group');
      // Inside the group's box but on no service: the box has no fill.
      await page.mouse.click(group.x + 6, group.y + group.height - 6);
      await expect(page.getByTestId(`${TID.selectionPanel}-name`)).toContainText('システム');
    });

    test('a sequence message and an ER relationship are selected by a click on the line', async ({
      editPage,
      page
    }) => {
      await create(page, 'sequence');
      await editPage.checkTextInView('依頼');
      const line = await page.locator('#view [class*="messageLine"]').first().boundingBox();
      if (!line) throw new Error('no message line');
      await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2);
      await expect(page.getByTestId(`${TID.selectionPanel}-name`)).toContainText(t('sel.edge'));
      await expect(page.getByTestId(`${TID.selectionPanel}-name`)).toContainText('依頼');

      await create(page, 'er');
      await editPage.checkTextInView('注文する');
      const path = page.locator('#view path.relationshipLine').first();
      const point = await path.evaluate((element: SVGPathElement) => {
        const middle = element.getPointAtLength(element.getTotalLength() / 2);
        const matrix = element.getScreenCTM();
        const screen = matrix ? new DOMPoint(middle.x, middle.y).matrixTransform(matrix) : middle;
        return { x: screen.x, y: screen.y };
      });
      // A couple of pixels off the line still counts.
      await page.mouse.click(point.x + 2, point.y + 2);
      await expect(page.getByTestId(`${TID.selectionPanel}-name`)).toContainText('顧客 → 注文');
    });
  });

  test('a composite state made by the Add card has a placeholder inside', async ({
    editPage,
    page
  }) => {
    await create(page, 'state');
    await editPage.checkTextInView('待機中');
    await openAdd(page);
    await page.getByTestId(field('composite', 'name')).fill('確認中');
    await page.getByTestId(field('composite', 'button')).click();
    await editPage.checkTextInView('確認中');
    await editPage.checkTextInView('内容');
  });

  test('names show no internal id unless two objects share the text', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor('flowchart TD\n  n1[承認] --> n2[改名]\n  n2 --> n3[承認]\n  n3 --> n4[終了]')
    );
    await editPage.checkTextInView('改名');
    await page.locator('#view .node', { hasText: '改名' }).first().click();
    await expect(page.getByTestId(`${TID.selectionPanel}-name`)).toHaveText(': 改名');
    await page.locator('#view .node', { hasText: '承認' }).first().click({ button: 'right' });
    await expect(page.getByTestId(`${TID.contextMenu}-name`)).toHaveText(/承認 \(n[13]\)/);
    await page.keyboard.press('Escape');
    await openEdit(page);
    const options = await page
      .getByTestId(TID.editObjectSelect)
      .locator('option')
      .allTextContents();
    expect(options).toEqual(['承認 (n1)', '改名', '承認 (n3)', '終了']);
  });

  test('the Add card names an unnamed participant in Japanese and asks for both ends', async ({
    editPage,
    page
  }) => {
    await create(page, 'sequence');
    await editPage.checkTextInView('依頼');
    await openAdd(page);
    await page.getByTestId(field('participant', 'button')).click();
    await editPage.checkTextInView('参加者3');
    const to = page.getByTestId(field('message', 'to'));
    await expect(to).toHaveAttribute('required', '');
    await expect(to.locator('option').first()).toHaveText(t('add.choosePlaceholder'));
    await to.selectOption('');
    await page.getByTestId(field('message', 'from')).selectOption('p1');
    await page.getByTestId(field('message', 'button')).click();
    await expect(addMessage(page)).toHaveText(t('add.choose'));
  });

  test('the template categories have Japanese names and no template name is cut short', async ({
    editPage,
    page
  }) => {
    const card = page.getByTestId(TID.sampleDiagramsCard).locator('..');
    await editPage.checkTextInView('Car');
    // The fixture folds the Templates card; open it again.
    await editPage.toggleSampleDiagrams();
    await expect(
      card.locator('[data-template-group="Flowchart"]', { hasText: t('preset.name.flowchart') })
    ).toBeVisible();
    const long = card.locator('[data-template-group="Cynefin Framework"]');
    await long.scrollIntoViewIfNeeded();
    await expect(long).toHaveText(t('preset.name.cynefin'));
    // Not clipped: every template's whole name fits in its button, on more lines if need be.
    const clipped = await card
      .getByTestId(TID.templatePick)
      .evaluateAll(
        (buttons) => buttons.filter((button) => button.scrollWidth > button.clientWidth + 1).length
      );
    expect(clipped).toBe(0);
    await editPage.loadSampleDiagram('User Journey');
    await expect(page.locator('#view')).toContainText('My working day', { timeout: 15_000 });
  });
});
