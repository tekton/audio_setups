const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { addDevice, saveLayout } = require('./helpers');

const PAGES = ['index', 'classic', 'library', 'device-types', 'port-types'];

// Every Content-Security-Policy violation the browser reports on the page
async function trackViolations(page) {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective}: ${e.blockedURI || 'inline'}`));
  });
}
const violations = (page) => page.evaluate(() => window.__csp);

test.beforeEach(async ({ page }) => {
  await trackViolations(page);
  await page.route('http://localhost:7001/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.on('dialog', (d) => d.accept());
});

for (const name of PAGES) {
  test(`${name}.html has a Content-Security-Policy that blocks inline script and foreign hosts, and loads without violations`, async ({ page }) => {
    await page.goto(`/${name}.html`);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/https?:\/\/(?!localhost:7001)/); // no third-party hosts
    await page.waitForLoadState('networkidle');
    expect(await violations(page)).toEqual([]);
  });
}

test('the browser really enforces it: an injected inline script does not run', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__ran = 1';
    document.head.append(s);
  });
  expect(await page.evaluate(() => window.__ran)).toBeUndefined();
  expect((await violations(page)).some((v) => v.startsWith('script-src'))).toBe(true);
});

test('everyday features work under the policy with no violations: save, PNG export, share, parts, library, pages', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true });
  });
  await page.goto('/index.html');
  await addDevice(page, 'eq');
  await saveLayout(page, 'CSP check');
  const download = page.waitForEvent('download');
  await page.click('#btn-export-image');
  await download;
  await page.click('#btn-share-link');
  await expect.poll(() => page.evaluate(() => window.__copied)).toMatch(/#share=/);
  await page.click('#btn-parts');
  await expect(page.locator('#parts-body table').first()).toBeVisible();
  await page.click('#btn-undo');
  await page.goto('/library.html');
  await page.locator('#library-layouts li', { hasText: 'The Crap Rack' }).getByRole('button', { name: 'Open a copy' }).click();
  await page.waitForURL(/index\.html$/);
  await expect(page.locator('.device-block')).toHaveCount(4);
  await page.goto('/port-types.html');
  await expect(page.locator('#port-type-list li').first()).toBeVisible();
  await page.goto('/device-types.html');
  expect(await violations(page)).toEqual([]);
});

test('the local-only build drops the backend host from every page policy', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'rebuilds dist/, so run it once');
  const { buildLocal } = require('../scripts/build-local.js');
  const out = buildLocal();
  for (const name of PAGES) {
    const html = fs.readFileSync(`${out}/${name}.html`, 'utf8');
    expect(html).toContain("connect-src 'self';");
    expect(html).not.toContain('localhost:7001');
  }
});
