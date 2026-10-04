const { test, expect } = require('@playwright/test');
const { openApp, addRack, addDevice, saveLayout, expectMessage } = require('./helpers');

// Replace the clipboard so the link can be read back in every browser (WebKit has no clipboard permission to grant)
async function captureClipboard(page) {
  await page.addInitScript(() => {
    window.__copied = null;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true });
  });
}

test('Copy link makes a #share link that opens the same layout, unsaved, in a fresh browser', async ({ page, browser }) => {
  await captureClipboard(page);
  await openApp(page);
  await addRack(page, 19, 4);
  await addDevice(page, 'eq');
  await saveLayout(page, 'Shared desk');
  await page.click('#btn-share-link');
  await expectMessage(page, 'Link copied');
  const link = await page.evaluate(() => window.__copied);
  expect(link).toMatch(/index\.html#share=z/);

  const friend = await (await browser.newContext(page.context()._options)).newPage();
  await friend.route('http://localhost:7001/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await friend.goto(link);
  await expectMessage(friend, 'Opened a shared layout');
  await expect(friend.locator('.rack-frame')).toHaveCount(1);
  await expect(friend.locator('.device-block')).toHaveCount(1);
  await expect(friend.locator('#layout-name')).toHaveValue('Shared desk');
  expect(new URL(friend.url()).hash).toBe(''); // the hash is dropped so a reload doesn't re-import
  // unsaved: nothing in the friend's storage until they press Save
  expect(await friend.evaluate(() => localStorage.getItem('audio_gear_layouts'))).toBeNull();
  await friend.context().close();
});

test('a link made on the classic page opens on the classic page even from the rack page', async ({ page, browser }) => {
  await captureClipboard(page);
  await openApp(page, 'classic');
  await addDevice(page, 'eq');
  await saveLayout(page, 'Freeform');
  await page.click('#btn-share-link');
  await expectMessage(page, 'Link copied');
  const link = await page.evaluate(() => window.__copied);
  const hash = new URL(link).hash;

  const friend = await (await browser.newContext(page.context()._options)).newPage();
  await friend.route('http://localhost:7001/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await friend.goto(new URL('/index.html', link).href + hash); // wrong page on purpose
  await expect(friend).toHaveURL(/classic\.html/);
  await expect(friend.locator('#layout-name')).toHaveValue('Freeform');
  await expect(friend.locator('.device-block')).toHaveCount(1);
  await friend.context().close();
});

test('a damaged link says so and leaves an empty canvas', async ({ page }) => {
  await openApp(page);
  await page.goto('about:blank'); // a hash-only change on the same page would not reload it
  await page.goto('/index.html#share=zNOTVALID');
  await expectMessage(page, 'Could not open the link');
  await expect(page.locator('.device-block')).toHaveCount(0);
});

test('Copy link on an empty canvas says there is nothing to share', async ({ page }) => {
  await openApp(page);
  await page.click('#btn-toggle-save-load');
  await page.click('#btn-share-link');
  await expectMessage(page, 'Nothing to share');
});

test('when the clipboard is blocked the link is offered in a prompt instead', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } }, configurable: true });
  });
  await openApp(page);
  await addDevice(page, 'eq');
  let promptText = null;
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => { promptText = d.defaultValue(); d.accept(); });
  await page.click('#btn-toggle-save-load');
  await page.click('#btn-share-link');
  await expect.poll(() => promptText).toMatch(/#share=/);
});
