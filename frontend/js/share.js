/**
 * Share links: a layout is packed into the URL hash (#share=...) so it can be sent without a file or a server.
 * The JSON is deflate-compressed when the browser can (token starts with "z"), otherwise sent as-is ("j").
 */

export function bytesToB64Url(bytes) {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64UrlToBytes(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// What a link carries: the layout without its local id (the receiver gets their own copy)
export function slimLayout(layout) {
  const { id, ...rest } = layout;
  return rest;
}

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// Links come from other people, so bound the work: a tiny compressed token can inflate to gigabytes.
export const MAX_TOKEN = 100000; // characters in the link's token
export const MAX_LAYOUT_BYTES = 5 * 1000 * 1000; // inflated size

class TooLarge extends Error {}

async function inflateLimited(bytes, max) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new TooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  chunks.forEach((c) => { out.set(c, at); at += c.length; });
  return out;
}

export async function encodeShare(layout) {
  const bytes = new TextEncoder().encode(JSON.stringify(slimLayout(layout)));
  if (typeof CompressionStream === 'undefined') return `j${bytesToB64Url(bytes)}`;
  return `z${bytesToB64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
}

// Throws if the token is damaged or isn't a layout (an object with a devices array).
export async function decodeShare(token) {
  if (token.length > MAX_TOKEN) throw new Error('this link is too large to open');
  try {
    const kind = token[0];
    let bytes = b64UrlToBytes(token.slice(1));
    if (kind === 'z') bytes = await inflateLimited(bytes, MAX_LAYOUT_BYTES);
    else if (kind !== 'j') throw new Error('unknown format');
    if (bytes.length > MAX_LAYOUT_BYTES) throw new TooLarge();
    const layout = JSON.parse(new TextDecoder().decode(bytes));
    if (!layout || typeof layout !== 'object' || !Array.isArray(layout.devices)) throw new Error('not a layout');
    return layout;
  } catch (e) {
    throw new Error(e instanceof TooLarge ? 'this link is too large to open' : 'this link is damaged or not a layout link');
  }
}

export function shareUrl(token, base) {
  return `${base.split('#')[0]}#share=${token}`;
}

// The token from a page's hash, or null when it isn't a share link
export function tokenFromHash(hash) {
  return hash.startsWith('#share=') ? hash.slice('#share='.length) : null;
}

// Browsers and chat apps start truncating or refusing very long links somewhere above this
export const LONG_LINK = 6000;
