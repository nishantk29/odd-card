// The Odd Card: pure game logic, no DOM. createGame(settings) / apply(state, action) -> new state.
import { ALL_WORDS } from './words.js';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;
export const MIN_TARGET = 4;
export const MAX_TARGET = 10;
export const DEFAULT_TARGET = 6;
export const MAX_UNDO = 120;

export const spyCount = n => (n >= 8 ? 2 : 1);

// ---- cards -------------------------------------------------------------
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = {
  H: { glyph: '♥', color: 'red', name: 'hearts' },
  D: { glyph: '♦', color: 'red', name: 'diamonds' },
  C: { glyph: '♣', color: 'black', name: 'clubs' },
  S: { glyph: '♠', color: 'black', name: 'spades' },
};
export const cardText = c => `${c.rank}${SUITS[c.suit].glyph}`;

function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const byRank = (a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank) || a.suit.localeCompare(b.suit);
const pick = (suits, count, rnd) => shuffle(RANKS.flatMap(rank => suits.map(suit => ({ rank, suit }))), rnd).slice(0, count).sort(byRank);

// The exact cards to pull from the deck: (n - spies) red, spies black, all distinct.
export function setupCards(n, rnd = Math.random) {
  if (!Number.isInteger(n) || n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`Players must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  const s = spyCount(n);
  return { red: pick(['H', 'D'], n - s, rnd), black: pick(['C', 'S'], s, rnd) };
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
export const NIGHT = [
  { id: 'close', lines: [{ type: 'say', text: 'Everyone, close your eyes.' }] },
  { id: 'redOpen', screen: 'word', lines: [{ type: 'say', text: 'Red cards, open your eyes and look at my screen.' }] },
  { id: 'redClose', lines: [{ type: 'say', text: 'Red cards, close your eyes.' }] },
  { id: 'blackOpen', screen: 'pick', lines: [{ type: 'say', text: 'Black cards, open your eyes. Look only at my screen, not around the table.' }] },
  { id: 'blackNod', lines: [{ type: 'gesture', text: "Give them a nod: you've seen them." }] },
  { id: 'blackClose', lines: [{ type: 'say', text: 'Black cards, close your eyes.' }] },
  { id: 'open', lines: [{ type: 'say', text: 'Everyone, open your eyes.' }] },
];
export const VOTE_CUE = 'On three, everyone point at who you think is a spy. One, two, three!';
export const GESTURE_NOT_SPY = 'Shake your head / Thumbs down — not a spy';
export const GESTURE_CAUGHT = 'Nod your head / Thumbs up — caught a spy!';
export const GESTURE_RIGHT = 'Nod your head / Thumbs up — that is the word!';
export const GESTURE_WRONG = 'Shake your head / Thumbs down — not the word';
export const dirName = dir => (dir === 1 ? 'clockwise' : 'counter-clockwise');

export const say = text => ({ type: 'say', text });
export const gesture = text => ({ type: 'gesture', text });

export function clueSeat(r, n, turn) {
  return (((r.start + r.dir * turn) % n) + n) % n;
}

// The lines the host reads / signals on the current screen, in order.
export function cueFor(state) {
  const r = state.round;
  const nm = i => state.names[i];
  switch (state.phase) {
    case 'night': return NIGHT[r.step].lines;
    case 'clues': {
      const seat = clueSeat(r, state.names.length, r.turn);
      return [say(`${nm(seat)}, your clue.`)];
    }
    case 'vote': return [say(VOTE_CUE)];
    case 'reveal':
      if (r.accused === null) return [say('Tie. No one is accused. Every spy escapes.')];
      if (r.spies.includes(r.accused)) return [say(`${nm(r.accused)}, flip your card.`), gesture(GESTURE_CAUGHT)];
      return [say(`${nm(r.accused)}, flip your card.`), gesture(GESTURE_NOT_SPY)];
    case 'guess': return [say(`${nm(r.accused)}, you get one guess. What is the secret word?`)];
    case 'flip': {
      const out = [];
      if (r.guessRight === true) out.push(gesture(GESTURE_RIGHT));
      if (r.guessRight === false) out.push(gesture(GESTURE_WRONG));
      out.push(say('Everyone, flip your cards face up so the table sees the spies.'));
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
  escape: 'Tie vote: every spy escaped.',
  agentAccused: 'An agent was accused: the spies win the round.',
  spyRight: 'The accused spy guessed the word.',
  spyWrong: 'The accused spy guessed wrong: the agents win the round.',
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
  return { names: names.map((x, i) => x || `Seat ${i + 1}`), target };
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
  st.round = {
    no: st.roundNo, word: w.word, category: w.category, spyCount: spyCount(n),
    cards: setupCards(n, rnd), step: 0, opened: [], spies: [],
    start: Math.floor(rnd() * n), dir: rnd() < 0.5 ? 1 : -1, turn: 0,
    accused: undefined, guessRight: undefined, outcome: null, delta: null,
  };
  return st;
}

export function createGame(settings) {
  const { names, target } = validateSettings(settings);
  const st = {
    names, target, scores: names.map(() => 0), roundNo: 0, history: [], used: [], tiebreak: null,
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
    no: r.no, word: r.word, category: r.category, spies: r.spies.map(i => st.names[i]),
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
        case 'deal': st.phase = 'night'; r.step = 0; return st;
        case 'night':
          if (NIGHT[r.step].screen === 'pick' && r.opened.length !== r.spyCount) return null;
          if (r.step === NIGHT.length - 1) { st.phase = 'clues'; r.turn = 0; r.spies = r.opened.slice(); return st; }
          r.step += 1;
          return st;
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
    case 'TOGGLE_OPENED': {
      if (st.phase !== 'night' || NIGHT[r.step].screen !== 'pick') return null;
      const i = a.seat;
      if (!Number.isInteger(i) || i < 0 || i >= n) return null;
      if (r.opened.includes(i)) r.opened = r.opened.filter(x => x !== i);
      else if (r.opened.length < r.spyCount) r.opened.push(i);
      else return null;
      return st;
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
      r.guessRight = !!a.right;
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
export const nightPickReady = state => state.round.opened.length === state.round.spyCount;
export const isSpy = (state, seat) => state.round.spies.includes(seat);
export const roleOf = (state, seat) => (state.round.spies.includes(seat) ? 'spy' : 'agent');
