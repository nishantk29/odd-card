// The Odd Card: host UI. All rules live in engine.js; this file renders state and dispatches actions.
import { toolsHTML, toolAct, resetTools } from './table-tools.js';
import * as E from './engine.js';
import { esc, titleArt, oddIcon, icons } from './art.js';
import { faqResults } from './faq.js';
import { holdCard, holdEnd, initHold, ODD_TEXT } from './holdcard.js';
import * as P from './phones.js';
import * as Su from './setup.js';
import { backClosesSheets } from './back-sheet.js';
import { parseDeepLink } from './deep-link.js';
// Back (Android Back, the iOS edge swipe) closes the top sheet first, the same as a tap on its backdrop. The win and
// round-over screens have no backdrop action, so Back leaves them alone.
const backNav = backClosesSheets(() => {
  const d = [...document.querySelectorAll('#sheets [aria-modal="true"]')].filter((x) => x.getClientRects().length).at(-1);
  const scrim = d?.previousElementSibling?.matches('[data-act="close"], [data-su="closesheet"]') ? d.previousElementSibling : null;
  return scrim ? { key: `${d.className}|${d.getAttribute('aria-label') || (d.querySelector('h2') || d).textContent.trim().slice(0, 40)}`, close: () => scrim.click() } : null;
});

const KEY = 'oddcard.v2';
const OLD_KEY = 'oddcard.v1'; // earlier format (eyes-open night, physical deck): only the setup is carried over
const $app = document.getElementById('app');
const $sheets = document.getElementById('sheets');
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const seats = n => Array.from({ length: n }, (_, i) => `Seat ${i + 1}`);
const PHASES = ['deal', 'pass', 'grid', 'clues', 'vote', 'reveal', 'guess', 'flip', 'score', 'over'];

const validNames = v => Array.isArray(v) && v.length >= E.MIN_PLAYERS && v.length <= E.MAX_PLAYERS && v.every(x => typeof x === 'string');
const validGame = g => !!g && validNames(g.names) && PHASES.includes(g.phase) && !!g.round && E.MODES.includes(g.round.mode) && Array.isArray(g.round.spies)
  && Array.isArray(g.scores) && Array.isArray(g.undo) && Number.isInteger(g.round.pass);

let S = { view: 'home', setup: { names: seats(5), target: E.DEFAULT_TARGET, mode: 'classic' }, game: null, anim: !lowEnd, haptics: true, wake: true };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && typeof saved === 'object') {
    S = { ...S, ...saved, setup: { ...S.setup, ...(saved.setup || {}) } };
  } else {
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
    if (old && validNames(old.setup?.names)) S.setup = { ...S.setup, names: old.setup.names, target: old.setup.target || E.DEFAULT_TARGET };
    if (old && typeof old.anim === 'boolean') S.anim = old.anim;
  }
  localStorage.removeItem(OLD_KEY);
} catch { /* fresh start */ }
if (!validNames(S.setup.names)) S.setup.names = seats(5);
if (!E.MODES.includes(S.setup.mode)) S.setup.mode = 'classic';
if (!validGame(S.game)) S.game = null;
if (S.view === 'game' && !S.game) S.view = 'home';
const T = { sheet: null, confirm: false, q: '', animKey: '', revealed: false, gridOpen: false }; // transient UI state

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ } };
const isFlat = () => mq.matches || !S.anim;
const G = () => S.game;

function dispatch(action) {
  const next = E.apply(S.game, action);
  if (next === S.game) return;
  S.game = next;
  T.revealed = false;
  save();
  render();
}

// ---- small view helpers ------------------------------------------------
const lines = list => `<div class="lines">${list.map(l => `<p class="line"><b>${esc(l.text)}</b></p>`).join('')}</div>`;
const stage = (cls, inner) => `<div class="stack3"><section class="stage ${cls}">${inner}</section></div>`;
const nameOf = i => esc(G().names[i]);
const spiesText = g => g.round.spies.map(i => esc(g.names[i])).join(' and ');
const plural = (n, one, many) => (n === 1 ? one : many);

const wordGrid = (g, tap = false) => `<ul class="wgrid" aria-label="16 words">${g.round.grid.map(w => `<li>${tap ? `<button class="gw" data-act="gridguess" data-word="${esc(w)}">${esc(w)}</button>` : `<span class="gw">${esc(w)}</span>`}</li>`).join('')}</ul>`;
const gridBox = g => (g.round.mode === 'grid' ? `<details class="gridbox" data-grid${T.gridOpen ? ' open' : ''}><summary>Word grid</summary>${wordGrid(g)}</details>` : '');

// ---- screens -----------------------------------------------------------
function homeHTML() {
  const g = G();
  const lastRoom = P.lastRoom();
  const rejoin = lastRoom ? `<button class="tile t-spy" data-act="rejoin"><h2>Rejoin</h2><p>Room ${esc(lastRoom)}</p>${icons.go()}</button>` : '';
  const resume = g && g.phase !== 'over' ? `<button class="tile t-spy" data-act="resume"><h2>Resume game</h2><p>Round ${g.round.no}, ${g.names.length} players</p>${icons.go()}</button>` : '';
  return `<main class="wrap home"><header>${titleArt()}<h1>The Odd Card</h1><p class="sub">A word game with one player out of the loop.</p></header>
  <div class="stack">
    <button class="tile t-gold" data-act="play"><h2>Host a game</h2><p>Own phones, one phone passed around, or both</p>${icons.go()}</button>
    <button class="tile t-teal" data-act="phones"><h2>Join a game</h2><p>Type a room code or scan the QR</p>${icons.go()}</button>${rejoin}${resume}
    <button class="rulescard" data-act="faq"><span class="rc-t"><b>Rules &amp; FAQ</b><small>Setup, modes, Phones mode and scoring.</small></span>${oddIcon()}</button>
    <section class="how"><h2>How to play</h2><ol aria-label="How to play, 4 steps">
      <li><b>Deal.</b> Each player secretly looks at their card, on one passed phone or on their own.</li>
      <li><b>Clues.</b> Two laps: one hint word each. Don’t give the word away.</li>
      <li><b>Vote.</b> On three, point at the Odd Card. The accused Odd Card gets one guess at the word.</li>
      <li><b>Score.</b> Odd Cards score by hiding, Word Holders by catching. First to the target wins.</li></ol></section>
    <button class="faqlink" data-act="settings"><span><b>Settings</b> Animations, vibration, screen</span>${icons.go()}</button>
  </div></main>`;
}

function dealBody(g) {
  const r = g.round;
  const tb = g.tiebreak ? `<p class="note"><b>Tiebreak round.</b> ${g.tiebreak.map(i => nameOf(i)).join(' and ')} are tied on top. Everyone still plays.</p>` : '';
  const k = r.spyCount;
  return stage('felt', `<span class="eyebrow">Round ${r.no}, ${r.mode === 'grid' ? 'grid' : 'classic'} mode</span>${tb}
    <h1 class="mid">Pass the phone around the table</h1>
    <ol class="steps"><li>Each player gets a secret card. The phone says who is next.</li>
    <li>Press and hold the card to look. Let go to hide it.</li>
    <li>${g.names.length} players, ${k} Odd ${plural(k, 'Card', 'Cards')}. ${r.mode === 'grid' ? 'After the last player, the 16-word grid appears for everyone.' : 'The Odd Card sees only the category.'}</li></ol>`);
}

function passBody(g) {
  const r = g.round;
  return `<div class="cardslot"><p class="cardfor">Pass the phone to <b>${nameOf(r.pass)}</b> (${r.pass + 1} of ${g.names.length})</p>${holdCard('pass')}</div>`
    + stage('spy', `<p class="note">Only ${nameOf(r.pass)} looks. Press and hold the card, then let go to hide it.</p>`);
}

function gridBody(g) {
  const r = g.round;
  return stage('felt', `<span class="eyebrow">Round ${r.no}, grid mode</span><h1 class="mid">${esc(r.category)}</h1>${lines(E.cueFor(g))}${wordGrid(g)}
    <p class="note">Everyone can see the grid. Word Holders know which word it is. The Odd Card doesn’t.</p>`);
}

function cluesBody(g) {
  const r = g.round, n = g.names.length, seat = E.clueSeat(r, n, r.turn);
  const lap = r.turn < n ? 1 : 2;
  return stage('teal', `<span class="eyebrow">Clues, lap ${lap} of 2</span><div class="big">${nameOf(seat)}</div>${lines(E.cueFor(g))}
    <p class="note">One word that hints at the secret word, without giving it away. Turn ${r.turn + 1} of ${2 * n}. Started with ${nameOf(r.start)}, going ${E.dirName(r.dir)}${r.turn < 2 * n - 1 ? `. Up next: ${nameOf(E.clueSeat(r, n, r.turn + 1))}` : '. Last clue, then the vote'}.</p>${gridBox(g)}`);
}

function voteBody(g) {
  return stage('gold', `<span class="eyebrow">Vote</span>${lines(E.cueFor(g))}<p class="note"><b>Host:</b> tap the player with the most fingers pointing at them.</p>
    <div class="players">${g.names.map((n, i) => `<button class="pbtn" data-act="vote" data-seat="${i}">${esc(n)}</button>`).join('')}<button class="pbtn tie" data-act="vote" data-seat="tie">Tie (no clear winner)</button></div>`);
}

function revealBody(g) {
  const r = g.round;
  if (r.accused === null) return stage('teal', `<span class="eyebrow">Reveal</span><div class="big">Tie</div>${lines(E.cueFor(g))}`);
  const odd = r.spies.includes(r.accused);
  return stage(odd ? 'felt' : 'red', `<span class="eyebrow">Reveal</span><div class="big">${nameOf(r.accused)}</div>
    <p class="mid">${odd ? 'Odd Card' : 'Word Holder'}</p>${lines(E.cueFor(g))}`);
}

function guessBody(g) {
  const r = g.round;
  const check = r.mode === 'grid' ? `${wordGrid(g, true)}<p class="note">One tap. The app checks it.</p>`
    : `<p class="note"><b>Host:</b> did they say the word? Anyone except ${nameOf(r.accused)} can press and hold to check it.</p>${holdCard('word', 'Secret word. Press and hold to check.')}`;
  return stage('spy', `<span class="eyebrow">Guess</span><div class="big">${nameOf(r.accused)}</div>${lines(E.cueFor(g))}${check}`);
}

function flipBody(g) {
  const r = g.round;
  const guess = r.mode === 'grid' && r.guess ? ` ${nameOf(r.accused)} tapped <b>${esc(r.guess)}</b>.` : '';
  return stage('felt', `<span class="eyebrow">Round ${r.no} result</span>${lines(E.cueFor(g))}
    <p class="note">The Odd ${plural(r.spies.length, 'Card was', 'Cards were')} <b>${spiesText(g)}</b>. The word was <b>${esc(r.word)}</b> (${esc(r.category)}).${guess}</p>`);
}

function scoreBody(g) {
  const r = g.round;
  const prev = g.scores.map((s, i) => s - r.delta[i]);
  const top = Math.max(g.target, ...g.scores);
  const order = g.names.map((_, i) => i).sort((a, b) => g.scores[b] - g.scores[a] || a - b);
  const rows = order.map(i => `<div class="srow"><span class="nm"><span class="nt">${esc(g.names[i])}</span>${r.spies.includes(i) ? '<span>Odd Card</span>' : ''}</span>
    <span class="pts"><span class="cnt" data-i="${i}" data-from="${prev[i]}" data-to="${g.scores[i]}">${g.scores[i]}</span>${r.delta[i] ? `<span class="gain">+${r.delta[i]}</span>` : ''}</span>
    <span class="track"><span class="fill" data-i="${i}" data-from="${prev[i] / top}" data-to="${g.scores[i] / top}" style="transform:scaleX(${g.scores[i] / top})"></span></span></div>`).join('');
  return stage('felt', `<span class="eyebrow">Scores after round ${r.no}</span><p class="mid">${E.OUTCOME_TEXT[r.outcome]}</p>
    <p class="note">First to ${g.target} wins. Odd ${plural(r.spies.length, 'Card', 'Cards')}: <b>${spiesText(g)}</b>.</p><div class="score">${rows}</div>`);
}

function gameHTML() {
  const g = G(), r = g.round, p = g.phase;
  const body = { deal: dealBody, pass: passBody, grid: gridBody, clues: cluesBody, vote: voteBody, reveal: revealBody, guess: guessBody, flip: flipBody, score: scoreBody, over: scoreBody }[p](g);
  let dock = '';
  const next = (label, cls = '', dis = false) => `<button class="next ${cls}" data-act="next" ${dis ? 'disabled' : ''}>${label}</button>`;
  if (p === 'deal') dock = next('Start passing');
  else if (p === 'pass') dock = next(r.pass === g.names.length - 1 ? (r.mode === 'grid' ? 'Next: Word grid' : 'Start clues') : `Next: ${esc(g.names[r.pass + 1])}`, '', !T.revealed);
  else if (p === 'grid') dock = next('Start clues');
  else if (p === 'clues') dock = next(r.turn === 2 * g.names.length - 1 ? 'Go to vote' : `Next: ${esc(g.names[E.clueSeat(r, g.names.length, r.turn + 1)])}`);
  else if (p === 'reveal') dock = next(r.accused !== null && r.spies.includes(r.accused) ? 'Next: Odd Card guess' : 'Next');
  else if (p === 'guess' && r.mode === 'classic') dock = `<div class="row2"><button class="next teal" data-act="guess" data-right="1">Right</button><button class="next red" data-act="guess" data-right="0">Wrong</button></div>`;
  else if (p === 'flip') dock = next('Show scores');
  else if (p === 'score') dock = next(g.win.status === 'win' ? 'Show the winner' : g.win.status === 'tie' ? 'Next: Tiebreak round' : `Next: Round ${r.no + 1}`);
  return `<main class="wrap"><div class="bar"><span class="pill gold">Round ${r.no}</span><span class="pill">First to ${g.target}</span><span class="grow"></span>
    <button class="iconbtn" data-act="menu" aria-label="Host menu">${icons.menu()}</button></div><div class="screen">${body}</div>${dock ? `<div class="dock">${dock}</div>` : ''}</main>`;
}

// ---- sheets ------------------------------------------------------------
function menuSheet() {
  const g = G();
  const conf = T.confirm ? `<div class="confirm"><p>Start a new game? The current game and its scores will be lost.</p><div class="row2"><button class="mbtn danger" data-act="newYes">Restart game</button><button class="mbtn" data-act="newNo">Keep playing</button></div></div>` : '';
  return `<h2>Host Menu</h2>${toolsHTML(esc, !!(g && g.names.length))}<div class="menu">
    <button class="mbtn" data-act="undo" ${g && E.canUndo(g) ? '' : 'disabled'}>Undo</button>
    <button class="mbtn" data-act="history">Round history</button>
    <button class="mbtn" data-act="faq">Rules &amp; FAQ</button>
    <button class="mbtn" data-act="settings">Settings</button>
    <button class="mbtn" data-act="home">The Odd Card home</button>
    <button class="mbtn danger" data-act="newGame">Restart game</button></div>${conf}
    <button class="mbtn" style="margin-top:14px;justify-content:center" data-act="close">Close</button>`;
}

function settingsSheet() {
  const sw = (act, label, on) => `<button class="mbtn" data-act="${act}" role="switch" aria-checked="${on}">${label}<span class="switch${on ? ' on' : ''}"></span></button>`;
  return `<h2>Settings</h2><div class="menu">${sw('anim', 'Animations', S.anim)}${sw('haptics', 'Vibration', S.haptics)}${sw('wake', 'Keep screen on', S.wake)}</div>
    <p class="note">Animations also follow your phone’s reduced-motion setting. Vibration and Keep Screen On only work where your browser supports them.</p>
    <button class="mbtn" style="margin-top:14px;justify-content:center" data-act="close">Close</button>`;
}

function historySheet() {
  const g = G();
  const items = g ? [...g.history].reverse().map(h => `<div class="hist"><span class="w">Round ${h.no}: ${esc(h.word)}</span> <span class="pill">${esc(h.category)}</span><br>
    <b>Odd ${h.spies.length > 1 ? 'Cards' : 'Card'}:</b> ${h.spies.map(esc).join(', ')}. <b>Accused:</b> ${h.accused === null ? 'no one (tie)' : esc(h.accused)}<br>${E.OUTCOME_TEXT[h.outcome]}<br>
    <b>Points:</b> ${g.names.map((n, i) => h.delta[i] ? `${esc(n)} +${h.delta[i]}` : '').filter(Boolean).join(', ') || 'none'}${h.tiebreak ? `<br><b>Tiebreak round</b> (${h.tiebreak.map(esc).join(', ')})` : ''}</div>`).join('') : '';
  return `<h2>Round history</h2><div class="sbody">${items || '<p class="nomatch">No rounds played yet.</p>'}</div><button class="mbtn" style="margin-top:14px;justify-content:center" data-act="back">Back</button>`;
}

function faqSheet() {
  return `<h2>Rules &amp; FAQ</h2><div class="search"><svg class="mag" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6"/><path d="M13 13l5 5"/></svg>
    <input id="faqq" type="search" placeholder="Search the FAQ" value="${esc(T.q)}" aria-label="Search the FAQ" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="clear" data-act="clearq" aria-label="Clear search" ${T.q ? '' : 'hidden'}>${icons.close()}</button></div>
    <div class="sbody" id="faqres">${faqResults(T.q)}</div><button class="mbtn" style="margin-top:14px;justify-content:center" data-act="close">Close</button>`;
}

function winPopup() {
  const g = G(), r = g.round;
  const leaders = g.win.leaders;
  const spyWon = leaders.every(i => r.spies.includes(i));
  const names = leaders.map(i => esc(g.names[i])).join(' & ');
  const pts = g.scores[leaders[0]];
  const reveal = g.names.map((n, i) => {
    const spy = r.spies.includes(i);
    return `<div class="rv${leaders.includes(i) ? ' me' : ''}"><span class="nm">${esc(n)}</span><span class="tag ${spy ? 'black' : 'red'}">${spy ? 'Odd Card' : 'Word Holder'}${r.delta[i] ? ` +${r.delta[i]}` : ''}</span><span class="tot">${g.scores[i]}</span></div>`;
  }).join('');
  const confetti = isFlat() ? '' : `<div class="confetti" aria-hidden="true">${Array.from({ length: 44 }, (_, i) => {
    const col = ['#F5C542', '#E5383B', '#1FB6B0', '#FFF7E6'][i % 4];
    return `<i style="--x:${Math.round(Math.random() * 100)}%;--col:${col};--d:${(0.3 + Math.random() * 0.06).toFixed(2)}s;--dl:${(Math.random() * 0.04).toFixed(2)}s;--dx:${Math.round(Math.random() * 120 - 60)}px;--r:${Math.round(360 + Math.random() * 540)}deg"></i>`;
  }).join('')}</div>`;
  return `<div class="win ${spyWon ? 'spy' : 'agent'}" role="dialog" aria-modal="true" aria-label="Game over">${confetti}<div class="win-in">
    <span class="eyebrow">Game over after round ${r.no}</span>
    <h1 class="headline">${names} win${leaders.length > 1 ? '' : 's'}!</h1>
    <p class="reason">${esc(g.names[leaders[0]])} reached ${pts} points (target ${g.target}). ${E.OUTCOME_TEXT[r.outcome]} The word was <b>${esc(r.word)}</b>.</p>
    <div class="reveal">${reveal}</div>
    <button class="next" data-act="again" style="margin-top:8px">Play again</button>
    <button class="mbtn" data-act="winhome" style="justify-content:center">The Odd Card home</button></div></div>`;
}

function sheetsHTML() {
  const g = G();
  if (S.view === 'setup' && !P.active() && !T.sheet) return Su.sheetHTML();
  if (P.active() && !T.sheet) return P.overHTML(isFlat());
  if (S.view === 'game' && g && g.phase === 'over' && T.sheet !== 'faq') return winPopup();
  if (!T.sheet) return '';
  const body = { menu: menuSheet, pmenu: P.menuSheet, settings: settingsSheet, history: historySheet, faq: faqSheet }[T.sheet]();
  return `<div class="scrim" data-act="close"></div><div class="sheet${T.sheet === 'menu' || T.sheet === 'pmenu' ? ' s-spy' : ''}" role="dialog" aria-modal="true"><span class="grab"><span></span></span>${body}</div>`;
}

// ---- render ------------------------------------------------------------
// Entrances play once per mount: the same stage, sheet, scrim or win screen (same classes, same label) keeps still.
const ENTER_SEL = '.stage, .scrim, .sheet, .win, .headline, .srow .gain, .scrim2, .su-sheet';
const enterKey = (el) => `${el.parentElement === $sheets ? 's' : 'a'}|${el.className.replace(/\bis-settled\b/, '').trim()}|${el.getAttribute('aria-label') || ''}|${el.matches('.headline, .srow .gain') ? el.textContent.trim().slice(0, 40) : el.matches('.stage') ? (el.querySelector('h1, h2, h3')?.textContent || '').trim().slice(0, 40) : ''}`;
const enterKeys = () => new Set([...$app.querySelectorAll(ENTER_SEL), ...$sheets.querySelectorAll(ENTER_SEL)].map(enterKey));
function settle(before) {
  if (!before.size) return;
  for (const el of [...$app.querySelectorAll(ENTER_SEL), ...$sheets.querySelectorAll(ENTER_SEL)]) if (before.has(enterKey(el))) el.classList.add('is-settled');
}

function render() {
  if (P.active() && P.busy()) { P.defer(); return; } // a card is showing under a finger: update when it's let go
  holdEnd();
  document.documentElement.classList.toggle('flat', isFlat());
  const active = P.active();
  const kept = keepFocus();
  const inSetup = !active && S.view === 'setup';
  document.body.classList.toggle('v2', inSetup);
  if (inSetup) Su.captureFocus();
  const shown = enterKeys(); // entrances already on screen do not replay on this repaint (Phones mode repaints on every room update)
  $app.innerHTML = active ? P.html() : inSetup ? Su.html() : S.view === 'game' && G() ? gameHTML() : homeHTML();
  $sheets.innerHTML = sheetsHTML();
  settle(shown);
  restoreFocus(kept);
  if (inSetup) Su.afterRender();
  document.body.classList.toggle('open', !!$sheets.firstChild);
  if (S.view === 'game' && G() && ['score', 'over'].includes(G().phase)) animateScore();
  wake();
  backNav.sync();
}

// Phones mode re-renders on every update from the room; keep what the player is typing.
function keepFocus() {
  const a = document.activeElement;
  if (!P.active() || !a?.matches?.('[data-pin]')) return null;
  return { pin: a.dataset.pin, from: a.selectionStart, to: a.selectionEnd };
}
function restoreFocus(k) {
  if (!k) return;
  const el = document.querySelector(`[data-pin="${k.pin}"]`);
  if (!el) return;
  el.focus();
  try { el.setSelectionRange(k.from, k.to); } catch { /* not a text field */ }
}

function animateScore() {
  const g = G(), key = `${g.roundNo}:${g.scores.join(',')}`;
  if (T.animKey === key || isFlat()) { T.animKey = key; return; }
  T.animKey = key;
  const cnts = [...$app.querySelectorAll('.cnt')], fills = [...$app.querySelectorAll('.fill')];
  cnts.forEach(c => (c.textContent = c.dataset.from));
  fills.forEach(f => { f.style.transition = 'none'; f.style.transform = `scaleX(${f.dataset.from})`; });
  void $app.offsetWidth;
  requestAnimationFrame(() => {
    fills.forEach(f => { f.style.transition = ''; f.style.transform = `scaleX(${f.dataset.to})`; });
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 400);
      cnts.forEach(c => (c.textContent = Math.round(+c.dataset.from + (+c.dataset.to - +c.dataset.from) * k)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => cnts.forEach(c => (c.textContent = c.dataset.to)), 450);
  });
}

// ---- events ------------------------------------------------------------
const startGame = (names, { mode, target }) => {
  S.game = E.createGame({ names, target, mode });
  S.view = 'game';
  T.sheet = null; T.revealed = false; T.animKey = ''; T.gridOpen = false;
};

const actions = {
  play() { S.view = 'setup'; Su.enter(); },
  phones() { P.open(); },
  rejoin() { P.open(P.lastRoom()); },
  pmenu() { T.sheet = 'pmenu'; P.resetMenu(); resetTools(); },
  resume() { S.view = 'game'; },
  home() { S.view = 'home'; T.sheet = null; T.confirm = false; Su.leaveView(); },
  faq() { T.sheet = 'faq'; },
  menu() { T.sheet = 'menu'; T.confirm = false; resetTools(); },
  tcoin() { toolAct('coin'); },
  tdie() { toolAct('die'); },
  tpick() { toolAct('pick', T.sheet === 'pmenu' ? P.roomNames() : G() ? G().names : []); },
  close() { T.sheet = null; T.confirm = false; },
  back() { T.sheet = 'menu'; },
  history() { T.sheet = 'history'; },
  anim() { S.anim = !S.anim; },
  haptics() { S.haptics = !S.haptics; },
  wake() { S.wake = !S.wake; },
  settings() { T.sheet = 'settings'; },
  undo() { T.sheet = null; dispatch({ type: 'UNDO' }); return 'done'; },
  newGame() { T.confirm = true; },
  newNo() { T.confirm = false; },
  newYes() { S.game = null; S.view = 'setup'; T.sheet = null; T.confirm = false; Su.enter(); },
  again() { startGame(G().names, { mode: G().mode, target: G().target }); },
  winhome() { S.game = null; S.view = 'home'; },
  clearq() { T.q = ''; const i = document.getElementById('faqq'); i.value = ''; document.getElementById('faqres').innerHTML = faqResults(''); i.focus(); document.querySelector('.search .clear').hidden = true; return 'done'; },
  next() { dispatch({ type: 'NEXT' }); return 'done'; },
  gridguess(el) { dispatch({ type: 'GUESS', word: el.dataset.word }); return 'done'; },
  vote(el) { dispatch({ type: 'VOTE', seat: el.dataset.seat === 'tie' ? null : +el.dataset.seat }); return 'done'; },
  guess(el) { dispatch({ type: 'GUESS', right: el.dataset.right === '1' }); return 'done'; },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  if (actions[el.dataset.act](el) !== 'done') { save(); render(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'faqq') {
    T.q = t.value;
    document.getElementById('faqres').innerHTML = faqResults(T.q);
    document.querySelector('.search .clear').hidden = !T.q;
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && T.sheet && !(S.view === 'setup')) { T.sheet = null; T.confirm = false; render(); } });

// ---- press-and-hold card: shared with Phones mode (holdcard.js) ----------
// The text is looked up here, in memory, only while a card is held; it is never in the page otherwise.
function secretFor(key) {
  const g = G();
  if (key === 'pass' && g) { const r = g.round; return { small: `Category: ${r.category}`, title: r.spies.includes(r.pass) ? ODD_TEXT : r.word }; }
  if (key === 'word' && g) return { small: `Category: ${g.round.category}`, title: g.round.word };
  return P.secretFor(key);
}
initHold({
  haptics: () => S.haptics,
  secretFor,
  onReveal(key) { P.markRevealed(key); if (key === 'pass' && !T.revealed) { T.revealed = true; const b = document.querySelector('.dock [data-act="next"]'); if (b) b.disabled = false; } },
});
document.addEventListener('toggle', e => { if (e.target.matches?.('[data-grid]')) T.gridOpen = e.target.open; }, true);

// ---- screen wake lock during play ----------------------------------------
let lock = null;
async function wake() {
  const want = S.wake && ((S.view === 'game' && !!G()) || P.wantsWake()) && document.visibilityState === 'visible';
  if (!want) { try { await lock?.release(); } catch { /* already released */ } lock = null; return; }
  if (lock || !navigator.wakeLock) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => { wake(); });

mq.addEventListener?.('change', render);
Su.init({ render, legacy: S.setup, home: () => actions.home(), startLocal: (names, settings) => { startGame(names, settings); save(); render(); } });
P.init({ render, haptics: () => S.haptics, closeSheet() { T.sheet = null; render(); }, hostLobby() { S.view = 'setup'; Su.hostLobby(); } });
// A deep link (#/faq, #/presets, #/join/CODE...) opens the page it names, not the last saved view. The hash is dropped
// once read, so a reload or the back-sheet history entries restore normally.
const dropHash = () => { try { history.replaceState(history.state, '', location.pathname + location.search); } catch { /* sandboxed */ } };
function applyLink(link) {
  if (link.to === 'faq') { T.sheet = 'faq'; T.confirm = false; return; }
  if (S.view !== 'setup') { S.view = 'setup'; Su.enter(); }
  Su.showPresets();
}
const link = parseDeepLink(location.hash);
if (link) dropHash();
const room = link?.to === 'room' ? link.code : new URLSearchParams(location.search).get('room');
if (room && /^[A-Za-z]{6}$/.test(room)) P.open(room.toUpperCase()); // a join link goes straight to the join screen
else {
  if (link?.to === 'presets') S.view = 'setup';
  if (S.view === 'setup') Su.resumeIfAny();
  if (link) applyLink(link);
  render();
}
addEventListener('hashchange', () => {
  const l = parseDeepLink(location.hash);
  if (!l) return;
  dropHash();
  if (l.to === 'room') { P.open(l.code); return; }
  applyLink(l); save(); render();
});
