import { defineConfig, devices } from '@playwright/test';

// Build the browser demo and serve it under the repository base path first; see README.
export default defineConfig({
  testDir: './demo-e2e', outputDir: './test-results-demo', workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: process.env.QUANTUM_JOB_TRACKER_DEMO_BASE_URL ?? 'http://127.0.0.1:5176/Quantum-Job-Tracker/',
    channel: process.env.QUANTUM_JOB_TRACKER_E2E_CHANNEL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
