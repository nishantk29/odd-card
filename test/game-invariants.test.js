// The shared invariants kit run over the Phones room: no step can block (a Host skip always exists), over is terminal,
// no phone's view changes when other players' cards are shuffled (no leaks), and Undo does nothing on the end screen.
import { gameInvariantTests, NOW } from './kit/game-invariants.mjs';
import { newRoom, reduce, viewForPlayer } from '../public/js/room.js';

const clone = (x) => structuredClone(x);
const rngOf = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };
const oddIds = (st) => st.room.game.round.spies.map((i) => st.room.order[i]);

const adapter = {
  name: 'odd card room',
  cases: [{ n: 4, mode: 'classic', target: 4 }, { n: 5, mode: 'grid', target: 4 }, { n: 8, mode: 'classic', target: 4 }, { n: 12, mode: 'grid', target: 4 }],
  setup(c, rng) {
    const room = newRoom('ABCDEF', 'hk'); const ids = [];
    for (let i = 0; i < c.n; i++) ids.push(reduce(room, {}, { type: 'join', name: `P${i}`, hostKey: i === 0 ? 'hk' : undefined }, rng).data.playerId);
    reduce(room, { playerId: ids[0] }, { type: 'settings', mode: c.mode, target: c.target }, rng);
    reduce(room, { playerId: ids[0] }, { type: 'start' }, rng);
    return { room, ids };
  },
  apply(st, actor, msg, rng) { const room = clone(st.room); const r = reduce(room, { playerId: actor }, msg, rng); return r.error ? { ok: false, state: st } : { ok: true, state: { room, ids: st.ids } }; },
  isOver: (st) => st.room.phase === 'over',
  progress(st, rng) {
    const { room, ids } = st, host = ids[0], g = room.game, ph = room.phase;
    if (ph === 'pass') return [...ids.map((id) => [id, { type: 'ready' }]), [host, { type: 'begin' }]];
    if (ph === 'clues') return [[host, { type: 'clueDone' }]];
    if (ph === 'vote') return ids.map((id) => [id, { type: 'vote', id: ids[(ids.indexOf(id) + 1 + Math.floor(rng() * (ids.length - 1))) % ids.length] }]);
    if (ph === 'guess') { const acc = room.order[g.round.accused]; return g.round.mode === 'grid' ? [[acc, { type: 'guess', word: g.round.grid[Math.floor(rng() * 16)] }]] : [[acc, { type: 'guess', text: 'x' }], [host, { type: 'judge', right: rng() < 0.5 }]]; }
    return [[host, { type: 'next' }]];
  },
  fallback(st) {
    const { room, ids } = st, host = ids[0];
    return { pass: [host, { type: 'begin' }], clues: [host, { type: 'clueDone' }], vote: [host, { type: 'closeVote' }], guess: [host, { type: 'judge', right: false }] }[room.phase] || [host, { type: 'next' }];
  },
  probes: (st) => [[st.ids[0], { type: 'next' }], [st.ids[0], { type: 'clueDone' }], [st.ids[0], { type: 'begin' }], [st.ids[0], { type: 'closeVote' }], [st.ids[0], { type: 'judge', right: true }], [st.ids[1], { type: 'vote', id: st.ids[2] }], [st.ids[1], { type: 'ready' }], [st.ids[1], { type: 'guess', text: 'x' }]],
  undo: (st) => [st.ids[0], { type: 'undo' }],
  fingerprint: (st) => JSON.stringify({ phase: st.room.phase, scores: st.room.game.scores, win: st.room.game.win, history: st.room.game.history.length, round: st.room.game.round.no }),
  viewers: (st) => st.ids,
  view: (st, id) => viewForPlayer(st.room, id, new Set(st.ids)),
  secretsRevealed: (st) => ['flip', 'score', 'over'].includes(st.room.phase),
  secretHolders: (st) => st.ids,
  withSecrets(st, mapping) {
    const room = clone(st.room), old = oddIds(st);
    room.game.round.spies = st.ids.filter((id) => old.includes(mapping[id] ?? id)).map((id) => room.order.indexOf(id)).sort((a, b) => a - b);
    return { room, ids: st.ids };
  },
  // Everyone knows their own card. From the reveal on, everyone also knows whether the accused player is an Odd Card.
  knowledgeClass: (st, viewer, other) => {
    const g = st.room.game, acc = g.round.accused;
    if (viewer === other) return null;
    if (['reveal', 'guess'].includes(st.room.phase) && acc !== null && acc !== undefined && st.room.order[acc] === other) return null;
    return 'other';
  },
};

gameInvariantTests(adapter, { games: 60, maxSteps: 1500, seed: 7, leakViewers: 3 });
void NOW;
