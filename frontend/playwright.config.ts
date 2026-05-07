import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

const isCiE2e = !!process.env.CI_E2E;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  timeout: isCiE2e ? 120_000 : 60_000,
  expect: { timeout: isCiE2e ? 15_000 : 5_000 },
  retries: isCiE2e ? 2 : process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
