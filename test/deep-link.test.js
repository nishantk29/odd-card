// Unit: the deep-link parser behind #/faq, #/rules, #/presets and the room links (deep-link.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDeepLink } from '../public/js/deep-link.js';

test('page links name their page; #/rules is the FAQ', () => {
  assert.deepEqual(parseDeepLink('#/faq'), { to: 'faq' });
  assert.deepEqual(parseDeepLink('#/rules'), { to: 'faq' });
  assert.deepEqual(parseDeepLink('#/presets'), { to: 'presets' });
  assert.deepEqual(parseDeepLink('#/faq/'), { to: 'faq' });
});

test('room links carry an upper-case 6-letter code', () => {
  for (const r of ['join', 'play', 'host']) assert.deepEqual(parseDeepLink(`#/${r}/abcDEF`), { to: 'room', code: 'ABCDEF' });
  for (const bad of ['#/join', '#/join/ABC', '#/join/ABCDEFG', '#/play/ABC12F', '#/faq/ABCDEF']) assert.equal(parseDeepLink(bad), null, bad);
});

test('anything else is not a deep link', () => {
  for (const h of ['', '#', '#faq', '#/', '#/local', '#/nope', '#/FAQ', undefined, null]) assert.equal(parseDeepLink(h), null, String(h));
});

test('app.js reads the hash at boot and on hashchange, and drops it once read', () => {
  const src = readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
  assert.match(src, /parseDeepLink\(location\.hash\)/);
  assert.match(src, /addEventListener\('hashchange'/);
  assert.match(src, /replaceState\(history\.state, '', location\.pathname \+ location\.search\)/);
});
