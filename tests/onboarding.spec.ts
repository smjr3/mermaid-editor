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
    await expect(popover).toContainText(t('guide.step3.body'));
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

  test('outlines what each step is about', async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/edit');
    const popover = page.getByTestId(TID.guidePopover);
    const outlines = page.getByTestId(TID.wsGuideHighlight);
    const lefts = async () =>
      (await outlines.evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().left))
      )) as number[];
    const leftOf = async (id: string) =>
      Math.round((await page.getByTestId(id).boundingBox())?.x ?? -1);

    // 1: the add bar above the diagram and the inspector on the right (each when present).
    await expect(popover).toContainText(t('guide.step1.title'));
    await expect.poll(lefts).toContain(await leftOf(TID.inspPanel));
    if ((await page.getByTestId(TID.canvasInsertBar).count()) > 0) {
      await expect(outlines).toHaveCount(2);
    }
    // 2: the diagram.
    await page.getByTestId(TID.guideNext).click();
    await expect(popover).toContainText(t('guide.step2.title'));
    await expect(outlines).toHaveCount(1);
    await expect
      .poll(lefts)
      .toEqual([Math.round((await page.locator('#view').boundingBox())?.x ?? -1)]);
    // 3: 新規 / 共有 / 書き出す, and 使い方 beside them.
    await page.getByTestId(TID.guideNext).click();
    await expect(popover).toContainText(t('guide.step3.title'));
    await expect(outlines).toHaveCount(2);
    await expect
      .poll(lefts)
      .toEqual([await leftOf(TID.wsHeaderActions), await leftOf(TID.helpButton)]);
  });

  // User feedback (2026-10-08): step 2, pointing at the diagram in the middle, was drawn
  // below it — off the screen. Every step's popover must sit wholly inside the window.
  for (const [width, height] of [
    [1280, 720],
    [1440, 900]
  ]) {
    test(`every step stays inside a ${width}x${height} window`, async ({ page }) => {
      await page.setViewportSize({ height, width });
      await page.goto('/edit');
      const popover = page.getByTestId(TID.guidePopover);
      for (const step of [1, 2, 3]) {
        await expect(popover).toContainText(t(`guide.step${step}.title` as 'guide.step1.title'));
        // Wait for the popover to settle where floating-ui puts it.
        await expect
          .poll(async () => {
            const first = await popover.boundingBox();
            await page.waitForTimeout(150);
            return JSON.stringify(first) === JSON.stringify(await popover.boundingBox());
          })
          .toBe(true);
        const box = await popover.boundingBox();
        if (!box) throw new Error(`step ${step}: no popover`);
        expect(box.x, `step ${step} left`).toBeGreaterThanOrEqual(0);
        expect(box.y, `step ${step} top`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `step ${step} right`).toBeLessThanOrEqual(width);
        expect(box.y + box.height, `step ${step} bottom`).toBeLessThanOrEqual(height);
        await expect(popover).toBeInViewport({ ratio: 1 });
        if (step < 3) await page.getByTestId(TID.guideNext).click();
      }
    });
  }
});
