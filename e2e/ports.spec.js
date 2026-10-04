const { test, expect } = require('@playwright/test');
const { openApp, addDevice, grabPoint } = require('./helpers');

// Positions of a device's port circles relative to its box: where each port sits along the edges
async function portEdges(page, device) {
  const box = await device.boundingBox();
  const ports = await page.locator('.device-port').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { io: e.dataset.portIo, x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }));
  return ports.map((p) => ({
    io: p.io,
    edge: Math.abs(p.y - box.y) < 2 ? 'top' : Math.abs(p.y - (box.y + box.height)) < 2 ? 'bottom'
      : Math.abs(p.x - box.x) < 2 ? 'left' : Math.abs(p.x - (box.x + box.width)) < 2 ? 'right' : 'other',
  }));
}

test('rack view starts with inputs on top and outputs on the bottom', async ({ page }) => {
  await openApp(page, 'index');
  const eq = await addDevice(page, 'eq');
  expect(await portEdges(page, eq)).toEqual([{ io: 'input', edge: 'top' }, { io: 'output', edge: 'bottom' }]);
});

test('the canvas switch moves every device to the sides', async ({ page }) => {
  await openApp(page, 'index');
  const eq = await addDevice(page, 'eq');
  await page.check('#toggle-ports-sides');
  expect(await portEdges(page, eq)).toEqual([{ io: 'input', edge: 'left' }, { io: 'output', edge: 'right' }]);
  await page.uncheck('#toggle-ports-sides');
  expect(await portEdges(page, eq)).toEqual([{ io: 'input', edge: 'top' }, { io: 'output', edge: 'bottom' }]);
});

test('a device switch overrides the canvas setting for that device only', async ({ page }) => {
  await openApp(page, 'index');
  const first = await addDevice(page, 'eq');
  const { x, y } = await grabPoint(first);
  await page.mouse.click(x, y); // select it
  await page.check('#device-ports-sides');
  expect(await portEdges(page, first)).toEqual([{ io: 'input', edge: 'left' }, { io: 'output', edge: 'right' }]);

  const second = await addDevice(page, 'dac'); // follows the canvas default
  const ports = await page.locator('.device-block').count();
  expect(ports).toBe(2);
  await expect(page.locator('#toggle-ports-sides')).not.toBeChecked();
  const dacPorts = await page.locator('[data-device-id]').last().locator('.device-port').count();
  expect(dacPorts).toBe(1);
  const box = await second.boundingBox();
  const circle = await page.locator('[data-device-id]').last().locator('.device-port').boundingBox();
  expect(Math.abs(circle.y + circle.height / 2 - (box.y + box.height))).toBeLessThan(2); // output on the bottom
});

test('classic view starts with ports on the sides', async ({ page }) => {
  await openApp(page, 'classic');
  const eq = await addDevice(page, 'eq');
  await expect(page.locator('#toggle-ports-sides')).toBeChecked();
  expect(await portEdges(page, eq)).toEqual([{ io: 'input', edge: 'left' }, { io: 'output', edge: 'right' }]);
});
