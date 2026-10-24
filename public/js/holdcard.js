// The press-and-hold card, shared by pass-the-phone and Phones mode. Markup, classes, sizes, timing and haptic are the
// same for every card; only the two strings differ, so nobody can tell the Odd Card from a Word Holder by watching.
import { esc } from './art.js';

export const HOLD_MS = 220;
export const holdCard = (small, title, label) => `<div class="holdcard" data-hold tabindex="0" role="button" aria-label="${label}">
  <div class="hc"><div class="hc-back"><span>Press and hold</span></div>
  <div class="hc-front"><small>${esc(small)}</small><strong>${esc(title)}</strong><em>Let go to hide it.</em></div></div></div>`;

let cfg = { haptics: () => true, onReveal: () => {} };
let hold = null;

// One haptic pattern for every reveal, whoever is looking.
export const buzz = () => { try { if (cfg.haptics() && navigator.vibrate) navigator.vibrate(18); } catch { /* unsupported */ } };

function holdStart(el) {
  if (hold) return;
  hold = { el, t: setTimeout(() => { el.classList.add('shown'); buzz(); cfg.onReveal(); }, HOLD_MS) };
}
export function holdEnd() {
  if (!hold) return;
  clearTimeout(hold.t);
  hold.el.classList.remove('shown');
  hold = null;
}

// Wires the document listeners once. haptics(): is vibration on; onReveal(): the card was shown at least once.
export function initHold(options) {
  cfg = { ...cfg, ...options };
  document.addEventListener('pointerdown', e => { const el = e.target.closest('[data-hold]'); if (el && e.isPrimary) { e.preventDefault(); holdStart(el); } });
  ['pointerup', 'pointercancel', 'blur'].forEach(t => addEventListener(t, holdEnd));
  document.addEventListener('contextmenu', e => { if (e.target.closest('[data-hold]')) e.preventDefault(); });
  document.addEventListener('keydown', e => { const el = e.target.closest?.('[data-hold]'); if (el && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) holdStart(el); } });
  document.addEventListener('keyup', e => { if (e.target.closest?.('[data-hold]') && (e.key === ' ' || e.key === 'Enter')) holdEnd(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') holdEnd(); });
}
