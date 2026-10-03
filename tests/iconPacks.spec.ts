import { expect, test } from './test';

const code = `architecture-beta
  group cloud(logos:aws)[AWS]
  service fn(logos:aws-lambda)[Lambda] in cloud
  service db(simple-icons:amazondynamodb)[DynamoDB] in cloud
  fn:R -- L:db`;
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

test.describe('Icon packs', () => {
  test('renders AWS icons from the bundled packs instead of the unknown-icon placeholder', async ({
    editPage
  }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Lambda');
    // logos:aws-lambda draws an orange gradient (#f90); the placeholder is a "?".
    await expect(editPage.view.locator('stop[stop-color="#f90"]').first()).toBeAttached();
    await expect(editPage.view.locator('text', { hasText: /^\?$/ })).toHaveCount(0);
  });
});
