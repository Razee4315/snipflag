import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.e2e.ts',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:1420', trace: 'retain-on-failure', screenshot: 'only-on-failure', acceptDownloads: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:1420', reuseExistingServer: false, timeout: 120_000 },
});
