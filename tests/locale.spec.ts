import { TID } from '$/constants';
import { createTranslator, nextLocale, resolveLocale } from '$/i18n/translate';
import { expect, test } from './test';

// Locale-agnostic: works whichever MERMAID_LOCALE the build under test uses.
const built = resolveLocale(process.env.MERMAID_LOCALE);
const other = nextLocale(built);

test.describe('Language toggle', () => {
  test('switches the UI language, keeps the diagram, and remembers the choice', async ({
    editPage,
    page
  }) => {
    const toggle = page.getByTestId(TID.localeToggleButton);
    const card = page.getByTestId(TID.sampleDiagramsCard);

    await editPage.toggleSampleDiagrams();
    await editPage.loadSampleDiagram('Swimlane');
    await editPage.checkTextInView('Warehouse');

    await expect(toggle).toContainText(createTranslator(other)('locale.name'));
    await toggle.click();

    await expect(page.locator('html')).toHaveAttribute('lang', other);
    await expect(card).toContainText(createTranslator(other)('preset.title'));
    await editPage.checkTextInView('Warehouse');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', other);

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('lang', built);
    await expect(card).toContainText(createTranslator(built)('preset.title'));
  });
});
