import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { formField, formMessage, openForm, submitForm, viewMode } from './helpers/canvas';
import { crumb, openTab, pickEdge, renameTo, toRoot } from './helpers/inspector';
import { openNewDialog } from './helpers/newDlg';
import { expect, t, test } from './test';

// Regressions from the second exploratory pass (someone who only uses the add bar and
// the inspector and never types code): the chart types made from zero, arrows of C4 and block diagrams,
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
/** Creates a diagram from 新規 › 形式から作る (it opens in a new tab; follow its link here). */
const create = async (page: Page, kind: string) => {
  await openNewDialog(page, 'type');
  await page.locator(`[data-testid="${TID.newDlgKind}"][data-kind="${kind}"]`).click();
  const href = await page.getByTestId(TID.newDlgCreate).getAttribute('href');
  await page.goto('about:blank');
  await page.goto(href ?? '');
};

/** Opens the add bar's form for `action` unless it is the one open. */
const formFor = async (page: Page, action: string) => {
  const open = page.locator(
    `[data-state="open"] [data-testid="${TID.canvasAddForm}"][data-form="${action}"]`
  );
  if (!(await open.isVisible())) await openForm(page, action);
  await expect(open).toBeVisible();
};
/** A field of the add form for `action`, opened first if need be. */
const fieldIn = async (page: Page, action: string, key: string) => {
  await formFor(page, action);
  return formField(page, key);
};
const submitIn = async (page: Page, action: string) => {
  await formFor(page, action);
  await submitForm(page);
};

/** The table beside the diagram (図 / 表 / 並べる › 並べる). */
const table = async (page: Page) => {
  await viewMode(page, 'both');
  return page.getByTestId(TID.canvasTable).getByTestId(TID.tableEditor);
};

/** Chooses an object in the object tab's list by the text it shows, and renames it. */
const renameInInspector = async (page: Page, shown: string, name: string) => {
  await toRoot(page);
  await openTab(page, 'object');
  await page.getByTestId(TID.inspPickItem).filter({ hasText: shown }).first().click();
  await renameTo(page, TID.inspName, name);
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
      await submitIn(page, 'task');
      await expect(formMessage(page)).toHaveText(t('add.journey.needTask'));
      await (await fieldIn(page, 'task', 'name')).fill('日報を書く');
      await (await fieldIn(page, 'task', 'score')).selectOption('5');
      await (await fieldIn(page, 'task', 'actors')).fill('自分, 上司');
      await submitIn(page, 'task');
      await editPage.checkTextInView('日報を書く');
      await expect.poll(() => stored(page)).toContain('日報を書く: 5: 自分, 上司');

      await renameInInspector(page, '出社する', '在宅で始業');
      await editPage.checkTextInView('在宅で始業');
      const score = (await table(page)).getByTestId(`${TID.tableCell}-score`).first();
      await score.selectOption('1');
      await expect.poll(() => stored(page)).toContain('在宅で始業: 1: 自分');
    });

    test('XY chart: axes and a series, and a series value in the table', async ({
      editPage,
      page
    }) => {
      await create(page, 'xychart');
      await editPage.checkTextInView('4月');
      await (await fieldIn(page, 'axes', 'categories')).fill('1Q, 2Q, 3Q, 4Q');
      await submitIn(page, 'axes');
      await editPage.checkTextInView('4Q');
      await (await fieldIn(page, 'series', 'values')).fill('1, x');
      await submitIn(page, 'series');
      await expect(formMessage(page)).toHaveText(t('add.xy.badValues'));
      await (await fieldIn(page, 'series', 'name')).fill('予測');
      await (await fieldIn(page, 'series', 'values')).fill('10, 20, 30, 40');
      await submitIn(page, 'series');
      await expect.poll(() => stored(page)).toContain('bar "予測" [10, 20, 30, 40]');

      const values = (await table(page)).getByTestId(`${TID.tableCell}-values`).last();
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
      await (await fieldIn(page, 'point', 'name')).fill('新規案件');
      await (await fieldIn(page, 'point', 'x')).fill('1.5');
      await submitIn(page, 'point');
      await expect(formMessage(page)).toHaveText(t('add.quad.badPoint'));
      await (await fieldIn(page, 'point', 'x')).fill('0.2');
      await (await fieldIn(page, 'point', 'y')).fill('0.3');
      await submitIn(page, 'point');
      await editPage.checkTextInView('新規案件');
      await (await fieldIn(page, 'axes', 'q1')).fill('最優先');
      await submitIn(page, 'axes');
      await editPage.checkTextInView('最優先');

      const x = (await table(page)).getByTestId(`${TID.tableCell}-x`).last();
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
      await (await fieldIn(page, 'flow', 'from')).fill('売上');
      await (await fieldIn(page, 'flow', 'to')).fill('Tax');
      await submitIn(page, 'flow');
      await expect(formMessage(page)).toHaveText(t('add.sankey.ascii'));
      await (await fieldIn(page, 'flow', 'from')).fill('Profit');
      await (await fieldIn(page, 'flow', 'value')).fill('15');
      await submitIn(page, 'flow');
      await editPage.checkTextInView('Tax');

      const value = (await table(page)).getByTestId(`${TID.tableCell}-value`).last();
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
      await (await fieldIn(page, 'branch', 'name')).fill('修正');
      await (await fieldIn(page, 'branch', 'from')).selectOption('main');
      await submitIn(page, 'branch');
      // The new branch is chosen for the next commit.
      await expect(await fieldIn(page, 'commit', 'branch')).toHaveValue('修正');
      await (await fieldIn(page, 'commit', 'name')).fill('不具合を直す');
      await submitIn(page, 'commit');
      await editPage.checkTextInView('不具合を直す');
      await (await fieldIn(page, 'merge', 'from')).selectOption('修正');
      await (await fieldIn(page, 'merge', 'into')).selectOption('main');
      await submitIn(page, 'merge');
      await expect.poll(() => stored(page)).toContain('  checkout main\n  merge "修正"');
      await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);

      await renameInInspector(page, '不具合を直す', 'バグ修正');
      await editPage.checkTextInView('バグ修正');
    });

    test('packet: a field after the last, renumbered when a width changes', async ({
      editPage,
      page
    }) => {
      await create(page, 'packet');
      await editPage.checkTextInView('送信元ポート');
      await (await fieldIn(page, 'field', 'name')).fill('ウィンドウ');
      await (await fieldIn(page, 'field', 'bits')).fill('16');
      await submitIn(page, 'field');
      await editPage.checkTextInView('ウィンドウ');
      await expect.poll(() => stored(page)).toContain('64-79: "ウィンドウ"');

      const bits = (await table(page)).getByTestId(`${TID.tableCell}-bits`).first();
      await bits.fill('8');
      await bits.press('Enter');
      await expect.poll(() => stored(page)).toContain('0-7: "送信元ポート"\n  8-23: "宛先ポート"');
    });

    test('ZenUML: a participant and a message', async ({ editPage, page }) => {
      await create(page, 'zenuml');
      await editPage.checkTextInView('注文する');
      await (await fieldIn(page, 'participant', 'name')).fill('在庫DB');
      await (await fieldIn(page, 'participant', 'kind')).selectOption('Database');
      await submitIn(page, 'participant');
      await (await fieldIn(page, 'message', 'from')).selectOption('システム');
      await (await fieldIn(page, 'message', 'to')).selectOption('在庫DB');
      await submitIn(page, 'message');
      await expect(formMessage(page)).toHaveText(t('add.zen.needText'));
      await (await fieldIn(page, 'message', 'text')).fill('在庫を確認');
      await submitIn(page, 'message');
      await editPage.checkTextInView('在庫を確認');
    });
  });

  test('C4 and block arrows are relabelled, reversed and deleted from the inspector', async ({
    editPage,
    page
  }) => {
    // The edited C4 diagram is the user's own: replacing it asks first.
    page.on('dialog', (dialog) => void dialog.accept());
    await create(page, 'c4');
    await editPage.checkTextInView('使う');
    await pickEdge(page, 0);
    await renameTo(page, TID.inspEdgeLabel, '閲覧する');
    await editPage.checkTextInView('閲覧する');
    await page.getByTestId(TID.inspEdgeReverse).click();
    await expect.poll(() => stored(page)).toContain('Rel(el2, el1, "閲覧する")');

    await create(page, 'block');
    await editPage.checkTextInView('ブロック1');
    await pickEdge(page, 0);
    await renameTo(page, TID.inspEdgeLabel, '送る');
    await expect.poll(() => stored(page)).toContain('blk1 -- "送る" --> blk2');
    await page.getByTestId(TID.inspDelete).click();
    await expect.poll(() => stored(page)).not.toContain('-->');
  });

  test('a C4 relationship is selected by clicking its text, then turned round', async ({
    editPage,
    page
  }) => {
    await create(page, 'c4');
    await editPage.checkTextInView('使う');
    await page.locator('#view svg text', { hasText: '使う' }).click();
    await expect(page.getByTestId(TID.inspEdgeEnds)).toContainText('利用者 → システム');
    await page.getByTestId(TID.inspEdgeReverse).click();
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
      await page.getByTestId(TID.wsHistoryButton).click();
      await expect(page.getByTestId(TID.historyPanel)).toBeVisible();
      const after = (await view.boundingBox())?.width ?? 0;
      expect(after).toBeGreaterThanOrEqual(1280 * 0.4);
      expect(after).toBeGreaterThanOrEqual(before - 1);
      // The zoom controls stay on one row.
      const zoom = await page.getByTestId(TID.zoomInButton).boundingBox();
      const grid = await page.getByTestId(TID.gridToggle).boundingBox();
      expect(Math.abs((zoom?.y ?? 0) - (grid?.y ?? 100))).toBeLessThan(8);
      await page.getByTestId(TID.wsHistoryButton).click();
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
      await expect(page.getByTestId(TID.inspName)).toHaveValue('承認者');

      await create(page, 'architecture');
      await editPage.checkTextInView('サーバー');
      const group = await page.locator('#view rect[id$="-group-grp1"]').boundingBox();
      if (!group) throw new Error('no group');
      // Inside the group's box but on no service: the box has no fill.
      await page.mouse.click(group.x + 6, group.y + group.height - 6);
      await expect(page.getByTestId(TID.inspName)).toHaveValue('システム');
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
      await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.edge');
      await expect(page.getByTestId(TID.inspEdgeLabel)).toHaveValue('依頼');

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
      await expect(page.getByTestId(TID.inspEdgeEnds)).toContainText('顧客 → 注文');
    });
  });

  test('a composite state made by the add bar has a placeholder inside', async ({
    editPage,
    page
  }) => {
    await create(page, 'state');
    await editPage.checkTextInView('待機中');
    await (await fieldIn(page, 'composite', 'name')).fill('確認中');
    await submitIn(page, 'composite');
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
    await expect(page.getByTestId(TID.inspName)).toHaveValue('改名');
    await page.locator('#view .node', { hasText: '承認' }).first().click({ button: 'right' });
    await expect(page.getByTestId(`${TID.contextMenu}-name`)).toHaveText(/承認 \(n[13]\)/);
    await page.keyboard.press('Escape');
    await toRoot(page);
    await openTab(page, 'object');
    const options = await page.getByTestId(TID.inspPickItem).allTextContents();
    expect(options).toEqual(['承認 (n1)', '改名', '承認 (n3)', '終了']);
  });

  test('the add bar names an unnamed participant in Japanese and asks for both ends', async ({
    editPage,
    page
  }) => {
    await create(page, 'sequence');
    await editPage.checkTextInView('依頼');
    await submitIn(page, 'participant');
    await editPage.checkTextInView('参加者3');
    const to = await fieldIn(page, 'message', 'to');
    await expect(to).toHaveAttribute('required', '');
    await expect(to.locator('option').first()).toHaveText(t('add.choosePlaceholder'));
    await to.selectOption('');
    await (await fieldIn(page, 'message', 'from')).selectOption('p1');
    await submitIn(page, 'message');
    await expect(formMessage(page)).toHaveText(t('add.choose'));
  });

  test('the template categories have Japanese names and no template name is cut short', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    await editPage.toggleSampleDiagrams();
    const dialog = page.getByTestId(TID.newDlg);
    const category = (group: string) =>
      dialog.locator(`[data-testid="${TID.newDlgCategory}"][data-category="${group}"]`);
    await expect(category('Flowchart')).toHaveText(t('preset.name.flowchart'));
    const long = category('Cynefin Framework');
    await long.scrollIntoViewIfNeeded();
    await expect(long).toHaveText(t('preset.name.cynefin'));
    // Not clipped: every sample's whole name fits in its card, on more lines if need be.
    const clipped = await dialog
      .getByTestId(TID.newDlgSample)
      .evaluateAll(
        (buttons) => buttons.filter((button) => button.scrollWidth > button.clientWidth + 1).length
      );
    expect(clipped).toBe(0);
    await editPage.loadSampleDiagram('User Journey');
    await expect(page.locator('#view')).toContainText('My working day', { timeout: 15_000 });
  });
});
