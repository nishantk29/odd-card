// E2E (browser, Chromium): the menu pill at the foot of a game screen. It is visible and at least 44px at 390 and
// 1280 wide, sits above Next without covering it, opens the menu sheet (the sheet grows out of the pill), Escape closes
// it and gives focus back to the pill, the keyboard opens it too, and with reduced motion nothing moves.
// Serves public/ from disk (no Worker needed).   Run: node test/e2e/more-pill.e2e.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, ledger, DEVICES } from './phones.mjs';

const L = ledger('odd card more-pill e2e');
const ROOT = fileURLToPath(new URL('../../public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();

// A page with a local game in progress (round 1, deal screen).
async function gamePage(device, reducedMotion) {
  const ctx = await browser.newContext({ ...DEVICES[device], serviceWorkers: 'block', reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    let p = join(ROOT, decodeURIComponent(url.pathname)); if (url.pathname === '/' || !existsSync(p)) p = join(ROOT, 'index.html');
    return route.fulfill({ status: 200, body: readFileSync(p), contentType: TYPES[extname(p)] || 'application/octet-stream' });
  });
  await page.goto('http://odd.test/');
  await page.evaluate(async () => {
    const E = await import('/js/engine.js');
    localStorage.setItem('oddcard.v2', JSON.stringify({ view: 'game', game: E.createGame({ names: ['Ana', 'Bo', 'Cleo', 'Dev', 'Eli'], target: E.DEFAULT_TARGET, mode: 'classic' }) }));
  });
  await page.reload();
  await page.locator('.more-pill').waitFor({ timeout: 5000 });
  return { ctx, page, errors };
}
const dialog = (page) => page.evaluate(() => { const d = document.querySelector('#sheets [role="dialog"]'); return !!d && d.getClientRects().length > 0; });
const expanded = (page) => page.locator('.more-pill').getAttribute('aria-expanded');
const pillFocused = (page) => page.evaluate(() => document.activeElement?.classList.contains('more-pill'));

try {
  const { ctx, page, errors } = await gamePage('p390', 'no-preference');
  const box = await page.locator('.more-pill').boundingBox();
  const next = await page.locator('.dock .next').boundingBox();
  L.check('390: the pill is visible on the game screen', await page.locator('.more-pill').isVisible());
  L.check('390: the pill is at least 44x44', box.width >= 44 && box.height >= 44, `${box.width}x${box.height}`);
  L.check('390: the pill sits above Next without covering it', box.y + box.height <= next.y, `pill ends ${box.y + box.height}, Next starts ${next.y}`);
  L.check('390: the pill is inside the viewport', box.y + box.height <= 844 && box.x >= 0 && box.x + box.width <= 390);
  L.check('the pill says Host menu and keeps data-act="menu"', (await page.locator('.more-pill').innerText()).trim() === 'Host menu' && (await page.locator('.more-pill').getAttribute('data-act')) === 'menu');

  await page.click('.more-pill');
  const moving = await page.evaluate(() => document.querySelector('#sheets .sheet').getAnimations().some((a) => a.effect.getKeyframes().some((k) => k.transform && k.transform !== 'none')));
  L.check('click: the menu sheet opens (role=dialog visible)', await dialog(page));
  L.check('click: aria-expanded is true', (await expanded(page)) === 'true');
  L.check('click: the sheet grows out of the pill (a transform animation runs)', moving);
  L.check('click: focus moves into the sheet', await page.evaluate(() => !!document.activeElement?.closest('#sheets .sheet')));
  await sleep(350);
  await page.keyboard.press('Escape');
  L.check('Escape: the sheet closes', !(await dialog(page)));
  L.check('Escape: aria-expanded is false', (await expanded(page)) === 'false');
  L.check('Escape: focus is back on the pill', await pillFocused(page));
  await sleep(350);
  L.check('close: the shrinking copy is gone after the morph', (await page.locator('.more-ghost').count()) === 0);

  await page.keyboard.press('Enter');
  L.check('keyboard: Enter on the focused pill opens the sheet', await dialog(page));
  await page.click('#sheets [data-act="close"].mbtn'); await sleep(350);
  L.check('Close button: closes, focus back on the pill', !(await dialog(page)) && (await pillFocused(page)));
  L.check('no page errors (motion on)', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();

  const rm = await gamePage('p390', 'reduce');
  await rm.page.click('.more-pill');
  const anims = await rm.page.evaluate(() => document.querySelector('#sheets .sheet').getAnimations().filter((a) => a.effect.getKeyframes().some((k) => k.transform && k.transform !== 'none')).length);
  const tf = await rm.page.evaluate(() => getComputedStyle(document.querySelector('#sheets .sheet')).transform);
  L.check('reduced motion: the sheet opens', await dialog(rm.page));
  L.check('reduced motion: no transform animation, the sheet is already in place', anims === 0 && tf === 'none', `${anims} anims, transform ${tf}`);
  await rm.page.keyboard.press('Escape');
  L.check('reduced motion: Escape closes, no shrinking copy, focus on the pill', !(await dialog(rm.page)) && (await rm.page.locator('.more-ghost').count()) === 0 && (await pillFocused(rm.page)));
  await rm.ctx.close();

  const dt = await gamePage('d1280', 'reduce');
  const db = await dt.page.locator('.more-pill').boundingBox();
  L.check('1280: the pill is visible and at least 44px tall', (await dt.page.locator('.more-pill').isVisible()) && db.height >= 44 && db.width >= 44);
  await dt.ctx.close();
} catch (e) {
  L.check('suite ran to the end', false, String(e && e.message || e).split('\n')[0]);
} finally {
  await browser.close(); L.done();
}
