// The Odd Card: host UI. All rules live in engine.js; this file renders state and dispatches actions.
import * as E from './engine.js';
import { esc, cardChip, titleArt, agentIcon, spyIcon, icons } from './art.js';
import { faqResults } from './faq.js';

const KEY = 'oddcard.v1';
const $app = document.getElementById('app');
const $sheets = document.getElementById('sheets');
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const seats = n => Array.from({ length: n }, (_, i) => `Seat ${i + 1}`);

let S = { view: 'home', setup: { names: seats(5), target: E.DEFAULT_TARGET }, game: null, anim: !lowEnd };
try { S = { ...S, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* fresh start */ }
if (S.view === 'game' && !S.game) S.view = 'home';
const T = { sheet: null, confirm: false, hidden: false, q: '', animKey: '' }; // transient UI state

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ } };
const isFlat = () => mq.matches || !S.anim;
const G = () => S.game;

function dispatch(action) {
  const next = E.apply(S.game, action);
  if (next === S.game) return;
  S.game = next;
  T.hidden = false;
  save();
  render();
}

// ---- small view helpers ------------------------------------------------
const lines = list => `<div class="lines">${list.map(l => `<p class="line ${l.type}"><span class="lbl">${l.type === 'say' ? 'Say' : 'Gesture'}:</span> <b>${esc(l.text)}</b></p>`).join('')}</div>`;
// Longest word in a secret word or category: the word card scales its type so a long word stays whole on one line.
const wl = (t) => Math.max(4, ...String(t).split(/\s+/).map((w) => w.length));
const stage = (cls, inner) => `<div class="stack3"><section class="stage ${cls}">${inner}</section></div>`;
const nameOf = i => esc(G().names[i]);
const spiesText = g => g.round.spies.map(i => esc(g.names[i])).join(' and ');

function legend() {
  return `<div class="legend"><h3>What each card means</h3>
    <div class="r">${agentIcon()}<span><b>Red card = Agent.</b> Sees the secret word. Gives a clue, hunts the spy.</span></div>
    <div class="r">${spyIcon()}<span><b>Black card = Spy.</b> Sees only the category. Blends in, guesses the word if caught.</span></div></div>`;
}

function playerButtons(selected, extra = '') {
  return `<div class="players">${G().names.map((n, i) => `<button class="pbtn${selected.includes(i) ? ' on' : ''}" data-act="${extra}" data-seat="${i}">${esc(n)}</button>`).join('')}</div>`;
}

// ---- screens -----------------------------------------------------------
function homeHTML() {
  const g = G();
  const resume = g && g.phase !== 'over' ? `<button class="tile t-spy" data-act="resume"><h2>Resume game</h2><p>Round ${g.round.no} · ${g.names.length} players</p>${icons.go()}</button>` : '';
  return `<main class="wrap home"><header>${titleArt()}<h1>The Odd Card</h1><p class="sub">A spy game for a regular deck</p></header>
  <div class="stack">
    <button class="tile t-gold" data-act="play"><h2>New game</h2><p>4 to 12 players plus you, the storyteller.</p>${icons.go()}</button>${resume}
    <section class="how"><h2>How to play</h2><ol>
      <li><b>Deal.</b> The app tells you which red and black cards to pull. Everyone gets one, face down.</li>
      <li><b>Night.</b> Red cards (agents) see the secret word. Black cards (spies) only see the category.</li>
      <li><b>Clues.</b> Two laps: one hint word each. Don't give the word away.</li>
      <li><b>Vote.</b> On three, point at the spy. The accused flips their card.</li>
      <li><b>Score.</b> Spies score by hiding, agents by catching. First to the target wins.</li></ol></section>
    <button class="faqlink" data-act="faq"><span><b>Stuck on a rule?</b> Search the FAQ</span>${icons.go()}</button>
  </div></main>`;
}

function setupHTML() {
  const { names, target } = S.setup;
  const n = names.length, k = E.spyCount(n);
  return `<main class="wrap"><div class="bar"><button class="iconbtn" data-act="home" aria-label="Home">${icons.back()}</button><span class="grow"></span><button class="iconbtn" data-act="faq" aria-label="FAQ">?</button></div>
  <div class="screen">${stage('felt', `<span class="eyebrow">Setup</span><h1 class="mid">Players, in seat order</h1>
    <p class="note">${n} players · ${k} spy${k > 1 ? 's' : ''} per round. You, the storyteller, don't play.</p>
    <div class="names">${names.map((v, i) => `<div class="nrow"><span class="n">${i + 1}</span><input data-name="${i}" value="${esc(v)}" maxlength="20" aria-label="Seat ${i + 1} name" autocomplete="off"><button class="x" data-act="remove" data-seat="${i}" aria-label="Remove seat ${i + 1}" ${n <= E.MIN_PLAYERS ? 'disabled' : ''}>${icons.close()}</button></div>`).join('')}</div>
    <button class="addbtn" data-act="add" ${n >= E.MAX_PLAYERS ? 'disabled' : ''}>+ Add player</button>
    <h2 class="mid">Play to</h2><div class="stepper"><button data-act="tminus" aria-label="Lower target" ${target <= E.MIN_TARGET ? 'disabled' : ''}>−</button><output>${target}</output><button data-act="tplus" aria-label="Raise target" ${target >= E.MAX_TARGET ? 'disabled' : ''}>+</button><span class="pill">points</span></div>`)}</div>
  <div class="dock"><button class="next" data-act="start">Deal round 1</button></div></main>`;
}

function dealBody(g) {
  const r = g.round;
  const tb = g.tiebreak ? `<p class="note"><b>Tiebreak round.</b> ${g.tiebreak.map(i => nameOf(i)).join(' and ')} are tied on top. Everyone still plays.</p>` : '';
  return stage('felt', `<span class="eyebrow">Round ${r.no} · Deal</span>${tb}
    <h1 class="mid">Pull these ${g.names.length} cards from the deck</h1>
    <div class="group-label"><span class="dot red"></span>Red · ${r.cards.red.length} agent${r.cards.red.length > 1 ? 's' : ''}</div><div class="chips">${r.cards.red.map(c => cardChip(c)).join('')}</div>
    <div class="group-label"><span class="dot black"></span>Black · ${r.cards.black.length} ${r.cards.black.length > 1 ? 'spies' : 'spy'}</div><div class="chips">${r.cards.black.map(c => cardChip(c)).join('')}</div>
    <p class="note">Shuffle these face down and deal one to each player. Look at your card, keep it secret, put it face down in front of you.</p>${legend()}`);
}

function nightBody(g) {
  const r = g.round, st = E.NIGHT[r.step];
  const head = `<span class="eyebrow">Night · ${r.step + 1} of ${E.NIGHT.length}</span>`;
  let extra = '';
  if (st.screen === 'word') {
    extra = `<button class="wordcard${T.hidden ? ' hid' : ''}" data-act="toggleWord" aria-label="Secret word. Tap to ${T.hidden ? 'show' : 'hide'}"><small>Category: ${esc(r.category)}</small><strong style="--wl:${wl(r.word)}">${esc(r.word)}</strong><em>${T.hidden ? 'Tap to show' : 'Tap to hide'}</em></button>`;
  } else if (st.screen === 'pick') {
    extra = `<div class="wordcard"><small>Secret word's category</small><strong style="--wl:${wl(r.category)}">${esc(r.category)}</strong></div>
      <p class="note"><b>Host:</b> tap who opened their eyes (${r.opened.length} of ${r.spyCount}).</p>${playerButtons(r.opened, 'toggle')}`;
  }
  return stage('spy', `${head}${lines(st.lines)}${extra}`);
}

function cluesBody(g) {
  const r = g.round, n = g.names.length, seat = E.clueSeat(r, n, r.turn);
  const lap = r.turn < n ? 1 : 2;
  return stage('teal', `<span class="eyebrow">Clues · lap ${lap} of 2</span><div class="big">${nameOf(seat)}</div>${lines(E.cueFor(g))}
    <p class="note">One word that hints at the secret word, without giving it away. Turn ${r.turn + 1} of ${2 * n}. Started with ${nameOf(r.start)}, going ${E.dirName(r.dir)}${r.turn < 2 * n - 1 ? `. Up next: ${nameOf(E.clueSeat(r, n, r.turn + 1))}` : '. Last clue, then the vote'}.</p>`);
}

function voteBody(g) {
  return stage('gold', `<span class="eyebrow">Vote</span>${lines(E.cueFor(g))}<p class="note"><b>Host:</b> tap the player with the most fingers pointing at them.</p>
    <div class="players">${g.names.map((n, i) => `<button class="pbtn" data-act="vote" data-seat="${i}">${esc(n)}</button>`).join('')}<button class="pbtn tie" data-act="vote" data-seat="tie">Tie · no clear winner</button></div>`);
}

function revealBody(g) {
  const r = g.round;
  if (r.accused === null) return stage('teal', `<span class="eyebrow">Reveal</span><div class="big">Tie</div>${lines(E.cueFor(g))}`);
  const spy = r.spies.includes(r.accused);
  return stage(spy ? 'felt' : 'red', `<span class="eyebrow">Reveal</span><div class="big">${nameOf(r.accused)}</div>
    <p class="mid">${spy ? 'BLACK card · Spy' : 'RED card · Agent'}</p>${lines(E.cueFor(g))}`);
}

function guessBody(g) {
  const r = g.round;
  return stage('spy', `<span class="eyebrow">Guess</span><div class="big">${nameOf(r.accused)}</div>${lines(E.cueFor(g))}
    <div class="wordcard"><small>Secret word (host only)</small><strong style="--wl:${wl(r.word)}">${esc(r.word)}</strong></div><p class="note"><b>Host:</b> did they say the word?</p>`);
}

function flipBody(g) {
  const r = g.round;
  return stage('felt', `<span class="eyebrow">Round ${r.no} · Cards up</span>${lines(E.cueFor(g))}
    <p class="note">${r.spies.length > 1 ? 'The spies were' : 'The spy was'} <b>${spiesText(g)}</b>. The word was <b>${esc(r.word)}</b> (${esc(r.category)}). Cards go back in the deck.</p>`);
}

function scoreBody(g) {
  const r = g.round;
  const prev = g.scores.map((s, i) => s - r.delta[i]);
  const top = Math.max(g.target, ...g.scores);
  const order = g.names.map((_, i) => i).sort((a, b) => g.scores[b] - g.scores[a] || a - b);
  const rows = order.map(i => `<div class="srow"><span class="nm"><span class="nt">${esc(g.names[i])}</span>${r.spies.includes(i) ? '<span>SPY</span>' : ''}</span>
    <span class="pts"><span class="cnt" data-i="${i}" data-from="${prev[i]}" data-to="${g.scores[i]}">${g.scores[i]}</span>${r.delta[i] ? `<span class="gain">+${r.delta[i]}</span>` : ''}</span>
    <span class="track"><span class="fill" data-i="${i}" data-from="${prev[i] / top}" data-to="${g.scores[i] / top}" style="transform:scaleX(${g.scores[i] / top})"></span></span></div>`).join('');
  return stage('felt', `<span class="eyebrow">Scoreboard · Round ${r.no}</span><p class="mid">${E.OUTCOME_TEXT[r.outcome]}</p>
    <p class="note">First to ${g.target} wins. ${r.spies.length > 1 ? 'Spies' : 'Spy'}: <b>${spiesText(g)}</b>.</p><div class="score">${rows}</div>`);
}

function gameHTML() {
  const g = G(), r = g.round, p = g.phase;
  const body = { deal: dealBody, night: nightBody, clues: cluesBody, vote: voteBody, reveal: revealBody, guess: guessBody, flip: flipBody, score: scoreBody, over: scoreBody }[p](g);
  let dock = '';
  const next = (label, cls = '', dis = false) => `<button class="next ${cls}" data-act="next" ${dis ? 'disabled' : ''}>${label}</button>`;
  if (p === 'deal') dock = next('Cards dealt');
  else if (p === 'night') dock = next(r.step === E.NIGHT.length - 1 ? 'Start clues' : 'Next', '', E.NIGHT[r.step].screen === 'pick' && !E.nightPickReady(g));
  else if (p === 'clues') dock = next(r.turn === 2 * g.names.length - 1 ? 'Go to vote' : 'Next player');
  else if (p === 'reveal') dock = next(r.accused !== null && r.spies.includes(r.accused) ? 'Spy guesses the word' : 'Next');
  else if (p === 'guess') dock = `<div class="row2"><button class="next teal" data-act="guess" data-right="1">Right</button><button class="next red" data-act="guess" data-right="0">Wrong</button></div>`;
  else if (p === 'flip') dock = next('Show scores');
  else if (p === 'score') dock = next(g.win.status === 'win' ? 'See the winner' : g.win.status === 'tie' ? 'Tiebreak round' : 'Next round');
  return `<main class="wrap"><div class="bar"><span class="pill gold">Round ${r.no}</span><span class="pill">First to ${g.target}</span><span class="grow"></span>
    <button class="iconbtn" data-act="menu" aria-label="Host menu">${icons.menu()}</button></div><div class="screen">${body}</div>${dock ? `<div class="dock">${dock}</div>` : ''}</main>`;
}

// ---- sheets ------------------------------------------------------------
function menuSheet() {
  const g = G();
  const conf = T.confirm ? `<div class="confirm"><p>Start a new game? The current game and its scores will be lost.</p><div class="row2"><button class="mbtn danger" data-act="newYes">Yes, new game</button><button class="mbtn" data-act="newNo">Cancel</button></div></div>` : '';
  return `<h2>Host menu</h2><div class="menu">
    <button class="mbtn" data-act="undo" ${g && E.canUndo(g) ? '' : 'disabled'}>Undo last step</button>
    <button class="mbtn" data-act="history">Round history</button>
    <button class="mbtn" data-act="faq">FAQ</button>
    <button class="mbtn" data-act="anim" role="switch" aria-checked="${S.anim}">Animations<span class="switch${S.anim ? ' on' : ''}"></span></button>
    <button class="mbtn" data-act="home">Home</button>
    <button class="mbtn danger" data-act="newGame">New game</button></div>${conf}
    <button class="mbtn" style="margin-top:14px;justify-content:center" data-act="close">Close</button>`;
}

function historySheet() {
  const g = G();
  const items = g ? [...g.history].reverse().map(h => `<div class="hist"><span class="w">Round ${h.no}: ${esc(h.word)}</span> <span class="pill">${esc(h.category)}</span><br>
    <b>${h.spies.length > 1 ? 'Spies' : 'Spy'}:</b> ${h.spies.map(esc).join(', ')} · <b>Accused:</b> ${h.accused === null ? 'no one (tie)' : esc(h.accused)}<br>${E.OUTCOME_TEXT[h.outcome]}<br>
    <b>Points:</b> ${g.names.map((n, i) => h.delta[i] ? `${esc(n)} +${h.delta[i]}` : '').filter(Boolean).join(', ') || 'none'}${h.tiebreak ? `<br><b>Tiebreak round</b> (${h.tiebreak.map(esc).join(', ')})` : ''}</div>`).join('') : '';
  return `<h2>Round history</h2><div class="sbody">${items || '<p class="nomatch">No rounds played yet.</p>'}</div><button class="mbtn" style="margin-top:14px;justify-content:center" data-act="back">Back</button>`;
}

function faqSheet() {
  return `<h2>FAQ</h2><div class="search"><svg class="mag" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6"/><path d="M13 13l5 5"/></svg>
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
    return `<div class="rv${leaders.includes(i) ? ' me' : ''}"><span class="nm">${esc(n)}</span><span class="tag ${spy ? 'black' : 'red'}">${spy ? 'Black · Spy' : 'Red · Agent'}${r.delta[i] ? ` +${r.delta[i]}` : ''}</span><span class="tot">${g.scores[i]}</span></div>`;
  }).join('');
  const confetti = isFlat() ? '' : `<div class="confetti" aria-hidden="true">${Array.from({ length: 44 }, (_, i) => {
    const col = ['#F5C542', '#E5383B', '#1FB6B0', '#FFF7E6'][i % 4];
    return `<i style="--x:${Math.round(Math.random() * 100)}%;--col:${col};--d:${(2.6 + Math.random() * 2).toFixed(2)}s;--dl:${(Math.random() * 2.5).toFixed(2)}s;--dx:${Math.round(Math.random() * 120 - 60)}px;--r:${Math.round(360 + Math.random() * 540)}deg"></i>`;
  }).join('')}</div>`;
  return `<div class="win ${spyWon ? 'spy' : 'agent'}" role="dialog" aria-modal="true" aria-label="Game over">${confetti}<div class="win-in">
    <span class="eyebrow">Game over · round ${r.no}</span>
    <h1 class="headline">${names} win${leaders.length > 1 ? '' : 's'}!</h1>
    <p class="reason">${esc(g.names[leaders[0]])} reached ${pts} points (target ${g.target}). ${E.OUTCOME_TEXT[r.outcome]} The word was <b>${esc(r.word)}</b>.</p>
    <div class="reveal">${reveal}</div>
    <button class="next" data-act="again" style="margin-top:8px">Play again (same players)</button>
    <button class="mbtn" data-act="winhome" style="justify-content:center">Home</button></div></div>`;
}

function sheetsHTML() {
  const g = G();
  if (S.view === 'game' && g && g.phase === 'over' && T.sheet !== 'faq') return winPopup();
  if (!T.sheet) return '';
  const body = { menu: menuSheet, history: historySheet, faq: faqSheet }[T.sheet]();
  return `<div class="scrim" data-act="close"></div><div class="sheet${T.sheet === 'menu' ? ' s-spy' : ''}" role="dialog" aria-modal="true"><span class="grab"><span></span></span>${body}</div>`;
}

// ---- render ------------------------------------------------------------
function render() {
  document.documentElement.classList.toggle('flat', isFlat());
  $app.innerHTML = S.view === 'setup' ? setupHTML() : S.view === 'game' && G() ? gameHTML() : homeHTML();
  $sheets.innerHTML = sheetsHTML();
  document.body.classList.toggle('open', !!$sheets.firstChild);
  if (S.view === 'game' && G() && ['score', 'over'].includes(G().phase)) animateScore();
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
      const k = Math.min(1, (now - t0) / 900);
      cnts.forEach(c => (c.textContent = Math.round(+c.dataset.from + (+c.dataset.to - +c.dataset.from) * k)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => cnts.forEach(c => (c.textContent = c.dataset.to)), 1000);
  });
}

// ---- events ------------------------------------------------------------
const startGame = () => {
  const names = S.setup.names.map((n, i) => n.trim() || `Seat ${i + 1}`);
  S.game = E.createGame({ names, target: S.setup.target });
  S.view = 'game';
  T.sheet = null; T.hidden = false; T.animKey = '';
};

const actions = {
  play() { S.view = 'setup'; },
  resume() { S.view = 'game'; },
  home() { S.view = 'home'; T.sheet = null; T.confirm = false; },
  faq() { T.sheet = 'faq'; },
  add() { if (S.setup.names.length < E.MAX_PLAYERS) { let k = S.setup.names.length + 1; while (S.setup.names.includes(`Seat ${k}`)) k++; S.setup.names.push(`Seat ${k}`); } },
  remove(el) { if (S.setup.names.length > E.MIN_PLAYERS) S.setup.names.splice(+el.dataset.seat, 1); },
  tminus() { S.setup.target = Math.max(E.MIN_TARGET, S.setup.target - 1); },
  tplus() { S.setup.target = Math.min(E.MAX_TARGET, S.setup.target + 1); },
  start: startGame,
  menu() { T.sheet = 'menu'; T.confirm = false; },
  close() { T.sheet = null; T.confirm = false; },
  back() { T.sheet = 'menu'; },
  history() { T.sheet = 'history'; },
  anim() { S.anim = !S.anim; },
  undo() { T.sheet = null; dispatch({ type: 'UNDO' }); return 'done'; },
  newGame() { T.confirm = true; },
  newNo() { T.confirm = false; },
  newYes() { S.game = null; S.view = 'setup'; T.sheet = null; T.confirm = false; },
  again() { S.setup.names = G().names.slice(); S.setup.target = G().target; startGame(); },
  winhome() { S.setup.names = G().names.slice(); S.setup.target = G().target; S.game = null; S.view = 'home'; },
  clearq() { T.q = ''; const i = document.getElementById('faqq'); i.value = ''; document.getElementById('faqres').innerHTML = faqResults(''); i.focus(); document.querySelector('.search .clear').hidden = true; return 'done'; },
  toggleWord() { T.hidden = !T.hidden; },
  next() { dispatch({ type: 'NEXT' }); return 'done'; },
  toggle(el) { dispatch({ type: 'TOGGLE_OPENED', seat: +el.dataset.seat }); return 'done'; },
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
  if (t.matches('[data-name]')) { S.setup.names[+t.dataset.name] = t.value; save(); }
  else if (t.id === 'faqq') {
    T.q = t.value;
    document.getElementById('faqres').innerHTML = faqResults(T.q);
    document.querySelector('.search .clear').hidden = !T.q;
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && T.sheet) { T.sheet = null; T.confirm = false; render(); } });
mq.addEventListener?.('change', render);
render();
