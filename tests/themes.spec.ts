import { expect, test } from './test';

// This fork defaults to dark and lets each person override it, rather than
// following the operating system. src/app.html seeds mode-watcher's storage key
// before any module loads, because mode-watcher's own defaultMode prop is
// pre-empted by its persisted singleton. See docs-dev/THEME.md.
test.describe('Test themes', () => {
  test.describe('Default mode', () => {
    test('should default to dark even when the OS prefers light', async ({ page, editPage }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await editPage.start();
      await editPage.checkTheme('dark');
    });

    test('should default to dark when the OS prefers dark', async ({ page, editPage }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await editPage.start();
      await editPage.checkTheme('dark');
    });
  });

  test.describe('Stored preference', () => {
    test('should let a stored light choice win over the dark default', async ({
      page,
      editPage
    }) => {
      await page.addInitScript(() => {
        localStorage.setItem('mode-watcher-mode', 'light');
      });
      await page.emulateMedia({ colorScheme: 'dark' });
      await editPage.start();
      await editPage.checkTheme('light');
    });

    test('should persist a choice made through the toggle across a reload', async ({
      page,
      editPage
    }) => {
      await editPage.start();
      await editPage.checkTheme('dark');

      await editPage.toggleTheme();
      await editPage.checkTheme('light');
      expect(await page.evaluate(() => localStorage.getItem('mode-watcher-mode'))).toBe('light');

      await editPage.start();
      await editPage.checkTheme('light');
    });
  });

  test('should change themes when clicked', async ({ editPage }) => {
    await editPage.start();
    await editPage.toggleTheme();
    await editPage.checkTheme('light');
    await editPage.toggleTheme();
    await editPage.checkTheme('dark');
  });
});
