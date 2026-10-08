import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { expect, t, test } from './test';

// The desktop tools pane: three tabs (作る / 直す / 出す), each an accordion of sections.
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const flowchart = urlFor('flowchart TD\n  A[Start] --> B[End]');

const tab = (page: Page, id: string) => page.getByTestId(`${TID.toolsTab}-${id}`);
const card = (page: Page, testId: string) =>
  page
    .getByTestId(TID.toolsPane)
    .locator('.card')
    .filter({ has: page.getByTestId(testId) });

test.describe('Tools tabs', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test('has three tabs, 作る first with its sections', async ({ editPage, page }) => {
    await editPage.start(flowchart);
    await expect(page.getByRole('tablist', { name: t('tools.tabs') }).getByRole('tab')).toHaveCount(
      3
    );
    for (const [id, key] of [
      ['make', 'tools.tab.make'],
      ['fix', 'tools.tab.fix'],
      ['out', 'tools.tab.out']
    ] as const) {
      await expect(tab(page, id)).toHaveText(t(key));
    }
    await expect(tab(page, 'make')).toHaveAttribute('aria-selected', 'true');
    // 作る: the templates (with new diagram) and the AI and unknown-icon section.
    await expect(page.getByTestId(TID.sampleDiagramsCard)).toBeInViewport();
    await expect(page.getByTestId(TID.aiCard)).toBeInViewport();
    await expect(page.getByTestId(TID.addCard)).not.toBeInViewport();
    await expect(page.getByTestId(TID.colorsCard)).not.toBeInViewport();
  });

  test('直す: Add first, then layout, edit, colours and icons; 出す: export and share', async ({
    editPage,
    page
  }) => {
    await editPage.start(flowchart);
    const order = async (id: string) =>
      page
        .getByTestId(`${TID.toolsTabPanel}-${id}`)
        .locator('.card > [role="toolbar"][data-testid]')
        .evaluateAll((headers) => headers.map((header) => header.dataset.testid));
    expect(await order('fix')).toEqual([
      TID.addCard,
      TID.layoutCard,
      TID.editCard,
      TID.colorsCard,
      TID.iconPacksCard
    ]);
    expect(await order('out')).toEqual([TID.actionsCard, TID.shareCard]);
    expect(await order('make')).toEqual([TID.sampleDiagramsCard, TID.aiCard]);
    // Showing 直す opens its first section, Add.
    await tab(page, 'fix').click();
    await expect(card(page, TID.addCard)).toHaveClass(/isOpen/);
  });

  test('a section header in another tab opens it and shows its tab', async ({ editPage, page }) => {
    await editPage.start(flowchart);
    await page.getByTestId(TID.colorsCard).click();
    await expect(tab(page, 'fix')).toHaveAttribute('aria-selected', 'true');
    await expect(card(page, TID.colorsCard)).toHaveClass(/isOpen/);
    await expect(page.getByTestId(TID.colorsCard)).toBeInViewport();
    await expect(page.getByTestId(TID.sampleDiagramsCard)).not.toBeInViewport();

    await page.getByTestId(TID.actionsCard).click();
    await expect(tab(page, 'out')).toHaveAttribute('aria-selected', 'true');
    await expect(card(page, TID.actionsCard)).toHaveClass(/isOpen/);
    await expect(page.getByTestId(TID.downloadPNG)).toBeInViewport();
  });

  test('a tab reopens the section last open in it, else its first', async ({ editPage, page }) => {
    await editPage.start(flowchart);
    await tab(page, 'fix').click();
    await expect(card(page, TID.addCard)).toHaveClass(/isOpen/);
    await page.getByTestId(TID.layoutCard).click();
    await tab(page, 'out').click();
    await expect(card(page, TID.actionsCard)).toHaveClass(/isOpen/);
    await tab(page, 'fix').click();
    await expect(card(page, TID.layoutCard)).toHaveClass(/isOpen/);
    await expect(page.getByTestId(TID.layoutCard)).toBeInViewport();
    // The arrow keys move between the tabs.
    await tab(page, 'fix').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'out')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'out')).toBeFocused();
  });

  test('one section open at a time, filling the pane; the 直す tab starts with the selection', async ({
    editPage,
    page
  }) => {
    await editPage.start(flowchart);
    const open = page.getByTestId(TID.toolsPane).locator('.card.isOpen');
    await page.getByTestId(TID.addCard).click();
    await expect(open).toHaveCount(1);
    await page.getByTestId(TID.editCard).click();
    await expect(open).toHaveCount(1);
    await expect(card(page, TID.editCard)).toHaveClass(/isOpen/);
    // The selection panel heads the tab; the last section's header sits at the bottom.
    const panel = await page.getByTestId(TID.selectionPanel).boundingBox();
    const edit = await card(page, TID.editCard).boundingBox();
    const icons = await card(page, TID.iconPacksCard).boundingBox();
    const pane = await page.getByTestId(TID.toolsPane).boundingBox();
    if (!panel || !edit || !icons || !pane) throw new Error('boxes missing');
    expect(panel.y).toBeLessThan(edit.y);
    expect(icons.y + icons.height).toBeGreaterThan(pane.y + pane.height - 3);
  });

  test('the rail icons open their tab and section', async ({ editPage, page }) => {
    await editPage.start(flowchart);
    await page.getByTestId(TID.toolsPaneToggle).click();
    for (const [target, id, section] of [
      ['ai', 'make', TID.aiCard],
      ['layout', 'fix', TID.layoutCard],
      ['add', 'fix', TID.addCard],
      ['share', 'out', TID.shareCard]
    ] as const) {
      await page.getByTestId(`${TID.toolsRail}-${target}`).click();
      await expect(tab(page, id)).toHaveAttribute('aria-selected', 'true');
      await expect(card(page, section)).toHaveClass(/isOpen/);
      await expect(page.getByTestId(section)).toBeInViewport();
      await page.getByTestId(TID.toolsPaneToggle).click();
    }
  });
});
