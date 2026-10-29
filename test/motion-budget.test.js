// Motion budget (Nishant, 2026-10-29): presses are snappy (100-150ms, never scaled) and nothing runs over 400ms.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as mb from './kit/motion-budget.mjs';

const pub = fileURLToPath(new URL('../public', import.meta.url));
const read = (f) => fs.readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');

test('no animation or transition resolves above 400ms (duration, and delay + duration)', () => {
  assert.deepEqual(mb.overBudget(pub), []);
  const { rows } = mb.timings(mb.cssSources(pub));
  assert.ok(rows.length > 10, 'the scan found the stylesheets');
  assert.deepEqual(rows.filter((r) => r.ms == null).map((r) => r.where), [], 'every timing resolves statically');
});

test('press feedback is 100-150ms, not scaled, scale .97; menu rows highlight instead of scaling', () => {
  assert.deepEqual(mb.pressProblems(mb.cssSources(pub), { rowSelectors: ['.mbtn'] }), []);
  assert.match(read('styles.css'), /\.mbtn:active\{background-image:linear-gradient\(var\(--f-press-row\),var\(--f-press-row\)\)\}/);
});

test('JS-driven motion stays within 400ms (confetti, score count-up)', () => {
  for (const f of ['js/app.js', 'js/phones.js']) {
    const s = read(f);
    for (const m of s.matchAll(/--d:\$\{\(([\d.]+) \+ Math\.random\(\) \* ([\d.]+)\)[^}]*\}s;--dl:\$\{\(Math\.random\(\) \* ([\d.]+)\)/g)) {
      assert.ok((+m[1] + +m[2] + +m[3]) * 1000 <= mb.CAP, `${f}: confetti ends at ${(+m[1] + +m[2] + +m[3]) * 1000}ms`);
    }
    assert.doesNotMatch(s, /--d:\$\{\(2\.6/, f);
  }
  const app = read('js/app.js');
  const k = /\(now - t0\) \/ (\d+)\)/.exec(app); assert.ok(k && +k[1] <= mb.CAP, 'score count-up');
  assert.deepEqual(mb.jsOverBudget(pub, 1), []);
});

test('the scans catch violations (verified red)', () => {
  const src = (css) => [{ file: 'x.css', css }];
  const props = ':root{--f-press:120ms;--f-press-scale:.97}';
  assert.equal(mb.timings(src('.a{transition:transform .5s}')).rows[0].ms, 500);
  assert.equal(mb.timings(src(':root{--s:2;--t:calc(300ms * var(--s))}.a{animation:x var(--t) ease 0s}')).rows[0].ms, 600);
  assert.equal(mb.timings(src('.a{animation:x 300ms ease 200ms}')).rows[0].end, 500);
  assert.equal(mb.timings(src('@media (prefers-reduced-motion:reduce){.a{transition:x 2s}}')).rows.length, 0);
  assert.ok(mb.pressProblems(src(':root{--s:2;--f-press:calc(120ms * var(--s));--f-press-scale:.97}.b:active{transition-duration:var(--f-press)}')).some((x) => /scaled/.test(x)));
  assert.ok(mb.pressProblems(src(':root{--f-press:200ms;--f-press-scale:.97}.b:active{transition-duration:var(--f-press)}')).length);
  assert.ok(mb.pressProblems(src(props + '.b:active{transition-duration:var(--f-press);transform:scale(.94)}')).length);
  assert.ok(mb.pressProblems(src(props + '.r:active{transition-duration:var(--f-press);transform:scale(.97)}'), { rowSelectors: ['.r'] }).length);
  assert.deepEqual(mb.pressProblems(src(props + '.b:active{transition-duration:var(--f-press);transform:scale(var(--f-press-scale))}')), []);
});
