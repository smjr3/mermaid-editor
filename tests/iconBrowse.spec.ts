import type { Page } from '@playwright/test';
import { TID } from '$/constants';
import { expect, test } from './test';

/** Opens the inspector's 「探して挿入」 dialog on its browse mode. */
const openBrowse = async (page: Page) => {
  await page.getByTestId(TID.inspIconBrowse).click();
  await expect(page.getByTestId(TID.inspIconDialog)).toBeVisible();
  await page.getByTestId(TID.iconPickerModeBrowse).click();
};

const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

const storedCode = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code
  );

test.describe('Browsing icons without typing', () => {
  test('shows a category as a grid with labels and inserts the clicked icon', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('architecture-beta\n  service db()[Database]'));
    await expect(editPage.editor).toContainText('db()');
    // The icon goes where the cursor was left in the code.
    await editPage.editor.getByText('db()').click();
    await page.keyboard.press('End');
    for (let index = 0; index < '[Database]'.length + 1; index++) {
      await page.keyboard.press('ArrowLeft');
    }
    await openBrowse(page);

    await page.getByTestId(TID.iconBrowseList).selectOption('cat:network');
    const grid = page.getByTestId(TID.iconBrowseGrid);
    const router = grid.locator('[data-icon="clarity:router-line"]');
    await expect(router).toBeVisible({ timeout: 30_000 });
    await expect(router.locator('svg')).toBeAttached();
    expect(await grid.locator('button').count()).toBeGreaterThanOrEqual(15);
    // The tooltip names the icon, its set and licence.
    await expect(router).toHaveAttribute('title', /clarity:router-line.*Clarity Icons \(MIT\)/);

    await router.click();
    // The dialog closes and the inspector says what went in.
    await expect(page.getByTestId(TID.inspIconDialog)).toBeHidden();
    await expect(page.getByTestId(TID.inspIconMessage)).toContainText('clarity:router-line');
    await expect
      .poll(() => storedCode(page))
      .toContain('service db(clarity:router-line)[Database]');
  });

  test('captions every icon with its own name, never a translation', async ({ editPage, page }) => {
    await editPage.start(urlFor('architecture-beta\n  service db()[Database]'));
    await openBrowse(page);
    const grid = page.getByTestId(TID.iconBrowseGrid);
    for (const list of ['cat:standard', 'cat:network', 'cat:m365']) {
      await page.getByTestId(TID.iconBrowseList).selectOption(list);
      await expect(grid.locator('button').first()).toBeVisible({ timeout: 60_000 });
      const tiles = await grid.locator('button').evaluateAll((buttons) =>
        buttons.map((button) => ({
          caption: (button.querySelector('[data-caption]')?.textContent ?? '')
            .replace('™', '')
            .trim(),
          id: button.getAttribute('data-icon') ?? '',
          title: button.getAttribute('title') ?? ''
        }))
      );
      expect(tiles.length).toBeGreaterThan(0);
      for (const tile of tiles) {
        expect(tile.caption, tile.id).toBe(tile.id.slice(tile.id.indexOf(':') + 1));
        expect(tile.title, tile.id).toContain(tile.caption);
        expect(tile.caption, tile.id).not.toMatch(/[\u3040-\u30ff\u4e00-\u9fff]/);
      }
    }
  });

  test('lists the standard icons and marks logos with a trademark sign', async ({
    editPage,
    page
  }) => {
    await editPage.start();
    await openBrowse(page);
    const grid = page.getByTestId(TID.iconBrowseGrid);

    await page.getByTestId(TID.iconBrowseList).selectOption('cat:standard');
    await expect(grid.locator('button')).toHaveCount(5, { timeout: 30_000 });
    await expect(grid.locator('[data-standard="true"]')).toHaveCount(5);

    await page.getByTestId(TID.iconBrowseList).selectOption('cat:m365');
    const teams = grid.locator('[data-icon="logos:microsoft-teams"]');
    await expect(teams).toBeVisible({ timeout: 60_000 });
    await expect(teams).toContainText('™');
    await expect(grid.locator('[data-icon="fluent-color:people-team-48"]')).toBeVisible();
  });

  test('pages through a whole pack, and opens on the same page next time', async ({
    editPage,
    page
  }) => {
    await editPage.start();
    await openBrowse(page);
    await page.getByTestId(TID.iconBrowseList).selectOption('pack:clarity');

    const grid = page.getByTestId(TID.iconBrowseGrid);
    const count = page.getByTestId(TID.iconBrowseCount);
    await expect(count).toBeVisible({ timeout: 30_000 });
    await expect(grid.locator('button')).toHaveCount(200);
    const total = Number(/(\d+)\D*$/.exec((await count.textContent()) ?? '')?.[1]);
    expect(total).toBeGreaterThan(400);
    await expect(count).toContainText('1');
    await expect(count).toContainText('200');
    await expect(page.getByTestId(TID.iconBrowsePrev)).toBeDisabled();
    const first = await grid.locator('button').first().getAttribute('data-icon');
    expect(first).toMatch(/^clarity:a/);

    await page.getByTestId(TID.iconBrowseNext).click();
    await expect(count).toContainText('201');
    await expect(count).toContainText('400');
    await expect(grid.locator('button').first()).not.toHaveAttribute('data-icon', first ?? '');
    await expect(page.getByTestId(TID.iconBrowsePrev)).toBeEnabled();

    // The dialog keeps its list and page when it is opened again.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.inspIconDialog)).toBeHidden();
    await page.getByTestId(TID.inspIconBrowse).click();
    const dialog = page.getByTestId(TID.inspIconDialog);
    await expect(dialog.getByTestId(TID.iconBrowseList)).toHaveValue('pack:clarity');
    await expect(dialog.getByTestId(TID.iconBrowseCount)).toContainText('201');
    await dialog.getByTestId(TID.iconBrowsePrev).click();
    await expect(dialog.getByTestId(TID.iconBrowseCount)).toContainText('200');
    await expect(grid.locator('button').first()).toHaveAttribute('data-icon', first ?? '');
    // Names under the icons.
    await expect(grid.locator('button').first().locator('[data-caption]')).toHaveText(
      (first ?? '').replace('clarity:', '')
    );
  });

  test('renders the new packs in a diagram', async ({ editPage }) => {
    const code = `architecture-beta
  group dc(clarity:rack-server-line)[Data centre]
  service fw(clarity:firewall-line)[Firewall] in dc
  service dns(eos-icons:dns)[DNS] in dc
  service team(fluent-color:people-team-48)[Team]
  team:R --> L:fw
  fw:R --> L:dns`;
    await editPage.start(urlFor(code));
    await editPage.checkTextInView('Firewall');
    await editPage.checkTextInView('DNS');
    await editPage.checkTextInView('Team');
    await expect(editPage.view.locator('text', { hasText: /^\?$/ })).toHaveCount(0);
  });
});
