// The FAQ's numbers come from engine.js, and its scoring answer matches scoreRound.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FAQ } from '../public/js/faq.js';
import * as E from '../public/js/engine.js';

const f = (re) => FAQ.find((x) => re.test(x.q)) || {};
const a = (re) => f(re).a || '';
const all = (re) => [f(re).a, ...(f(re).steps || []), ...(f(re).list || [])].join(' ');

test('FAQ player range, target and undo cap come from the engine', () => {
  assert.ok(a(/What is The Odd Card/).includes(`${E.MIN_PLAYERS} to ${E.MAX_PLAYERS} players`));
  assert.ok(a(/How do I win/).includes(`default ${E.DEFAULT_TARGET}, you choose ${E.MIN_TARGET} to ${E.MAX_TARGET}`));
  assert.ok(a(/undo/i).includes(`up to ${E.MAX_UNDO} steps`));
});

test('FAQ Odd Card counts match spyCount for every table size', () => {
  const list = (f(/How many Odd Cards/).list || []).join(' ');
  for (let n = E.MIN_PLAYERS; n <= E.MAX_PLAYERS; n++) {
    const k = E.spyCount(n);
    assert.ok(new RegExp(`(^| )${k === 1 ? '' : ''}[\\d]+ to [\\d]+ players: ${k} Odd Card`).test(list), `${n}`);
    const m = list.match(new RegExp(`(\\d+) to (\\d+) players: ${k} Odd Card`));
    assert.ok(n >= +m[1] && n <= +m[2], `${n} in range`);
  }
});

test('FAQ scoring matches scoreRound', () => {
  const s = all(/How is a round scored/);
  for (const bit of ['not accused: 2 points', 'guesses the word: 1 point', 'guesses wrong: every Word Holder gets 1 point', 'each Odd Card gets 2 points']) assert.ok(s.includes(bit), bit);
});
