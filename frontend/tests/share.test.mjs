/** @jest-environment node */
import { bytesToB64Url, b64UrlToBytes, slimLayout, shareUrl, tokenFromHash, decodeShare } from '../js/share.js';

describe('share links', () => {
  test('base64url round-trips every byte value and has no +, / or =', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const text = bytesToB64Url(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(Array.from(b64UrlToBytes(text))).toEqual(Array.from(bytes));
  });

  test('slimLayout drops the local id and keeps the rest', () => {
    expect(slimLayout({ id: 'local_1', name: 'A', devices: [] })).toEqual({ name: 'A', devices: [] });
  });

  test('shareUrl replaces any existing hash and tokenFromHash reads it back', () => {
    const url = shareUrl('zabc', 'https://x.test/index.html#old');
    expect(url).toBe('https://x.test/index.html#share=zabc');
    expect(tokenFromHash('#share=zabc')).toBe('zabc');
    expect(tokenFromHash('#other')).toBeNull();
    expect(tokenFromHash('')).toBeNull();
  });

  test('an uncompressed ("j") token decodes to the layout', async () => {
    const layout = { name: 'Café ✓', devices: [], mode: 'rack' };
    const token = `j${bytesToB64Url(new TextEncoder().encode(JSON.stringify(layout)))}`;
    expect(await decodeShare(token)).toEqual(layout);
  });

  test('damaged or non-layout tokens are rejected with one friendly message', async () => {
    const notLayout = `j${bytesToB64Url(new TextEncoder().encode('{"a":1}'))}`;
    for (const bad of ['', 'x123', 'j!!!', 'zAAAA', notLayout]) {
      await expect(decodeShare(bad)).rejects.toThrow('this link is damaged or not a layout link');
    }
  });
});
