const { test, expect } = require('@playwright/test');
const { openApp, openSavePanel, loadOptions } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:7001/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.on('dialog', (d) => d.accept());
});

test('opening The Crap Rack gives a 6" rack with four racked devices and three cables', async ({ page }) => {
  await page.goto('/library.html');
  await page.locator('#library-layouts li', { hasText: 'The Crap Rack' }).getByRole('button').click();
  await page.waitForURL(/index\.html$/); // the ?layout= parameter is removed once it has loaded

  await expect(page.locator('.rack-frame')).toHaveCount(1);
  await expect(page.locator('.device-block')).toHaveCount(4);
  await expect(page.locator('.cable')).toHaveCount(3);
  await expect(page.locator('.rack-label')).toContainText('The Crap Rack');
  await expect(page.locator('#layout-name')).toHaveValue('The Crap Rack');
});

test('an opened example is saved as the visitor\'s own copy, and a second open gets a new name', async ({ page }) => {
  await page.goto('/library.html');
  const open = page.locator('#library-layouts li', { hasText: 'The Crap Rack' }).getByRole('button');
  await open.click();
  await page.waitForURL(/index\.html$/);
  await page.goto('/library.html');
  await open.click();
  await page.waitForURL(/index\.html$/);
  await openSavePanel(page);
  await expect.poll(() => loadOptions(page)).toEqual(expect.arrayContaining(['The Crap Rack', 'The Crap Rack (2)']));
});

test('a rack example appears on the rack page only, not the classic page', async ({ page }) => {
  await page.goto('/library.html');
  await page.locator('#library-layouts li', { hasText: 'Home stereo' }).getByRole('button').click();
  await page.waitForURL(/index\.html$/);
  await page.goto('/classic.html');
  await openSavePanel(page);
  expect(await loadOptions(page)).not.toContain('Home stereo rack');
});

test('adding the device pack puts its devices in the Add device dropdown', async ({ page }) => {
  await page.goto('/library.html');
  await page.locator('#library-device-types li').getByRole('button').click();
  await expect(page.locator('#library-status')).toContainText('Added 4 device types');
  await openApp(page, 'index');
  await expect(page.locator('#add-device-select option', { hasText: 'Mac mini mount (6")' })).toHaveCount(1);
  await page.selectOption('#add-device-select', 'template:lib_mac_mini_mount_6in');
  await expect(page.locator('.device-block')).toHaveCount(1);
});

test('adding the port types makes them available and colors the example\'s ports', async ({ page }) => {
  await page.goto('/library.html');
  await page.locator('#library-port-types li').getByRole('button').click();
  await expect(page.locator('#library-status')).toContainText('port types');
});

test('system reset needs confirmation and clears types but keeps saved layouts', async ({ page }) => {
  page.removeAllListeners('dialog');
  await page.goto('/library.html');
  await page.locator('#library-device-types li').first().getByRole('button').click();
  await page.locator('#library-port-types li').first().getByRole('button').click();
  await expect(page.locator('#library-status')).toContainText('Added');
  await page.evaluate(() => localStorage.setItem('audio_gear_layouts', JSON.stringify([{ id: 'l1', name: 'Keep me', mode: 'rack', devices: [], connections: [] }])));
  const keys = () => page.evaluate(() => ['audio_gear_device_types', 'audio_gear_port_types', 'audio_gear_layouts'].map((k) => localStorage.getItem(k) !== null));

  page.once('dialog', (d) => d.dismiss());
  await page.locator('#library-reset').click();
  expect(await keys()).toEqual([true, true, true]);

  page.once('dialog', (d) => d.accept());
  await page.locator('#library-reset').click();
  await expect(page.locator('#library-status')).toContainText('System reset');
  expect(await keys()).toEqual([false, false, true]);
});
