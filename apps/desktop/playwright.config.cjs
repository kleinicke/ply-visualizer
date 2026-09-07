const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './test',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:18763', viewport: { width: 1280, height: 850 } },
  webServer: {
    command: 'python3 -m http.server 18763 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:18763',
    reuseExistingServer: false,
  },
});
