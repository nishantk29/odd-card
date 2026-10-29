// The Odd Card: pure game logic, no DOM. createGame(settings) / apply(state, action) -> new state.
import { ALL_WORDS, WORDS, GRID_SIZE } from './words.js';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;
export const MIN_TARGET = 4;
export const MAX_TARGET = 10;
export const DEFAULT_TARGET = 6;
export const MAX_UNDO = 120;

export const MODES = ['classic', 'grid'];
export { GRID_SIZE };

export const spyCount = n => (n >= 8 ? 2 : 1);

function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- rng (state-carried so apply stays reproducible) --------------------
function rngOf(st) {
  return () => {
    st.rng = (st.rng + 0x6d2b79f5) >>> 0;
    let t = st.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- cues ---------------------------------------------------------------
export const dirName = dir => (dir === 1 ? 'clockwise' : 'counter-clockwise');
export const say = text => ({ type: 'say', text });

export function clueSeat(r, n, turn) {
  return (((r.start + r.dir * turn) % n) + n) % n;
}

// The lines the host reads out on the current screen, in order.
export function cueFor(state) {
  const r = state.round;
  const nm = i => state.names[i];
  switch (state.phase) {
    case 'pass': return [say(`Pass the phone to ${nm(r.pass)}.`)];
    case 'grid': return [say('The secret word is one of these 16 words.')];
    case 'clues': {
      const seat = clueSeat(r, state.names.length, r.turn);
      return [say(`${nm(seat)}, your clue.`)];
    }
    case 'vote': return [say('On three, everyone point at who you think is the Odd Card. One, two, three.')];
    case 'reveal':
      if (r.accused === null) return [say('Tie. No one is accused. Every Odd Card escapes.')];
      return [say(r.spies.includes(r.accused) ? `${nm(r.accused)} is an Odd Card.` : `${nm(r.accused)} is not an Odd Card.`)];
    case 'guess':
      return [say(r.mode === 'grid' ? `${nm(r.accused)}, tap the secret word on the grid. You get one guess.` : `${nm(r.accused)}, you get one guess. What is the secret word?`)];
    case 'flip': {
      const out = [];
      if (r.guessRight === true) out.push(say('The guess was right.'));
      if (r.guessRight === false) out.push(say('The guess was wrong.'));
      return out;
    }
    default: return [];
  }
}

// ---- scoring & win ------------------------------------------------------
// outcome: 'escape' (tie), 'agentAccused', 'spyRight', 'spyWrong'
export function scoreRound(n, spies, accused, guessRight) {
  const delta = new Array(n).fill(0);
  let outcome;
  if (accused === null) {
    outcome = 'escape';
    spies.forEach(s => (delta[s] += 2));
  } else if (!spies.includes(accused)) {
    outcome = 'agentAccused';
    spies.forEach(s => (delta[s] += 2));
  } else {
    spies.filter(s => s !== accused).forEach(s => (delta[s] += 2));
    if (guessRight) {
      outcome = 'spyRight';
      delta[accused] += 1;
    } else {
      outcome = 'spyWrong';
      for (let i = 0; i < n; i++) if (!spies.includes(i)) delta[i] += 1;
    }
  }
  return { outcome, delta };
}

export const OUTCOME_TEXT = {
  escape: 'Tie vote: every Odd Card escaped.',
  agentAccused: 'A Word Holder was accused: the Odd Cards win the round.',
  spyRight: 'The accused Odd Card guessed the word.',
  spyWrong: 'The accused Odd Card guessed wrong: the Word Holders win the round.',
};

// 'none' | 'win' (one leader) | 'tie' (several leaders on the top score at/over target)
export function checkWin(scores, target) {
  const max = Math.max(...scores);
  if (max < target) return { status: 'none', leaders: [] };
  const leaders = scores.map((s, i) => (s === max ? i : -1)).filter(i => i >= 0);
  return { status: leaders.length === 1 ? 'win' : 'tie', leaders };
}

// ---- state --------------------------------------------------------------
export function validateSettings(s) {
  const names = (s.names || []).map(x => String(x).trim());
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) throw new Error(`Players must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  const target = s.target ?? DEFAULT_TARGET;
  if (!Number.isInteger(target) || target < MIN_TARGET || target > MAX_TARGET) throw new Error(`Target must be ${MIN_TARGET}-${MAX_TARGET}`);
  const mode = s.mode ?? 'classic';
  if (!MODES.includes(mode)) throw new Error('Mode must be classic or grid');
  return { names: names.map((x, i) => x || `Seat ${i + 1}`), target, mode };
}

function startRound(st) {
  const rnd = rngOf(st);
  const n = st.names.length;
  let pool = ALL_WORDS.filter(w => !st.used.includes(w.word));
  if (!pool.length) { st.used = []; pool = ALL_WORDS; }
  const w = pool[Math.floor(rnd() * pool.length)];
  st.used.push(w.word);
  st.roundNo += 1;
  st.phase = 'deal';
  const spies = shuffle(Array.from({ length: n }, (_, i) => i), rnd).slice(0, spyCount(n)).sort((a, b) => a - b);
  const grid = st.mode === 'grid'
    ? shuffle([w.word, ...shuffle(WORDS[w.category].filter(x => x !== w.word), rnd).slice(0, GRID_SIZE - 1)], rnd)
    : null;
  st.round = {
    no: st.roundNo, word: w.word, category: w.category, mode: st.mode, grid, spyCount: spies.length, spies, pass: 0,
    start: Math.floor(rnd() * n), dir: rnd() < 0.5 ? 1 : -1, turn: 0,
    accused: undefined, guess: null, guessRight: undefined, outcome: null, delta: null,
  };
  return st;
}

export function createGame(settings) {
  const { names, target, mode } = validateSettings(settings);
  const st = {
    names, target, mode, scores: names.map(() => 0), roundNo: 0, history: [], used: [], tiebreak: null,
    win: { status: 'none', leaders: [] }, phase: 'deal', round: null, undo: [],
    rng: (settings.seed ?? (Date.now() ^ (Math.random() * 2 ** 32))) >>> 0,
  };
  return startRound(st);
}

function finalize(st) {
  const r = st.round;
  const { outcome, delta } = scoreRound(st.names.length, r.spies, r.accused, r.guessRight);
  r.outcome = outcome;
  r.delta = delta;
  st.scores = st.scores.map((s, i) => s + delta[i]);
  st.history.push({
    no: r.no, word: r.word, category: r.category, mode: r.mode, spies: r.spies.map(i => st.names[i]),
    accused: r.accused === null ? null : st.names[r.accused], outcome, delta, scores: st.scores.slice(),
    tiebreak: st.tiebreak ? st.tiebreak.map(i => st.names[i]) : null,
  });
  st.win = checkWin(st.scores, st.target);
  st.phase = 'flip';
}

function reduce(st, a) {
  const r = st.round;
  const n = st.names.length;
  switch (a.type) {
    case 'NEXT':
      switch (st.phase) {
        case 'deal': st.phase = 'pass'; r.pass = 0; return st;
        case 'pass':
          if (r.pass < n - 1) { r.pass += 1; return st; }
          st.phase = r.mode === 'grid' ? 'grid' : 'clues';
          r.turn = 0;
          return st;
        case 'grid': st.phase = 'clues'; r.turn = 0; return st;
        case 'clues':
          if (r.turn === 2 * n - 1) { st.phase = 'vote'; return st; }
          r.turn += 1;
          return st;
        case 'reveal':
          if (r.accused !== null && r.spies.includes(r.accused)) { st.phase = 'guess'; return st; }
          finalize(st);
          return st;
        case 'flip': st.phase = 'score'; return st;
        case 'score':
          if (st.win.status === 'win') { st.phase = 'over'; return st; }
          st.tiebreak = st.win.status === 'tie' ? st.win.leaders.slice() : null;
          return startRound(st);
        default: return null;
      }
    case 'VOTE': {
      if (st.phase !== 'vote') return null;
      if (a.seat === null) r.accused = null;
      else if (Number.isInteger(a.seat) && a.seat >= 0 && a.seat < n) r.accused = a.seat;
      else return null;
      st.phase = 'reveal';
      return st;
    }
    case 'GUESS':
      if (st.phase !== 'guess') return null;
      if (r.mode === 'grid') {
        if (!r.grid.includes(a.word)) return null;
        r.guess = a.word;
        r.guessRight = a.word === r.word;
      } else r.guessRight = !!a.right;
      finalize(st);
      return st;
    default: return null;
  }
}

// Returns a new state (the same object if the action is invalid or there is nothing to undo).
export function apply(state, action) {
  if (action.type === 'UNDO') {
    if (!state.undo.length) return state;
    const prev = state.undo[state.undo.length - 1];
    return { ...structuredClone(prev), undo: state.undo.slice(0, -1) };
  }
  const { undo, ...rest } = state;
  const next = reduce(structuredClone(rest), action);
  if (!next) return state;
  next.undo = [...undo, rest].slice(-MAX_UNDO);
  return next;
}

export const canUndo = state => state.undo.length > 0;
export const isSpy = (state, seat) => state.round.spies.includes(seat);
export const roleOf = (state, seat) => (state.round.spies.includes(seat) ? 'spy' : 'agent');
