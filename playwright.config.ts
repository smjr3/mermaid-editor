import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      // clipboard-read / clipboard-write are Chromium-only permission names.
      // Playwright rejects them when granting on Firefox, so the grant belongs
      // to this project rather than to the shared `use` below.
      use: { ...devices['Desktop Chrome'], permissions: ['clipboard-read', 'clipboard-write'] }
    },
    {
      // A portability check, not a second full suite: only the @smoke journeys
      // — load, edit/render, persistence, embed. Keeping the full suite on
      // Chromium is what makes a second browser affordable.
      // See docs-dev/QUALITY-AUDIT-2026-08-31.md, finding 3.
      grep: /@smoke/,
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    }
  ],
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 }
  },
  webServer: {
    command: `pnpm ${process.env.CI ? 'preview' : 'dev'}`,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  },
  workers: process.env.CI ? 3 : undefined
});
