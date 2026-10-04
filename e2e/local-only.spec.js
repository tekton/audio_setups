const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { addRack, addDevice, saveLayout, loadOptions } = require('./helpers');

// Serves the local-only build's config (what `npm run build:local` produces) without needing a build
const config = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'config.js'), 'utf8').replace('localOnly: false', 'localOnly: true');

let backendRequests;

test.beforeEach(async ({ page }) => {
  backendRequests = [];
  page.on('request', (req) => { if (req.url().includes(':7001')) backendRequests.push(req.url()); });
  page.on('dialog', (dialog) => dialog.accept());
  await page.route('**/js/config.js', (route) => route.fulfill({ contentType: 'text/javascript', body: config }));
});

for (const view of ['index', 'classic']) {
  test(`${view}: no backend calls, no server storage option, save and load still work`, async ({ page }) => {
    await page.goto(`/${view}.html`);
    await expect(page.locator('#storage-mode-select')).toBeHidden();

    if (view === 'index') await addRack(page, 19, 4);
    await addDevice(page, 'eq');
    await saveLayout(page, 'Local only');
    await expect.poll(() => loadOptions(page)).toContain('Local only');
    await page.click('#btn-new');
    await page.selectOption('#load-layout-select', { label: 'Local only' });
    await expect(page.locator('.device-block')).toHaveCount(1);

    expect(backendRequests).toEqual([]);
  });
}

for (const view of ['device-types', 'port-types']) {
  test(`${view}: no backend calls and no "Save to server" button`, async ({ page }) => {
    await page.goto(`/${view}.html`);
    await expect(page.locator('#btn-save-server')).toBeHidden();
    await expect(page.locator('#btn-save-local')).toBeVisible();
    expect(backendRequests).toEqual([]);
  });
}

test('the default (dev) build still offers server storage', async ({ page }) => {
  await page.unroute('**/js/config.js');
  await page.route('http://localhost:7001/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/index.html');
  await page.click('#btn-toggle-save-load');
  await expect(page.locator('#storage-mode-select')).toBeVisible();
});
