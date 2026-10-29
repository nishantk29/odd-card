// Polish e2e (Oct 28 sweep). Serves public/ in-process; game state goes straight into localStorage, built with public/js/engine.js.
// Checks: the vote's Tie button is readable on the gold stage; the longest secret words stay on one line on a phone; a setup
// name field is not covered by the Deal button with a phone keyboard up.   usage: node tools/polish.e2e.mjs [repoDir]
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire('/workspace/forge/pw/');
const { chromium } = require('playwright-core');
const repo = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(repo, 'public');
const E = await import(path.join(repo, 'public/js/engine.js'));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const serve = (route) => { const u = new URL(route.request().url()); const f = path.join(pub, u.pathname === '/' ? '/index.html' : u.pathname);
  if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: 'nf' });
  return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f), headers: { 'cache-control': 'no-store' } }); };
const N = { type: 'NEXT' }; const NAMES = ['Ana', 'Ben', 'Cal', 'Dee', 'Eve'];
const toPhase = (phase) => { let g = E.createGame({ names: NAMES, target: 6, seed: 42 });
  for (let i = 0; i < 40 && g.phase !== phase; i++) { if (g.phase === 'night' && E.NIGHT[g.round.step].screen === 'pick' && !E.nightPickReady(g)) g = E.apply(g, { type: 'TOGGLE_OPENED', seat: 1 });
    else if (g.phase === 'vote') g = E.apply(g, { type: 'VOTE', seat: g.round.spies[0] }); else g = E.apply(g, N); }
  if (g.phase !== phase) throw new Error('could not reach ' + phase); return g; };
const atNightWord = () => { let g = E.createGame({ names: NAMES, target: 6, seed: 42 }); g = E.apply(g, N); g = E.apply(g, N); return g; }; // night step 1: red cards see the word
async function open(browser, w, state, h = 844) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.on('pageerror', (e) => console.log('pageerror', e.message)); await page.route('**/*', serve);
  await page.addInitScript((s) => localStorage.setItem('oddcard.v1', s), JSON.stringify(state));
  await page.goto('http://game.test/'); await page.waitForTimeout(900); return { page, ctx };
}
const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const results = []; const check = (name, pass, info) => { results.push(pass); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name} ${JSON.stringify(info)}`); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const game = (g) => ({ view: 'game', setup: { names: NAMES, target: 6 }, game: g, anim: false });
// 1. Tie button contrast on the gold vote stage
{ const { page, ctx } = await open(browser, 390, game(toPhase('vote')));
  const c = await page.$eval('.pbtn.tie', (e) => ({ fg: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
  const a = c.bg.match(/[\d.]+/g).map(Number)[3] ?? 1; const ratio = a < 0.9 ? 1 : (Math.max(lum(c.fg), lum(c.bg)) + .05) / (Math.min(lum(c.fg), lum(c.bg)) + .05);
  check('Tie button readable (4.5:1, solid fill)', ratio >= 4.5, { ...c, ratio: +ratio.toFixed(2) }); await ctx.close(); }
// 2. the longest secret words stay whole on one line (guess card and the night word card), 320 to 390 wide
for (const w of [320, 375, 390]) for (const word of ['Snowstorm', 'Thanksgiving', 'Photographer']) for (const where of ['guess', 'night']) {
  const g = where === 'guess' ? toPhase('guess') : atNightWord(); g.round.word = word;
  const { page, ctx } = await open(browser, w, game(g));
  const r = await page.$eval('.wordcard strong', (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const lines = new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size; return { lines, size: getComputedStyle(e).fontSize, fits: e.scrollWidth <= e.clientWidth + 1 }; });
  check(`"${word}" on one line on the ${where} card at ${w}`, r.lines === 1 && r.fits && parseFloat(r.size) >= 28, r); await ctx.close(); }
// 3. short words keep their full size (no visual change for most words)
{ const g = toPhase('guess'); g.round.word = 'Cake'; const { page, ctx } = await open(browser, 390, game(g));
  const s = await page.$eval('.wordcard strong', (e) => parseFloat(getComputedStyle(e).fontSize)); check('short words keep their size at 390', Math.abs(s - 54.6) < 1, { s }); await ctx.close(); }
// 4. typing a name in setup: the Deal button doesn't cover the field above the keyboard, and comes back after
for (const w of [375, 390]) {
  const { page, ctx } = await open(browser, w, { view: 'setup', setup: { names: NAMES, target: 6 } });
  await page.focus('[data-name="4"]');
  const r = await page.evaluate(() => { const f = document.activeElement; const kbTop = innerHeight * 0.55, shift = innerHeight - kbTop; window.scrollBy(0, f.getBoundingClientRect().bottom - (kbTop - 8)); const fr = f.getBoundingClientRect();
    const d = document.querySelector('.dock'); const s = getComputedStyle(d); if (s.display === 'none') return { cov: false }; const b = d.getBoundingClientRect();
    const pinned = b.bottom >= innerHeight - 2; return { cov: pinned && b.top - shift < fr.bottom - 2 && b.bottom - shift > fr.top + 2 }; });
  check(`setup field not covered while typing at ${w}`, !r.cov, r);
  await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(150);
  const back = await page.$eval('.dock', (d) => getComputedStyle(d).display !== 'none'); check(`Deal button back after typing at ${w}`, back, { back }); await ctx.close();
}
await browser.close();
const fail = results.filter((x) => !x).length; console.log(`${results.length - fail} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
