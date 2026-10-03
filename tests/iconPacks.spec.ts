import { expect, test } from './test';

const code = `architecture-beta
  group app(tabler:server-2)[App]
  service lb(tabler:load-balancer)[Load balancer] in app
  service db(lucide:database)[Database] in app
  lb:R -- L:db`;
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

test.describe('Icon packs', () => {
  test('renders bundled icons instead of the unknown-icon placeholder', async ({ editPage }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Load balancer');
    // The start of tabler:load-balancer's drawing; the placeholder is a "?".
    await expect(editPage.view.locator('path[d^="M9 13a3 3 0 1 0 6 0"]').first()).toBeAttached();
    await expect(editPage.view.locator('text', { hasText: /^\?$/ })).toHaveCount(0);
  });

  test('renders logos, which are bundled by default', async ({ editPage }) => {
    const withLogo = `architecture-beta\n  service gh(logos:github-icon)[GitHub]\n  service lambda(logos:aws-lambda)[Lambda]`;
    await editPage.start(
      `/edit#base64:${Buffer.from(JSON.stringify({ code: withLogo, mermaid: '{}' })).toString('base64')}`
    );
    await editPage.checkTextInView('Lambda');
    await expect(editPage.view.locator('text', { hasText: /^\?$/ })).toHaveCount(0);
  });

  test('shows the placeholder for an unknown icon', async ({ editPage }) => {
    const unknown = `architecture-beta\n  service x(tabler:no-such-icon)[Unknown]`;
    await editPage.start(
      `/edit#base64:${Buffer.from(JSON.stringify({ code: unknown, mermaid: '{}' })).toString('base64')}`
    );
    await editPage.checkTextInView('Unknown');
    await expect(editPage.view.locator('text', { hasText: /^\?$/ }).first()).toBeAttached();
  });
});
