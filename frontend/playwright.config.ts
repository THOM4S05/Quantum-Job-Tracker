import { defineConfig, devices } from '@playwright/test';

// Start/seed the real Compose stack first. This test never mocks the API.
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.QTRACE_E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    channel: process.env.QTRACE_E2E_CHANNEL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
