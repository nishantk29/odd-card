// Presets: names, validity at every player count in range, saved presets, and mapping of old setups.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';
import * as PR from '../public/js/presets.js';
import * as C from '../public/js/config-defaults.js';

const mem = () => { const m = new Map(); globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; return m; };

test('the six presets have the approved names, in order, and the default is Opening Hand', () => {
  assert.deepEqual(PR.PRESETS.map((p) => p.name), ['Opening Hand', 'Quick Hand', 'The Grid', 'Long Game', 'Crowded Table', 'Full Grid']);
  assert.equal(C.DEFAULT_PRESET_ID, 'opening-hand');
  assert.deepEqual(PR.PRESETS.map((p) => [p.settings.mode, p.settings.target]), [['classic', 6], ['classic', 4], ['grid', 6], ['classic', 10], ['classic', 8], ['grid', 10]]);
  assert.deepEqual([PR.PRESETS[4].min, PR.PRESETS[4].max], [8, 12]);
  for (const p of PR.PRESETS) { assert.ok(p.id && p.vibe && PR.DIFFICULTY.includes(p.difficulty), p.name); assert.ok(p.min >= E.MIN_PLAYERS && p.max <= E.MAX_PLAYERS && p.min <= p.max, p.name); }
});

test('every preset makes a valid game at every player count in its range', () => {
  for (const p of PR.PRESETS) {
    assert.ok(PR.settingsValid(p.settings), p.name);
    for (let n = p.min; n <= p.max; n++) {
      const g = E.createGame({ names: Array.from({ length: n }, (_, i) => `P${i}`), ...p.settings, seed: n });
      assert.equal(g.target, p.settings.target); assert.equal(g.mode, p.settings.mode);
      assert.equal(g.round.spies.length, E.spyCount(n), `${p.name} at ${n}`);
      assert.equal(PR.oddCards(n), E.spyCount(n));
      if (p.settings.mode === 'grid') assert.equal(g.round.grid.length, E.GRID_SIZE);
    }
  }
});

test('there is a preset that fits every table size, and the recommended one is Opening Hand where it fits', () => {
  for (let n = E.MIN_PLAYERS; n <= E.MAX_PLAYERS; n++) { const r = PR.recommendedFor(n); assert.ok(PR.fits(r, n), `${n}`); assert.equal(r.id, 'opening-hand'); }
  assert.match(PR.needs(PR.PRESETS[4], 6), /Needs 8\+ players\. You have 6\./);
  assert.equal(PR.needs(PR.PRESETS[0], 6), '');
});

test('saved presets: save, rename, delete, validation and the cap', () => {
  mem();
  assert.deepEqual(PR.savedPresets(), []);
  assert.match(PR.savePreset('  ', { mode: 'classic', target: 5 }).error, /name/);
  assert.match(PR.savePreset('Bad', { mode: 'weird', target: 5 }).error, /valid/);
  assert.match(PR.savePreset('opening hand', { mode: 'classic', target: 5 }).error, /already exists/);
  const r = PR.savePreset('Friday night', { mode: 'grid', target: 7 });
  assert.ok(r.ok);
  const list = PR.savedPresets();
  assert.equal(list.length, 1); assert.equal(list[0].saved, true); assert.deepEqual(list[0].settings, { mode: 'grid', target: 7 });
  assert.equal(PR.findPreset(r.id).name, 'Friday night');
  assert.ok(PR.renamePreset(r.id, 'Saturday').ok);
  assert.equal(PR.findPreset(r.id).name, 'Saturday');
  assert.match(PR.renamePreset(r.id, 'Quick Hand').error, /already exists/);
  PR.deletePreset(r.id);
  assert.equal(PR.findPreset(r.id), null);
  for (let i = 0; i < C.MAX_SAVED_PRESETS; i++) assert.ok(PR.savePreset(`Mine ${i}`, { mode: 'classic', target: 5 }).ok);
  assert.match(PR.savePreset('One more', { mode: 'classic', target: 5 }).error, /Delete one first/);
});

test('corrupt saved presets are ignored, never thrown', () => {
  const m = mem(); m.set(C.SAVED_PRESETS_KEY, '{nope');
  assert.deepEqual(PR.savedPresets(), []);
  m.set(C.SAVED_PRESETS_KEY, JSON.stringify([{ id: 'x', name: 'Ok', settings: { mode: 'classic', target: 99 } }, { id: 'y', name: 'Fine', settings: { mode: 'classic', target: 5 } }, null]));
  assert.deepEqual(PR.savedPresets().map((p) => p.name), ['Fine']);
});

test('an old { names, target, mode } setup maps to the preset with the same mode and target, else the default', () => {
  mem();
  assert.equal(PR.presetIdFor({ mode: 'grid', target: 10 }), 'full-grid');
  assert.equal(PR.presetIdFor({ mode: 'classic', target: 4 }), 'quick-hand');
  assert.equal(PR.presetIdFor({ mode: 'classic', target: 5 }), C.DEFAULT_PRESET_ID);
});

test('config defaults: seating and the room code step are one named constant each', () => {
  assert.ok(['one', 'phones', 'mixed'].includes(C.DEFAULT_SEATING));
  assert.equal(C.ROOM_CODE_STEP, 1);
  assert.equal(C.SLIDE_MS, 240);
  assert.equal(C.SETUP_KEY, 'oddcard.setup.v1');
});
