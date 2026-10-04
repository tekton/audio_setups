const { test, expect } = require('@playwright/test');
const { openApp, addRack, addDevice, saveLayout, dropInRack, grabPoint, drag, relBox } = require('./helpers');

const count = (page, sel) => page.locator(sel).count();

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('Undo and Redo start disabled, then step back and forward through adding devices', async ({ page }) => {
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await expect(page.locator('#btn-redo')).toBeDisabled();
  await addDevice(page, 'eq');
  await addDevice(page, 'dac');
  await expect(page.locator('.device-block')).toHaveCount(2);
  await expect(page.locator('#btn-undo')).toBeEnabled();

  await page.click('#btn-undo');
  await expect(page.locator('.device-block')).toHaveCount(1);
  await expect(page.locator('#btn-redo')).toBeEnabled();
  await page.click('#btn-undo');
  await expect(page.locator('.device-block')).toHaveCount(0);
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await page.click('#btn-redo');
  await page.click('#btn-redo');
  await expect(page.locator('.device-block')).toHaveCount(2);
  await expect(page.locator('#btn-redo')).toBeDisabled();
});

test('moving a device is one undo step that puts it back where it was', async ({ page }) => {
  const dev = await addDevice(page, 'eq');
  const before = await relBox(page, dev);
  const from = await grabPoint(dev);
  await drag(page, from, { x: from.x + 260, y: from.y + 120 });
  const moved = await relBox(page, page.locator('.device-block'));
  expect(Math.abs(moved.x - before.x)).toBeGreaterThan(100);
  await page.click('#btn-undo');
  const back = await relBox(page, page.locator('.device-block'));
  expect(Math.abs(back.x - before.x)).toBeLessThan(3);
  expect(Math.abs(back.y - before.y)).toBeLessThan(3);
  await expect(page.locator('#btn-undo')).toBeEnabled(); // the add is still undoable
});

test('undo reverts snapping a device into a rack, and redo snaps it back', async ({ page }) => {
  await addRack(page, 19, 4);
  const dev = await addDevice(page, 'eq');
  await dropInRack(page, dev, page.locator('.rack-frame'), 20, 40);
  // measured relative to the canvas: selecting or deselecting a device opens or closes the side panel and shifts the page
  const posRacked = await relBox(page, page.locator('.device-block'));
  await page.click('#btn-undo');
  const posFree = await relBox(page, page.locator('.device-block'));
  expect(Math.abs(posFree.y - posRacked.y) + Math.abs(posFree.x - posRacked.x)).toBeGreaterThan(5);
  await page.click('#btn-redo');
  const posAgain = await relBox(page, page.locator('.device-block'));
  expect(Math.abs(posAgain.y - posRacked.y)).toBeLessThan(3);
  expect(Math.abs(posAgain.x - posRacked.x)).toBeLessThan(3);
});

test('cables and deleting can be undone', async ({ page, isMobile }) => {
  test.skip(isMobile, 'draws the cable with Shift-drag, which is a mouse gesture; mobile cables are covered in mobile.spec.js');
  await addDevice(page, 'dac');
  await addDevice(page, 'eq');
  const b = page.locator('.device-block').nth(1);
  const ab = await b.boundingBox();
  await drag(page, await grabPoint(b), { x: ab.x + 300, y: ab.y + 100 }); // keep them apart
  const out = page.locator('.device-port.port-output').first();
  const inn = page.locator('.device-port.port-input').last();
  const o = await out.boundingBox();
  const i = await inn.boundingBox();
  await page.keyboard.down('Shift'); // Shift-drag from an output port draws a cable with the mouse
  await drag(page, { x: o.x + o.width / 2, y: o.y + o.height / 2 }, { x: i.x + i.width / 2, y: i.y + i.height / 2 });
  await page.keyboard.up('Shift');
  await expect(page.locator('.cable')).toHaveCount(1);
  await page.click('#btn-undo');
  await expect(page.locator('.cable')).toHaveCount(0);
  await page.click('#btn-redo');
  await expect(page.locator('.cable')).toHaveCount(1);

  await page.locator('.device-block').nth(0).click({ position: { x: 6, y: 6 } });
  await page.click('#btn-delete');
  await expect(page.locator('.device-block')).toHaveCount(1);
  await expect(page.locator('.cable')).toHaveCount(0); // deleting a device removes its cables
  await page.click('#btn-undo');
  await expect(page.locator('.device-block')).toHaveCount(2);
  await expect(page.locator('.cable')).toHaveCount(1);
});

test('keyboard shortcuts: Ctrl/Cmd+Z undoes, Shift+Z and Ctrl+Y redo, but not while typing in a field', async ({ page }) => {
  await addDevice(page, 'eq');
  await page.click('#btn-toggle-save-load');
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.fill('#layout-name', 'x');
  await page.locator('#layout-name').press(`${mod}+z`); // in a text field: the browser's own undo, ours stays out of it
  await expect(page.locator('.device-block')).toHaveCount(1);
  await page.locator('#layout-name').blur();
  await page.locator('body').press(`${mod}+z`);
  await expect(page.locator('.device-block')).toHaveCount(0);
  await page.locator('body').press(`${mod}+Shift+z`);
  await expect(page.locator('.device-block')).toHaveCount(1);
  await page.locator('body').press(`${mod}+z`);
  await page.locator('body').press(`${mod}+y`);
  await expect(page.locator('.device-block')).toHaveCount(1);
});

test('loading, starting a new layout or importing clears the history so undo cannot cross layouts', async ({ page }) => {
  await addDevice(page, 'eq');
  await saveLayout(page, 'First');
  await page.click('#btn-new');
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await addDevice(page, 'dac');
  await page.click('#btn-undo');
  await expect(page.locator('.device-block')).toHaveCount(0); // back to the empty new layout, not into "First"
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await page.selectOption('#load-layout-select', { label: 'First' });
  await expect(page.locator('.device-block')).toHaveCount(1);
  await expect(page.locator('#btn-undo')).toBeDisabled();
});

test('undo keeps the layout name and saved identity', async ({ page }) => {
  await saveLayout(page, 'Keep my name');
  await addDevice(page, 'eq');
  await page.click('#btn-undo');
  await expect(page.locator('#layout-name')).toHaveValue('Keep my name');
  await expect(page.locator('#btn-delete-layout')).toBeEnabled(); // still the saved layout
});

test('Parts list shows devices, where they sit, cables and cable totals for the layout', async ({ page }) => {
  await page.goto('/library.html');
  await page.locator('#library-layouts li', { hasText: 'The Crap Rack' }).getByRole('button', { name: 'Open a copy' }).click();
  await page.waitForURL(/index\.html$/);
  await expect(page.locator('#parts-panel')).toBeHidden();
  await page.click('#btn-parts');
  await expect(page.locator('#parts-panel')).toBeVisible();
  await expect(page.locator('#btn-parts')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#parts-title')).toHaveText('The Crap Rack');
  const text = await page.locator('#parts-body').innerText();
  expect(text).toContain('Racks (1)');
  expect(text).toContain('Devices (4)');
  expect(text).toContain('Cables (3)');
  expect(text).toMatch(/Mac mini mount \(6"\)\s+6" × 2U\s+The Crap Rack, U1–U2/);
  expect(text).toMatch(/DAC \(6"\) · USB\s+\S/);
  expect(text).toContain('Cables to buy, by type');
  expect(await count(page, '#parts-body table')).toBe(4);
  await page.click('#btn-parts-close');
  await expect(page.locator('#parts-panel')).toBeHidden();
});

test('Parts list updates with the canvas and says None yet when empty', async ({ page }) => {
  await page.click('#btn-parts');
  await expect(page.locator('#parts-body')).toContainText('None yet');
  await page.click('#btn-parts-close');
  await addDevice(page, 'eq');
  await page.click('#btn-parts');
  await expect(page.locator('#parts-body')).toContainText('Devices (1)');
  await expect(page.locator('#parts-body')).toContainText('Not in a rack');
});

test('Copy as CSV puts the list on the clipboard', async ({ page }) => {
  await page.evaluate(() => {
    window.__copied = null;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true });
  });
  await addDevice(page, 'eq');
  await page.click('#btn-parts');
  await page.click('#btn-parts-csv');
  await expect.poll(() => page.evaluate(() => window.__copied)).toMatch(/^Devices\nName,Size,Location\n"/);
});

test('Print prints only the parts list (everything else is hidden by the print styles)', async ({ page }) => {
  await addDevice(page, 'eq');
  await page.click('#btn-parts');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('header')).toBeHidden();
  await expect(page.locator('#canvas')).toBeHidden();
  await expect(page.locator('#parts-panel')).toBeVisible();
  await expect(page.locator('.parts-actions')).toBeHidden();
});
