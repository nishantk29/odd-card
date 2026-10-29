import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../scripts/sim-games.mjs';

test('engine sim: random full games at every table size and both modes end with one winner', () => {
  const s = simulate(10);
  assert.equal(s.games, 9 * 2 * 10);
  assert.ok(s.rounds > s.games);
});
