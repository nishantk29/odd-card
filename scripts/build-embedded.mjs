// Builds dist-embedded/worker.js: the Worker with every file in public/ inlined, for deploying through the
// Cloudflare API without the assets-upload step (used when wrangler has no token on this machine).
// `wrangler deploy` (npm run deploy) is still the normal path and uses real Workers Static Assets.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from 'esbuild';

const TYPES = { js: 'application/javascript; charset=utf-8', css: 'text/css; charset=utf-8', html: 'text/html; charset=utf-8', png: 'image/png',
  svg: 'image/svg+xml', woff2: 'font/woff2', webmanifest: 'application/manifest+json', pdf: 'application/pdf' };
const files = {};
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else files['/' + path.relative('public', p).split(path.sep).join('/')] = p; } };
walk('public');
// e: a strong ETag from the file's content hash, so an expired file revalidates with a 304 instead of a full download.
const entry = (p) => { const buf = fs.readFileSync(p); return { t: TYPES[path.extname(p).slice(1)] || 'application/octet-stream', b: buf.toString('base64'), e: `"${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 20)}"` }; };
const map = Object.fromEntries(Object.entries(files).map(([u, p]) => [u, entry(p)]));
fs.mkdirSync('dist-embedded', { recursive: true });
// Headers, cache lifetimes and 304s live in embedded-assets.mjs.
fs.writeFileSync('dist-embedded/entry.js', `import worker, { Room } from '../src/worker.js';
import { serveAsset } from '../scripts/embedded-assets.mjs';
const FILES = ${JSON.stringify(map)};
const ASSETS = { async fetch(req) { return serveAsset(req, FILES); } };
export default { fetch: (req, env, ctx) => worker.fetch(req, Object.assign(Object.create(env), { ROOM: env.ROOM, ASSETS }), ctx) };
export { Room };
`);
await build({ entryPoints: ['dist-embedded/entry.js'], bundle: true, format: 'esm', outfile: 'dist-embedded/worker.js', external: ['cloudflare:workers'], target: 'es2022', logLevel: 'warning' });
console.log('dist-embedded/worker.js', fs.statSync('dist-embedded/worker.js').size, 'bytes,', Object.keys(map).length, 'files');
