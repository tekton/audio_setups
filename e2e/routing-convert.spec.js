const { test, expect } = require('@playwright/test');
const { addDevice, saveLayout, expectMessage, loadOptions, openSavePanel } = require('./helpers');

// For every cable, walks along its path and reports any point strictly inside a device box
function cablesThroughDevices(page) {
  return page.evaluate(() => {
    const rects = [...document.querySelectorAll('.device-block')].map((el) => ({ x: +el.getAttribute('x'), y: +el.getAttribute('y'), w: +el.getAttribute('width'), h: +el.getAttribute('height') }));
    const bad = [];
    document.querySelectorAll('path.cable').forEach((path) => {
      const len = path.getTotalLength();
      for (let t = 0; t <= len; t += 2) {
        const p = path.getPointAtLength(t);
        if (rects.some((r) => p.x > r.x + 2 && p.x < r.x + r.w - 2 && p.y > r.y + 2 && p.y < r.y + r.h - 2)) { bad.push(path.dataset.connectionId); break; }
      }
    });
    return bad;
  });
}

const segments = (page) => page.locator('path.cable').evaluateAll((els) => els.map((el) => (el.getAttribute('d').match(/L/g) || []).length));

async function openExample(page, name, url) {
  await page.goto('/library.html');
  await page.locator('#library-layouts li', { hasText: name }).getByRole('button', { name: 'Open a copy' }).click();
  await page.waitForURL(url);
  await expect(page.locator('.device-block').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:7001/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.on('dialog', (d) => d.accept());
});

test('The Crap Rack: no cable is drawn through a device; the ones that would be go around the side', async ({ page }) => {
  await openExample(page, 'The Crap Rack', /index\.html$/);
  expect(await cablesThroughDevices(page)).toEqual([]);
  const legs = await segments(page);
  expect(legs).toHaveLength(3);
  expect(legs.some((n) => n > 1)).toBe(true); // at least one rerouted
});

test('neighbouring devices keep straight cables (the Two-channel rack has no detours)', async ({ page }) => {
  await openExample(page, 'Two-channel', /index\.html$/);
  expect(await segments(page)).toEqual([1, 1]);
  expect(await cablesThroughDevices(page)).toEqual([]);
});

for (const name of ['Desktop 10" rack', 'Home stereo rack']) {
  test(`${name}: nothing is cabled through a device`, async ({ page }) => {
    await openExample(page, name, /index\.html$/);
    expect(await cablesThroughDevices(page)).toEqual([]);
  });
}

test('a rerouted cable is still selectable and can be severed', async ({ page }) => {
  await openExample(page, 'The Crap Rack', /index\.html$/);
  const id = await page.locator('path.cable').evaluateAll((els) => els.find((el) => (el.getAttribute('d').match(/L/g) || []).length > 1).dataset.connectionId);
  await page.locator(`path.cable[data-connection-id="${id}"]`).dispatchEvent('mousedown');
  await expect(page.locator(`path.cable[data-connection-id="${id}"]`)).toHaveClass(/selected/);
  await page.click('#btn-remove-cable');
  await expect(page.locator('.cable')).toHaveCount(2);
});

test('Convert to rack makes a rack copy in signal-flow order and leaves the classic layout alone', async ({ page }) => {
  await openExample(page, 'Headphone desk (freeform)', /classic\.html$/);
  await expect(page.locator('.rack-frame')).toHaveCount(0);
  await page.click('#btn-toggle-save-load');
  await page.click('#btn-convert-rack');
  await page.waitForURL(/index\.html$/);
  await expect(page.locator('#layout-name')).toHaveValue('Headphone desk (freeform) (rack)');
  await expect(page.locator('.rack-frame')).toHaveCount(1);
  await expect(page.locator('.device-block')).toHaveCount(4);
  await expect(page.locator('.cable')).toHaveCount(3);
  expect(await cablesThroughDevices(page)).toEqual([]);
  // flow order: laptop is the top device
  const tops = await page.locator('.device-block').evaluateAll((els) => els.map((el) => +el.getAttribute('y')));
  const labels = await page.locator('.device-label').allTextContents();
  expect(labels[tops.indexOf(Math.min(...tops))]).toBe('Laptop');
  // the classic original is still there and the copy is listed on the rack page only
  await openSavePanel(page);
  expect(await loadOptions(page)).toContain('Headphone desk (freeform) (rack)');
  await page.goto('/classic.html');
  await openSavePanel(page);
  const classic = await loadOptions(page);
  expect(classic).toContain('Headphone desk (freeform)');
  expect(classic).not.toContain('Headphone desk (freeform) (rack)');
});

test('Convert to rack on an empty canvas says there is nothing to convert', async ({ page }) => {
  await page.goto('/classic.html');
  await page.click('#btn-toggle-save-load');
  await page.click('#btn-convert-rack');
  await expectMessage(page, 'Nothing to convert');
});

test('Convert to rack is a classic-page button only', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#btn-convert-rack')).toHaveCount(0);
});

test('converting twice numbers the copies', async ({ page }) => {
  await page.goto('/classic.html');
  await addDevice(page, 'eq');
  await saveLayout(page, 'Desk');
  await page.click('#btn-convert-rack');
  await page.waitForURL(/index\.html$/);
  await page.goto('/classic.html');
  await openSavePanel(page);
  await page.selectOption('#load-layout-select', { label: 'Desk' });
  await page.click('#btn-convert-rack');
  await page.waitForURL(/index\.html$/);
  await expect(page.locator('#layout-name')).toHaveValue('Desk (rack) (2)');
});
