import { TID } from '$/constants';
import { expect, test } from './test';
import { cmd, verifyFileSizeGreaterThan } from './utils';

test.describe('Command palette', () => {
  test('opens from the keyboard, finds the Colours card and opens it', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    // From inside the code editor, where Ctrl+K would otherwise start a Monaco chord.
    await editPage.editor.click();
    await page.keyboard.press(`${cmd}+KeyK`);
    const input = page.getByTestId(TID.commandInput);
    await expect(input).toBeFocused();
    await input.fill('色');
    await expect(page.getByTestId(TID.commandItem).first()).toHaveAttribute(
      'data-command',
      'colors'
    );
    await page.keyboard.press('Enter');
    await expect(page.getByTestId(TID.commandPalette)).toBeHidden();
    await expect(
      page.getByTestId(TID.colorsCard).locator('xpath=ancestor::*[contains(@class,"card")][1]')
    ).toHaveClass(/isOpen/);
  });

  test('opens from the header button, moves with the arrow keys and closes with Escape', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    await page.getByTestId(TID.commandButton).click();
    const items = page.getByTestId(TID.commandItem);
    await expect(items.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(items.first()).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId(TID.commandInput).fill('zzzzzz');
    await expect(items).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.commandPalette)).toBeHidden();
  });

  test('"png" saves the diagram as a PNG', async ({ editPage, page }) => {
    await editPage.checkTextInView('Car');
    await page.keyboard.press(`${cmd}+KeyK`);
    await page.getByTestId(TID.commandInput).fill('png');
    const download = verifyFileSizeGreaterThan(page, 'diagram', 'png', 1000);
    await page.keyboard.press('Enter');
    await download;
  });

  test('runs an action: share link opens the share dialog', async ({ editPage, page }) => {
    await editPage.checkTextInView('Car');
    await page.keyboard.press(`${cmd}+KeyK`);
    await page.getByTestId(TID.commandInput).fill('share');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId(TID.commandPalette)).toBeHidden();
  });
});
