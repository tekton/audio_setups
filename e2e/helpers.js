const { expect } = require('@playwright/test');

// Fresh page on the given view, with the backend API stubbed out (the app falls back to device storage)
async function openApp(page, view = 'index') {
  await page.route('http://localhost:7001/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`/${view}.html`);
}

async function addRack(page, widthIn, heightU) {
  await page.selectOption('#add-rack-width', String(widthIn));
  await page.fill('#add-rack-height', String(heightU));
  await page.click('#btn-add-rack');
}

// Adds a device of a built-in type and returns a locator for its box (the newest device)
async function addDevice(page, type = 'eq') {
  await page.selectOption('#add-device-select', type);
  return page.locator('.device-block').last();
}

// Drags from `from` to `to` (page coordinates) with real mouse events
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.mouse.up();
}

// A point just inside a box's top-left corner, clear of its ports
async function grabPoint(locator) {
  const box = await locator.boundingBox();
  return { x: box.x + 6, y: box.y + 6, box };
}

// Selects a device (a tap without moving) and sets its size in the side panel
async function setDeviceSize(page, device, widthIn, heightU = 1) {
  const { x, y } = await grabPoint(device);
  await page.mouse.click(x, y);
  await page.selectOption('#device-width', String(widthIn));
  await page.fill('#device-height', String(heightU));
  await page.dispatchEvent('#device-height', 'change');
}

// Drops `device` so its top-left corner lands `dx`,`dy` inside the rack frame's top-left
async function dropInRack(page, device, rackFrame, dx, dy) {
  const rack = await rackFrame.boundingBox();
  const from = await grabPoint(device);
  await drag(page, from, { x: rack.x + dx + 6, y: rack.y + dy + 6 });
}

async function expectMessage(page, text) {
  await expect(page.locator('#canvas-message')).toContainText(text);
}

async function openSavePanel(page) {
  if (await page.locator('#toolbar-save-load').isHidden()) await page.click('#btn-toggle-save-load');
}

async function saveLayout(page, name) {
  await openSavePanel(page);
  await page.fill('#layout-name', name);
  await page.click('#btn-save');
}

async function loadOptions(page) {
  return page.locator('#load-layout-select option').allTextContents();
}

// Box relative to the canvas: selecting a device opens the side panel and shifts the whole canvas down the page
async function relBox(page, locator) {
  const canvas = await page.locator('#canvas').boundingBox();
  const box = await locator.boundingBox();
  return { x: box.x - canvas.x, y: box.y - canvas.y, width: box.width, height: box.height };
}

// Measured boxes include the SVG stroke (1-3px) and half-pixel rounding, so compare with a small tolerance
function expectNear(actual, expected, tolerance = 4) {
  expect(Math.abs(actual - expected), `${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

function expectBoxNear(actual, expected, tolerance = 4) {
  for (const key of ['x', 'y', 'width', 'height']) expectNear(actual[key], expected[key], tolerance);
}

module.exports = { relBox, openSavePanel, expectNear, expectBoxNear, openApp, addRack, addDevice, drag, grabPoint, setDeviceSize, dropInRack, expectMessage, saveLayout, loadOptions };
