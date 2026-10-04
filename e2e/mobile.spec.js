const { test, expect } = require('@playwright/test');
const { openApp, addRack, addDevice, openSavePanel, saveLayout, expectNear } = require('./helpers');

// Runs only in the iPhone and iPad projects (see playwright.config.js): touch events, small viewports, WebKit.
// Playwright's touchscreen can only tap, so drags are sent as touchstart/touchmove/touchend events.

async function touchDrag(page, from, to) {
  // WebKit-on-desktop has no Touch constructor, so build plain events that carry the touch lists the app reads
  const send = (type, pt) => page.evaluate(({ type, pt }) => {
    const target = type === 'touchstart' ? document.elementFromPoint(pt.x, pt.y) : document.getElementById('canvas');
    const touch = { identifier: 1, target, clientX: pt.x, clientY: pt.y };
    const evt = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'touches', { value: type === 'touchend' ? [] : [touch] });
    Object.defineProperty(evt, 'changedTouches', { value: [touch] });
    target.dispatchEvent(evt);
  }, { type, pt });
  await send('touchstart', from);
  await send('touchmove', { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
  await send('touchmove', to);
  await send('touchend', to);
}

const center = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

test.beforeEach(async ({ page }) => {
  await openApp(page, 'index');
});

test('the page fits the screen without sideways scrolling', async ({ page }) => {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  for (const id of ['#add-device-select', '#btn-add-rack', '#btn-delete', '#btn-toggle-save-load']) {
    const box = await page.locator(id).boundingBox();
    expect(box.x, id).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, id).toBeLessThanOrEqual(innerWidth);
  }
});

test('buttons and fields are big enough to tap, and inputs do not trigger iOS zoom', async ({ page }) => {
  const small = await page.evaluate(() => {
    return [...document.querySelectorAll('.toolbar button, .toolbar-select, .toolbar-input')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => el.getBoundingClientRect().height < 44 || parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => el.id || el.className);
  });
  expect(small).toEqual([]);
});

test('tapping a device selects it and opens its ports editor', async ({ page }) => {
  const dac = await addDevice(page, 'dac');
  await expect(page.locator('#ports-editor')).toBeHidden();
  const box = await dac.boundingBox();
  await page.touchscreen.tap(box.x + 8, box.y + 8);
  await expect(page.locator('#ports-editor')).toBeVisible();
});

test('dragging a device with a finger snaps it into a rack', async ({ page }) => {
  await addRack(page, 19, 6);
  const dac = await addDevice(page, 'dac');
  const rack = await page.locator('.rack-frame').boundingBox();
  const d = await dac.boundingBox();
  await touchDrag(page, { x: d.x + 8, y: d.y + 8 }, { x: rack.x + 40, y: rack.y + 40 });

  const after = await dac.boundingBox();
  const r = await page.locator('.rack-frame').boundingBox();
  expectNear(after.x - r.x, 16); // RACK_PAD
  expectNear(after.y - r.y, 24); // RACK_HEADER
});

test('tapping an output port and then an input port connects them with a cable', async ({ page }) => {
  await addDevice(page, 'dac');
  const speaker = await addDevice(page, 'speaker');
  const sb = await speaker.boundingBox();
  await touchDrag(page, { x: sb.x + 8, y: sb.y + 8 }, { x: sb.x + 100, y: sb.y + 8 }); // move it clear of the DAC

  const output = page.locator('.device-port[data-port-io="output"]').first();
  const input = page.locator('.device-port[data-port-io="input"]').first();
  await page.touchscreen.tap(...Object.values(center(await output.boundingBox())));
  await expect(page.locator('#canvas-message')).toContainText(/cable|connect|input/i);
  await page.touchscreen.tap(...Object.values(center(await input.boundingBox())));
  await expect(page.locator('.cable')).toHaveCount(1);
});

test('a layout saved on the phone survives a reload', async ({ page }) => {
  await addDevice(page, 'dac');
  await saveLayout(page, 'Phone layout');
  await page.reload();
  await openSavePanel(page);
  await expect(page.locator('#load-layout-select option', { hasText: 'Phone layout' })).toHaveCount(1);
});
