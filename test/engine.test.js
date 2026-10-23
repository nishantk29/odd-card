import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, apply, setupCards, spyCount, cueFor, scoreRound, checkWin, cardText, NIGHT, clueSeat,
  VOTE_CUE, GESTURE_CAUGHT, GESTURE_NOT_SPY, GESTURE_RIGHT, GESTURE_WRONG, canUndo, MIN_PLAYERS, MAX_PLAYERS,
} from '../public/js/engine.js';
import { WORDS, CATEGORIES, ALL_WORDS } from '../public/js/words.js';

const names = n => Array.from({ length: n }, (_, i) => `P${i + 1}`);
const game = (n = 6, target = 6, seed = 1) => createGame({ names: names(n), target, seed });
const A = (s, type, extra = {}) => apply(s, { type, ...extra });

// Drive a round from the deal screen to the score screen.
function playRound(s, { spies = [0], accused = null, right = false } = {}) {
  s = A(s, 'NEXT'); // deal -> night
  for (let i = 0; i < NIGHT.length; i++) {
    if (NIGHT[i].screen === 'pick') spies.forEach(seat => (s = A(s, 'TOGGLE_OPENED', { seat })));
    s = A(s, 'NEXT');
  }
  assert.equal(s.phase, 'clues');
  for (let i = 0; i < 2 * s.names.length; i++) s = A(s, 'NEXT');
  assert.equal(s.phase, 'vote');
  s = A(s, 'VOTE', { seat: accused });
  s = A(s, 'NEXT');
  if (s.phase === 'guess') s = A(s, 'GUESS', { right });
  assert.equal(s.phase, 'flip');
  s = A(s, 'NEXT');
  assert.equal(s.phase, 'score');
  return s;
}

test('word list: 150+ words, 12+ categories, unique', () => {
  assert.ok(CATEGORIES.length >= 12);
  assert.ok(ALL_WORDS.length >= 150);
  assert.equal(new Set(ALL_WORDS.map(w => w.word)).size, ALL_WORDS.length);
  for (const c of CATEGORIES) assert.ok(WORDS[c].length >= 10);
});

test('spy count: 1 for 4-7, 2 for 8-12', () => {
  for (let n = 4; n <= 7; n++) assert.equal(spyCount(n), 1);
  for (let n = 8; n <= 12; n++) assert.equal(spyCount(n), 2);
});

test('setup cards for every player count', () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    for (let k = 0; k < 20; k++) {
      const { red, black } = setupCards(n);
      assert.equal(red.length, n - spyCount(n));
      assert.equal(black.length, spyCount(n));
      assert.ok(red.every(c => 'HD'.includes(c.suit)));
      assert.ok(black.every(c => 'CS'.includes(c.suit)));
      const all = [...red, ...black].map(cardText);
      assert.equal(new Set(all).size, n);
    }
  }
  assert.throws(() => setupCards(3));
  assert.throws(() => setupCards(13));
});

test('card lists vary between rounds', () => {
  let s = game(6);
  const first = JSON.stringify(s.round.cards);
  let differs = false;
  for (let i = 0; i < 4; i++) { s = A(playRound(s, { spies: [1], accused: 1 }), 'NEXT'); if (JSON.stringify(s.round.cards) !== first) differs = true; }
  assert.ok(differs);
});

test('settings are validated', () => {
  assert.throws(() => createGame({ names: names(3) }));
  assert.throws(() => createGame({ names: names(13) }));
  assert.throws(() => createGame({ names: names(5), target: 3 }));
  assert.throws(() => createGame({ names: names(5), target: 11 }));
  assert.equal(createGame({ names: names(5) }).target, 6);
  assert.equal(createGame({ names: ['', 'b', 'c', 'd'] }).names[0], 'Seat 1');
});

test('night cue sequence, in exact order', () => {
  let s = A(game(6), 'NEXT');
  const seen = [];
  for (let i = 0; i < NIGHT.length; i++) {
    seen.push(cueFor(s).map(l => `${l.type}:${l.text}`));
    if (NIGHT[i].screen === 'pick') s = A(s, 'TOGGLE_OPENED', { seat: 2 });
    s = A(s, 'NEXT');
  }
  assert.deepEqual(seen.flat(), [
    'say:Everyone, close your eyes.',
    'say:Red cards, open your eyes and look at my screen.',
    'say:Red cards, close your eyes.',
    'say:Black cards, open your eyes. Look only at my screen, not around the table.',
    "gesture:Give them a nod: you've seen them.",
    'say:Black cards, close your eyes.',
    'say:Everyone, open your eyes.',
  ]);
  assert.equal(s.phase, 'clues');
  assert.deepEqual(s.round.spies, [2]);
});

test('night: host must tap exactly the spy count', () => {
  let s = A(game(9), 'NEXT');
  for (let i = 0; i < 3; i++) s = A(s, 'NEXT');
  assert.equal(NIGHT[s.round.step].screen, 'pick');
  assert.equal(s.round.spyCount, 2);
  assert.equal(A(s, 'NEXT'), s);
  s = A(s, 'TOGGLE_OPENED', { seat: 1 });
  assert.equal(A(s, 'NEXT'), s);
  s = A(s, 'TOGGLE_OPENED', { seat: 4 });
  assert.equal(A(s, 'TOGGLE_OPENED', { seat: 5 }), s); // cannot pick a third
  s = A(s, 'TOGGLE_OPENED', { seat: 4 }); // untoggle
  assert.deepEqual(s.round.opened, [1]);
  s = A(s, 'TOGGLE_OPENED', { seat: 7 });
  s = A(s, 'NEXT');
  assert.equal(NIGHT[s.round.step].id, 'blackNod');
});

test('clues: two laps, every player twice, follows start and direction', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    let s = game(5, 6, seed);
    s = A(s, 'NEXT');
    for (let i = 0; i < NIGHT.length; i++) {
      if (NIGHT[i].screen === 'pick') s = A(s, 'TOGGLE_OPENED', { seat: 0 });
      s = A(s, 'NEXT');
    }
    const order = [];
    for (let t = 0; t < 10; t++) {
      const seat = clueSeat(s.round, 5, s.round.turn);
      assert.deepEqual(cueFor(s), [{ type: 'say', text: `${s.names[seat]}, your clue.` }]);
      order.push(seat);
      s = A(s, 'NEXT');
    }
    assert.equal(s.phase, 'vote');
    const counts = order.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
    assert.deepEqual(Object.values(counts), [2, 2, 2, 2, 2]);
    for (let t = 1; t < 10; t++) assert.equal(order[t], (order[t - 1] + s.round.dir + 5) % 5);
  }
});

test('vote, reveal and gesture lines', () => {
  let s = game(6);
  const toVote = st => {
    st = A(st, 'NEXT');
    for (let i = 0; i < NIGHT.length; i++) {
      if (NIGHT[i].screen === 'pick') st = A(st, 'TOGGLE_OPENED', { seat: 3 });
      st = A(st, 'NEXT');
    }
    for (let i = 0; i < 12; i++) st = A(st, 'NEXT');
    return st;
  };
  const v = toVote(s);
  assert.deepEqual(cueFor(v), [{ type: 'say', text: VOTE_CUE }]);
  const red = A(v, 'VOTE', { seat: 1 });
  assert.deepEqual(cueFor(red), [{ type: 'say', text: 'P2, flip your card.' }, { type: 'gesture', text: GESTURE_NOT_SPY }]);
  const black = A(v, 'VOTE', { seat: 3 });
  assert.deepEqual(cueFor(black), [{ type: 'say', text: 'P4, flip your card.' }, { type: 'gesture', text: GESTURE_CAUGHT }]);
  assert.match(GESTURE_NOT_SPY, /Shake your head \/ Thumbs down/);
  assert.match(GESTURE_CAUGHT, /Nod your head \/ Thumbs up/);
  const tie = A(v, 'VOTE', { seat: null });
  assert.match(cueFor(tie)[0].text, /Tie.*Every spy escapes/);
  const g = A(black, 'NEXT');
  assert.equal(g.phase, 'guess');
  assert.match(cueFor(g)[0].text, /P4, you get one guess/);
  assert.deepEqual(cueFor(A(g, 'GUESS', { right: true })).map(l => l.text), [GESTURE_RIGHT, 'Everyone, flip your cards face up so the table sees the spies.']);
  assert.deepEqual(cueFor(A(g, 'GUESS', { right: false }))[0], { type: 'gesture', text: GESTURE_WRONG });
  assert.equal(A(v, 'VOTE', { seat: 99 }), v);
  assert.equal(A(s, 'VOTE', { seat: 1 }), s); // wrong phase
});

test('scoring for every outcome', () => {
  assert.deepEqual(scoreRound(6, [2], null, undefined), { outcome: 'escape', delta: [0, 0, 2, 0, 0, 0] });
  assert.deepEqual(scoreRound(6, [2], 0, undefined), { outcome: 'agentAccused', delta: [0, 0, 2, 0, 0, 0] });
  assert.deepEqual(scoreRound(6, [2], 2, true), { outcome: 'spyRight', delta: [0, 0, 1, 0, 0, 0] });
  assert.deepEqual(scoreRound(6, [2], 2, false), { outcome: 'spyWrong', delta: [1, 1, 0, 1, 1, 1] });
  // two spies
  assert.deepEqual(scoreRound(8, [1, 5], null).delta, [0, 2, 0, 0, 0, 2, 0, 0]);
  assert.deepEqual(scoreRound(8, [1, 5], 3).delta, [0, 2, 0, 0, 0, 2, 0, 0]);
  assert.deepEqual(scoreRound(8, [1, 5], 1, true).delta, [0, 1, 0, 0, 0, 2, 0, 0]);
  assert.deepEqual(scoreRound(8, [1, 5], 5, false).delta, [1, 2, 1, 1, 1, 0, 1, 1]);
});

test('engine applies scores and history', () => {
  let s = playRound(game(6), { spies: [2], accused: 2, right: false });
  assert.deepEqual(s.scores, [1, 1, 0, 1, 1, 1]);
  assert.equal(s.history.length, 1);
  assert.equal(s.history[0].outcome, 'spyWrong');
  assert.deepEqual(s.history[0].spies, ['P3']);
  assert.equal(s.round.outcome, 'spyWrong');
});

test('win checks and ties', () => {
  assert.equal(checkWin([5, 3, 0], 6).status, 'none');
  assert.deepEqual(checkWin([6, 3, 0], 6), { status: 'win', leaders: [0] });
  assert.deepEqual(checkWin([7, 7, 2], 6), { status: 'tie', leaders: [0, 1] });
  assert.deepEqual(checkWin([8, 6, 6], 6), { status: 'win', leaders: [0] });
});

test('full game: spy wins by escaping', () => {
  let s = game(5, 4);
  for (let i = 0; i < 2; i++) { s = playRound(s, { spies: [1], accused: null }); s = A(s, 'NEXT'); if (i === 0) assert.equal(s.phase, 'deal'); }
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.win, { status: 'win', leaders: [1] });
  assert.equal(s.scores[1], 4);
  assert.equal(A(s, 'NEXT'), s);
});

test('full game: agents win by catching spies', () => {
  let s = game(5, 4);
  for (let i = 0; i < 3; i++) { s = playRound(s, { spies: [1], accused: 1, right: false }); s = A(s, 'NEXT'); assert.equal(s.phase, 'deal'); }
  assert.deepEqual(s.scores, [3, 0, 3, 3, 3]);
  s = playRound(s, { spies: [1], accused: 1, right: false });
  assert.deepEqual(s.win, { status: 'tie', leaders: [0, 2, 3, 4] });
  s = A(s, 'NEXT');
  assert.deepEqual(s.tiebreak, [0, 2, 3, 4]);
  s = playRound(s, { spies: [0], accused: null });
  assert.equal(s.win.status, 'win');
  s = A(s, 'NEXT');
  assert.equal(s.phase, 'over');
});

test('full game: spy guesses word right, 8 players with two spies', () => {
  let s = game(8, 4);
  s = playRound(s, { spies: [0, 7], accused: 0, right: true });
  assert.equal(s.scores[0], 1);
  assert.equal(s.scores[7], 2);
  s = A(s, 'NEXT');
  s = playRound(s, { spies: [0, 7], accused: 3 });
  assert.equal(s.scores[7], 4);
  assert.equal(s.scores[0], 3);
  s = A(s, 'NEXT');
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.win.leaders, [7]);
});

test('tie on top score triggers a tiebreak round, then a winner', () => {
  let s = game(5, 5);
  for (const spy of [0, 0, 1, 1]) { s = playRound(s, { spies: [spy], accused: null }); s = A(s, 'NEXT'); }
  assert.deepEqual(s.scores.slice(0, 2), [4, 4]);
  s = playRound(s, { spies: [2], accused: 2, right: false }); // P1 and P2 both +1
  assert.deepEqual(s.scores.slice(0, 2), [5, 5]);
  assert.equal(s.win.status, 'tie');
  assert.deepEqual(s.win.leaders, [0, 1]);
  s = A(s, 'NEXT');
  assert.equal(s.phase, 'deal');
  assert.deepEqual(s.tiebreak, [0, 1]);
  s = playRound(s, { spies: [1], accused: null });
  assert.equal(s.win.status, 'win');
  s = A(s, 'NEXT');
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.win.leaders, [1]);
});

test('tie vote: nobody accused and spies escape', () => {
  const s = playRound(game(6), { spies: [4], accused: null });
  assert.equal(s.round.outcome, 'escape');
  assert.deepEqual(s.scores, [0, 0, 0, 0, 2, 0]);
});

test('words do not repeat within a game', () => {
  let s = game(4, 10, 9);
  const words = [s.round.word];
  for (let i = 0; i < 6; i++) { s = A(playRound(s, { spies: [0], accused: null }), 'NEXT'); if (s.phase !== 'deal') break; words.push(s.round.word); }
  assert.equal(new Set(words).size, words.length);
});

test('undo steps back through every action, and apply is pure', () => {
  const s0 = game(6);
  const frozen = JSON.stringify(s0);
  const s1 = A(s0, 'NEXT');
  assert.equal(JSON.stringify(s0), frozen);
  assert.equal(s1.phase, 'night');
  assert.ok(canUndo(s1));
  assert.deepEqual(A(s1, "UNDO"), s0);
  assert.equal(A(s0, 'UNDO'), s0);
  // undo through a whole round returns to the start
  let s = playRound(s0, { spies: [0], accused: 0, right: true });
  while (canUndo(s)) s = A(s, 'UNDO');
  assert.deepEqual(s, s0);
  // undo after a round was scored removes the points
  let t = playRound(s0, { spies: [0], accused: null });
  t = A(t, 'UNDO');
  assert.equal(t.phase, 'flip');
  t = A(t, 'UNDO');
  assert.equal(t.phase, 'reveal');
  assert.deepEqual(t.scores, [0, 0, 0, 0, 0, 0]);
});
