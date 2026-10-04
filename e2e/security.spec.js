const { test, expect } = require('@playwright/test');

const HOSTILE_ID = 'x" onmouseover="window.__pwned=1" data-x="';
const HOSTILE_NAME = '<img src=x onerror="window.__pwned=1"><b>bold</b>';
const HOSTILE_COLOR = 'red" onmouseover="window.__pwned=1';

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:7001/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.on('dialog', (d) => d.dismiss());
});

const seed = (page, key, value) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [key, value]);
const pwned = (page) => page.evaluate(() => window.__pwned);

test('the Port types page shows hostile data as plain text and runs nothing', async ({ page }) => {
  await page.goto('/port-types.html');
  await seed(page, 'audio_gear_port_types', [{ id: HOSTILE_ID, name: HOSTILE_NAME, type: HOSTILE_NAME, color: HOSTILE_COLOR }]);
  await page.reload();
  const row = page.locator('#port-type-list li', { hasText: 'bold' });
  await expect(row).toBeVisible();
  await expect(row.locator('img, b')).toHaveCount(0); // the markup is text, not elements
  await expect(row.locator('strong')).toHaveText(HOSTILE_NAME);
  await row.hover();
  await row.locator('strong').hover();
  for (const button of await row.locator('button').all()) await button.hover();
  expect(await pwned(page)).toBeUndefined();
  // the bad color is not applied to the swatch (it could otherwise be a url(...) request)
  expect(await row.locator('.port-type-swatch').evaluate((el) => el.getAttribute('style') || '')).toBe('');
});

test('the Device types page shows hostile data as plain text and runs nothing', async ({ page }) => {
  await page.goto('/device-types.html');
  await seed(page, 'audio_gear_device_types', [{ id: HOSTILE_ID, name: HOSTILE_NAME, label: HOSTILE_NAME, width_in: 19, height_u: 1, input_ports: [{ name: HOSTILE_NAME, type: 'audio' }], output_ports: [] }]);
  await seed(page, 'audio_gear_port_types', [{ id: 'p', name: HOSTILE_NAME, type: HOSTILE_ID, color: '#fff' }]);
  await page.reload();
  const row = page.locator('#type-list li', { hasText: 'bold' });
  await expect(row).toBeVisible();
  await expect(row.locator('img, b')).toHaveCount(0);
  for (const button of await row.locator('button').all()) await button.hover();
  await row.getByRole('button', { name: 'Edit' }).click(); // builds the port rows and the port-type <select>
  await expect(page.locator('#form-title, h2').first()).toBeVisible();
  expect(await page.locator('.port-type-select option').evaluateAll((os) => os.map((o) => o.value))).toContain(HOSTILE_ID);
  expect(await page.locator('.port-type-select img, .port-type-select b').count()).toBe(0);
  expect(await pwned(page)).toBeUndefined();
});

test('Library import refuses hostile device and port types and stores nothing', async ({ page }) => {
  await page.goto('/library.html');
  const file = (obj) => ({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
  await page.locator('#library-import-file').setInputFiles(file({ app: 'audio_gear_layout', layouts: [], port_types: [{ id: 'p', type: 't', color: HOSTILE_COLOR }] }));
  await expect(page.locator('#library-status')).toContainText('Import failed: not a backup file (port type 1: color must look like #rrggbb)');
  await page.locator('#library-import-file').setInputFiles(file({ app: 'audio_gear_layout', layouts: [], device_types: [{ id: 'd', width_in: 5 }] }));
  await expect(page.locator('#library-status')).toContainText('width must be 6, 10 or 19');
  expect(await page.evaluate(() => [localStorage.getItem('audio_gear_port_types'), localStorage.getItem('audio_gear_device_types')])).toEqual([null, null]);
});

test('a hostile layout (names and labels full of markup) is drawn as text on the canvas', async ({ page }) => {
  await page.goto('/index.html');
  const layout = { id: 'h1', name: HOSTILE_NAME, mode: 'rack', devices: [{ id: 'd1', type: 'x', label: HOSTILE_NAME, position: { x: 100, y: 100 }, input_ports: [{ name: HOSTILE_NAME, type: 'audio' }], output_ports: [], width_in: 19, height_u: 1 }], connections: [], racks: [] };
  await seed(page, 'audio_gear_layouts', [layout]);
  await page.goto('/index.html?layout=h1');
  await expect(page.locator('.device-label')).toHaveText(HOSTILE_NAME);
  await expect(page.locator('#canvas img, #canvas b')).toHaveCount(0);
  await page.click('#btn-parts');
  await expect(page.locator('#parts-body img, #parts-body b')).toHaveCount(0);
  expect(await pwned(page)).toBeUndefined();
});
