// Back closes the open sheet first: render() keeps back-sheet.js in step with the sheets layer (e2e: test/e2e/back-nav.e2e.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app = readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
test('render() syncs Back with the sheets layer; Back closes only a sheet with a backdrop action; SW precaches back-sheet.js', () => {
  assert.match(app, /import \{ backClosesSheets \} from '\.\/back-sheet\.js'/);
  const render = app.slice(app.indexOf('function render() {'), app.indexOf('function keepFocus()'));
  assert.match(render, /backNav\.sync\(\);\n\}/, 'sync is the last step of render');
  assert.match(app, /\[data-act="close"\], \[data-su="closesheet"\]/);
  assert.ok(sw.includes("'/js/back-sheet.js'"));
});
