import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Twinge E2E suite.
 *
 * Tests run against the live AU deployment (there is no local server mode).
 * The target is configurable via the BASE_URL env var so a run can be pointed
 * at another region, defaulting to the stable AU reference endpoint.
 */
export default defineConfig({
  testDir: './tests',
  // Generous timeout: tests depend on real AWS infrastructure (Lambda cold
  // starts, DynamoDB latency, WebSocket round-trips).
  timeout: 30000,
  // Retry once to absorb transient live-network flakiness.
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://twinge.mcteamster.com',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
