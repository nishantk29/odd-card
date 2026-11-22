// The asset server bundled into dist-embedded/worker.js: security headers, cache lifetimes, ETag + 304.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { serveAsset, cacheControl, etagMatches, SECURITY_HEADERS } from '../scripts/embedded-assets.mjs';

const b64 = (s) => Buffer.from(s).toString('base64');
const FILES = {
  '/index.html': { t: 'text/html; charset=utf-8', b: b64('<!doctype html>'), e: '"aaa111"' },
  '/sw.js': { t: 'application/javascript; charset=utf-8', b: b64('// sw'), e: '"bbb222"' },
  '/fonts/rubik-var.woff2': { t: 'font/woff2', b: b64('font'), e: '"ccc333"' },
  '/icons/icon-512.png': { t: 'image/png', b: b64('png'), e: '"ddd444"' },
  '/styles.css': { t: 'text/css; charset=utf-8', b: b64('a{}'), e: '"eee555"' },
};
const get = (p, h = {}) => serveAsset(new Request('https://x.test' + p, { headers: h }), FILES);

test('security headers on HTML, assets and 404s', async () => {
  for (const p of ['/', '/styles.css', '/fonts/rubik-var.woff2', '/nope']) {
    const r = await get(p);
    assert.equal(r.headers.get('strict-transport-security'), 'max-age=31536000', p);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', p);
    assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', p);
    assert.equal(r.headers.get('content-security-policy'), "frame-ancestors 'none'", p);
  }
  assert.equal(Object.keys(SECURITY_HEADERS).length, 4);
});

test('cache lifetimes: no-cache on HTML and /sw.js; fonts a year immutable; icons a year; the rest an hour', async () => {
  assert.equal(cacheControl('/index.html'), 'no-cache');
  assert.equal(cacheControl('/sw.js'), 'no-cache');
  assert.equal(cacheControl('/fonts/rubik-var.woff2'), 'public, max-age=31536000, immutable');
  assert.equal(cacheControl('/icons/icon-512.png'), 'public, max-age=31536000');
  assert.equal(cacheControl('/js/app.js'), 'public, max-age=3600');
  assert.equal((await get('/')).headers.get('cache-control'), 'no-cache');
  assert.equal((await get('/sw.js')).headers.get('cache-control'), 'no-cache');
});

test('ETag on every file; If-None-Match answers 304 with no body, a stale tag gets the full file', async () => {
  const r = await get('/styles.css');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('etag'), '"eee555"');
  assert.equal(await r.text(), 'a{}');
  for (const h of ['"eee555"', 'W/"eee555"', '"zzz", "eee555"', '*']) {
    const n = await get('/styles.css', { 'if-none-match': h });
    assert.equal(n.status, 304, h);
    assert.equal(n.headers.get('etag'), '"eee555"');
    assert.equal(n.headers.get('cache-control'), 'public, max-age=3600');
    assert.equal(n.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await n.text(), '');
  }
  assert.equal((await get('/styles.css', { 'if-none-match': '"old"' })).status, 200);
  assert.equal(etagMatches(null, '"a"'), false);
  assert.equal(etagMatches('"a"', undefined), false);
});

test('build-embedded.mjs hashes each file into its ETag and serves through embedded-assets.mjs', () => {
  const s = readFileSync(new URL('../scripts/build-embedded.mjs', import.meta.url), 'utf8');
  assert.match(s, /createHash\('sha256'\)\.update\(buf\)/);
  assert.match(s, /import \{ serveAsset \} from '\.\.\/scripts\/embedded-assets\.mjs'/);
  assert.match(s, /serveAsset\(req, FILES\)/);
});
