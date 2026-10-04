const fs = require('fs');
const { test, expect } = require('@playwright/test');

const DAY = 86400000;
const LAYOUTS = [{ id: 'l1', name: 'One', mode: 'rack', devices: [], connections: [] }];
const get = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);
const set = (page, key, value) => page.evaluate(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)), [key, value]);
const devicePack = (page) => page.locator('#library-device-types li').first();

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/library.html');
});

test('a pack shows Installed with a Remove button once added, and goes back after Remove', async ({ page }) => {
  await expect(devicePack(page).getByRole('button', { name: 'Add to my devices' })).toBeVisible();
  await expect(devicePack(page).getByRole('button', { name: 'Remove' })).toBeHidden();
  await expect(devicePack(page)).not.toContainText('Installed');

  await devicePack(page).getByRole('button', { name: 'Add to my devices' }).click();
  await expect(devicePack(page)).toContainText('Installed');
  await expect(devicePack(page).getByRole('button', { name: 'Add to my devices' })).toBeHidden();
  expect((await get(page, 'audio_gear_device_types')).map((t) => t.id)).toContain('lib_dac_6in');

  await devicePack(page).getByRole('button', { name: 'Remove' }).click();
  await expect(devicePack(page)).not.toContainText('Installed');
  expect(await get(page, 'audio_gear_device_types')).toEqual([]);
});

test('Remove leaves custom types of your own and says Partly installed when only some of a pack is there', async ({ page }) => {
  await set(page, 'audio_gear_device_types', [{ id: 'lib_dac_6in', name: 'DAC' }, { id: 'mine', name: 'Mine' }]);
  await page.reload();
  await expect(devicePack(page)).toContainText('Partly installed');
  await devicePack(page).getByRole('button', { name: 'Remove' }).click();
  expect((await get(page, 'audio_gear_device_types')).map((t) => t.id)).toEqual(['mine']);
});

test('the Your data summary counts what is stored and its size, and updates as things change', async ({ page }) => {
  await expect(page.locator('#library-storage')).toContainText('0 saved layouts, 0 custom device types, 0 custom port types');
  await set(page, 'audio_gear_layouts', LAYOUTS);
  await page.reload();
  await expect(page.locator('#library-storage')).toContainText('1 saved layout,');
  await expect(page.locator('#library-storage')).toContainText(/about \d+ B of the roughly 5 MB/);
  await expect(page.locator('#library-storage')).toContainText('Last backup: never');
  await page.locator('#library-clear-layouts').click();
  await expect(page.locator('#library-storage')).toContainText('0 saved layouts');
});

test('the backup nudge shows for never-backed-up layouts, hides after a backup, and returns when it is old', async ({ page }) => {
  await expect(page.locator('#library-nudge')).toBeHidden(); // nothing saved, nothing to back up
  await set(page, 'audio_gear_layouts', LAYOUTS);
  await page.reload();
  await expect(page.locator('#library-nudge')).toContainText('never been backed up');

  const download = page.waitForEvent('download');
  await page.locator('#library-full-backup').click();
  await download;
  await expect(page.locator('#library-nudge')).toBeHidden();
  await expect(page.locator('#library-storage')).not.toContainText('Last backup: never');

  await set(page, 'audio_gear_last_backup', new Date(Date.now() - 45 * DAY).toISOString());
  await page.reload();
  await expect(page.locator('#library-nudge')).toContainText('45 days ago');
});

test('Export all layouts also counts as a backup', async ({ page }) => {
  await set(page, 'audio_gear_layouts', LAYOUTS);
  await page.reload();
  const download = page.waitForEvent('download');
  await page.locator('#library-export-layouts').click();
  await download;
  expect(await page.evaluate(() => localStorage.getItem('audio_gear_last_backup'))).toBeTruthy();
  await expect(page.locator('#library-nudge')).toBeHidden();
});

test('Full backup contains layouts and custom types, and Import restores all of it after a reset and clear', async ({ page }) => {
  await set(page, 'audio_gear_layouts', LAYOUTS);
  await set(page, 'audio_gear_device_types', [{ id: 'mine', name: 'Mine', label: 'Mine', width_in: 10, height_u: 1, input_ports: [], output_ports: [] }]);
  await set(page, 'audio_gear_port_types', [{ id: 'p1', name: 'Port', type: 'x', color: '#fff' }]);
  await page.reload();

  const download = page.waitForEvent('download');
  await page.locator('#library-full-backup').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('audio_gear_backup.json');
  const text = fs.readFileSync(await file.path(), 'utf8');
  const backup = JSON.parse(text);
  expect(backup).toMatchObject({ app: 'audio_gear_layout', backup_version: 1 });
  expect(backup.layouts.map((l) => l.name)).toEqual(['One']);
  expect(backup.device_types.map((t) => t.id)).toEqual(['mine']);
  expect(backup.port_types.map((t) => t.id)).toEqual(['p1']);

  await page.locator('#library-reset').click();
  await page.locator('#library-clear-layouts').click();
  expect(await get(page, 'audio_gear_layouts')).toBeNull();
  expect(await get(page, 'audio_gear_device_types')).toBeNull();

  await page.locator('#library-import-file').setInputFiles({ name: 'audio_gear_backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#library-status')).toContainText('Imported 1 layout as new copies, 1 device type, 1 port type');
  expect((await get(page, 'audio_gear_layouts')).map((l) => l.name)).toEqual(['One']);
  expect((await get(page, 'audio_gear_device_types')).map((t) => t.id)).toEqual(['mine']);
  expect((await get(page, 'audio_gear_port_types')).map((t) => t.id)).toEqual(['p1']);
});

test('importing a backup twice does not duplicate types and renames the layout copies', async ({ page }) => {
  const backup = { app: 'audio_gear_layout', backup_version: 1, layouts: LAYOUTS, device_types: [{ id: 'mine', name: 'Mine' }], port_types: [] };
  const file = { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) };
  await page.locator('#library-import-file').setInputFiles(file);
  await page.locator('#library-import-file').setInputFiles(file);
  expect((await get(page, 'audio_gear_layouts')).map((l) => l.name)).toEqual(['One', 'One (2)']);
  expect(await get(page, 'audio_gear_device_types')).toHaveLength(1);
});

test('Full backup with nothing stored says so and does not download', async ({ page }) => {
  await page.locator('#library-full-backup').click();
  await expect(page.locator('#library-status')).toContainText('Nothing to back up yet');
});

test('Import rejects a broken backup and changes nothing', async ({ page }) => {
  const bad = { app: 'audio_gear_layout', layouts: [{ name: 'no devices' }] };
  await page.locator('#library-import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.locator('#library-status')).toContainText('Import failed: not a layouts file');
  expect(await get(page, 'audio_gear_layouts')).toBeNull();
});
