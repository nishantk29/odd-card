// Table tools in the Host menu (combo C): coin, die and pick give fair results on this phone only.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toolAct, toolsHTML, resetTools } from '../public/js/table-tools.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
test('coin, die and pick give every outcome and nothing else', () => {
  const seen = { coin: new Set(), die: new Set(), pick: new Set() };
  for (let i = 0; i < 600; i++) { seen.coin.add(toolAct('coin')); seen.die.add(toolAct('die')); seen.pick.add(toolAct('pick', ['Ana', 'Ben', 'Cy'])); }
  assert.deepEqual([...seen.coin].sort(), ['Heads', 'Tails']);
  assert.deepEqual([...seen.die].sort(), [1, 2, 3, 4, 5, 6].map((n) => `Rolled ${n}`));
  assert.deepEqual([...seen.pick].sort(), ['Picked Ana', 'Picked Ben', 'Picked Cy']);
  assert.equal(toolAct('pick', []), 'Add players first');
});
test('the result shows inline, escaped, and clears when the menu opens again', () => {
  toolAct('pick', ['<b>x</b>']); const h = toolsHTML(esc);
  assert.match(h, /role="status"/); assert.ok(!h.includes('<b>x</b>')); assert.ok(h.includes('&#60;b&#62;x'));
  resetTools(); assert.match(toolsHTML(esc), /class="tt-out"[^>]*hidden/);
  assert.match(toolsHTML(esc, false), /data-act="tpick" disabled/);
});
test('the tools never touch the game: no dispatch, no storage, no engine import', () => {
  const src = readFileSync(new URL('../public/js/table-tools.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/dispatch|localStorage|import /.test(src));
  const app = readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
  for (const a of ['tcoin', 'tdie', 'tpick']) assert.ok(!new RegExp(`${a}\\(\\)[^\\n]*dispatch`).test(app), a);
});
