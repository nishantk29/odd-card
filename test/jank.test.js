// Jank fixes (Oct 29 2026): entrances play once per mount and stay short; no looping confetti; one divider token.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');

test('a repaint settles entrances that were already on screen (Phones mode repaints on every room update)', () => {
  const app = read('js/app.js'); const i = app.indexOf('$app.innerHTML = active');
  assert.ok(app.lastIndexOf('const shown = enterKeys()', i) > 0 && app.indexOf('settle(shown)', i) > i);
  assert.match(read('styles.css'), /\.is-settled\{animation:none!important\}/);
});

test('entrances are 180ms or less, on opacity and transform', () => {
  const css = read('styles.css') + read('setup.css');
  for (const m of css.matchAll(/animation:(popin|rise|fade|pop|sheetin) ([\d.]+)(ms|s)/g)) assert.ok((m[3] === 's' ? +m[2] * 1000 : +m[2]) <= 180, m[0]);
  const bad = /\b(height|width|top|left|right|bottom|margin[\w-]*|padding[\w-]*|inset)\s*:/;
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) assert.ok(!bad.test(m[2]), m[1]);
});

test('nothing loops (confetti falls once)', () => {
  for (const f of ['styles.css', 'setup.css']) assert.doesNotMatch(read(f), /animation:[^;}]*\binfinite\b/, f);
});

test('partitions use the opaque divider token, resolved per surface', () => {
  const s = read('setup.css');
  assert.match(s, /--divider:color-mix\(in oklab,rgb\(255,247,230\) 16%,var\(--bg\)\)/);
  assert.match(s, /\.su-sheet\{--divider:color-mix\(in oklab,rgb\(255,247,230\) 16%,var\(--sheet\)\)/);
  assert.doesNotMatch(s, /border[\w-]*:[^;}]*var\(--hair\)/);
});

test('starting a room keeps setup on screen until the game view arrives (no empty lobby flash)', () => {
  const p = fs.readFileSync(new URL('../public/js/phones.js', import.meta.url), 'utf8');
  const i = p.indexOf('export function startRoom');
  const body = p.slice(i, p.indexOf('\n}', i));
  assert.ok(!/P\.setup = false/.test(body), 'startRoom must not drop setup before the room confirms');
  assert.match(p, /if \(v\.phase !== 'lobby'\) \{ P\.starting = false; if \(P\.setup\) P\.setup = false; \}/);
});
