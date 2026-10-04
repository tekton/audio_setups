const { test, expect } = require('@playwright/test');
const { openApp, addDevice, saveLayout, loadOptions, openSavePanel } = require('./helpers');

const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('audio_gear_layouts') || '[]').map((l) => ({ name: l.name, devices: l.devices.length })));

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('Duplicate saves a copy under a free name and keeps editing the copy', async ({ page }) => {
  await addDevice(page, 'eq');
  await saveLayout(page, 'Desk');
  await page.click('#btn-duplicate-layout');
  await page.click('#btn-duplicate-layout');
  expect(await saved(page)).toEqual([
    { name: 'Desk', devices: 1 },
    { name: 'Desk (2)', devices: 1 },
    { name: 'Desk (3)', devices: 1 },
  ]);
  await expect(page.locator('#layout-name')).toHaveValue('Desk (3)');
  // the copy is now the current layout, so a new device goes into it and not the original
  await addDevice(page, 'eq');
  await page.click('#btn-save');
  expect((await saved(page)).map((l) => l.devices)).toEqual([1, 1, 2]);
});

test('Duplicate works on a layout that was never saved', async ({ page }) => {
  await addDevice(page, 'eq');
  await openSavePanel(page);
  await page.click('#btn-duplicate-layout');
  expect(await saved(page)).toEqual([{ name: 'Untitled layout', devices: 1 }]);
});

test('Rename changes the saved name without saving other edits', async ({ page }) => {
  await expect(page.locator('#btn-rename-layout')).toBeDisabled();
  await addDevice(page, 'eq');
  await saveLayout(page, 'Old name');
  await expect(page.locator('#btn-rename-layout')).toBeEnabled();
  await addDevice(page, 'eq'); // unsaved
  await page.fill('#layout-name', 'New name');
  await page.click('#btn-rename-layout');
  expect(await saved(page)).toEqual([{ name: 'New name', devices: 1 }]);
  await expect.poll(() => loadOptions(page)).toContain('New name');
});

test('Rename avoids a name another layout already has', async ({ page }) => {
  await saveLayout(page, 'A');
  await page.click('#btn-new');
  await saveLayout(page, 'B');
  await page.fill('#layout-name', 'A');
  await page.click('#btn-rename-layout');
  expect((await saved(page)).map((l) => l.name)).toEqual(['A', 'A (2)']);
});
