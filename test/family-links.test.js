// Home screen family links, the menu sheet's name, the focus ring and the menu pill (cross-site review, 2026-11-21).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUB, GAMES, allGamesLink, gamesFooter } from '../public/js/games.js';

const read = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const app = read('js/app.js');
const css = read('styles.css');

test('games.js: hub link plus all five games; this game is marked, not linked', () => {
  assert.equal(HUB, 'https://gamenight.hatethespurs.com');
  assert.deepEqual(GAMES.map((g) => g.name), ['Mafia Night', 'Quest Night', 'The Gilded Chamber', 'Brass Wallet', 'The Odd Card']);
  assert.deepEqual(GAMES.slice(0, 4).map((g) => g.url), ['https://mafia.hatethespurs.com', 'https://avalon.hatethespurs.com', 'https://gilded.hatethespurs.com', 'https://brass.hatethespurs.com']);
  assert.equal(allGamesLink('<svg></svg>'), '<a class="allgames" href="https://gamenight.hatethespurs.com"><svg></svg><span>All games</span></a>');
  const f = gamesFooter();
  assert.equal((f.match(/<li>/g) || []).length, 5);
  assert.equal((f.match(/<a href="https:/g) || []).length, 4);
  assert.match(f, /<span aria-current="page">The Odd Card<\/span>/);
  assert.match(f, /^<footer class="games">/);
});

test('home screen renders the All games link and the games footer', () => {
  const home = app.slice(app.indexOf('function homeHTML'), app.indexOf('function dealBody'));
  assert.match(home, /<main class="wrap home">\$\{allGamesLink\(icons\.back\(\)\)\}<header>/);
  assert.match(home, /<\/div>\$\{gamesFooter\(\)\}<\/main>/);
  // every family link is a 44px tap target
  assert.match(css, /\.allgames\{[^}]*min-height:44px/);
  assert.match(css, /\.games :is\(a,span\)\{[^}]*min-height:44px/);
});

test('menu sheets: role=dialog takes its aria-label from the sheet title', () => {
  const src = app.slice(app.indexOf('function sheetsHTML'));
  const m = /const title = (\/.*\/)\.exec\(body\)/.exec(src);
  assert.ok(m, 'title is read from the sheet body');
  assert.match(src, /role="dialog" aria-modal="true" aria-label="\$\{title\}"/);
  const re = new RegExp(m[1].slice(1, -1));
  assert.equal(re.exec('<h2>Host Menu</h2><div class="menu">')[1], 'Host Menu');
  assert.equal(re.exec('<h2>Rules &amp; FAQ</h2><div>')[1], 'Rules &amp; FAQ');
});

test('focus ring: :focus-visible on every focusable, 3px, offset 3px (inset where .qa clips)', () => {
  assert.match(css, /(^|\n):focus-visible\{outline:3px solid var\(--ivory\);outline-offset:3px\}/);
  assert.doesNotMatch(css, /outline:4px/);
  assert.doesNotMatch(css, /button:focus-visible,input:focus-visible/);
  assert.match(css, /\.qa\{[^}]*overflow:hidden/);
  assert.match(css, /\.qa summary:focus-visible\{outline-offset:-3px\}/);
});

test('menu pill: weight 700, min-height 48px, press scale only under prefers-reduced-motion:no-preference', () => {
  const rule = /\n\.more-pill\{([^}]*)\}/.exec(css)[1];
  assert.match(rule, /font-weight:700/);
  assert.match(rule, /min-height:48px/);
  assert.equal((css.match(/\.more-pill:active\{transform/g) || []).length, 1);
  assert.match(css, /\n@media \(prefers-reduced-motion:no-preference\)\{\.more-pill:active\{transform:scale\(var\(--f-press-scale\)\)\}\}/);
});
