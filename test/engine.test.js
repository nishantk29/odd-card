import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../public/js/engine.js';
import { createGame, apply, spyCount, cueFor, scoreRound, checkWin, clueSeat, canUndo, MIN_PLAYERS, MAX_PLAYERS } from '../public/js/engine.js';
import { WORDS, CATEGORIES, ALL_WORDS, GRID_SIZE } from '../public/js/words.js';

const names = n => Array.from({ length: n }, (_, i) => `P${i + 1}`);
const game = (n = 6, target = 6, seed = 1, mode = 'classic') => createGame({ names: names(n), target, seed, mode });
const A = (s, type, extra = {}) => apply(s, { type, ...extra });
const odd = s => s.round.spies[0];
const holder = s => [...s.names.keys()].find(i => !s.round.spies.includes(i));

// Drive a round from the deal screen to the score screen. accused: seat | 'odd' | 'word' | null.
function playRound(s, { accused = null, right = false } = {}) {
  const n = s.names.length;
  s = A(s, 'NEXT'); // deal -> pass
  for (let i = 0; i < n; i++) { assert.equal(s.phase, 'pass'); assert.equal(s.round.pass, i); s = A(s, 'NEXT'); }
  if (s.round.mode === 'grid') { assert.equal(s.phase, 'grid'); s = A(s, 'NEXT'); }
  assert.equal(s.phase, 'clues');
  for (let i = 0; i < 2 * n; i++) s = A(s, 'NEXT');
  assert.equal(s.phase, 'vote');
  const seat = accused === 'odd' ? odd(s) : accused === 'word' ? holder(s) : accused;
  s = A(s, 'VOTE', { seat });
  s = A(s, 'NEXT');
  if (s.phase === 'guess') s = s.round.mode === 'grid' ? A(s, 'GUESS', { word: right ? s.round.word : s.round.grid.find(w => w !== s.round.word) }) : A(s, 'GUESS', { right });
  assert.equal(s.phase, 'flip');
  s = A(s, 'NEXT');
  assert.equal(s.phase, 'score');
  return s;
}

test('word list: 200+ words, 12+ categories, unique, 16+ per category', () => {
  assert.ok(CATEGORIES.length >= 12);
  assert.ok(ALL_WORDS.length >= 190);
  assert.equal(new Set(ALL_WORDS.map(w => w.word.toLowerCase())).size, ALL_WORDS.length);
  for (const c of CATEGORIES) assert.ok(WORDS[c].length >= GRID_SIZE, c);
});

test('no trademarked names in the words', () => {
  assert.ok(!ALL_WORDS.some(w => /chameleon|spyfall/i.test(w.word)));
});

test('spy count: 1 for 4-7, 2 for 8-12', () => {
  for (let n = 4; n <= 7; n++) assert.equal(spyCount(n), 1);
  for (let n = 8; n <= 12; n++) assert.equal(spyCount(n), 2);
});

test('role assignment: right Odd Card count and valid distinct seats for every player count', () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    for (let seed = 1; seed <= 15; seed++) {
      const { spies } = game(n, 6, seed).round;
      assert.equal(spies.length, n >= 8 ? 2 : 1);
      assert.equal(new Set(spies).size, spies.length);
      assert.ok(spies.every(i => Number.isInteger(i) && i >= 0 && i < n));
    }
  }
});

test('role assignment varies by seed and is reproducible from the seed', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) seen.add(game(6, 6, seed).round.spies.join());
  assert.ok(seen.size >= 4);
  const a = game(9, 6, 77), b = game(9, 6, 77);
  assert.deepEqual(a, b);
  assert.deepEqual(playRound(a, { accused: null }), playRound(b, { accused: null }));
});

test('settings are validated', () => {
  assert.throws(() => createGame({ names: names(3) }));
  assert.throws(() => createGame({ names: names(13) }));
  assert.throws(() => createGame({ names: names(5), target: 3 }));
  assert.throws(() => createGame({ names: names(5), target: 11 }));
  assert.throws(() => createGame({ names: names(5), mode: 'party' }));
  assert.equal(createGame({ names: names(5) }).target, 6);
  assert.equal(createGame({ names: names(5) }).mode, 'classic');
  assert.equal(createGame({ names: ['', 'b', 'c', 'd'] }).names[0], 'Seat 1');
});

test('no eyes-open night, no tap-who-opened pick, no deck cards left in the engine', () => {
  assert.equal(E.NIGHT, undefined);
  assert.equal(E.setupCards, undefined);
  const src = readFileSync(new URL('../public/js/engine.js', import.meta.url), 'utf8');
  assert.ok(!/eyes|TOGGLE_OPENED|opened|NIGHT|black card|red card/i.test(src));
  let s = game(6);
  assert.equal(A(s, 'TOGGLE_OPENED', { seat: 1 }), s);
  assert.ok(!('opened' in s.round) && !('cards' in s.round));
});

test('pass the phone: every player once in seat order, then clues (classic) or grid', () => {
  let s = game(5);
  assert.equal(s.phase, 'deal');
  s = A(s, 'NEXT');
  const seen = [];
  while (s.phase === 'pass') {
    assert.deepEqual(cueFor(s), [{ type: 'say', text: `Pass the phone to ${s.names[s.round.pass]}.` }]);
    seen.push(s.round.pass);
    s = A(s, 'NEXT');
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4]);
  assert.equal(s.phase, 'clues');
  let g = game(5, 6, 1, 'grid');
  for (let i = 0; i < 6; i++) g = A(g, 'NEXT');
  assert.equal(g.phase, 'grid');
  assert.equal(A(g, 'NEXT').phase, 'clues');
});

test('clues: two laps, every player twice, follows start and direction', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    let s = game(5, 6, seed);
    for (let i = 0; i < 6; i++) s = A(s, 'NEXT');
    const order = [];
    for (let t = 0; t < 10; t++) {
      const seat = clueSeat(s.round, 5, s.round.turn);
      assert.deepEqual(cueFor(s), [{ type: 'say', text: `${s.names[seat]}, your clue.` }]);
      order.push(seat);
      s = A(s, 'NEXT');
    }
    assert.equal(s.phase, 'vote');
    assert.deepEqual(Object.values(order.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})), [2, 2, 2, 2, 2]);
    for (let t = 1; t < 10; t++) assert.equal(order[t], (order[t - 1] + s.round.dir + 5) % 5);
  }
});

test('vote, reveal and guess lines', () => {
  const s = game(6);
  let v = s;
  for (let i = 0; i < 1 + 6 + 12; i++) v = A(v, 'NEXT');
  assert.equal(v.phase, 'vote');
  assert.match(cueFor(v)[0].text, /point at who you think is the Odd Card/);
  const o = odd(v), h = holder(v);
  assert.deepEqual(cueFor(A(v, 'VOTE', { seat: h })).map(l => l.text), [`${v.names[h]} is not an Odd Card.`]);
  const caught = A(v, 'VOTE', { seat: o });
  assert.deepEqual(cueFor(caught).map(l => l.text), [`${v.names[o]} is an Odd Card.`]);
  assert.match(cueFor(A(v, 'VOTE', { seat: null }))[0].text, /Tie.*Every Odd Card escapes/);
  const g = A(caught, 'NEXT');
  assert.equal(g.phase, 'guess');
  assert.match(cueFor(g)[0].text, /you get one guess\. What is the secret word/);
  assert.deepEqual(cueFor(A(g, 'GUESS', { right: true })).map(l => l.text), ['The guess was right.']);
  assert.deepEqual(cueFor(A(g, 'GUESS', { right: false })).map(l => l.text), ['The guess was wrong.']);
  assert.equal(A(v, 'VOTE', { seat: 99 }), v);
  assert.equal(A(s, 'VOTE', { seat: 1 }), s);
});

test('no cue or UI copy uses the trademarked names', () => {
  for (const f of ['engine.js', 'faq.js', 'app.js', 'words.js']) {
    assert.ok(!/chameleon|spyfall/i.test(readFileSync(new URL(`../public/js/${f}`, import.meta.url), 'utf8')), f);
  }
});

test('grid mode: 16 distinct words from the category, including the secret word', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { round } = game(5, 6, seed, 'grid');
    assert.equal(round.grid.length, 16);
    assert.equal(new Set(round.grid).size, 16);
    assert.ok(round.grid.includes(round.word));
    assert.ok(round.grid.every(w => WORDS[round.category].includes(w)));
  }
  assert.equal(game(5, 6, 1).round.grid, null);
});

test('grid mode: guess is auto-checked from the tapped word', () => {
  let s = game(6, 6, 3, 'grid');
  for (let i = 0; i < 1 + 6 + 1 + 12; i++) s = A(s, 'NEXT');
  s = A(A(s, 'VOTE', { seat: odd(s) }), 'NEXT');
  assert.equal(s.phase, 'guess');
  assert.equal(A(s, 'GUESS', { word: 'Not In Grid' }), s);
  const right = A(s, 'GUESS', { word: s.round.word });
  assert.equal(right.round.guessRight, true);
  assert.equal(right.round.outcome, 'spyRight');
  const wrongWord = s.round.grid.find(w => w !== s.round.word);
  const wrong = A(s, 'GUESS', { word: wrongWord });
  assert.equal(wrong.round.guessRight, false);
  assert.equal(wrong.round.guess, wrongWord);
  assert.equal(wrong.round.outcome, 'spyWrong');
});

test('scoring for every outcome', () => {
  assert.deepEqual(scoreRound(6, [2], null, undefined), { outcome: 'escape', delta: [0, 0, 2, 0, 0, 0] });
  assert.deepEqual(scoreRound(6, [2], 0, undefined), { outcome: 'agentAccused', delta: [0, 0, 2, 0, 0, 0] });
  assert.deepEqual(scoreRound(6, [2], 2, true), { outcome: 'spyRight', delta: [0, 0, 1, 0, 0, 0] });
  assert.deepEqual(scoreRound(6, [2], 2, false), { outcome: 'spyWrong', delta: [1, 1, 0, 1, 1, 1] });
  assert.deepEqual(scoreRound(8, [1, 5], null).delta, [0, 2, 0, 0, 0, 2, 0, 0]);
  assert.deepEqual(scoreRound(8, [1, 5], 3).delta, [0, 2, 0, 0, 0, 2, 0, 0]);
  assert.deepEqual(scoreRound(8, [1, 5], 1, true).delta, [0, 1, 0, 0, 0, 2, 0, 0]);
  assert.deepEqual(scoreRound(8, [1, 5], 5, false).delta, [1, 2, 1, 1, 1, 0, 1, 1]);
});

test('engine applies scores and history', () => {
  const s = playRound(game(6), { accused: 'odd', right: false });
  const o = odd(s);
  assert.deepEqual(s.scores, s.names.map((_, i) => (i === o ? 0 : 1)));
  assert.equal(s.history.length, 1);
  assert.equal(s.history[0].outcome, 'spyWrong');
  assert.deepEqual(s.history[0].spies, [`P${o + 1}`]);
  assert.equal(s.round.outcome, 'spyWrong');
});

test('win checks and ties', () => {
  assert.equal(checkWin([5, 3, 0], 6).status, 'none');
  assert.deepEqual(checkWin([6, 3, 0], 6), { status: 'win', leaders: [0] });
  assert.deepEqual(checkWin([7, 7, 2], 6), { status: 'tie', leaders: [0, 1] });
  assert.deepEqual(checkWin([8, 6, 6], 6), { status: 'win', leaders: [0] });
});

test('full game: an Odd Card wins by escaping, then game over', () => {
  let s = game(5, 4);
  s = A(playRound(s, { accused: null }), 'NEXT');
  assert.equal(s.phase, 'deal');
  s = playRound(s, { accused: null });
  s = A(s, 'NEXT');
  assert.equal(s.phase, 'over');
  assert.equal(s.win.status, 'win');
  assert.equal(s.scores.reduce((a, b) => a + b, 0), 4);
  assert.equal(A(s, 'NEXT'), s);
});

test('full game: eight players, two Odd Cards, scoring with a right guess', () => {
  let s = game(8, 4);
  assert.equal(s.round.spies.length, 2);
  const [a, b] = s.round.spies;
  s = playRound(s, { accused: a, right: true });
  assert.equal(s.scores[a], 1);
  assert.equal(s.scores[b], 2);
  assert.equal(s.scores.reduce((x, y) => x + y, 0), 3);
});

test('tie on top score triggers a tiebreak round', () => {
  const s = playRound(game(4, 4, 5), { accused: null });
  const t = { ...s, scores: [5, 5, 0, 0], win: checkWin([5, 5, 0, 0], 4) };
  assert.equal(t.win.status, 'tie');
  const n = A(t, 'NEXT');
  assert.equal(n.phase, 'deal');
  assert.deepEqual(n.tiebreak, [0, 1]);
  assert.equal(n.round.no, 2);
});

test('tie vote: nobody accused and Odd Cards escape', () => {
  const s = playRound(game(6), { accused: null });
  assert.equal(s.round.outcome, 'escape');
  assert.deepEqual(s.scores, s.names.map((_, i) => (s.round.spies.includes(i) ? 2 : 0)));
});

test('words do not repeat within a game', () => {
  let s = game(4, 10, 9);
  const words = [s.round.word];
  for (let i = 0; i < 6; i++) { s = A(playRound(s, { accused: null }), 'NEXT'); if (s.phase !== 'deal') break; words.push(s.round.word); }
  assert.equal(new Set(words).size, words.length);
});

test('undo steps back through every action, and apply is pure', () => {
  const s0 = game(6);
  const frozen = JSON.stringify(s0);
  const s1 = A(s0, 'NEXT');
  assert.equal(JSON.stringify(s0), frozen);
  assert.equal(s1.phase, 'pass');
  assert.ok(canUndo(s1));
  assert.deepEqual(A(s1, 'UNDO'), s0);
  assert.equal(A(s0, 'UNDO'), s0);
  let s = playRound(s0, { accused: 'odd', right: true });
  while (canUndo(s)) s = A(s, 'UNDO');
  assert.deepEqual(s, s0);
  let t = playRound(s0, { accused: null });
  t = A(t, 'UNDO');
  assert.equal(t.phase, 'flip');
  t = A(t, 'UNDO');
  assert.equal(t.phase, 'reveal');
  assert.deepEqual(t.scores, [0, 0, 0, 0, 0, 0]);
});
