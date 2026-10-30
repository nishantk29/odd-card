// The Host's setup: a 4-step carousel (Players, Round, Seating, Start) plus the Presets page and its preview sheet.
// Pure UI over three things: the Host's names on this phone (S below), the room in the lobby (phones.js, when online),
// and presets.js. Nothing here can block: every disabled Next names its reason and links to the step that fixes it.
import * as E from './engine.js';
import { esc, icons } from './art.js';
import { qrSvg } from './qr.js';
import * as P from './phones.js';
import * as PR from './presets.js';
import { DEFAULT_PRESET_ID, DEFAULT_SEATING, SEATING_STEP_LABEL, SLIDE_MS, FADE_MS, SETUP_KEY, ROOM_CODE_STEP } from './config-defaults.js';

const STEPS = ['Players', 'Round', SEATING_STEP_LABEL, 'Start'];
const SEATINGS = {
  one: { name: 'One phone', desc: 'Pass this phone around the table.', icon: 'phone' },
  phones: { name: 'Own phones', desc: 'Everyone joins on their own phone.', icon: 'phone' },
  mixed: { name: 'Mixed', desc: 'Some on their phones, the rest on this phone.', icon: 'phone' },
};
const initial = (name) => `${(name || '').trim().charAt(0).toUpperCase() || '?'}`;
const plural = (n, one, many) => (n === 1 ? one : many);
const hostName = () => { try { return (localStorage.getItem('oddcard.name') || '').trim().slice(0, 20) || 'Host'; } catch { return 'Host'; } };

let deps = { render() {}, startLocal() {}, home() {}, faq() {} };
let F = null; // the saved flow: { step, names, presetId, settings, seating, touched, adv }
const T = { page: null, sheet: null, add: '', addErr: '', focusAdd: false, slideFrom: null, live: '', ren: '', confirmDel: false, saveName: '', saveErr: '', nudge: 0 };
const mq = matchMedia('(prefers-reduced-motion: reduce)');

// ---- state: load, map older setups, save ----------------------------------------------------------------
const defaults = () => { const p = PR.PRESETS.find(x => x.id === DEFAULT_PRESET_ID); return { v: 1, step: 0, names: [hostName()], presetId: p.id, settings: { ...p.settings }, seating: DEFAULT_SEATING, touched: false, adv: false }; };
function load(legacy) {
  const d = defaults();
  let f = null;
  try { f = JSON.parse(localStorage.getItem(SETUP_KEY) || 'null'); } catch { /* fresh */ }
  if (!f || typeof f !== 'object') {
    // An older setup was { names, target, mode }: keep the mode and target (as a preset when one matches), not the seat names.
    if (legacy && PR.settingsValid({ mode: legacy.mode, target: legacy.target })) { d.settings = { mode: legacy.mode, target: legacy.target }; d.presetId = PR.presetIdFor(d.settings); }
    return d;
  }
  const names = Array.isArray(f.names) ? f.names.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 20)) : [];
  const settings = PR.settingsValid(f.settings) ? { mode: f.settings.mode, target: f.settings.target } : d.settings;
  return {
    v: 1, step: Number.isInteger(f.step) && f.step >= 0 && f.step <= 3 ? f.step : 0,
    names: names.length && names.length <= E.MAX_PLAYERS ? names : d.names,
    presetId: PR.findPreset(f.presetId) ? f.presetId : PR.presetIdFor(settings), settings,
    seating: SEATINGS[f.seating] ? f.seating : DEFAULT_SEATING, touched: !!f.touched, adv: !!f.adv,
  };
}
const persist = () => { try { localStorage.setItem(SETUP_KEY, JSON.stringify(F)); } catch { /* storage blocked */ } };
export const flow = () => F;

// ---- derived facts ----------------------------------------------------------------------------------------
function facts() {
  const info = P.setupInfo();
  const remote = info.status === 'ready' ? info.players.filter(p => !p.local && p.id !== info.me) : [];
  const locals = F.names.slice(1); // on this phone, besides the Host
  const total = 1 + locals.length + remote.length;
  const online = info.status === 'ready';
  const auto = remote.length === 0 ? DEFAULT_SEATING : locals.length === 0 ? 'phones' : 'mixed';
  const seating = F.touched ? F.seating : auto;
  const preset = PR.findPreset(F.presetId) || PR.PRESETS[0];
  return { info, remote, locals, total, online, seating, preset };
}
// Why Start can't go yet: [text, step to fix, link label] or null.
function problem(f) {
  if (f.total < E.MIN_PLAYERS) return [`Add ${E.MIN_PLAYERS - f.total} more ${plural(E.MIN_PLAYERS - f.total, 'player', 'players')} to start (${E.MIN_PLAYERS} minimum).`, 0, 'Add a name'];
  if (!PR.fits(f.preset, f.total)) return [`${f.preset.name} ${f.total < f.preset.min ? `needs ${f.preset.min}+ players` : `fits up to ${f.preset.max} players`}.`, 1, 'Change preset'];
  if (f.seating !== 'one' && !f.online) return ['Own phones needs a connection to the room.', 2, 'Pick One phone'];
  if (f.seating === 'phones' && f.locals.length) return [`${f.locals[0]} plays on this phone. Own phones needs everyone on their own phone.`, 2, 'Pick Mixed'];
  return null;
}
const stepProblem = (f, step) => { const p = problem(f); return p && p[1] <= step ? p : null; };
const nextProblem = (f, step) => { // reason Next is disabled on `step`
  if (step === 0 && f.total < E.MIN_PLAYERS) return problem(f);
  if (step === 1 && !PR.fits(f.preset, f.total)) return [`${f.preset.name} ${f.total < f.preset.min ? `needs ${f.preset.min}+ players` : `fits up to ${f.preset.max} players`}. Change preset or add players.`, 1, 'Change preset'];
  return null;
};

// ---- html -----------------------------------------------------------------------------------------------
const chip = (name, { phone, onX, label }) => `<li class="pchip"><span class="ini" aria-hidden="true">${esc(initial(name))}</span><span class="nm">${esc(name)}</span>${phone ? `<span class="tint" title="On their phone">${icons.phone()}<span class="sr">On their phone</span></span>` : ''}${onX ? `<button class="chx" data-su="${onX}" ${label} aria-label="Remove ${esc(name)}">${icons.close()}</button>` : '<span class="chpad"></span>'}</li>`;

function playersPanel(f) {
  const { info } = f;
  const roomLine = info.status === 'ready'
    ? `<p class="roomline">${icons.qr()}<span>Join with code <b class="code" data-code="${esc(info.code)}">${esc(info.code)}</b></span><button class="link" data-su="qr">Show QR code</button></p>`
    : info.status === 'connecting'
      ? `<p class="roomline">${icons.qr()}<span>Opening a room…</span></p>`
      : `<p class="roomline">${icons.qr()}<span>${esc(info.error || 'No room yet.')} One phone still works.</span><button class="link" data-su="retry">Try again</button></p>`;
  const rows = [
    chip(F.names[0], { phone: f.online }),
    ...f.locals.map((n, i) => chip(n, { onX: 'rmlocal', label: `data-i="${i + 1}"` })),
    ...f.remote.map(p => chip(p.name, { phone: true, onX: 'rmremote', label: `data-id="${esc(p.id)}"` })),
  ].join('');
  return `<h1 class="disp" tabindex="-1">Who’s at the table?</h1>${roomLine}
    <section class="plist2"><p class="grp">${f.total} ${plural(f.total, 'player', 'players')}</p><ul class="pchips" aria-label="Players">${rows}</ul>
    <form class="field" data-su-form="add"><input id="su-add" data-su-in="add" value="${esc(T.add)}" maxlength="20" placeholder="Add a name" aria-label="Add a name" autocomplete="off" autocapitalize="words" enterkeyhint="done"><button class="add" type="submit" ${f.total >= E.MAX_PLAYERS ? 'disabled' : ''}>Add</button></form>
    ${T.addErr ? `<p class="perr2" role="alert">${esc(T.addErr)}</p>` : ''}
    <p class="callout">${icons.lock()}Names are saved only on this device.</p></section>`;
}

// The small cards under each preset: the first card carries the target score, the rest show who is at the table.
const SUITS = { 'opening-hand': ['♠', 'k'], 'quick-hand': ['♣', 'k'], 'long-game': ['♦', 'r'], 'crowded-table': ['♠', 'k'] };
const pc = (inner, red) => `<span class="pc${red ? ' r' : ''}" aria-hidden="true">${inner}</span>`;
function mixOf(p) {
  const label = `${p.settings.mode === 'grid' ? 'Grid' : 'Classic'}, first to ${p.settings.target}`;
  if (p.settings.mode === 'grid') return `<p class="mix" aria-label="${label}"><span class="gicon" aria-hidden="true"></span><span>${label}</span></p>`;
  const [suit, c] = SUITS[p.id] || ['♠', 'k'];
  const cards = [pc(`${p.settings.target}<i>${suit}</i>`, c === 'r')];
  if (p.id === 'opening-hand') cards.push(pc('<i>♥</i>', true));
  if (p.id === 'crowded-table') cards.push(pc('?'), pc('?', true));
  return `<p class="mix" aria-label="${label}">${cards.join('')}<span class="sr">${label}</span></p>`;
}
const pips = (d) => `<span class="pips" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i <= PR.DIFFICULTY.indexOf(d) ? 'on' : ''}"></i>`).join('')}</span>`;
const presetCard = (p, n, { cur = false, tag = '', tap = false } = {}) => {
  const off = !PR.fits(p, n);
  const body = `<h2 class="disp">${esc(p.name)}</h2>${tag}<p class="vibe">${esc(p.vibe)}</p>
    <p class="meta"><span>${off ? `Needs ${p.min}+ players` : `${p.min}–${p.max} players`}</span><span class="diff">${esc(p.difficulty)} ${pips(p.difficulty)}</span></p>
    ${mixOf(p)}`;
  return `<li class="pre${cur ? ' cur' : ''}${off ? ' off' : ''}">${tap ? `<button class="pre-btn" data-su="preview" data-id="${esc(p.id)}">${body}</button>` : body}</li>`;
};

function roundPanel(f) {
  const p = f.preset, custom = p.settings.mode !== F.settings.mode || p.settings.target !== F.settings.target;
  const bad = !PR.fits(p, f.total);
  const k = PR.oddCards(f.total);
  return `<h1 class="disp" tabindex="-1">Pick the round</h1>
    <ul class="presets one">${presetCard(p, f.total, { cur: true, tag: `<span class="sel">${icons.check()}${custom ? 'Edited' : 'Picked'}</span>` })}</ul>
    <p class="line2">${F.settings.mode === 'grid' ? 'Grid' : 'Classic'}, first to ${F.settings.target}. ${k} Odd ${plural(k, 'Card', 'Cards')} at ${f.total} players${f.total === 1 ? '' : ''}.</p>
    ${bad ? `<p class="perr2" role="alert">${esc(PR.needs(p, f.total))} <button class="link inl" data-su="step" data-i="0">Back to players</button></p>` : ''}
    <button class="link" data-su="presets">Change preset</button>`;
}

function seatingPanel(f) {
  const opts = Object.entries(SEATINGS).map(([id, o]) => {
    const need = id !== 'one' && !f.online;
    return `<button class="opt${f.seating === id ? ' on' : ''}" data-su="seat" data-id="${id}" role="radio" aria-checked="${f.seating === id}" ${need ? 'disabled' : ''}>
      <span class="ico">${icons.phone()}</span><span class="t"><b>${o.name}</b><span>${need ? 'Needs a connection. Try again on step 1.' : o.desc}</span></span><span class="radio" aria-hidden="true"></span></button>`;
  }).join('');
  return `<h1 class="disp" tabindex="-1">How is everyone playing?</h1><div class="opts" role="radiogroup" aria-label="Seating">${opts}</div>
    ${f.seating === 'one' && f.remote.length ? `<p class="callout">${icons.phone()}${f.remote.length} ${plural(f.remote.length, 'phone', 'phones')} that joined will play on this phone instead.</p>` : ''}`;
}

function startPanel(f) {
  const p = f.preset, S = SEATINGS[f.seating];
  const row = (k, v, i) => `<li class="sum"><span class="k">${k}</span><span class="v">${v}</span><button class="link" data-su="step" data-i="${i}" aria-label="Edit ${k.toLowerCase()}">Edit</button></li>`;
  const phonesN = f.remote.length;
  const cur = F.settings;
  const mode = (m, t) => `<button class="chipb${cur.mode === m ? ' on' : ''}" data-su="mode" data-id="${m}" role="radio" aria-checked="${cur.mode === m}">${t}</button>`;
  return `<h1 class="disp" tabindex="-1">Ready?</h1>
    <ul class="sums">${row('Players', `${f.total}${phonesN || f.locals.length ? ` (${phonesN} on their phones, ${f.locals.length + 1} here)` : ''}`, 0)}${row('Round', `${esc(p.name)}<br><span class="tint">${cur.mode === 'grid' ? 'Grid' : 'Classic'}, first to ${cur.target}</span>`, 1)}${row('Seating', S.name, 2)}</ul>
    <details class="adv" ${F.adv ? 'open' : ''} data-su-adv><summary>Advanced</summary>
      <div class="advin"><p class="grp">Mode</p><div class="chiprow" role="radiogroup" aria-label="Mode">${mode('classic', 'Classic')}${mode('grid', 'Grid')}</div>
      <p class="grp">Play to</p><div class="stepper2"><button data-su="tminus" aria-label="Lower target" ${cur.target <= E.MIN_TARGET ? 'disabled' : ''}>−</button><output aria-live="polite">${cur.target} points</output><button data-su="tplus" aria-label="Raise target" ${cur.target >= E.MAX_TARGET ? 'disabled' : ''}>+</button></div>
      <p class="grp">Save preset</p><form class="field" data-su-form="savepreset"><input data-su-in="saveName" value="${esc(T.saveName)}" maxlength="24" placeholder="Preset name" aria-label="Preset name" autocomplete="off"><button class="add" type="submit">Save</button></form>${T.saveErr ? `<p class="perr2" role="alert">${esc(T.saveErr)}</p>` : ''}</div></details>`;
}

function dockFor(f) {
  const step = F.step;
  const last = step === 3;
  const pr = last ? problem(f) : nextProblem(f, step);
  const label = last ? 'Start round 1' : `Next: ${STEPS[step + 1]}`;
  const why = pr ? `<p class="why" id="su-why">${esc(pr[0])} <button class="link inl" data-su="step" data-i="${pr[1]}">${esc(pr[2])}</button></p>` : '<p class="why" id="su-why" hidden></p>';
  return `<div class="dock">${why}<button class="btn pri" data-su="${last ? 'start' : 'next'}" ${pr ? 'disabled aria-disabled="true"' : ''} aria-describedby="su-why">${label}</button></div>`;
}

export function html() {
  if (!F) return '';
  if (T.page === 'presets') return presetsPage();
  const f = facts();
  const panels = [playersPanel, roundPanel, seatingPanel, startPanel].map((fn, i) =>
    `<section class="panel" data-step="${i}" aria-label="Step ${i + 1} of 4, ${STEPS[i]}" ${i === F.step ? '' : 'inert aria-hidden="true"'}>${fn(f)}</section>`).join('');
  const from = T.slideFrom === null ? F.step : T.slideFrom;
  const dots = STEPS.map((s, i) => `<li><button class="dot2${i === F.step ? ' now' : i < F.step ? ' done' : ''}" data-su="step" data-i="${i}" ${i > F.step ? 'disabled' : ''} aria-label="Step ${i + 1}, ${s}" ${i === F.step ? 'aria-current="step"' : ''}>${i + 1}</button></li>`).join('');
  return `<main class="su" data-step="${F.step}"><div class="top">${F.step === 0 ? `<button class="back" data-su="home" aria-label="The Odd Card home">${icons.back()}</button>` : `<button class="back" data-su="back">${icons.back()}Back</button>`}<span class="sp"></span>
    <div class="prog"><ol aria-label="Steps" data-su-dots>${dots}</ol><span>Step ${F.step + 1} of 4: ${STEPS[F.step]}</span></div></div>
    <div class="viewport" data-su-view><div class="track" style="--tx:${-from * 100}%" data-to="${F.step}">${panels}</div></div>${dockFor(f)}
    <div class="sr" aria-live="polite" id="su-live">${esc(T.live)}</div></main>${T.sheet ? '' : ''}`;
}

function presetsPage() {
  const f = facts(), n = f.total, rec = PR.recommendedFor(n);
  const sel = F.presetId;
  const tag = (id) => (id === sel ? `<span class="sel">${icons.check()}Picked</span>` : '');
  const built = PR.PRESETS.filter(p => p.id !== rec.id);
  const saved = PR.savedPresets();
  const savedCard = (p) => `<li class="pre${PR.fits(p, n) ? '' : ' off'}${p.id === sel ? ' cur' : ''}"><button class="pre-btn" data-su="preview" data-id="${esc(p.id)}"><h2 class="disp">${esc(p.name)}</h2><span class="sel star">${icons.star()}Saved${p.id === sel ? ' · Picked' : ''}</span><p class="vibe">${esc(p.vibe)}</p>
    <p class="meta"><span>${p.settings.mode === 'grid' ? 'Grid' : 'Classic'}</span><span>First to ${p.settings.target}</span></p></button><button class="more" data-su="more" data-id="${esc(p.id)}" aria-label="Rename or delete ${esc(p.name)}">${icons.more()}</button></li>`;
  const cur = PR.findPreset(sel) || rec;
  return `<main class="su pg"><div class="top"><button class="back" data-su="presetsback">${icons.back()}Back</button><span class="sp"></span></div>
    <header class="mast"><h1 class="disp" tabindex="-1">Presets</h1><p class="sub">${n} ${plural(n, 'player', 'players')}. Tap one to see what it sets.</p></header>
    <div class="pgbody"><p class="grp">Recommended for ${n}</p><ul class="presets">${presetCard(rec, n, { cur: rec.id === sel, tag: tag(rec.id), tap: true })}</ul>
    <p class="grp">Built in</p><ul class="presets">${built.map(p => presetCard(p, n, { cur: p.id === sel, tag: tag(p.id), tap: true })).join('')}</ul>
    ${saved.length ? `<p class="grp">Saved on this phone</p><ul class="presets">${saved.map(savedCard).join('')}</ul>` : ''}
    <p class="callout">${icons.lock()}Saved only on this device.</p></div>
    <div class="dock"><button class="btn pri" data-su="usecur">Use ${esc(cur.name)}</button></div></main>`;
}

export function sheetHTML() {
  const f = F && facts();
  const s = T.sheet;
  if (!s || !f) return '';
  const n = f.total;
  const wrap = (inner) => `<div class="scrim2" data-su="closesheet"></div><div class="su-sheet" role="dialog" aria-modal="true" aria-label="${esc(s.kind === 'preview' ? 'Preset details' : 'Preset options')}">${inner}</div>`;
  if (s.kind === 'preview') {
    const p = PR.findPreset(s.id);
    if (!p) return '';
    const fit = PR.fits(p, n), k = PR.oddCards(n);
    return wrap(`<h2 class="disp">${esc(p.name)}</h2>${p.saved ? `<span class="sel star">${icons.star()}Saved</span>` : ''}
      <p class="vibe">${esc(p.vibe)}</p><p class="meta"><span>${p.min}–${p.max} players</span><span class="diff">${esc(p.difficulty)} ${pips(p.difficulty)}</span></p>
      <ul class="sets"><li><b>${p.settings.mode === 'grid' ? 'Grid' : 'Classic'}</b><span>${p.settings.mode === 'grid' ? '16 words on a public grid. The Odd Card taps one.' : 'One secret word. The Odd Card sees only the category.'}</span></li>
      <li><b>First to ${p.settings.target}</b><span>Points to win the game.</span></li>
      <li><b>${fit ? `${k} Odd ${plural(k, 'Card', 'Cards')}` : `${n} players`}</b><span>${fit ? `At ${n} players. The engine sets this, not the preset.` : esc(PR.needs(p, n))}</span></li></ul>
      ${fit ? `<button class="btn pri" data-su="usepreset" data-id="${esc(p.id)}">Use this</button><button class="link" data-su="customize" data-id="${esc(p.id)}">Customize from here</button>`
        : `<button class="btn pri" data-su="addplayers">Add players</button><button class="link" data-su="closesheet">Pick another</button>`}`);
  }
  const p = PR.findPreset(s.id);
  if (!p) return '';
  return wrap(`<h2 class="disp">${esc(p.name)}</h2><form class="field" data-su-form="rename"><input data-su-in="ren" value="${esc(T.ren)}" maxlength="24" aria-label="New name" autocomplete="off"><button class="add" type="submit">Rename</button></form>${T.saveErr ? `<p class="perr2" role="alert">${esc(T.saveErr)}</p>` : ''}
    ${T.confirmDel ? `<p class="vibe">Delete ${esc(p.name)}? This can’t be undone.</p><button class="btn dng" data-su="delyes" data-id="${esc(p.id)}">Delete preset</button><button class="link" data-su="delno">Keep it</button>` : `<button class="btn sec" data-su="delask">Delete</button><button class="link" data-su="closesheet">Close</button>`}`);
}

// ---- behaviour --------------------------------------------------------------------------------------------
const flat = () => mq.matches || document.documentElement.classList.contains('flat');
function go(step, { announce = true } = {}) {
  step = Math.max(0, Math.min(3, step));
  if (step === F.step) return;
  T.slideFrom = F.step; F.step = step;
  if (announce) T.live = `Step ${step + 1} of 4, ${STEPS[step]}`;
  T.focusStep = true;
  commit();
}
// Keep the room in line with the names and settings picked here (phones.js ignores it when there is no room).
function syncRoom() {
  P.syncLocals(F.names.slice(1));
  const f = facts();
  if (f.online) P.applySettings(F.settings);
}
function commit() { persist(); deps.render(); }

const acts = {
  home() { endRoom(); deps.home(); },
  back() { go(F.step - 1); },
  next() { const f = facts(); const pr = nextProblem(f, F.step); if (pr) { T.nudge++; return flashWhy(); } go(F.step + 1); },
  step(el) { go(+el.dataset.i); if (+el.dataset.i === 0) T.focusAdd = true; },
  qr() { P.showQr(); },
  retry() { P.resetSetupFail(); P.openSetup(F.names[0]); },
  rmlocal(el) { F.names.splice(+el.dataset.i, 1); commit(); },
  rmremote(el) { P.kickPlayer(el.dataset.id); },
  seat(el) { F.seating = el.dataset.id; F.touched = true; commit(); },
  mode(el) { F.settings.mode = el.dataset.id; commit(); },
  tminus() { F.settings.target = Math.max(E.MIN_TARGET, F.settings.target - 1); commit(); },
  tplus() { F.settings.target = Math.min(E.MAX_TARGET, F.settings.target + 1); commit(); },
  presets() { T.page = 'presets'; commit(); },
  presetsback() { T.page = null; T.sheet = null; commit(); },
  usecur() { T.page = null; T.sheet = null; commit(); },
  preview(el) { T.sheet = { kind: 'preview', id: el.dataset.id }; deps.render(); },
  closesheet() { T.sheet = null; T.confirmDel = false; T.saveErr = ''; deps.render(); },
  usepreset(el) { pick(el.dataset.id); T.page = null; T.sheet = null; commit(); },
  customize(el) { pick(el.dataset.id); F.adv = true; T.page = null; T.sheet = null; T.slideFrom = F.step; F.step = 3; T.focusStep = true; commit(); },
  addplayers() { T.page = null; T.sheet = null; T.slideFrom = F.step; F.step = 0; T.focusAdd = true; commit(); },
  more(el) { const p = PR.findPreset(el.dataset.id); T.ren = p?.name || ''; T.confirmDel = false; T.saveErr = ''; T.sheet = { kind: 'manage', id: el.dataset.id }; deps.render(); },
  delask() { T.confirmDel = true; deps.render(); },
  delno() { T.confirmDel = false; deps.render(); },
  delyes(el) { PR.deletePreset(el.dataset.id); if (F.presetId === el.dataset.id) pick(DEFAULT_PRESET_ID); T.sheet = null; T.confirmDel = false; commit(); },
  start() { startNow(); },
};
function pick(id) { const p = PR.findPreset(id); if (!p) return; F.presetId = p.id; F.settings = { ...p.settings }; }
function flashWhy() { document.getElementById('su-why')?.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 160 }); }

function startNow() {
  const f = facts();
  const pr = problem(f);
  if (pr) { T.nudge++; flashWhy(); return; }
  const settings = { mode: F.settings.mode, target: F.settings.target };
  if (f.seating === 'one') {
    const names = [...F.names, ...f.remote.map(p => p.name)];
    endRoom();
    deps.startLocal(names, settings);
  } else {
    P.startRoom(settings);
  }
}
function endRoom() { P.endSetup(); }

const forms = {
  add() {
    const name = T.add.trim().replace(/\s+/g, ' ');
    const f = facts();
    T.focusAdd = true;
    if (!name) { T.addErr = 'Type a name first.'; return deps.render(); }
    if (f.total >= E.MAX_PLAYERS) { T.addErr = `The table is full (${E.MAX_PLAYERS} players).`; return deps.render(); }
    const all = [...F.names, ...f.remote.map(p => p.name)].map(x => x.toLowerCase());
    if (all.includes(name.toLowerCase())) { T.addErr = 'Someone already has that name. Pick another.'; return deps.render(); }
    F.names.push(name.slice(0, 20)); T.add = ''; T.addErr = ''; commit();
  },
  savepreset() {
    const r = PR.savePreset(T.saveName, F.settings);
    if (r.error) { T.saveErr = r.error; return deps.render(); }
    T.saveName = ''; T.saveErr = ''; pick(r.id); commit();
  },
  rename() {
    const r = PR.renamePreset(T.sheet?.id, T.ren);
    if (r.error) { T.saveErr = r.error; return deps.render(); }
    T.sheet = null; T.saveErr = ''; commit();
  },
};

// ---- wiring ------------------------------------------------------------------------------------------------
let swipe = null;
export function init(d) {
  deps = { ...deps, ...d };
  F = load(d.legacy);
  document.addEventListener('click', e => {
    const el = e.target.closest?.('[data-su]');
    if (!el || !F || !isOpen()) return;
    if (el.disabled && el.dataset.su !== 'next') return;
    e.preventDefault();
    acts[el.dataset.su]?.(el);
  });
  document.addEventListener('submit', e => { const f = e.target.closest?.('[data-su-form]'); if (f && isOpen()) { e.preventDefault(); forms[f.dataset.suForm]?.(); } });
  document.addEventListener('input', e => { const k = e.target.dataset?.suIn; if (k) T[k] = e.target.value; });
  document.addEventListener('toggle', e => { if (e.target.matches?.('[data-su-adv]')) { F.adv = e.target.open; persist(); } }, true);
  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape' && T.sheet) { acts.closesheet(); return; }
    const dots = e.target.closest?.('[data-su-dots]');
    if (dots && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { go(F.step + (e.key === 'ArrowRight' ? 1 : -1)); }
  });
  // swipe is a pointer gesture on the card area; Back, Next and the dots do the same for everyone else
  document.addEventListener('pointerdown', e => { const v = e.target.closest?.('[data-su-view]'); if (v && isOpen() && e.isPrimary && !e.target.closest('input,button,a,summary')) swipe = { x: e.clientX, y: e.clientY }; });
  document.addEventListener('pointerup', e => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; swipe = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) acts.next(); else if (F.step > 0) go(F.step - 1);
  });
  addEventListener('pointercancel', () => { swipe = null; });
}

// ---- called by app.js ---------------------------------------------------------------------------------------
let open = false;
const isOpen = () => open;
export function enter({ resume = false } = {}) {
  open = true;
  if (!P.inSetup() && !resume) P.openSetup(F.names[0]);
}
export function leaveView() { open = false; T.page = null; T.sheet = null; }
export function hostLobby() { open = true; if (F) { T.slideFrom = null; F.step = 3; persist(); } }
export function resumeIfAny() { const c = P.lastRoom(); if (c && !P.inSetup()) { open = true; P.resumeSetup(c); } else enter(); }
export const isPage = () => T.page === 'presets';
export function showPresets() { T.page = 'presets'; T.sheet = null; } // the #/presets deep link

// After each render: put the slide, focus and caret where they belong.
export function afterRender() {
  if (!open || !F) return;
  syncRoom();
  const track = document.querySelector('.su .track');
  if (track && T.slideFrom !== null) {
    const from = T.slideFrom; T.slideFrom = null;
    if (flat()) { track.style.transition = 'none'; track.classList.add('fade'); void track.offsetWidth; track.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' }); }
    else { void track.offsetWidth; track.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(.2,.8,.2,1)`; track.style.setProperty('--tx', `${-F.step * 100}%`); }
    if (from === F.step) track.style.setProperty('--tx', `${-F.step * 100}%`);
  }
  if (track && flat()) track.style.setProperty('--tx', `${-F.step * 100}%`);
  if (T.focusStep) { T.focusStep = false; document.querySelector(`.su .panel[data-step="${F.step}"] h1`)?.focus({ preventScroll: true }); }
  if (T.focusAdd) { T.focusAdd = false; const a = document.getElementById('su-add'); if (a && F.step === 0) a.focus({ preventScroll: true }); }
  const ren = document.querySelector('[data-su-in="ren"]'); if (ren && !ren.dataset.did) { ren.dataset.did = 1; ren.focus(); ren.select(); }
}
export const captureFocus = () => { const a = document.activeElement; T.focusAdd = !!(a && a.id === 'su-add'); };
