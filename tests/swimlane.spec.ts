import { test } from './test';

// Swimlane support is the reason this fork exists, so its samples are checked
// in every engine the suite runs, not only Chromium.
test.describe('Swimlane samples', () => {
  test.beforeEach(async ({ editPage }) => {
    await editPage.toggleSampleDiagrams();
  });

  test('render their lanes', { tag: '@smoke' }, async ({ editPage }) => {
    await editPage.loadSampleDiagram('Swimlane');
    for (const text of ['Customer', 'Shop', 'Warehouse', 'Pick and pack']) {
      await editPage.checkTextInView(text);
    }
  });
});
