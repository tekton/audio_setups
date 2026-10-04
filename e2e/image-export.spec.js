const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { openApp, addRack, addDevice, saveLayout, expectMessage } = require('./helpers');

// PNG header: 8-byte signature, then the IHDR chunk with width and height as big-endian 32-bit numbers
function pngSize(buf) {
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('Export image downloads a PNG of the layout named after it', async ({ page }) => {
  await addRack(page, 19, 4);
  await addDevice(page, 'eq');
  await saveLayout(page, 'My Desk');
  const download = page.waitForEvent('download');
  await page.click('#btn-export-image');
  const file = await download;
  expect(file.suggestedFilename()).toBe('My_Desk.png');
  const { width, height } = pngSize(fs.readFileSync(await file.path()));
  expect(width).toBeGreaterThan(300);
  expect(height).toBeGreaterThan(200);
});

test('the exported picture is drawn, not blank: it contains the device colors', async ({ page }) => {
  await addDevice(page, 'eq');
  await saveLayout(page, 'Pixels');
  const download = page.waitForEvent('download');
  await page.click('#btn-export-image');
  const png = fs.readFileSync(await (await download).path());
  const colors = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const seen = new Set();
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < data.length; i += 4 * 7) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return { count: seen.size, hasBlueEdge: seen.has('74,158,255') };
  }, png.toString('base64'));
  expect(colors.count).toBeGreaterThan(3);
  expect(colors.hasBlueEdge).toBe(true); // the device outline (--device-stroke #4a9eff)
});

test('Export image on an empty canvas says there is nothing to export', async ({ page }) => {
  await page.click('#btn-toggle-save-load');
  await page.click('#btn-export-image');
  await expectMessage(page, 'Nothing to export');
});
