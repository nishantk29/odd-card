import test from 'node:test';
import assert from 'node:assert/strict';
import { newRoom, reduce, viewForPlayer, broadcastPlan, tallyVotes, endedNow, socketsToDrop } from '../public/js/room.js';

const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const must = r => { assert.ok(r.ok, r.error); return r; };
const act = (room, id, msg, rng) => reduce(room, { playerId: id }, msg, rng);

function lobby(n, seed = 1) {
  const rng = seeded(seed), room = newRoom('ABCDEF', 'hk'), ids = [];
  for (let i = 0; i < n; i++) ids.push(must(reduce(room, {}, { type: 'join', name: `P${i}`, hostKey: i === 0 ? 'hk' : undefined }, rng)).data.playerId);
  return { room, ids, host: ids[0], rng };
}
function started(n, mode = 'classic', seed = 1) {
  const t = lobby(n, seed);
  if (mode !== 'classic') must(act(t.room, t.host, { type: 'settings', mode }));
  must(act(t.room, t.host, { type: 'start' }, t.rng));
  return t;
}
const g = t => t.room.game, rd = t => g(t).round;
const oddIds = t => rd(t).spies.map(s => t.room.order[s]);
function toClues(t) {
  t.ids.forEach(id => must(act(t.room, id, { type: 'ready' })));
  must(act(t.room, t.host, { type: 'begin' }));
  assert.equal(t.room.phase, 'clues');
}
function toVote(t) {
  toClues(t);
  for (let i = 0; i < 2 * t.ids.length; i++) must(act(t.room, t.host, { type: 'clueDone' }));
  assert.equal(t.room.phase, 'vote');
}
// everyone votes for `target`; the target votes for `alt`
function voteAll(t, target, alt) { t.ids.forEach(id => must(act(t.room, id, { type: 'vote', id: id === target ? alt : target }))); }

test('create, join, duplicate names, host key and the 12-player cap', () => {
  const t = lobby(3);
  assert.deepEqual(t.room.players.map(p => p.host), [true, false, false]);
  assert.match(act(t.room, null, { type: 'join', name: ' p1 ' }).error, /already has that name/);
  assert.match(reduce(t.room, {}, { type: 'join', name: '   ' }).error, /name/);
  assert.equal(must(reduce(t.room, {}, { type: 'join', name: 'Late', hostKey: 'hk' })).data.host, false, 'only one host');
  for (let i = 0; i < 8; i++) must(reduce(t.room, {}, { type: 'join', name: `X${i}` }));
  assert.equal(t.room.players.length, 12);
  assert.match(reduce(t.room, {}, { type: 'join', name: 'Thirteen' }).error, /full/);
});

test('start needs 4 players and the host; settings are validated', () => {
  const t = lobby(3);
  assert.match(act(t.room, t.host, { type: 'start' }).error, /at least 4/);
  must(reduce(t.room, {}, { type: 'join', name: 'P3' }));
  assert.match(act(t.room, t.ids[1], { type: 'start' }).error, /Host/);
  assert.match(act(t.room, t.host, { type: 'settings', mode: 'weird' }).error, /Classic or Grid/);
  assert.match(act(t.room, t.host, { type: 'settings', target: 11 }).error, /4–10/);
  assert.match(act(t.room, t.ids[1], { type: 'settings', target: 5 }).error, /Host/);
  must(act(t.room, t.host, { type: 'settings', mode: 'grid', target: 8 }));
  must(act(t.room, t.host, { type: 'start' }));
  assert.equal(t.room.phase, 'pass');
  assert.equal(t.room.game.target, 8);
  assert.match(reduce(t.room, {}, { type: 'join', name: 'Latecomer' }).error, /already started/);
});

test('kick works in the lobby only and never on the host', () => {
  const t = lobby(5);
  assert.match(act(t.room, t.ids[1], { type: 'kick', id: t.ids[2] }).error, /Host/);
  assert.match(act(t.room, t.host, { type: 'kick', id: t.host }).error, /removed/);
  must(act(t.room, t.host, { type: 'kick', id: t.ids[4] }));
  assert.equal(t.room.players.length, 4);
  must(act(t.room, t.host, { type: 'start' }));
  assert.match(act(t.room, t.host, { type: 'kick', id: t.ids[1] }).error, /lobby/);
});

test('secret isolation: the word and the roles reach only the entitled phone', () => {
  for (const n of [4, 6, 8, 12]) {
    const t = started(n, 'classic', n);
    const word = rd(t).word, odd = oddIds(t);
    assert.equal(odd.length, n >= 8 ? 2 : 1);
    for (const id of t.ids) {
      const v = viewForPlayer(t.room, id), s = JSON.stringify(v);
      assert.ok(!/"spies"|"roles"|"undo"|"rng"|"used"/.test(s), 'no engine internals');
      if (odd.includes(id)) { assert.deepEqual(v.secret, { category: rd(t).category, odd: true }); assert.ok(!s.includes(word), 'the Odd Card never gets the word'); }
      else { assert.deepEqual(v.secret, { category: rd(t).category, odd: false, word }); }
      for (const o of odd) if (o !== id) assert.ok(!s.includes(`"${o}","odd"`) && !/"odd":\[/.test(s), 'no other roles');
    }
    const plan = broadcastPlan(t.room, t.ids.map(id => ({ ws: id, who: 'player', playerId: id })), new Set(t.ids));
    assert.equal(plan.length, n);
    for (const { ws, msgs } of plan) {
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].type, 'view');
      assert.equal(msgs[0].view.me.id, ws, 'each socket gets its own view only');
      assert.equal(!!msgs[0].view.secret?.word, !odd.includes(ws));
    }
    // sockets that have not joined, or whose seat was removed, get nothing
    assert.equal(broadcastPlan(t.room, [{ ws: 'x', who: null }, { ws: 'y', who: 'player', playerId: 'p99' }], new Set()).length, 0);
  }
});

test('secrets stay hidden through clues and the vote, and are revealed to everyone after the round', () => {
  const t = started(5, 'classic', 3);
  const word = rd(t).word, odd = oddIds(t)[0];
  toClues(t);
  const view = id => JSON.stringify(viewForPlayer(t.room, id));
  assert.ok(!view(odd).includes(word));
  for (const id of t.ids) assert.equal(viewForPlayer(t.room, id).game.result, undefined);
  for (let i = 0; i < 10; i++) must(act(t.room, t.host, { type: 'clueDone' }));
  assert.ok(!view(odd).includes(word));
  const other = t.ids.find(id => id !== odd);
  voteAll(t, other, odd);
  assert.equal(t.room.phase, 'reveal');
  assert.ok(!view(odd).includes(word), 'still hidden at the reveal');
  must(act(t.room, t.host, { type: 'next' })); // accused is a Word Holder: no guess
  assert.equal(t.room.phase, 'flip');
  for (const id of t.ids) { const v = viewForPlayer(t.room, id); assert.equal(v.game.result.word, word); assert.deepEqual(v.game.result.odd, [odd]); assert.equal(v.secret, null); }
});

test('clue turns: only the speaker or the host hands the turn on; direction and start come from the server', () => {
  const t = started(5, 'classic', 4);
  toClues(t);
  const v = viewForPlayer(t.room, t.host).game;
  assert.equal(v.turns, 10);
  assert.ok(['clockwise', 'counter-clockwise'].includes(v.dir));
  const speaker = v.speaker, stranger = t.ids.find(id => id !== speaker && id !== t.host);
  assert.match(act(t.room, stranger, { type: 'clueDone' }).error, /your turn/);
  must(act(t.room, speaker, { type: 'clueDone' }));
  assert.notEqual(viewForPlayer(t.room, t.host).game.speaker, speaker);
  assert.equal(viewForPlayer(t.room, t.host).game.turn, 1);
});

test('vote: no self vote, tally, majority accuses, a tie accuses no one', () => {
  const t = started(5, 'classic', 5);
  toVote(t);
  const [a, b, c, d, e] = t.ids;
  assert.match(act(t.room, a, { type: 'vote', id: a }).error, /yourself/);
  assert.match(act(t.room, a, { type: 'vote', id: 'p99' }).error, /Pick a player/);
  must(act(t.room, a, { type: 'vote', id: c }));
  must(act(t.room, a, { type: 'vote', id: b })); // changing a vote is fine
  assert.deepEqual(tallyVotes(t.room), { counts: { [b]: 1 }, accused: b });
  must(act(t.room, b, { type: 'vote', id: c }));
  must(act(t.room, c, { type: 'vote', id: b }));
  must(act(t.room, d, { type: 'vote', id: b }));
  assert.equal(t.room.phase, 'vote', 'waiting for the last voter');
  must(act(t.room, e, { type: 'vote', id: b }));
  assert.equal(t.room.phase, 'reveal');
  const v = viewForPlayer(t.room, a).game;
  assert.equal(v.accused, b);
  assert.deepEqual(v.tally, { [b]: 4, [c]: 1 });

  const tie = started(4, 'classic', 6);
  toVote(tie);
  const [p, q, r, s] = tie.ids;
  must(act(tie.room, p, { type: 'vote', id: q })); must(act(tie.room, q, { type: 'vote', id: p }));
  must(act(tie.room, r, { type: 'vote', id: p })); must(act(tie.room, s, { type: 'vote', id: q }));
  assert.equal(tie.room.phase, 'reveal');
  assert.equal(viewForPlayer(tie.room, p).game.accused, null);
  must(act(tie.room, tie.host, { type: 'next' }));
  assert.equal(tie.room.phase, 'flip');
  const res = viewForPlayer(tie.room, p).game.result;
  assert.equal(res.outcome, 'escape');
  assert.equal(res.delta[oddIds(tie)[0]], 2, 'tie: each Odd Card scores 2, same as the engine');
});

test('host can close the vote early; no votes at all is a tie', () => {
  const t = started(4, 'classic', 7);
  toVote(t);
  assert.match(act(t.room, t.ids[1], { type: 'closeVote' }).error, /Host/);
  must(act(t.room, t.host, { type: 'closeVote' }));
  assert.equal(viewForPlayer(t.room, t.host).game.accused, null);
});

test('classic guess: the accused Odd Card types, the host judges, scoring follows the engine', () => {
  for (const right of [true, false]) {
    const t = started(5, 'classic', right ? 8 : 9);
    const odd = oddIds(t)[0], holder = t.ids.find(id => id !== odd);
    toVote(t);
    voteAll(t, odd, holder);
    must(act(t.room, t.host, { type: 'next' }));
    assert.equal(t.room.phase, 'guess');
    assert.match(act(t.room, holder, { type: 'guess', text: 'x' }).error, /accused/);
    assert.match(act(t.room, odd, { type: 'guess', text: '  ' }).error, /Type/);
    must(act(t.room, odd, { type: 'guess', text: 'a  word' }));
    assert.equal(viewForPlayer(t.room, holder).game.guessText, 'a word');
    assert.match(act(t.room, t.ids[1], { type: 'judge', right }).error, /Host/);
    must(act(t.room, t.host, { type: 'judge', right }));
    assert.equal(t.room.phase, 'flip');
    const res = viewForPlayer(t.room, holder).game.result;
    assert.equal(res.outcome, right ? 'spyRight' : 'spyWrong');
    if (right) assert.equal(res.delta[odd], 1); else assert.equal(res.delta[holder], 1);
  }
});

test('grid mode: every phone gets the same 16-word grid; the accused taps a word and it is auto-checked', () => {
  const t = started(5, 'grid', 10);
  const odd = oddIds(t)[0], word = rd(t).word, holder = t.ids.find(id => id !== odd);
  const grids = t.ids.map(id => viewForPlayer(t.room, id).game.grid);
  assert.equal(grids[0].length, 16);
  assert.ok(grids[0].includes(word));
  grids.forEach(x => assert.deepEqual(x, grids[0]));
  assert.equal(viewForPlayer(t.room, odd).secret.word, undefined);
  toVote(t);
  voteAll(t, odd, holder);
  must(act(t.room, t.host, { type: 'next' }));
  assert.equal(t.room.phase, 'guess');
  assert.match(act(t.room, odd, { type: 'guess', word: 'not in the grid' }).error, /16 words/);
  assert.match(act(t.room, t.host, { type: 'judge', right: true }).error, /Not now/);
  const wrong = grids[0].find(w => w !== word);
  must(act(t.room, odd, { type: 'guess', word: wrong }));
  assert.equal(t.room.phase, 'flip');
  const res = viewForPlayer(t.room, holder).game.result;
  assert.equal(res.outcome, 'spyWrong');
  assert.equal(res.guess, wrong);
});

test('scores, next round (new word, new cards) and the winner screen are synced to every phone', () => {
  const t = started(4, 'classic', 11);
  t.room.game.target = 4;
  const words = [rd(t).word];
  for (let round = 1; round <= 12 && t.room.phase !== 'over'; round++) {
    toVote(t);
    const odd = oddIds(t)[0], holder = t.ids.find(id => id !== odd);
    voteAll(t, holder, odd); // a Word Holder is accused: the Odd Card scores 2
    must(act(t.room, t.host, { type: 'next' })); // flip
    const v = viewForPlayer(t.room, t.ids[1]);
    assert.equal(v.game.result.delta[odd], 2);
    must(act(t.room, t.host, { type: 'next' })); // scores
    for (const id of t.ids) assert.deepEqual(viewForPlayer(t.room, id).game.scores, viewForPlayer(t.room, t.host).game.scores);
    const before = t.room.phase;
    must(act(t.room, t.host, { type: 'next' }));
    if (t.room.phase === 'pass') { words.push(rd(t).word); assert.equal(rd(t).no, round + 1); assert.deepEqual(t.room.ready, {}); }
    assert.ok(before === 'score');
  }
  assert.equal(t.room.phase, 'over');
  const win = viewForPlayer(t.room, t.ids[2]).game.win;
  assert.ok(['win', 'tie'].includes(win.status) && win.leaders.length >= 1);
  assert.equal(new Set(words).size, words.length, 'no repeated words');
  assert.ok(endedNow('score', t.room));
  assert.match(act(t.room, t.ids[1], { type: 'again' }).error, /Host/);
  must(act(t.room, t.host, { type: 'again' }));
  assert.equal(t.room.phase, 'lobby');
  assert.equal(t.room.players.length, 4);
});

test('end game closes the room for everyone, host only', () => {
  const t = started(4, 'classic', 12);
  assert.match(act(t.room, t.ids[1], { type: 'end' }).error, /Host/);
  must(act(t.room, t.host, { type: 'end' }));
  for (const id of t.ids) { const v = viewForPlayer(t.room, id); assert.equal(v.phase, 'ended'); assert.equal(v.secret, null); assert.equal(v.game, null); }
  assert.match(act(t.room, t.host, { type: 'start' }).error, /ended/);
});

test('reconnect: the stored player key keeps the seat and the card; a wrong key does not', () => {
  const t = started(5, 'classic', 13);
  const id = t.ids[2], p = t.room.players.find(x => x.id === id);
  const before = JSON.stringify(viewForPlayer(t.room, id));
  // the worker's hello check: a matching playerId + token resumes, anything else is refused
  assert.equal(t.room.players.find(x => x.id === id && x.token === p.token), p);
  assert.equal(t.room.players.find(x => x.id === id && x.token === 'nope'), undefined);
  assert.equal(JSON.stringify(viewForPlayer(t.room, id, new Set([id]))).replace('"online":true', '"online":false'), before.replace(/"online":true/g, '"online":false'));
  assert.equal(viewForPlayer(t.room, id, new Set([id])).players.find(x => x.id === id).online, true);
  assert.deepEqual(socketsToDrop([{ ws: 1, playerId: id }, { ws: 2, playerId: id }, { ws: 3, playerId: 'p1' }], id, 2), [1]);
  const tokens = new Set(t.room.players.map(x => x.token));
  assert.equal(tokens.size, 5);
  tokens.forEach(k => assert.match(k, /^[0-9a-f]{32}$/));
  assert.ok(!JSON.stringify(viewForPlayer(t.room, id)).includes(p.token), 'tokens are never in a view');
});

test('actions outside a game or by a stranger are refused', () => {
  const t = lobby(4);
  assert.match(act(t.room, t.host, { type: 'vote', id: t.ids[1] }).error, /not in this game/);
  must(act(t.room, t.host, { type: 'start' }));
  assert.match(act(t.room, 'p99', { type: 'ready' }).error, /not in this game/);
  assert.match(act(t.room, t.host, { type: 'vote', id: t.ids[1] }).error, /time to vote/);
  assert.match(act(t.room, t.host, { type: 'bogus' }).error, /Unknown/);
});
