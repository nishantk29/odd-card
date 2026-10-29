// Presets for the Odd Card. The engine fixes the Odd Card count by table size (spyCount), so a preset only sets the
// mode (classic or grid) and the target score. Plain data: { id, name, vibe, min, max, difficulty, settings }.
import * as E from './engine.js';
import { DEFAULT_PRESET_ID, SAVED_PRESETS_KEY, MAX_SAVED_PRESETS } from './config-defaults.js';

export const DIFFICULTY = ['Beginner', 'Classic', 'Veteran'];

export const PRESETS = [
  { id: 'opening-hand', name: 'Opening Hand', vibe: 'The standard game. First to 6 points.', min: 4, max: 12, difficulty: 'Beginner', settings: { mode: 'classic', target: 6 } },
  { id: 'quick-hand', name: 'Quick Hand', vibe: 'Over in a few rounds. First to 4.', min: 4, max: 12, difficulty: 'Beginner', settings: { mode: 'classic', target: 4 } },
  { id: 'the-grid', name: 'The Grid', vibe: 'The Odd Card guesses from 16 words on screen.', min: 4, max: 12, difficulty: 'Classic', settings: { mode: 'grid', target: 6 } },
  { id: 'long-game', name: 'Long Game', vibe: 'A full evening. First to 10.', min: 4, max: 12, difficulty: 'Classic', settings: { mode: 'classic', target: 10 } },
  { id: 'crowded-table', name: 'Crowded Table', vibe: 'Two Odd Cards hide in a big group.', min: 8, max: 12, difficulty: 'Classic', settings: { mode: 'classic', target: 8 } },
  { id: 'full-grid', name: 'Full Grid', vibe: 'Grid mode, long race. First to 10.', min: 4, max: 12, difficulty: 'Veteran', settings: { mode: 'grid', target: 10 } },
];

export const fits = (p, n) => n >= p.min && n <= p.max;
export const settingsValid = (s) => !!s && E.MODES.includes(s.mode) && Number.isInteger(s.target) && s.target >= E.MIN_TARGET && s.target <= E.MAX_TARGET;
export const oddCards = (n) => E.spyCount(n);
// One line saying what the preset sets, with the engine's Odd Card count for n players.
export const summary = (p, n) => `${p.settings.mode === 'grid' ? 'Grid' : 'Classic'}, first to ${p.settings.target}. ${oddCards(n)} Odd ${oddCards(n) === 1 ? 'Card' : 'Cards'} at ${n} players.`;
export const needs = (p, n) => (n < p.min ? `Needs ${p.min}+ players. You have ${n}.` : n > p.max ? `Fits up to ${p.max} players. You have ${n}.` : '');

// ---- saved on this phone -------------------------------------------------------------------------------
const read = () => { try { const v = JSON.parse(localStorage.getItem(SAVED_PRESETS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const write = (list) => { try { localStorage.setItem(SAVED_PRESETS_KEY, JSON.stringify(list)); } catch { /* storage blocked */ } };
const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);

export const savedPresets = () => read().filter(p => p && typeof p.id === 'string' && cleanName(p.name) && settingsValid(p.settings))
  .map(p => ({ id: p.id, name: cleanName(p.name), vibe: `${p.settings.mode === 'grid' ? 'Grid' : 'Classic'}, first to ${p.settings.target}. Saved on this phone.`, min: E.MIN_PLAYERS, max: E.MAX_PLAYERS, difficulty: 'Classic', settings: { mode: p.settings.mode, target: p.settings.target }, saved: true }));
export const allPresets = () => [...PRESETS, ...savedPresets()];
export const findPreset = (id) => allPresets().find(p => p.id === id) || null;

export function savePreset(name, settings) {
  const n = cleanName(name);
  if (!n) return { error: 'Type a name for the preset.' };
  if (!settingsValid(settings)) return { error: 'Those settings are not valid.' };
  const list = read();
  if (list.length >= MAX_SAVED_PRESETS) return { error: `You can keep ${MAX_SAVED_PRESETS} saved presets. Delete one first.` };
  if (allPresets().some(p => p.name.toLowerCase() === n.toLowerCase())) return { error: 'A preset with that name already exists.' };
  const p = { id: `saved-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, name: n, settings: { mode: settings.mode, target: settings.target } };
  write([...list, p]);
  return { ok: true, id: p.id };
}
export function renamePreset(id, name) {
  const n = cleanName(name);
  if (!n) return { error: 'Type a name for the preset.' };
  if (allPresets().some(p => p.id !== id && p.name.toLowerCase() === n.toLowerCase())) return { error: 'A preset with that name already exists.' };
  write(read().map(p => (p.id === id ? { ...p, name: n } : p)));
  return { ok: true };
}
export const deletePreset = (id) => write(read().filter(p => p.id !== id));

// ---- mapping old setups -----------------------------------------------------------------------------------
// The old setup was { names, target, mode }. It maps to the built-in preset with the same mode and target, else to a custom one.
export function presetIdFor(settings) {
  const hit = allPresets().find(p => p.settings.mode === settings.mode && p.settings.target === settings.target);
  return hit ? hit.id : DEFAULT_PRESET_ID;
}
// The id of the preset a player count should start on.
export const recommendedFor = (n) => { const d = PRESETS.find(p => p.id === DEFAULT_PRESET_ID); return fits(d, n) ? d : PRESETS.find(p => fits(p, n)) || d; };
