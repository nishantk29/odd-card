// The Odd Card, Phones mode client: join flow, the live WebSocket, and every phone screen. The server (room.js) decides
// who may do what; each message here is a request and the next "view" it sends back is the truth. app.js owns the page
// shell, settings and sheets; while a room is open this module supplies #app's HTML and handles its own [data-pa] clicks.
import * as E from './engine.js';
import { esc, oddIcon, icons } from './art.js';
import { holdCard, buzz } from './holdcard.js';
import { qrSvg, joinUrl } from './qr.js';
import { MIN_PLAYERS } from './room.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* blocked */ } },
};
const K = { name: 'oddcard.name', last: 'oddcard.lastroom', player: c => `oddcard.player.${c}`, host: c => `oddcard.host.${c}` };
const CODE_RE = /^[A-Za-z]{6}$/;
const plural = (n, one, many) => (n === 1 ? one : many);

let deps = { render() {}, haptics: () => true };
let P = null; // the open room, or null
let ws = null;

export const init = d => { deps = { ...deps, ...d }; };
export const active = () => !!P;
export const lastRoom = () => { const c = store.get(K.last); return c && store.get(K.player(c)) ? c : null; };
// Keep the screen on from the first deal to the winner screen (not in the lobby, not after the end).
export const wantsWake = () => !!(P?.view?.game && !['lobby', 'over', 'ended'].includes(P.view.phase));
// A card is showing under a finger: hold the next screen update until it is let go.
export const busy = () => !!document.querySelector('.holdcard.shown');

// ---- opening, joining, leaving -------------------------------------------
export function open(code = null) {
  P = { code, step: code ? 'join' : 'entry', view: null, conn: false, err: '', name: store.get(K.name) || '', codeInput: '', revealed: false, confirmEnd: false, guess: '', menu: false, wait: false, prev: null, gone: false };
  if (code) {
    if (store.get(K.player(code))) { P.step = 'room'; connect(); } else checkRoom();
  }
  deps.render();
}

async function checkRoom() {
  const code = P?.code;
  try {
    const res = await fetch(`/api/room/${code}`);
    if (P?.code !== code) return;
    if (!res.ok) { P.gone = true; P.err = 'Couldn’t find that room. Check the code and try again.'; }
  } catch { if (P?.code === code) P.err = 'Couldn’t reach the server. Check your connection and try again.'; }
  deps.render();
}

export function leave() {
  if (P?.code) { store.del(K.player(P.code)); store.del(K.host(P.code)); if (store.get(K.last) === P.code) store.del(K.last); }
  exit();
}
export function exit() {
  closeSocket();
  P = null;
  try { history.replaceState(null, '', location.pathname); } catch { /* sandboxed */ }
  document.getElementById('qrfs')?.remove();
  deps.render();
}

const flash = msg => { if (!P) return; P.err = msg; deps.render(); clearTimeout(flash.t); flash.t = setTimeout(() => { if (P && P.err === msg) { P.err = ''; deps.render(); } }, 5000); };

async function hostRoom() {
  const name = P.name.trim();
  if (!name) return flash('Type your name first.');
  P.wait = true; deps.render();
  try {
    const res = await fetch('/api/create', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    store.set(K.host(data.code), data.hostKey);
    P.code = data.code; P.wait = false;
    sendJoin();
  } catch (e) { P.wait = false; flash(e?.message || 'Couldn’t create a room. Check your connection and try again.'); }
}

async function joinRoom() {
  const name = P.name.trim();
  if (!name) return flash('Type your name first.');
  if (!P.code) {
    const c = P.codeInput.trim().toUpperCase();
    if (!CODE_RE.test(c)) return flash('The room code is 6 letters.');
    P.code = c;
  }
  P.wait = true; deps.render();
  try {
    const res = await fetch(`/api/room/${P.code}`);
    if (!res.ok) { P.wait = false; const c = P.code; P.code = null; return flash(`Couldn’t find room ${c}. Check the code and try again.`); }
  } catch { P.wait = false; return flash('Couldn’t reach the server. Check your connection and try again.'); }
  P.wait = false;
  sendJoin();
}

function sendJoin() {
  store.set(K.name, P.name.trim());
  P.pending = { join: P.name.trim(), hostKey: store.get(K.host(P.code)) || undefined };
  if (ws && ws.readyState === 1) { ws.send(JSON.stringify({ type: 'hello', ...P.pending })); P.pending = null; } else connect();
}

// ---- transport -------------------------------------------------------------
let timer; let tries = 0;
function closeSocket() { clearTimeout(timer); if (ws) { ws.onclose = null; ws.close(); ws = null; } }
function connect() {
  closeSocket();
  const code = P.code;
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${code}`);
  const me = ws;
  ws.onopen = () => {
    tries = 0; P.conn = true;
    const c = (() => { try { return JSON.parse(store.get(K.player(code)) || 'null'); } catch { return null; } })();
    if (c) me.send(JSON.stringify({ type: 'hello', ...c }));
    else if (P.pending) { me.send(JSON.stringify({ type: 'hello', ...P.pending })); P.pending = null; }
    deps.render();
  };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (!P) return;
    if (m.type === 'view') onView(m.view);
    else if (m.type === 'joined') { store.set(K.player(code), JSON.stringify({ playerId: m.playerId, token: m.token })); store.set(K.last, code); P.step = 'room'; try { history.replaceState(null, '', `?room=${code}`); } catch { /* sandboxed */ } }
    else if (m.type === 'error') flash(m.error);
    else if (m.type === 'fatal') { if (m.clear) store.del(K.player(code)); closeSocket(); P.step = 'join'; P.view = null; P.conn = false; P.err = m.error; deps.render(); }
  };
  ws.onclose = () => { if (ws !== me || !P) return; P.conn = false; deps.render(); timer = setTimeout(connect, Math.min(8000, 400 * 2 ** tries++)); };
}
const send = msg => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); else flash('Not connected to the room yet. Wait a moment and try again.'); };

function onView(v) {
  const old = P.prev; P.prev = v; P.view = v; P.step = 'room';
  const key = `${v.phase}:${v.game?.round}`;
  if (P.key !== key) { P.key = key; P.revealed = false; P.guess = ''; }
  // a nudge when it becomes my turn to do something
  const g = v.game, id = v.me.id;
  if (old && g) {
    const was = old.game || {};
    if ((v.phase === 'clues' && g.speaker === id && (was.speaker !== id || old.phase !== 'clues')) || (v.phase === 'vote' && old.phase !== 'vote') || (v.phase === 'guess' && g.accused === id && old.phase !== 'guess')) buzz();
  }
  deps.render();
}

// ---- helpers ---------------------------------------------------------------
const nm = (v, id) => esc(v.players.find(p => p.id === id)?.name || '?');
const isHost = v => v.me.host;
const stage = (cls, inner) => `<div class="stack3"><section class="stage ${cls}">${inner}</section></div>`;
const gridOf = (g, tap = false) => `<ul class="wgrid" aria-label="16 words">${g.grid.map(w => `<li>${tap ? `<button class="gw" data-pa="gridguess" data-word="${esc(w)}">${esc(w)}</button>` : `<span class="gw">${esc(w)}</span>`}</li>`).join('')}</ul>`;
const gridBox = (g, open) => (g.grid ? `<details class="gridbox"${open ? ' open' : ''}><summary>Word grid</summary>${gridOf(g)}</details>` : '');
// The same card for everyone: category on top, the word or "You’re the Odd Card" below.
const myCard = v => holdCard(`Category: ${v.secret.category}`, v.secret.odd ? 'You’re the Odd Card' : v.secret.word, 'Your card. Press and hold to reveal.');
const next = (label, act, { cls = '', dis = false, extra = '' } = {}) => `<button class="next ${cls}" data-pa="${act}" ${extra} ${dis ? 'disabled' : ''}>${label}</button>`;

// ---- screens ---------------------------------------------------------------
function entryHTML() {
  return `<main class="wrap"><div class="bar"><button class="iconbtn" data-pa="exit" aria-label="Home">${icons.back()}</button><span class="grow"></span><button class="iconbtn" data-act="faq" aria-label="Rules and FAQ">?</button></div>
  <div class="screen">${stage('felt', `<span class="eyebrow">Phones</span><h1 class="mid">Everyone plays on their own phone</h1>
    <label class="fld"><span>Your name</span><input data-pin="name" value="${esc(P.name)}" maxlength="20" autocomplete="off" autocapitalize="words" placeholder="Name"></label>
    ${err()}
    <button class="next gold-btn" data-pa="host" ${P.wait ? 'disabled' : ''}>Host a Room</button>
    <h2 class="mid">Join a room</h2>
    <label class="fld"><span>Room code</span><input class="codein" data-pin="codeInput" value="${esc(P.codeInput)}" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDEF"></label>
    <button class="addbtn" data-pa="join" ${P.wait ? 'disabled' : ''}>Join Room</button>`)}</div></main>`;
}

function joinHTML() {
  if (P.gone) return `<main class="wrap"><div class="bar"><button class="iconbtn" data-pa="exit" aria-label="Home">${icons.back()}</button></div><div class="screen">${stage('red', `<span class="eyebrow">Room ${esc(P.code)}</span><h1 class="mid">Room not found</h1>${err()}<p class="note">The Host may have ended the game, or the code is wrong.</p>`)}</div></main>`;
  return `<main class="wrap"><div class="bar"><button class="iconbtn" data-pa="exit" aria-label="Home">${icons.back()}</button><span class="grow"></span><button class="iconbtn" data-act="faq" aria-label="Rules and FAQ">?</button></div>
  <div class="screen">${stage('felt', `<span class="eyebrow">Join Room</span><div class="roomcode">${esc(P.code)}</div>
    <label class="fld"><span>Your name</span><input data-pin="name" value="${esc(P.name)}" maxlength="20" autocomplete="off" autocapitalize="words" placeholder="Name"></label>${err()}`)}</div>
  <div class="dock">${next('Join Room', 'join', { dis: P.wait })}</div></main>`;
}

const err = () => (P.err ? `<p class="perr" role="alert">${esc(P.err)}</p>` : '');

function lobbyBody(v) {
  const n = v.players.length, host = isHost(v), link = joinUrl(location.origin, v.code);
  const need = MIN_PLAYERS - n;
  const rows = v.players.map(p => `<div class="prow"><span class="dot${p.online ? ' on' : ''}" title="${p.online ? 'Online' : 'Offline'}"></span><span class="nt">${esc(p.name)}</span>${p.host ? '<span class="tag black">Host</span>' : ''}${p.id === v.me.id ? '<span class="tag red">You</span>' : ''}${host && !p.host ? `<button class="x" data-pa="kick" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">${icons.close()}</button>` : ''}</div>`).join('');
  const seg = (m, t, d) => `<button class="segb${v.settings.mode === m ? ' on' : ''}" data-pa="mode" data-mode="${m}" role="radio" aria-checked="${v.settings.mode === m}" ${host ? '' : 'disabled'}><b>${t}</b><small>${d}</small></button>`;
  const setup = host ? `<h2 class="mid">Mode</h2><div class="seg" role="radiogroup" aria-label="Mode">${seg('classic', 'Classic', 'One secret word. The Odd Card sees only the category.')}${seg('grid', 'Grid', '16 words on a public grid. The secret word is one of them.')}</div>
    <h2 class="mid">Play to</h2><div class="stepper"><button data-pa="tminus" aria-label="Lower target" ${v.settings.target <= E.MIN_TARGET ? 'disabled' : ''}>−</button><output>${v.settings.target}</output><button data-pa="tplus" aria-label="Raise target" ${v.settings.target >= E.MAX_TARGET ? 'disabled' : ''}>+</button><span class="pill">points</span></div>`
    : `<p class="note">${v.settings.mode === 'grid' ? 'Grid' : 'Classic'} mode · first to ${v.settings.target} points. Waiting for the Host to start.</p>`;
  return `${stage('felt', `<span class="eyebrow">Lobby · Room</span><div class="roomcode">${esc(v.code)}</div>
    <button type="button" class="qr-tap" data-pa="qrfull" aria-label="Show the join QR code full screen">${qrSvg(link, `QR code to join room ${v.code}`)}</button>
    <div class="row2 qrbtns"><button class="mbtn" data-pa="qrfull">Full Screen</button><button class="mbtn" data-pa="copy">Copy Link</button></div>
    <p class="note linkline">${esc(link)}</p>`)}
  ${stage('spy', `<span class="eyebrow">${n} of ${E.MAX_PLAYERS} players</span><div class="plist">${rows}</div>${host && need > 0 ? `<p class="note">Need ${MIN_PLAYERS} players to start. ${need} more to go.</p>` : ''}`)}
  ${stage('felt', setup)}`;
}

function passBody(v) {
  const g = v.game, readyN = g.ready.length, me = g.ready.includes(v.me.id);
  return stage('spy', `<span class="eyebrow">Round ${g.round} · ${g.mode === 'grid' ? 'Grid' : 'Classic'}</span><h1 class="mid">Your card</h1>${myCard(v)}
    <p class="note">Press and hold the card, then let go to hide it. ${g.oddCount} Odd ${plural(g.oddCount, 'Card', 'Cards')} this round. ${readyN} of ${g.total} ready.</p>`) + (g.grid ? stage('felt', `<span class="eyebrow">${esc(g.category)}</span>${gridOf(g)}<p class="note">Everyone sees the grid. Word Holders know which word it is. The Odd Card doesn’t.</p>`) : '');
}

function cluesBody(v) {
  const g = v.game, mine = g.speaker === v.me.id;
  return stage('teal', `<span class="eyebrow">Clues · lap ${g.lap} of 2</span><div class="big">${mine ? 'You’re up' : nm(v, g.speaker)}</div>
    <div class="lines"><p class="line"><b>${mine ? 'Say one word that hints at the secret word.' : `${nm(v, g.speaker)}, your clue.`}</b></p></div>
    <p class="note">Turn ${g.turn + 1} of ${g.turns}. Started with ${nm(v, g.start)}, going ${g.dir}${g.next ? `. Up next: ${nm(v, g.next)}` : '. Last clue, then the vote'}.</p>`)
    + stage('spy', `<span class="eyebrow">Your card</span>${myCard(v)}`) + gridBox(g, false);
}

function voteBody(v) {
  const g = v.game;
  const btns = v.players.filter(p => p.seat >= 0 && p.id !== v.me.id).map(p => `<button class="pbtn${g.myVote === p.id ? ' on' : ''}" data-pa="vote" data-id="${p.id}">${esc(p.name)}</button>`).join('');
  return stage('gold', `<span class="eyebrow">Vote</span><div class="lines"><p class="line"><b>Who is the Odd Card?</b></p></div>
    <p class="note">Tap a player. You can change your vote until everyone has voted. ${g.voted.length} of ${g.total} voted.${g.myVote ? ` You voted for ${nm(v, g.myVote)}.` : ''}</p><div class="players">${btns}</div>`)
    + stage('spy', `<span class="eyebrow">Your card</span>${myCard(v)}`) + gridBox(g, false);
}

function revealBody(v) {
  const g = v.game, tally = Object.entries(g.tally || {}).sort((a, b) => b[1] - a[1]).map(([id, c]) => `${nm(v, id)} ${c}`).join(' · ');
  const votes = tally ? `<p class="note"><b>Votes:</b> ${tally}.</p>` : '';
  if (g.accused === null) return stage('teal', `<span class="eyebrow">Reveal</span><div class="big">Tie</div><div class="lines"><p class="line"><b>No one is accused. Every Odd Card escapes.</b></p></div>${votes}`);
  return stage(g.accusedOdd ? 'felt' : 'red', `<span class="eyebrow">Reveal</span><div class="big">${nm(v, g.accused)}</div><p class="mid">${g.accusedOdd ? 'Odd Card' : 'Word Holder'}</p>${votes}`);
}

function guessBody(v) {
  const g = v.game, mine = g.accused === v.me.id;
  let inner;
  if (mine && g.grid) inner = `<div class="lines"><p class="line"><b>Tap the secret word on the grid. You get one guess.</b></p></div>${gridOf(g, true)}<p class="note">One tap. The app checks it.</p>`;
  else if (mine) inner = `<div class="lines"><p class="line"><b>What is the secret word? You get one guess.</b></p></div>
    <label class="fld"><span>Your guess</span><input data-pin="guess" value="${esc(P.guess || g.guessText || '')}" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    <button class="addbtn" data-pa="guess">${g.guessText ? 'Change Guess' : 'Submit Guess'}</button><p class="note">${g.guessText ? `You guessed <b>${esc(g.guessText)}</b>. The Host confirms it.` : 'The Host confirms it.'}</p>`;
  else inner = `<div class="lines"><p class="line"><b>${nm(v, g.accused)} is guessing the word.</b></p></div>${g.grid ? `${gridOf(g)}` : ''}<p class="note">${g.guessText ? `Guess: <b>${esc(g.guessText)}</b>. ${isHost(v) ? 'Tap Right or Wrong.' : 'The Host confirms it.'}` : isHost(v) ? 'Waiting for the guess. You can also judge a spoken guess.' : ''}</p>`;
  return stage('spy', `<span class="eyebrow">Guess</span><div class="big">${mine ? 'You' : nm(v, g.accused)}</div>${inner}`);
}

function flipBody(v) {
  const g = v.game, r = g.result;
  const odd = r.odd.map(id => nm(v, id)).join(' and ');
  const guess = r.guess ? ` ${nm(v, g.accused)} tapped <b>${esc(r.guess)}</b>.` : '';
  return stage('felt', `<span class="eyebrow">Round ${g.round} · Result</span><div class="lines"><p class="line"><b>${esc(r.text)}</b></p></div>
    <p class="note">The Odd ${plural(r.odd.length, 'Card was', 'Cards were')} <b>${odd}</b>. The word was <b>${esc(r.word)}</b> (${esc(g.category)}).${guess}</p>`);
}

function scoreBody(v) {
  const g = v.game, r = g.result;
  const top = Math.max(g.target, ...Object.values(g.scores));
  const order = v.players.filter(p => p.seat >= 0).sort((a, b) => g.scores[b.id] - g.scores[a.id] || a.seat - b.seat);
  const rows = order.map(p => `<div class="srow"><span class="nm"><span class="nt">${esc(p.name)}</span>${r.odd.includes(p.id) ? '<span>Odd Card</span>' : ''}</span>
    <span class="pts"><span class="cnt">${g.scores[p.id]}</span>${r.delta[p.id] ? `<span class="gain">+${r.delta[p.id]}</span>` : ''}</span>
    <span class="track"><span class="fill" style="transform:scaleX(${g.scores[p.id] / top})"></span></span></div>`).join('');
  const tb = g.tiebreak ? `<p class="note"><b>Tiebreak round.</b> ${g.tiebreak.map(id => nm(v, id)).join(' and ')} are tied on top. Everyone still plays.</p>` : '';
  return stage('felt', `<span class="eyebrow">Scoreboard · Round ${g.round}</span><p class="mid">${esc(r.text)}</p><p class="note">First to ${g.target} wins. Odd ${plural(r.odd.length, 'Card', 'Cards')}: <b>${r.odd.map(id => nm(v, id)).join(' and ')}</b>.</p>${tb}<div class="score">${rows}</div>`);
}

function endedBody() { return stage('spy', `<span class="eyebrow">Room closed</span><h1 class="mid">The Host ended the game</h1><p class="note">Thanks for playing. Tap Home to leave.</p>`); }

function dockFor(v) {
  const g = v.game, host = isHost(v), id = v.me.id;
  switch (v.phase) {
    case 'lobby': return host ? next('Start Game', 'start', { dis: v.players.length < MIN_PLAYERS }) : '';
    case 'pass': {
      const ready = g.ready.includes(id);
      if (host) return next('Start Clues', 'begin', { dis: !P.revealed && !ready });
      return next(ready ? 'Waiting for Others' : 'Got It', 'ready', { dis: ready || !P.revealed });
    }
    case 'clues': return g.speaker === id || host ? next(g.turn === g.turns - 1 ? 'Go to Vote' : g.speaker === id ? 'Done, Next Player' : 'Next Player', 'clueDone') : '';
    case 'vote': return host ? next('Close Vote', 'closeVote', { cls: 'teal', dis: g.voted.length === 0 }) : '';
    case 'reveal': return host ? next(g.accusedOdd ? 'Odd Card Guesses' : 'Next', 'next') : '';
    case 'guess': return host && !g.grid ? `<div class="row2"><button class="next teal" data-pa="judge" data-right="1">Right</button><button class="next red" data-pa="judge" data-right="0">Wrong</button></div>` : '';
    case 'flip': return host ? next('Show Scores', 'next') : '';
    case 'score': return host ? next(g.win.status === 'win' ? 'See the Winner' : g.win.status === 'tie' ? 'Tiebreak Round' : 'Next Round', 'next') : '';
    default: return '';
  }
}

export function html() {
  if (P.step === 'entry') return entryHTML();
  if (!P.view) return P.step === 'room' ? `<main class="wrap"><div class="screen">${stage('spy', `<span class="eyebrow">Room ${esc(P.code)}</span><h1 class="mid">${P.conn ? 'Joining…' : 'Connecting…'}</h1>${err()}`)}</div><div class="dock"><button class="mbtn" data-pa="leave" style="justify-content:center">Leave Room</button></div></main>` : joinHTML();
  const v = P.view, g = v.game;
  const body = { lobby: lobbyBody, pass: passBody, clues: cluesBody, vote: voteBody, reveal: revealBody, guess: guessBody, flip: flipBody, score: scoreBody, over: scoreBody, ended: endedBody }[v.phase]?.(v) || '';
  const dock = v.phase === 'ended' ? `<button class="next" data-pa="leave">Home</button>` : dockFor(v);
  const bar = `<div class="bar">${g ? `<span class="pill gold">Round ${g.round}</span><span class="pill">First to ${g.target}</span>` : `<span class="pill gold">Room ${esc(v.code)}</span>`}${P.conn ? '' : '<span class="pill">Reconnecting…</span>'}<span class="grow"></span><button class="iconbtn" data-act="pmenu" aria-label="Menu">${icons.menu()}</button></div>`;
  return `<main class="wrap">${bar}<div class="screen">${P.err && v.phase !== 'lobby' ? err() : ''}${body}${v.phase === 'lobby' ? err() : ''}</div>${dock ? `<div class="dock">${dock}</div>` : ''}</main>`;
}

export function menuSheet() {
  const v = P?.view, host = v && isHost(v) && v.phase !== 'ended';
  const conf = P.confirmEnd ? `<div class="confirm"><p>End the game for everyone? Scores will be lost.</p><div class="row2"><button class="mbtn danger" data-pa="endYes">Yes, End Game</button><button class="mbtn" data-pa="endNo">Cancel</button></div></div>` : '';
  return `<h2>Menu</h2><div class="menu"><button class="mbtn" data-act="faq">Rules &amp; FAQ</button><button class="mbtn" data-act="settings">Settings</button>
    ${host ? '<button class="mbtn danger" data-pa="endAsk">End Game</button>' : ''}<button class="mbtn" data-pa="leave">Leave Room</button></div>${conf}
    <button class="mbtn" style="margin-top:14px;justify-content:center" data-act="close">Close</button>`;
}

// The winner screen, shown over the page like the pass-the-phone one.
export function overHTML(isFlat) {
  const v = P?.view;
  if (!v || v.phase !== 'over') return '';
  const g = v.game, r = g.result, leaders = g.win.leaders;
  const oddWon = leaders.every(id => r.odd.includes(id));
  const names = leaders.map(id => nm(v, id)).join(' &amp; ');
  const rows = v.players.filter(p => p.seat >= 0).map(p => { const odd = r.odd.includes(p.id);
    return `<div class="rv${leaders.includes(p.id) ? ' me' : ''}"><span class="nm">${esc(p.name)}</span><span class="tag ${odd ? 'black' : 'red'}">${odd ? 'Odd Card' : 'Word Holder'}${r.delta[p.id] ? ` +${r.delta[p.id]}` : ''}</span><span class="tot">${g.scores[p.id]}</span></div>`; }).join('');
  const confetti = isFlat ? '' : `<div class="confetti" aria-hidden="true">${Array.from({ length: 44 }, (_, i) => `<i style="--x:${Math.round(Math.random() * 100)}%;--col:${['#F5C542', '#E5383B', '#1FB6B0', '#FFF7E6'][i % 4]};--d:${(2.6 + Math.random() * 2).toFixed(2)}s;--dl:${(Math.random() * 2.5).toFixed(2)}s;--dx:${Math.round(Math.random() * 120 - 60)}px;--r:${Math.round(360 + Math.random() * 540)}deg"></i>`).join('')}</div>`;
  return `<div class="win ${oddWon ? 'spy' : 'agent'}" role="dialog" aria-modal="true" aria-label="Game over">${confetti}<div class="win-in">
    <span class="eyebrow">Game over · round ${g.round}</span><h1 class="headline">${names} win${leaders.length > 1 ? '' : 's'}!</h1>
    <p class="reason">${nm(v, leaders[0])} reached ${g.scores[leaders[0]]} points (target ${g.target}). ${esc(r.text)} The word was <b>${esc(r.word)}</b>.</p><div class="reveal">${rows}</div>
    ${isHost(v) ? '<button class="next" data-pa="again" style="margin-top:8px">Play Again</button>' : '<p class="note">Waiting for the Host to start another game.</p>'}
    <button class="mbtn" data-pa="leave" style="justify-content:center">Leave Room</button></div></div>`;
}

// ---- QR: Fullscreen API with a full-viewport overlay fallback (iPhone Safari) --------
function toggleFullscreen(el) {
  if (document.fullscreenElement === el) { document.exitFullscreen?.(); return; }
  if (el.requestFullscreen) el.requestFullscreen().catch(() => el.classList.add('is-full'));
  else el.classList.add('is-full');
}
function showQr() {
  const v = P.view, link = joinUrl(location.origin, v.code);
  let el = document.getElementById('qrfs');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'qrfs', role: 'dialog', tabIndex: 0 });
    el.setAttribute('aria-label', 'Join QR code. Tap to close.');
    const close = () => { if (document.fullscreenElement === el) document.exitFullscreen?.(); el.hidden = true; el.classList.remove('is-full'); };
    el.addEventListener('click', close);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) el.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) close(); });
    document.body.append(el);
  }
  el.innerHTML = `${qrSvg(link, `QR code to join room ${v.code}`)}<p class="qr-code">${esc(v.code)}</p><p class="qr-hint">Tap to close</p>`;
  el.hidden = false; el.classList.add('is-full');
  toggleFullscreen(el);
}

// ---- events ------------------------------------------------------------------
const A = {
  exit: () => exit(),
  leave: () => leave(),
  host: hostRoom,
  join: joinRoom,
  kick: el => send({ type: 'kick', id: el.dataset.id }),
  mode: el => send({ type: 'settings', mode: el.dataset.mode }),
  tminus: () => send({ type: 'settings', target: P.view.settings.target - 1 }),
  tplus: () => send({ type: 'settings', target: P.view.settings.target + 1 }),
  start: () => send({ type: 'start' }),
  ready: () => send({ type: 'ready' }),
  begin: () => { send({ type: 'ready' }); send({ type: 'begin' }); },
  clueDone: () => send({ type: 'clueDone' }),
  vote: el => send({ type: 'vote', id: el.dataset.id }),
  closeVote: () => send({ type: 'closeVote' }),
  next: () => send({ type: 'next' }),
  guess: () => { const t = P.guess.trim(); if (!t) return flash('Type your guess first.'); send({ type: 'guess', text: t }); },
  gridguess: el => send({ type: 'guess', word: el.dataset.word }),
  judge: el => send({ type: 'judge', right: el.dataset.right === '1' }),
  again: () => send({ type: 'again' }),
  endAsk: () => { P.confirmEnd = true; deps.render(); },
  endNo: () => { P.confirmEnd = false; deps.render(); },
  endYes: () => { P.confirmEnd = false; send({ type: 'end' }); deps.closeSheet(); },
  qrfull: showQr,
  copy: async () => { try { await navigator.clipboard.writeText(joinUrl(location.origin, P.view.code)); flash('Link copied.'); } catch { flash('Couldn’t copy the link. Select it and copy by hand.'); } },
};

document.addEventListener('click', e => {
  if (!P) return;
  const el = e.target.closest('[data-pa]');
  if (el && A[el.dataset.pa]) { e.preventDefault(); A[el.dataset.pa](el); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (P && t.matches?.('[data-pin]')) P[t.dataset.pin] = t.dataset.pin === 'codeInput' ? t.value.toUpperCase().replace(/[^A-Z]/g, '') : t.value;
});
document.addEventListener('keydown', e => {
  if (P && e.key === 'Enter' && e.target.matches?.('[data-pin]')) {
    if (P.step === 'entry') (e.target.dataset.pin === 'codeInput' ? joinRoom : hostRoom)();
    else if (P.step === 'join') joinRoom();
    else if (e.target.dataset.pin === 'guess') A.guess();
  }
});
// A screen update that arrived while a card was held waits for the finger to lift.
['pointerup', 'pointercancel', 'keyup'].forEach(t => addEventListener(t, () => { if (P?.deferred) { P.deferred = false; setTimeout(deps.render, 0); } }));
export const resetMenu = () => { if (P) P.confirmEnd = false; };
export function markRevealed() {
  if (!P || P.revealed) return;
  P.revealed = true;
  document.querySelectorAll('.dock [data-pa="ready"], .dock [data-pa="begin"]').forEach(b => { b.disabled = false; });
}
export const defer = () => { if (P) P.deferred = true; };
