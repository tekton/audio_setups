const { test, expect } = require('@playwright/test');
const { relBox, expectNear, expectBoxNear, openApp, addRack, addDevice, drag, grabPoint, setDeviceSize, dropInRack, expectMessage } = require('./helpers');

// Rack drawing constants (see frontend/js/rack-geometry.js)
const RACK_PAD = 16;
const RACK_HEADER = 24;
const INCH_PX = 24;

test.beforeEach(async ({ page }) => {
  await openApp(page, 'index');
});

test('a device that fits snaps into the top slot of the rack', async ({ page }) => {
  await addRack(page, 10, 6);
  const eq = await addDevice(page, 'eq');
  await setDeviceSize(page, eq, 10, 1);
  const rack = page.locator('.rack-frame');
  await dropInRack(page, eq, rack, 30, 30);

  const r = await rack.boundingBox();
  const d = await eq.boundingBox();
  expectNear(d.x - r.x, RACK_PAD);
  expectNear(d.y - r.y, RACK_HEADER);
  expectNear(d.width, 10 * INCH_PX);
});

test('a device wider than the rack is refused and put back', async ({ page }) => {
  await addRack(page, 10, 6);
  const eq = await addDevice(page, 'eq'); // 19" by default
  const before = await relBox(page, eq);
  await dropInRack(page, eq, page.locator('.rack-frame'), 30, 30);

  await expectMessage(page, 'Too wide');
  expectBoxNear(await relBox(page, eq), before);
});

test('devices can share a row and the row gets an asterisk', async ({ page }) => {
  await addRack(page, 19, 4);
  const rack = page.locator('.rack-frame');
  const first = await addDevice(page, 'eq');
  await setDeviceSize(page, first, 6);
  await dropInRack(page, first, rack, RACK_PAD, RACK_HEADER);
  await expect(page.locator('.rack-shared-mark')).toHaveCount(0);

  const second = await addDevice(page, 'dac');
  await setDeviceSize(page, second, 6);
  await dropInRack(page, second, rack, RACK_PAD + 8 * INCH_PX, RACK_HEADER);
  await expect(page.locator('.rack-shared-mark')).toHaveCount(1);
});

test('overlapping a device in the same slot is refused', async ({ page }) => {
  await addRack(page, 19, 4);
  const rack = page.locator('.rack-frame');
  const first = await addDevice(page, 'eq');
  await setDeviceSize(page, first, 6);
  await dropInRack(page, first, rack, RACK_PAD, RACK_HEADER);

  const second = await addDevice(page, 'dac');
  await setDeviceSize(page, second, 6);
  await dropInRack(page, second, rack, RACK_PAD + 2 * INCH_PX, RACK_HEADER);
  await expectMessage(page, 'taken');
  await expect(page.locator('.rack-shared-mark')).toHaveCount(0);
});

test('moving a rack carries its devices along', async ({ page }) => {
  await addRack(page, 10, 6);
  const rack = page.locator('.rack-frame');
  const eq = await addDevice(page, 'eq');
  await setDeviceSize(page, eq, 10);
  await dropInRack(page, eq, rack, 30, 30);

  const rackBefore = await rack.boundingBox();
  const rackRelBefore = await relBox(page, rack);
  const devBefore = await relBox(page, eq);
  // Grab the empty lower part of the frame
  await drag(page, { x: rackBefore.x + 30, y: rackBefore.y + rackBefore.height - 20 }, { x: rackBefore.x + 230, y: rackBefore.y + rackBefore.height + 30 });

  const rackAfter = await relBox(page, rack);
  const devAfter = await relBox(page, eq);
  expectNear(rackAfter.x - rackRelBefore.x, 200);
  expectNear(devAfter.x - devBefore.x, 200);
  expectNear(devAfter.y - devBefore.y, 50);
});

test('dragging a device out of its rack frees it and drops the asterisk', async ({ page }) => {
  await addRack(page, 19, 4);
  const rack = page.locator('.rack-frame');
  const first = await addDevice(page, 'eq');
  await setDeviceSize(page, first, 6);
  await dropInRack(page, first, rack, RACK_PAD, RACK_HEADER);
  const second = await addDevice(page, 'dac');
  await setDeviceSize(page, second, 6);
  await dropInRack(page, second, rack, RACK_PAD + 8 * INCH_PX, RACK_HEADER);
  await expect(page.locator('.rack-shared-mark')).toHaveCount(1);

  const rackBox = await rack.boundingBox();
  const from = await grabPoint(second);
  await drag(page, from, { x: rackBox.x + rackBox.width + 200, y: rackBox.y + 100 });

  await expect(page.locator('.rack-shared-mark')).toHaveCount(0);
  const out = await second.boundingBox();
  expectNear(out.width, 120); // back to the free-device box
  expectNear(out.height, 56);
});

test('deleting a rack leaves its devices on the canvas', async ({ page }) => {
  await addRack(page, 10, 6);
  const rack = page.locator('.rack-frame');
  const eq = await addDevice(page, 'eq');
  await setDeviceSize(page, eq, 10);
  await dropInRack(page, eq, rack, 30, 30);
  const before = await relBox(page, eq);

  const r = await rack.boundingBox();
  await page.mouse.click(r.x + 30, r.y + r.height - 20); // select the rack
  await page.click('#btn-delete');

  await expect(page.locator('.rack-frame')).toHaveCount(0);
  await expect(page.locator('.device-block')).toHaveCount(1);
  const after = await relBox(page, eq);
  expectNear(after.x, before.x);
  expectNear(after.y, before.y);
});

test('the canvas grows so a tall rack is not clipped', async ({ page }) => {
  await addRack(page, 19, 12);
  const rack = await page.locator('.rack-frame').boundingBox();
  const canvas = await page.locator('#canvas').boundingBox();
  expect(rack.y + rack.height).toBeLessThanOrEqual(canvas.y + canvas.height);
});
