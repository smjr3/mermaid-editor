import { C, TID } from '$/constants';
import { expect, t, test } from './test';

// The guide is the thing under test here, so these specs start without the "seen" flag.
test.use({ guideSeen: false });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, 'true');
  }, C.editorChooserDismissedKey);
});

test.describe('First-visit guide', () => {
  test('walks through three steps and is not shown again after Close', async ({ page }) => {
    await page.goto('/edit');
    const popover = page.getByTestId(TID.guidePopover);
    await expect(popover).toBeVisible();
    await expect(popover).toContainText(t('guide.step1.title'));
    await page.getByTestId(TID.guideNext).click();
    await expect(popover).toContainText(t('guide.step2.title'));
    await page.getByTestId(TID.guideNext).click();
    await expect(popover).toContainText(t('guide.step3.title'));
    // The last step has no "next".
    await expect(page.getByTestId(TID.guideNext)).toHaveCount(0);
    await page.getByTestId(TID.guideClose).click();
    await expect(popover).toBeHidden();

    await page.reload();
    await expect(page.locator('#view')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(popover).toBeHidden();
  });

  test('Escape closes it for good', async ({ page }) => {
    await page.goto('/edit');
    const popover = page.getByTestId(TID.guidePopover);
    await expect(popover).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    const stored = await page.evaluate((key) => localStorage.getItem(key), C.guideDoneKey);
    expect(stored).toBe('true');
  });

  test('"show again" in the How to use dialog restarts it', async ({ page }) => {
    await page.goto('/edit');
    await page.getByTestId(TID.guideClose).click();
    await expect(page.getByTestId(TID.guidePopover)).toBeHidden();

    await page.getByTestId(TID.helpButton).click();
    await page.getByTestId(TID.guideRestart).click();
    await expect(page.getByTestId(TID.helpDialog)).toBeHidden();
    const popover = page.getByTestId(TID.guidePopover);
    await expect(popover).toBeVisible();
    await expect(popover).toContainText(t('guide.step1.title'));
  });
});
