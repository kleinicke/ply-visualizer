/// <reference types="node" />

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // These specs each boot a WebGL context and load multi-million-point files,
  // so they are GPU- and memory-bound rather than CPU-bound. Playwright's
  // default (half the cores — 5 here) oversubscribes a single GPU and makes
  // the heaviest file-loading specs time out whenever anything else is
  // building on the machine. Three workers leaves headroom; the suite is not
  // meaningfully slower because the bottleneck was never CPU.
  workers: process.env.CI ? 1 : 3,
  // 30s (the default) is not enough for the largest fixtures once the machine
  // is busy. The failures that motivated this were all timeouts on specs that
  // pass comfortably when run alone.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One local retry so a transient hiccup surfaces as "flaky" rather than
  // failing the run. A genuinely broken test still fails both attempts.
  retries: process.env.CI ? 2 : 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'cd dist && python3 -m http.server 8001',
    port: 8001,
    reuseExistingServer: !process.env.CI,
  },
});
