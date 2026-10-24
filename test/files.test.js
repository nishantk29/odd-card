import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { FAQ, faqResults } from '../public/js/faq.js';

const pub = new URL('../public/', import.meta.url).pathname;
const jsDir = join(pub, 'js');
const html = readFileSync(join(pub, 'index.html'), 'utf8');

test('index.html references only existing local files', () => {
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]).filter(u => u.startsWith('/'));
  assert.ok(refs.length >= 3);
  for (const u of refs) assert.ok(existsSync(join(pub, u)), `missing ${u}`);
  const css = readFileSync(join(pub, 'styles.css'), 'utf8');
  for (const m of css.matchAll(/url\("([^"]+)"\)/g)) assert.ok(existsSync(join(pub, m[1])), `missing ${m[1]}`);
});

test('every public/js module is imported somewhere (or is the html entry)', () => {
  const mods = readdirSync(jsDir).filter(f => f.endsWith('.js'));
  const entries = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => resolve(pub, '.' + m[1]));
  const imported = new Set(entries);
  for (const f of mods) {
    for (const m of readFileSync(join(jsDir, f), 'utf8').matchAll(/from\s+'(\.[^']+)'/g)) imported.add(resolve(jsDir, m[1]));
  }
  for (const f of mods) assert.ok(imported.has(join(jsDir, f)), `${f} is not imported anywhere`);
  for (const p of imported) assert.ok(existsSync(p), `import target missing: ${p}`);
});

test('no network calls or external resources in the app', () => {
  for (const f of readdirSync(jsDir)) {
    if (f === 'phones.js') continue; // Phones mode: the only module that talks to the room server (same-origin /api and /ws)
    const src = readFileSync(join(jsDir, f), 'utf8');
    assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|https?:\/\//.test(src.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), `${f} touches the network`);
  }
  assert.ok(!/https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')));
});

const css = readFileSync(join(pub, 'styles.css'), 'utf8');
const appSrc = readFileSync(join(jsDir, 'app.js'), 'utf8');

test('regression: flat mode does not override score bar widths', () => {
  assert.ok(!/\.fill\{[^}]*transform:none/.test(css));
});

test('regression: scoreboard SPY badge sits outside the ellipsised name', () => {
  assert.match(appSrc, /<span class="nt">\$\{esc\(g\.names\[i\]\)\}<\/span>\$\{r\.spies/);
  assert.match(css, /\.srow \.nm \.nt\{[^}]*text-overflow:ellipsis/);
  assert.ok(!/\.srow \.nm\{[^}]*text-overflow/.test(css));
});

test('regression: Add player picks an unused default seat name', () => {
  assert.match(appSrc, /while \(S\.setup\.names\.includes\(`Seat \$\{k\}`\)\) k\+\+/);
});

test('regression: winhome keeps target as well as names', () => {
  assert.match(appSrc, /winhome\(\) \{[^}]*S\.setup\.target = G\(\)\.target/);
});

test('FAQ: 12+ entries, search is case-insensitive with <mark> highlights', () => {
  assert.ok(FAQ.length >= 12);
  assert.equal(faqResults('').match(/<details/g).length, FAQ.length);
  const hit = faqResults('ODD CARD');
  assert.match(hit, /<mark>odd card<\/mark>/i);
  assert.ok(hit.match(/<details/g).length >= 5);
  assert.match(faqResults('zzzxqq'), /No matches/);
  assert.ok(faqResults('<b>').includes('No matches'));
});

test('FAQ: steps and lists render as real <ol>/<ul> and are searchable', () => {
  const all = faqResults('');
  assert.ok((all.match(/<ol>/g) || []).length >= 4);
  assert.ok((all.match(/<ul>/g) || []).length >= 3);
  assert.match(all, /<ol><li>.*<\/li><\/ol>/);
  assert.match(faqResults('add to home screen'), /<ol>[\s\S]*Add to Home Screen[\s\S]*<\/ol>/);
  for (const f of FAQ) assert.ok(!/\d\. .* \d\. /.test(f.a || ''), `${f.q} has numbered steps inside one paragraph`);
});

test('FAQ covers setup, modes, pass-the-phone, clues, voting, scoring, offline and the card guide', () => {
  const qs = FAQ.map(f => f.q.toLowerCase()).join(' | ');
  for (const w of ['set up', 'classic and grid', 'passing the phone', 'two cards look', 'clues', 'vote', 'scored', 'without internet']) assert.ok(qs.includes(w), w);
  const off = FAQ.find(f => /without internet/.test(f.q));
  assert.ok(off.steps.length >= 4);
  assert.ok(off.steps.some(x => /Add to Home Screen/.test(x)) && off.steps.some(x => /Install app/.test(x)));
});

test('removed eyes-open night: no copy mentions it anywhere', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  for (const [name, src] of [['app', appSrc], ['faq', readFileSync(join(jsDir, 'faq.js'), 'utf8')], ['readme', readme]]) {
    assert.ok(!/open your eyes|close your eyes|who opened|TOGGLE_OPENED|storyteller|chameleon|spyfall/i.test(src), name);
  }
});

test('Phones mode talks only to its own origin', () => {
  const src = readFileSync(join(jsDir, 'phones.js'), 'utf8');
  assert.ok(!/https?:\/\//.test(src));
  assert.ok(/fetch\(`\/api\//.test(src) && /fetch\('\/api\/create'/.test(src));
});

test('hold-to-reveal: one shared card template for both roles and both modes, one haptic call', () => {
  const hold = readFileSync(join(jsDir, 'holdcard.js'), 'utf8');
  const phonesSrc = readFileSync(join(jsDir, 'phones.js'), 'utf8');
  assert.equal((hold.match(/class="holdcard"/g) || []).length, 1);
  assert.equal((appSrc.match(/class="holdcard"/g) || []).length + (phonesSrc.match(/class="holdcard"/g) || []).length, 0);
  assert.ok(/v\.secret\.odd \? 'You’re the Odd Card' : v\.secret\.word/.test(phonesSrc));
  assert.ok(/r\.spies\.includes\(r\.pass\) \? 'You’re the Odd Card' : r\.word/.test(appSrc));
  assert.equal((hold.match(/navigator\.vibrate/g) || []).length, 2); // guard + call, in buzz()
  assert.equal((appSrc.match(/navigator\.vibrate/g) || []).length + (phonesSrc.match(/navigator\.vibrate/g) || []).length, 0);
  assert.match(hold, /export const buzz = \(\) => \{ try \{ if \(cfg\.haptics\(\) && navigator\.vibrate\)/);
  assert.match(css, /\.hc-front strong\{[^}]*min-height/);
});

test('platform: wake lock re-acquired on visibility, v2 storage key, overflow-x clip, reduced motion', () => {
  assert.match(appSrc, /navigator\.wakeLock\.request\('screen'\)/);
  assert.match(appSrc, /visibilitychange', \(\) => \{[^}]*wake\(\)/);
  assert.match(appSrc, /const KEY = 'oddcard\.v2'/);
  assert.match(appSrc, /validGame\(S\.game\)/);
  assert.match(css, /html\{[^}]*overflow-x:clip/);
  assert.match(css, /body\{[^}]*overflow-x:clip/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('animations toggle lives in Settings, not the Host menu', () => {
  const menu = appSrc.slice(appSrc.indexOf('function menuSheet'), appSrc.indexOf('function settingsSheet'));
  assert.ok(!/data-act="anim"/.test(menu));
  assert.match(appSrc.slice(appSrc.indexOf('function settingsSheet')), /sw\('anim'/);
});

test('home has Rules & FAQ card and a 4-step How to Play list', () => {
  const home = appSrc.slice(appSrc.indexOf('function homeHTML'), appSrc.indexOf('function setupHTML'));
  assert.match(home, /class="rulescard" data-act="faq"/);
  assert.equal((home.match(/<li><b>/g) || []).length, 4);
});
