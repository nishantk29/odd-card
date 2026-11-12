// Copy gate (2026-10-28: all user-facing text is checked for AI wording). Shared lint vendored in test/kit/copy-lint.mjs.
// Scans the FAQ, the outcome text and every .js/.html file the site ships (tags stripped).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path';
import { lintCopy } from './kit/copy-lint.mjs';
import { FAQ } from '../public/js/faq.js';
import * as E from '../public/js/engine.js';

const pub = new URL('../public/', import.meta.url).pathname;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (['fonts', 'icons'].includes(e.name) ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]));

test('copy lint: FAQ and outcome text have no AI wording', () => {
  const script = Object.values(E.OUTCOME_TEXT).map(String);
  const strings = [...FAQ.flatMap((f) => [f.q, f.a, ...(f.steps || []), ...(f.list || [])]), ...script];
  const hits = strings.flatMap((s) => lintCopy(String(s)).map((i) => `${i} in "${String(s).slice(0, 50)}"`));
  assert.deepEqual(hits, []);
});

test('copy lint: every shipped .js/.html file (buttons, tips, narration)', () => {
  const hits = [];
  for (const f of walk(pub).filter((f) => /\.(js|html)$/.test(f) && !/(sw|qr)\.js$/.test(f))) {
    fs.readFileSync(f, 'utf8').replace(/<[^>]+>/g, ' ').split('\n').forEach((line, i) => { for (const x of lintCopy(line)) hits.push(`${path.relative(pub, f)}:${i + 1} ${x}`); });
  }
  assert.deepEqual(hits, []);
});

test('copy lint catches a planted phrase (the gate is live)', () => {
  assert.ok(lintCopy('Embark on a seamless night').length >= 2);
});
