const { defineConfig, devices } = require('@playwright/test');

const external = process.env.TEST_URL;
module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL: external || 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'android-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-mobile', use: { ...devices['iPhone 15'] } }
  ],
  ...(!external ? { webServer: { command: 'npm start', url: 'http://127.0.0.1:3000/health', reuseExistingServer: false, timeout: 30000 } } : {})
});
