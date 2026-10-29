// Plays random full games through the engine at every table size and both modes, checking the rules hold end to end.
//   node scripts/sim-games.mjs [gamesPerCase]     (also run by test/sim.test.js)
import * as E from '../public/js/engine.js';

export function simulate(perCase = 20) {
  const stats = { games: 0, rounds: 0, steps: 0, ties: 0 };
  for (let n = E.MIN_PLAYERS; n <= E.MAX_PLAYERS; n++) for (const mode of E.MODES) for (let k = 0; k < perCase; k++) {
    let seed = (n * 7919 + k * 104729 + (mode === 'grid' ? 13 : 0)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const target = E.MIN_TARGET + Math.floor(rnd() * (E.MAX_TARGET - E.MIN_TARGET + 1));
    let s = E.createGame({ names: Array.from({ length: n }, (_, i) => `P${i}`), mode, target, seed: Math.floor(rnd() * 2 ** 32) });
    let guard = 0;
    while (s.phase !== 'over') {
      if (++guard > 20000) throw new Error(`no end: n=${n} ${mode} target ${target}`);
      const r = s.round, before = s.scores.reduce((a, b) => a + b, 0);
      let a = { type: 'NEXT' };
      if (s.phase === 'vote') a = { type: 'VOTE', seat: rnd() < 0.15 ? null : Math.floor(rnd() * n) };
      else if (s.phase === 'guess') a = r.mode === 'grid' ? { type: 'GUESS', word: r.grid[Math.floor(rnd() * r.grid.length)] } : { type: 'GUESS', right: rnd() < 0.4 };
      const next = E.apply(s, a);
      if (next === s) throw new Error(`stuck in ${s.phase} (n=${n}, ${mode})`);
      if (s.phase === 'deal' || next.phase === 'pass') if (next.round && next.round.spies.length !== E.spyCount(n)) throw new Error('wrong Odd Card count');
      if (next.phase === 'flip') { const d = next.round.delta.reduce((x, y) => x + y, 0); if (d <= 0) throw new Error('a round must score'); stats.rounds++; if (next.round.outcome === 'escape') stats.ties++; }
      if (next.scores.reduce((x, y) => x + y, 0) < before) throw new Error('scores went down');
      s = next; stats.steps++;
    }
    const top = Math.max(...s.scores);
    if (top < s.target || s.win.leaders.length !== 1) throw new Error(`ended without a lone leader at the target (n=${n})`);
    const again = E.apply(s, { type: 'NEXT' });
    if (again !== s) throw new Error('over is not terminal');
    stats.games++;
  }
  return stats;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) console.log(simulate(Number(process.argv[2]) || 20));
