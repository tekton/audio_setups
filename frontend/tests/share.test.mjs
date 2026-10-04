/** @jest-environment node */
import { bytesToB64Url, b64UrlToBytes, slimLayout, shareUrl, tokenFromHash, decodeShare, encodeShare, MAX_TOKEN, MAX_LAYOUT_BYTES } from '../js/share.js';

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

  test('a token over the length cap is refused before any decoding', async () => {
    await expect(decodeShare(`z${'A'.repeat(MAX_TOKEN)}`)).rejects.toThrow('too large to open');
  });

  test('a small token that inflates past the size cap (a decompression bomb) is refused', async () => {
    const zeros = new Uint8Array(MAX_LAYOUT_BYTES + 1000); // compresses to a few KB
    const bomb = await new Response(new Blob([zeros]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    const token = `z${bytesToB64Url(new Uint8Array(bomb))}`;
    expect(token.length).toBeLessThan(MAX_TOKEN);
    await expect(decodeShare(token)).rejects.toThrow('too large to open');
  });

  test('a compressed layout round-trips, including non-ASCII text', async () => {
    const layout = { name: 'Café ✓ 🎧', devices: [{ id: 'a' }], mode: 'rack' };
    const token = await encodeShare({ id: 'local_1', ...layout });
    expect(token[0]).toBe('z');
    expect(await decodeShare(token)).toEqual(layout);
  });
});
