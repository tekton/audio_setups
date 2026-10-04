const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { openApp, addDevice, openSavePanel, saveLayout } = require('./helpers');

// Moving layouts between devices and coping with browsers where storage is unavailable (private tabs, blocked site data)

test('Export downloads the layout as JSON and Import loads it back', async ({ page }) => {
  await openApp(page, 'index');
  await addDevice(page, 'dac');
  await addDevice(page, 'speaker');
  await openSavePanel(page);
  await page.fill('#layout-name', 'Travel setup');

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-layout')]);
  expect(download.suggestedFilename()).toBe('Travel_setup.json');
  const file = await download.path();
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(exported.devices).toHaveLength(2);
  expect(exported.mode).toBe('rack');

  await page.click('#btn-new');
  await expect(page.locator('.device-block')).toHaveCount(0);
  await page.setInputFiles('#import-layout-file', file);
  await expect(page.locator('.device-block')).toHaveCount(2);
  await expect(page.locator('#layout-name')).toHaveValue('Travel setup');
});

test('Import refuses a layout from the other page and anything that is not a layout', async ({ page }) => {
  const messages = [];
  await openApp(page, 'index');
  page.on('dialog', (d) => messages.push(d.message()));
  await openSavePanel(page);
  await page.setInputFiles('#import-layout-file', { name: 'classic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ mode: 'classic', devices: [] })) });
  await page.setInputFiles('#import-layout-file', { name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
  await expect.poll(() => messages.length).toBe(2);
  expect(messages[0]).toMatch(/Import failed.*classic/i);
  expect(messages[1]).toMatch(/Import failed/);
});

test('with storage blocked the app still works and saving says why it failed', async ({ page }) => {
  await page.addInitScript(() => {
    const fail = () => { throw new DOMException('blocked', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { get: fail });
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const messages = [];
  await page.route('http://localhost:7001/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.on('dialog', (d) => { messages.push(d.message()); d.accept(); });
  await page.goto('/index.html');

  await addDevice(page, 'dac');
  await expect(page.locator('.device-block')).toHaveCount(1);
  await saveLayout(page, 'Nope');
  await expect.poll(() => messages.join('|')).toMatch(/Save failed/);
  expect(errors).toEqual([]);
});
