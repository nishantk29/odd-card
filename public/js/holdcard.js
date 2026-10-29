// The press-and-hold card, shared by pass-the-phone and Phones mode. Markup, classes, sizes, timing and haptic are the
// same for every card and every value, so nobody can tell the Odd Card from a Word Holder by watching.
// Nothing secret is in the page while the card is not held: the markup is an empty face with a key (data-hold="me").
// The text is looked up in memory (secretFor) only when the press starts, written into the face, and wiped on release.
import { esc } from './art.js';

export const HOLD_MS = 220;
export const ODD_TEXT = 'You are the Odd Card'; // the one string an Odd Card sees; a Word Holder sees the word in the same slot

export const holdCard = (key, label = 'Your card. Press and hold to reveal.') => `<div class="holdcard" data-hold="${esc(key)}" tabindex="0" role="button" aria-label="${esc(label)}">
  <div class="hc"><div class="hc-back"><span>Press and hold</span></div><div class="hc-front" aria-live="polite"></div></div></div>`;

let cfg = { haptics: () => true, onReveal: () => {}, secretFor: () => null };
let hold = null;

// One haptic pattern for every reveal, whoever is looking.
export const buzz = () => { try { if (cfg.haptics() && navigator.vibrate) navigator.vibrate(18); } catch { /* unsupported */ } };

const face = (s) => `<small>${esc(s.small)}</small><strong>${esc(s.title)}</strong><em>Let go to hide it.</em>`;

function holdStart(el) {
  if (hold) return;
  hold = { el, t: setTimeout(() => {
    const s = cfg.secretFor(el.dataset.hold);
    if (!s) return;
    el.querySelector('.hc-front').innerHTML = face(s);
    el.classList.add('shown');
    buzz(); cfg.onReveal(el.dataset.hold);
  }, HOLD_MS) };
}
export function holdEnd() {
  if (!hold) return;
  clearTimeout(hold.t);
  hold.el.classList.remove('shown');
  const f = hold.el.querySelector('.hc-front');
  if (f) f.textContent = '';
  hold = null;
}

// Wires the document listeners once. secretFor(key) -> { small, title } | null; haptics(): is vibration on; onReveal(key).
export function initHold(options) {
  cfg = { ...cfg, ...options };
  document.addEventListener('pointerdown', e => { const el = e.target.closest('[data-hold]'); if (el && e.isPrimary) { e.preventDefault(); holdStart(el); } });
  ['pointerup', 'pointercancel', 'blur'].forEach(t => addEventListener(t, holdEnd));
  document.addEventListener('contextmenu', e => { if (e.target.closest('[data-hold]')) e.preventDefault(); });
  document.addEventListener('keydown', e => { const el = e.target.closest?.('[data-hold]'); if (el && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) holdStart(el); } });
  document.addEventListener('keyup', e => { if (e.target.closest?.('[data-hold]') && (e.key === ' ' || e.key === 'Enter')) holdEnd(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') holdEnd(); });
}
