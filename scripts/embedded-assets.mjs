// The asset server inside dist-embedded/worker.js (bundled in by build-embedded.mjs; unit-tested in test/embedded-assets.test.js).
// FILES maps a path to { t: content type, b: base64 body, e: content-hash ETag }.
// HTML and /sw.js: no-cache. Fonts: a year, immutable (the one font file never changes). Icons: a year, revalidated by ETag.
// Everything else: an hour. A matching If-None-Match answers 304 with no body.
export const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "frame-ancestors 'none'",
};

export function cacheControl(p) {
  if (p === '/sw.js' || p.endsWith('.html')) return 'no-cache';
  if (p.startsWith('/fonts/')) return 'public, max-age=31536000, immutable';
  if (p.startsWith('/icons/')) return 'public, max-age=31536000';
  return 'public, max-age=3600';
}

// True when an If-None-Match header names this ETag (weak or strong, or *).
export function etagMatches(header, etag) {
  if (!header || !etag) return false;
  return header.split(',').some((t) => { t = t.trim(); return t === '*' || t.replace(/^W\//, '') === etag; });
}

const bytes = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

export function serveAsset(req, FILES) {
  const url = new URL(req.url);
  const p = url.pathname === '/' ? '/index.html' : url.pathname;
  const f = FILES[p];
  if (!f) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS } });
  const headers = { 'content-type': f.t, 'cache-control': cacheControl(p), etag: f.e, ...SECURITY_HEADERS };
  if (etagMatches(req.headers.get('if-none-match'), f.e)) return new Response(null, { status: 304, headers });
  return new Response(bytes(f.b), { headers });
}
