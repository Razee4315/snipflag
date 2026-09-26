import { defineConfig, devices } from '@playwright/test';

// Website hero screenshots only. Not part of the app test suite (different testMatch).
export default defineConfig({
  testDir: '.',
  testMatch: '*.shot.ts',
  outputDir: '../../site-shots',
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:1420' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:1420', reuseExistingServer: false, timeout: 120_000, cwd: '../..' },
});
