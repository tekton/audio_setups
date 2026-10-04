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
  await page.locator('#library-device-types li', { hasText: 'Compact 6' }).getByRole('button', { name: 'Add to my devices' }).click();
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
  // both adds are asynchronous (each fetches its pack first), so wait for both to land
  await expect.poll(() => page.evaluate(() => ['audio_gear_device_types', 'audio_gear_port_types'].every((k) => localStorage.getItem(k) !== null))).toBe(true);
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

const SAVED = [
  { id: 'l1', name: 'One', mode: 'rack', devices: [], connections: [] },
  { id: 'l2', name: 'Two', mode: 'classic', devices: [], connections: [] },
];

test('Export all layouts downloads every saved layout as one JSON file', async ({ page }) => {
  await page.goto('/library.html');
  await page.evaluate((l) => localStorage.setItem('audio_gear_layouts', JSON.stringify(l)), SAVED);
  const download = page.waitForEvent('download');
  await page.locator('#library-export-layouts').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('audio_gear_all_layouts.json');
  const body = JSON.parse(require('fs').readFileSync(await file.path(), 'utf8'));
  expect(body.map((l) => l.name)).toEqual(['One', 'Two']);
  await expect(page.locator('#library-status')).toContainText('Exported 2 layouts');
});

test('Export all and Clear say so when there are no layouts', async ({ page }) => {
  await page.goto('/library.html');
  await page.locator('#library-export-layouts').click();
  await expect(page.locator('#library-status')).toContainText('No saved layouts to export');
  await page.locator('#library-clear-layouts').click();
  await expect(page.locator('#library-status')).toContainText('No saved layouts to clear');
});

test('Clear all layouts needs confirmation and leaves device and port types alone', async ({ page }) => {
  page.removeAllListeners('dialog');
  await page.goto('/library.html');
  await page.evaluate((l) => {
    localStorage.setItem('audio_gear_layouts', JSON.stringify(l));
    localStorage.setItem('audio_gear_device_types', '[]');
    localStorage.setItem('audio_gear_port_types', '[]');
  }, SAVED);
  const keys = () => page.evaluate(() => ['audio_gear_layouts', 'audio_gear_device_types', 'audio_gear_port_types'].map((k) => localStorage.getItem(k) !== null));

  page.once('dialog', (d) => d.dismiss());
  await page.locator('#library-clear-layouts').click();
  expect(await keys()).toEqual([true, true, true]);

  page.once('dialog', (d) => { expect(d.message()).toContain('2 saved layouts'); d.accept(); });
  await page.locator('#library-clear-layouts').click();
  await expect(page.locator('#library-status')).toContainText('Cleared 2 layouts');
  expect(await keys()).toEqual([false, true, true]);
});

const names = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('audio_gear_layouts') || '[]').map((l) => l.name));
const importFile = (page, name, content) => page.locator('#library-import-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });

test('Export all, Clear, then Import restores every layout', async ({ page }) => {
  await page.goto('/library.html');
  await page.evaluate((l) => localStorage.setItem('audio_gear_layouts', JSON.stringify(l)), SAVED);
  const download = page.waitForEvent('download');
  await page.locator('#library-export-layouts').click();
  const exported = require('fs').readFileSync(await (await download).path(), 'utf8');
  await page.locator('#library-clear-layouts').click(); // beforeEach accepts the confirm
  expect(await names(page)).toEqual([]);

  await importFile(page, 'backup.json', exported);
  await expect(page.locator('#library-status')).toContainText('Imported 2 layouts');
  expect(await names(page)).toEqual(['One', 'Two']);
});

test('Import adds a single layout file as a new copy next to what is already saved', async ({ page }) => {
  await page.goto('/library.html');
  await page.evaluate((l) => localStorage.setItem('audio_gear_layouts', JSON.stringify(l)), SAVED);
  await importFile(page, 'one.json', JSON.stringify({ name: 'One', mode: 'rack', devices: [], connections: [] }));
  await expect(page.locator('#library-status')).toContainText('Imported 1 layout');
  expect(await names(page)).toEqual(['One', 'Two', 'One (2)']);
});

test('Import rejects files that are not layouts and saves nothing', async ({ page }) => {
  await page.goto('/library.html');
  await importFile(page, 'bad.json', 'not json');
  await expect(page.locator('#library-status')).toContainText('Import failed: not a JSON file');
  await importFile(page, 'bad2.json', '[{"name":"x"}]');
  await expect(page.locator('#library-status')).toContainText('Import failed: not a layouts file');
  expect(await names(page)).toEqual([]);
});

const EXAMPLES = [
  { name: 'Desktop 10" rack', page: /index\.html$/, racks: 1, devices: 4, cables: 3 },
  { name: 'Two-channel listening rack', page: /index\.html$/, racks: 1, devices: 3, cables: 2 },
  { name: 'Headphone desk (freeform)', page: /classic\.html$/, racks: 0, devices: 4, cables: 3 },
];

for (const ex of EXAMPLES) {
  test(`opening "${ex.name}" shows ${ex.devices} devices and ${ex.cables} cables on the right page`, async ({ page }) => {
    await page.goto('/library.html');
    await page.locator('#library-layouts li', { hasText: ex.name }).getByRole('button', { name: 'Open a copy' }).click();
    await page.waitForURL(ex.page);
    await expect(page.locator('.rack-frame')).toHaveCount(ex.racks);
    await expect(page.locator('.device-block')).toHaveCount(ex.devices);
    await expect(page.locator('.cable')).toHaveCount(ex.cables);
    await expect(page.locator('#layout-name')).toHaveValue(ex.name);
  });
}

test('the 10" and 19" packs add their devices to the Add device dropdown', async ({ page }) => {
  await page.goto('/library.html');
  for (const pack of ['Desktop 10" gear', 'Full-width 19" gear']) {
    await page.locator('#library-device-types li', { hasText: pack }).getByRole('button', { name: 'Add to my devices' }).click();
    await expect(page.locator('#library-device-types li', { hasText: pack })).toContainText('Installed');
  }
  await page.goto('/index.html');
  const values = await page.locator('#add-device-select option').evaluateAll((os) => os.map((o) => o.value));
  expect(values).toEqual(expect.arrayContaining(['template:lib_dac_10in', 'template:lib_power_amp_19in']));
});
