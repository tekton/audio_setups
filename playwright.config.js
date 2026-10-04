const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;
const MOBILE_SPECS = ['**/mobile.spec.js', '**/portability.spec.js', '**/image-export.spec.js', '**/share.spec.js', '**/routing-convert.spec.js'];

module.exports = defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  // Desktop runs every spec; the iOS projects (WebKit, the engine behind Safari and Chrome on iOS) run the
  // touch/layout/storage specs under phone and tablet emulation
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: '**/mobile.spec.js' },
    { name: 'iphone', use: { ...devices['iPhone 14'] }, testMatch: MOBILE_SPECS },
    { name: 'ipad', use: { ...devices['iPad Pro 11'] }, testMatch: MOBILE_SPECS },
  ],
  // Serve the static frontend; the tests run against device storage, so no backend is needed
  webServer: {
    command: `python3 -m http.server ${PORT} --directory frontend`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'ignore', // python's http.server logs every request to stderr
  },
});
