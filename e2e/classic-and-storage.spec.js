const { test, expect } = require('@playwright/test');
const { relBox, expectNear, expectBoxNear, openSavePanel, openApp, addRack, addDevice, setDeviceSize, dropInRack, saveLayout, loadOptions } = require('./helpers');

test('classic view hides the rack controls and keeps devices at the free-form size', async ({ page }) => {
  await openApp(page, 'classic');
  await expect(page.locator('#btn-add-rack')).toBeHidden();
  await expect(page.locator('#add-rack-width')).toBeHidden();
  const eq = await addDevice(page, 'eq');
  const box = await eq.boundingBox();
  expectNear(box.width, 120);
  expectNear(box.height, 56);
  await expect(page.locator('.rack-frame')).toHaveCount(0);
});

test('rack view shows the rack controls', async ({ page }) => {
  await openApp(page, 'index');
  await expect(page.locator('#btn-add-rack')).toBeVisible();
});

test('each view lists only its own saved layouts', async ({ page }) => {
  await openApp(page, 'classic');
  await addDevice(page, 'eq');
  await saveLayout(page, 'Classic one');
  await expect.poll(() => loadOptions(page)).toContain('Classic one');

  await page.goto('/index.html');
  await openSavePanel(page);
  await page.focus('#load-layout-select');
  expect(await loadOptions(page)).not.toContain('Classic one');
  await addRack(page, 19, 4);
  await saveLayout(page, 'Rack one');
  await expect.poll(() => loadOptions(page)).toContain('Rack one');

  await page.goto('/classic.html');
  await openSavePanel(page);
  await page.focus('#load-layout-select');
  await expect.poll(() => loadOptions(page)).toContain('Classic one');
  expect(await loadOptions(page)).not.toContain('Rack one');
});

test('a rack layout keeps its racks, placement and ports setting through save and load', async ({ page }) => {
  await openApp(page, 'index');
  await addRack(page, 10, 6);
  const rack = page.locator('.rack-frame');
  const eq = await addDevice(page, 'eq');
  await setDeviceSize(page, eq, 10);
  await dropInRack(page, eq, rack, 30, 30);
  await page.check('#toggle-ports-sides');
  const placed = await relBox(page, eq);
  const rackBox = await relBox(page, rack);
  await saveLayout(page, 'Round trip');

  await page.click('#btn-new');
  await expect(page.locator('.rack-frame')).toHaveCount(0);
  await expect(page.locator('#toggle-ports-sides')).not.toBeChecked();

  await expect.poll(() => loadOptions(page)).toContain('Round trip');
  await page.selectOption('#load-layout-select', { label: 'Round trip' });
  await expect(page.locator('.rack-frame')).toHaveCount(1);
  await expect(page.locator('#toggle-ports-sides')).toBeChecked();
  expectBoxNear(await relBox(page, page.locator('.rack-frame')), rackBox);
  expectBoxNear(await relBox(page, page.locator('.device-block')), placed);
});
