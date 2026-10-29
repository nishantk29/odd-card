// The Odd Card, Phones mode: the room reducer and the per-viewer projections. Pure, no DOM, no network.
// All rules come from engine.js (roles, grid, clue order, scoring, win check); this file only decides who may do what and
// what each phone is allowed to see. Secrecy lives in viewForPlayer: the word and the Odd Cards leave the room only to
// the one player entitled (the word to Word Holders, "Odd Card" to the Odd Card), and everyone sees both after the round.
import * as E from './engine.js';

export const MIN_PLAYERS = E.MIN_PLAYERS;
export const MAX_PLAYERS = E.MAX_PLAYERS;
// Bumped when a rule change must not reach rooms that already started; a room keeps the version it was created with.
export const ROOM_RULES_VERSION = 2;
const NAME_MAX = 20;

const ok = (data = {}) => ({ ok: true, data });
const err = (error) => ({ error });
const byId = (room, id) => room.players.find(p => p.id === id);
// A local seat is a player who sits at the Host's phone: no socket, no token. The Host passes the phone to them.
const isLocal = (room, id) => !!byId(room, id)?.local;
const localsInOrder = room => room.order.map(id => byId(room, id)).filter(p => p?.local);
const cleanName = s => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
const randToken = rng => Array.from({ length: 16 }, () => Math.floor(rng() * 256).toString(16).padStart(2, '0')).join('');
export const cryptoRng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;

export function newRoom(code, hostKey) {
  return { code, hostKey, rulesVersion: ROOM_RULES_VERSION, phase: 'lobby', players: [], nextId: 1, settings: { mode: 'classic', target: E.DEFAULT_TARGET }, game: null, order: [], ready: {}, votes: {}, tally: null, guessText: null, updated: 0 };
}

// ---- engine bridge -------------------------------------------------------
// The engine keeps an undo stack of whole states; a room never undoes, so it is dropped to keep the saved room small.
function step(room, action) {
  const next = E.apply(room.game, action);
  if (next === room.game) return false;
  room.game = { ...next, undo: [] };
  return true;
}
function sync(room) {
  if (room.game.phase === 'deal') step(room, { type: 'NEXT' }); // straight to the secret cards
  room.phase = room.game.phase;
  room.ready = {}; room.votes = {};
  if (room.phase === 'pass') { room.tally = null; room.guessText = null; } // a new round
}
const seatOf = (room, id) => room.order.indexOf(id);
const idAt = (room, seat) => (seat === null || seat === undefined ? null : room.order[seat]);

function startGame(room, rng) {
  const players = room.players;
  if (players.length < MIN_PLAYERS) return err(`You need at least ${MIN_PLAYERS} players to start.`);
  room.order = players.map(p => p.id);
  const seed = Math.floor(rng() * 4294967296) >>> 0;
  room.game = { ...E.createGame({ names: players.map(p => p.name), target: room.settings.target, mode: room.settings.mode, seed }), undo: [] };
  sync(room);
  return ok();
}

// Everyone has voted (or the Host closed the vote): most votes is accused, a tie accuses no one.
export function tallyVotes(room) {
  const counts = {};
  Object.values(room.votes).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const top = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter(id => counts[id] === top);
  return { counts, accused: top > 0 && leaders.length === 1 ? leaders[0] : null };
}

function closeVote(room) {
  const { counts, accused } = tallyVotes(room);
  const seat = accused === null ? null : seatOf(room, accused);
  if (!step(room, { type: 'VOTE', seat })) return err('The vote is already closed.');
  room.phase = room.game.phase;
  room.tally = counts;
  room.votes = {};
  return ok();
}

// ---- reducer -------------------------------------------------------------
// reduce(room, { playerId }, msg, rng) -> { ok, data } | { error }. Mutates the room.
export function reduce(room, actor, msg, rng = cryptoRng) {
  const me = actor.playerId ? byId(room, actor.playerId) : null;
  const isHost = !!me?.host;
  const g = room.game;
  const hostOnly = () => (isHost ? null : err('Only the Host can do that.'));
  if (room.phase === 'ended' && msg.type !== 'join') return err('The Host ended this game.');

  switch (msg.type) {
    case 'join': {
      const name = cleanName(msg.name);
      if (!name) return err('Type your name first.');
      if (room.phase !== 'lobby') return err('That game has already started. Ask the Host to start a new one.');
      if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return err('Someone already has that name. Pick another.');
      if (room.players.length >= MAX_PLAYERS) return err(`The room is full (${MAX_PLAYERS} players).`);
      const host = !!msg.hostKey && msg.hostKey === room.hostKey && !room.players.some(p => p.host);
      const p = { id: `p${room.nextId++}`, name, token: randToken(rng), host };
      room.players.push(p);
      return ok({ playerId: p.id, token: p.token, host });
    }
    case 'addLocal': {
      const e = hostOnly(); if (e) return e;
      if (room.phase !== 'lobby') return err('Players can only be added in the lobby.');
      const name = cleanName(msg.name);
      if (!name) return err('Type a name first.');
      if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return err('Someone already has that name. Pick another.');
      if (room.players.length >= MAX_PLAYERS) return err(`The room is full (${MAX_PLAYERS} players).`);
      const p = { id: `p${room.nextId++}`, name, token: null, host: false, local: true };
      room.players.push(p);
      return ok({ playerId: p.id });
    }
    case 'kick': {
      const e = hostOnly(); if (e) return e;
      if (room.phase !== 'lobby') return err('Players can only be removed in the lobby.');
      const p = byId(room, msg.id);
      if (!p || p.host) return err('That player can’t be removed.');
      room.players = room.players.filter(x => x.id !== p.id);
      return ok();
    }
    case 'settings': {
      const e = hostOnly(); if (e) return e;
      if (room.phase !== 'lobby') return err('Settings can only be changed in the lobby.');
      if (msg.mode !== undefined) { if (!E.MODES.includes(msg.mode)) return err('Pick Classic or Grid.'); room.settings.mode = msg.mode; }
      if (msg.target !== undefined) {
        if (!Number.isInteger(msg.target) || msg.target < E.MIN_TARGET || msg.target > E.MAX_TARGET) return err(`The target is ${E.MIN_TARGET}–${E.MAX_TARGET} points.`);
        room.settings.target = msg.target;
      }
      return ok();
    }
    case 'start': {
      const e = hostOnly(); if (e) return e;
      if (room.phase !== 'lobby') return err('The game has already started.');
      return startGame(room, rng);
    }
    case 'end': {
      const e = hostOnly(); if (e) return e;
      room.phase = 'ended'; room.game = null; room.order = [];
      return ok();
    }
    case 'again': {
      const e = hostOnly(); if (e) return e;
      if (room.phase !== 'over') return err('The game isn’t over yet.');
      room.phase = 'lobby'; room.game = null; room.order = [];
      return ok();
    }
    default: break;
  }

  // everything below needs a game and a seated player
  if (!g || !me || seatOf(room, me.id) < 0) return err('You’re not in this game.');
  const mySeat = seatOf(room, me.id);

  switch (msg.type) {
    case 'ready': { // I have seen my card (the Host can say it for a local seat after passing the phone)
      if (room.phase !== 'pass') return err('Cards are already dealt.');
      if (msg.for) {
        if (!isHost) return err('Only the Host can do that.');
        if (!isLocal(room, msg.for)) return err('That player has their own phone.');
        room.ready[msg.for] = true;
        return ok();
      }
      room.ready[me.id] = true;
      return ok();
    }
    case 'begin': { // Host: start the clues once cards are seen
      const e = hostOnly(); if (e) return e;
      if (room.phase !== 'pass') return err('Cards are already dealt.');
      const waiting = localsInOrder(room).find(p => !room.ready[p.id]);
      if (waiting) return err(`Pass the phone to ${waiting.name} first.`);
      while (room.game.phase === 'pass') if (!step(room, { type: 'NEXT' })) break;
      if (room.game.phase === 'grid') step(room, { type: 'NEXT' }); // the grid is already on every phone
      room.phase = room.game.phase; room.ready = {};
      return ok();
    }
    case 'clueDone': { // the player whose turn it is (or the Host) hands the turn on
      if (room.phase !== 'clues') return err('It isn’t the clue round.');
      const cur = E.clueSeat(g.round, g.names.length, g.round.turn);
      if (mySeat !== cur && !isHost) return err('It isn’t your turn.');
      step(room, { type: 'NEXT' }); room.phase = room.game.phase;
      room.votes = {};
      return ok();
    }
    case 'vote': {
      if (room.phase !== 'vote') return err('It isn’t time to vote.');
      let voter = me;
      if (msg.as) { // the Host votes for a local seat
        if (!isHost) return err('Only the Host can do that.');
        if (!isLocal(room, msg.as)) return err('That player has their own phone.');
        voter = byId(room, msg.as);
      }
      const target = byId(room, msg.id);
      if (!target || seatOf(room, target.id) < 0) return err('Pick a player.');
      if (target.id === voter.id) return err('You can’t vote for yourself.');
      room.votes[voter.id] = target.id;
      if (Object.keys(room.votes).length >= room.order.length) return closeVote(room);
      return ok();
    }
    case 'closeVote': {
      const e = hostOnly(); if (e) return e;
      if (room.phase !== 'vote') return err('It isn’t time to vote.');
      return closeVote(room);
    }
    case 'next': { // Host: reveal -> guess/result -> scores -> next round
      const e = hostOnly(); if (e) return e;
      if (!['reveal', 'flip', 'score'].includes(room.phase)) return err('Not now.');
      step(room, { type: 'NEXT' }); sync(room);
      return ok();
    }
    case 'guess': { // the accused Odd Card
      if (room.phase !== 'guess') return err('It isn’t time to guess.');
      if (mySeat !== g.round.accused && !(isHost && isLocal(room, idAt(room, g.round.accused)))) return err('Only the accused Odd Card guesses.');
      if (g.round.mode === 'grid') {
        if (!step(room, { type: 'GUESS', word: msg.word })) return err('Tap one of the 16 words.');
        room.phase = room.game.phase;
        return ok();
      }
      const text = String(msg.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!text) return err('Type your guess first.');
      room.guessText = text;
      return ok();
    }
    case 'judge': { // Classic: the Host says whether the guess was right. Grid: the Host can skip a guess that never comes (counts as wrong).
      const e = hostOnly(); if (e) return e;
      if (room.phase !== 'guess') return err('Not now.');
      if (g.round.mode === 'grid') step(room, { type: 'GUESS', word: g.round.grid.find(w => w !== g.round.word) });
      else step(room, { type: 'GUESS', right: !!msg.right });
      room.phase = room.game.phase;
      return ok();
    }
    default: return err('Unknown action.');
  }
}

// ---- projections ---------------------------------------------------------
const RESULT_PHASES = ['flip', 'score', 'over'];

// What one phone may see. `secret` is the only place the word or the role appears before the round is over.
export function viewForPlayer(room, playerId, connected = new Set()) {
  const me = byId(room, playerId);
  const g = room.game;
  const players = room.players.map(p => ({ id: p.id, name: p.name, host: !!p.host, local: !!p.local, online: !!p.local || connected.has(p.id), seat: room.order.indexOf(p.id) }));
  const view = { code: room.code, phase: room.phase, me: { id: playerId, name: me?.name, host: !!me?.host }, players, settings: { ...room.settings }, game: null, secret: null, localPass: null };
  if (!g || room.phase === 'ended') return view;
  const r = g.round, n = g.names.length, seatId = i => idAt(room, i);
  const mySeat = room.order.indexOf(playerId);
  const done = RESULT_PHASES.includes(room.phase);
  view.game = {
    round: r.no, mode: r.mode, target: g.target, category: r.category, oddCount: r.spyCount,
    grid: r.mode === 'grid' ? r.grid : null,
    scores: Object.fromEntries(room.order.map((id, i) => [id, g.scores[i]])),
    ready: room.phase === 'pass' ? Object.keys(room.ready) : null, total: n,
    tiebreak: g.tiebreak ? g.tiebreak.map(seatId) : null,
  };
  if (['clues', 'vote', 'reveal', 'guess', ...RESULT_PHASES].includes(room.phase)) {
    view.game.start = seatId(r.start); view.game.dir = E.dirName(r.dir);
  }
  if (room.phase === 'clues') {
    view.game.turn = r.turn; view.game.turns = 2 * n; view.game.lap = r.turn < n ? 1 : 2;
    view.game.speaker = seatId(E.clueSeat(r, n, r.turn));
    view.game.next = r.turn < 2 * n - 1 ? seatId(E.clueSeat(r, n, r.turn + 1)) : null;
  }
  if (room.phase === 'vote') {
    view.game.voted = Object.keys(room.votes); view.game.myVote = room.votes[playerId] || null;
    const lv = me?.host ? localsInOrder(room).find(p => !room.votes[p.id]) : null;
    view.game.localVoter = lv ? { id: lv.id, name: lv.name } : null;
  }
  if (['reveal', 'guess', ...RESULT_PHASES].includes(room.phase)) {
    view.game.accused = seatId(r.accused);
    view.game.accusedOdd = r.accused !== null && r.spies.includes(r.accused);
    view.game.tally = room.tally;
  }
  if (room.phase === 'guess') view.game.guessText = room.guessText;
  // my own card: the word for a Word Holder, "Odd Card" for the Odd Card; never both
  if (mySeat >= 0 && !done) view.secret = r.spies.includes(mySeat) ? { category: r.category, odd: true } : { category: r.category, odd: false, word: r.word };
  // A local seat's card goes to the Host's phone only while the phone is being passed to that seat.
  if (me?.host && room.phase === 'pass') {
    const lp = localsInOrder(room).find(p => !room.ready[p.id]);
    if (lp) { const seat = room.order.indexOf(lp.id); view.localPass = { id: lp.id, name: lp.name, left: localsInOrder(room).filter(p => !room.ready[p.id]).length, secret: r.spies.includes(seat) ? { category: r.category, odd: true } : { category: r.category, odd: false, word: r.word } }; }
  }
  if (done) {
    view.game.result = {
      outcome: r.outcome, text: E.OUTCOME_TEXT[r.outcome], word: r.word, odd: r.spies.map(seatId), guess: r.guess, guessRight: r.guessRight,
      delta: Object.fromEntries(room.order.map((id, i) => [id, r.delta[i]])),
    };
    view.game.win = { status: g.win.status, leaders: g.win.leaders.map(seatId) };
  }
  return view;
}

export const endedNow = (phaseBefore, room) => phaseBefore !== 'over' && room.phase === 'over';

// Sockets to drop because their seat was removed.
export const socketsToDrop = (sockets, playerId, exceptWs = null) => sockets.filter(s => s.playerId === playerId && s.ws !== exceptWs).map(s => s.ws);

// What to send each open socket after a change: its own view and nothing else. sockets: [{ ws, who, playerId }].
export function broadcastPlan(room, sockets, connected) {
  return sockets.filter(s => s.who === 'player' && byId(room, s.playerId)).map(s => ({ ws: s.ws, msgs: [{ type: 'view', view: viewForPlayer(room, s.playerId, connected) }] }));
}
