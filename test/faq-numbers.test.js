// The FAQ's numbers come from engine.js, and its scoring answer matches scoreRound.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FAQ } from '../public/js/faq.js';
import * as E from '../public/js/engine.js';

const a = (re) => FAQ.find((f) => re.test(f.q))?.a || '';

test('FAQ player range, target and undo cap come from the engine', () => {
  assert.ok(a(/What is The Odd Card/).includes(`${E.MIN_PLAYERS} to ${E.MAX_PLAYERS} players`));
  assert.ok(a(/How do I win/).includes(`default ${E.DEFAULT_TARGET}, the host can choose ${E.MIN_TARGET} to ${E.MAX_TARGET}`));
  assert.ok(a(/undo/i).includes(`up to ${E.MAX_UNDO} steps`));
});

test('FAQ spy and card counts match spyCount for every table size', () => {
  const pull = a(/Which cards do we pull/), spies = a(/How many spies/);
  for (let n = E.MIN_PLAYERS; n <= E.MAX_PLAYERS; n++) {
    const k = E.spyCount(n), dealt = E.setupCards(n);
    if (n === E.MIN_PLAYERS || n === E.MAX_PLAYERS) assert.ok(pull.includes(`${n} players = ${n - k} red + ${k} black`), `${n}`);
    assert.equal(dealt.black.length, k, `${n} black`); assert.equal(dealt.red.length, n - k, `${n} red`);
  }
  assert.match(spies, /One spy with \d+ to \d+ players\. Two spies with \d+ to \d+ players/);
});

test('FAQ scoring matches scoreRound', () => {
  const s = a(/How is a round scored/);
  for (const bit of ['not accused: +2', 'guesses the word: +1', 'guesses wrong: every agent +1', 'each spy +2']) assert.ok(s.includes(bit), bit);
});
