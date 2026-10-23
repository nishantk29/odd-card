import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { FAQ, faqResults } from '../public/js/faq.js';

const pub = new URL('../public/', import.meta.url).pathname;
const jsDir = join(pub, 'js');
const html = readFileSync(join(pub, 'index.html'), 'utf8');

test('index.html references only existing local files', () => {
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]).filter(u => u.startsWith('/'));
  assert.ok(refs.length >= 3);
  for (const u of refs) assert.ok(existsSync(join(pub, u)), `missing ${u}`);
  const css = readFileSync(join(pub, 'styles.css'), 'utf8');
  for (const m of css.matchAll(/url\("([^"]+)"\)/g)) assert.ok(existsSync(join(pub, m[1])), `missing ${m[1]}`);
});

test('every public/js module is imported somewhere (or is the html entry)', () => {
  const mods = readdirSync(jsDir).filter(f => f.endsWith('.js'));
  const entries = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => resolve(pub, '.' + m[1]));
  const imported = new Set(entries);
  for (const f of mods) {
    for (const m of readFileSync(join(jsDir, f), 'utf8').matchAll(/from\s+'(\.[^']+)'/g)) imported.add(resolve(jsDir, m[1]));
  }
  for (const f of mods) assert.ok(imported.has(join(jsDir, f)), `${f} is not imported anywhere`);
  for (const p of imported) assert.ok(existsSync(p), `import target missing: ${p}`);
});

test('no network calls or external resources in the app', () => {
  for (const f of readdirSync(jsDir)) {
    const src = readFileSync(join(jsDir, f), 'utf8');
    assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|https?:\/\//.test(src.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), `${f} touches the network`);
  }
  assert.ok(!/https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')));
});

test('FAQ: 12+ entries, search is case-insensitive with <mark> highlights', () => {
  assert.ok(FAQ.length >= 12);
  assert.equal(faqResults('').match(/<details/g).length, FAQ.length);
  const hit = faqResults('SPY');
  assert.match(hit, /<mark>spy<\/mark>/i);
  assert.ok(hit.match(/<details/g).length >= 5);
  assert.match(faqResults('zzzxqq'), /No matches/);
  assert.ok(faqResults('<b>').includes('No matches'));
});
