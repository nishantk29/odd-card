// E2E (browser, Chromium): the home screen's "All games" link and games footer (44px targets, keyboard focus shows the
// 3px ring), the menu sheet's accessible name and Escape, and the menu pill (700 weight, 48px, press scale only when
// motion is allowed). Serves public/ from disk (no Worker needed).   Run: node test/e2e/home-links.e2e.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, ledger, DEVICES } from './phones.mjs';

const L = ledger('odd card home-links e2e');
const ROOT = fileURLToPath(new URL('../../public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();

async function open(reducedMotion, game) {
  const ctx = await browser.newContext({ ...DEVICES.p390, serviceWorkers: 'block', reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'odd.test') return route.abort();
    let p = join(ROOT, decodeURIComponent(url.pathname)); if (url.pathname === '/' || !existsSync(p)) p = join(ROOT, 'index.html');
    return route.fulfill({ status: 200, body: readFileSync(p), contentType: TYPES[extname(p)] || 'application/octet-stream' });
  });
  await page.goto('http://odd.test/');
  if (game) {
    await page.evaluate(async () => {
      const E = await import('/js/engine.js');
      localStorage.setItem('oddcard.v2', JSON.stringify({ view: 'game', game: E.createGame({ names: ['Ana', 'Bo', 'Cleo', 'Dev', 'Eli'], target: E.DEFAULT_TARGET, mode: 'classic' }) }));
    });
    await page.reload();
    await page.locator('.more-pill').waitFor({ timeout: 5000 });
  } else await page.locator('.home .allgames').waitFor({ timeout: 5000 });
  return { ctx, page, errors };
}
const pressedTransform = async (page) => {
  const b = await page.locator('.more-pill').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await sleep(250);
  const t = await page.evaluate(() => getComputedStyle(document.querySelector('.more-pill')).transform);
  await page.mouse.up();
  return t;
};

try {
  // Home: family links
  {
    const { ctx, page, errors } = await open('no-preference', false);
    const all = page.locator('.home .allgames');
    const ab = await all.boundingBox();
    L.check('home: "All games" links to the hub', (await all.getAttribute('href')) === 'https://gamenight.hatethespurs.com' && (await all.innerText()).trim() === 'All games');
    L.check('home: "All games" is at least 44x44', ab.width >= 44 && ab.height >= 44, `${ab.width}x${ab.height}`);
    const items = await page.$$eval('.home footer.games li', (els) => els.map((li) => { const a = li.querySelector('a'), r = li.firstElementChild.getBoundingClientRect(); return { t: li.textContent.trim(), href: a?.getAttribute('href') || '', h: r.height, w: r.width }; }));
    L.check('footer: lists all five games', items.map((i) => i.t).join('|') === 'Mafia Night|Quest Night|The Gilded Chamber|Brass Wallet|The Odd Card', items.map((i) => i.t).join('|'));
    L.check('footer: four links, this game is not a link', items.filter((i) => i.href.startsWith('https://')).length === 4 && !items[4].href);
    L.check('footer: every item is at least 44px tall', items.every((i) => i.h >= 44 && i.w >= 44), JSON.stringify(items.map((i) => i.h)));
    L.check('390: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= 390));
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => { const el = document.activeElement, s = getComputedStyle(el); return { cls: el.className, w: s.outlineWidth, st: s.outlineStyle, off: s.outlineOffset }; });
    L.check('keyboard: Tab focuses "All games" first and shows a 3px ring, offset 3px', ring.cls === 'allgames' && ring.w === '3px' && ring.st === 'solid' && ring.off === '3px', JSON.stringify(ring));
    L.check('home: no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // Game: pill and the named menu sheet
  {
    const { ctx, page, errors } = await open('no-preference', true);
    const pill = page.locator('.more-pill');
    const pb = await pill.boundingBox();
    L.check('pill: weight 700 and at least 48px tall', (await pill.evaluate((el) => getComputedStyle(el).fontWeight)) === '700' && pb.height >= 48, `${pb.height}`);
    const t = await pressedTransform(page);
    L.check('motion allowed: pressing the pill scales it', t !== 'none', t);
    await page.waitForSelector('#sheets [role="dialog"]');
    L.check('menu sheet: role=dialog is named by its title', (await page.getAttribute('#sheets [role="dialog"]', 'aria-label')) === 'Host Menu');
    await page.locator('#sheets [data-act="faq"]').click();
    await page.waitForSelector('#sheets [role="dialog"][aria-label="Rules & FAQ"]');
    L.check('FAQ sheet: named "Rules & FAQ"', true);
    await page.keyboard.press('Escape');
    await sleep(350);
    L.check('Escape: the sheet closes', await page.evaluate(() => !document.querySelector('#sheets [role="dialog"]')));
    L.check('game: no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // Reduced motion: the press does not move
  {
    const { ctx, page } = await open('reduce', true);
    const t = await pressedTransform(page);
    L.check('reduced motion: pressing the pill does not scale it', t === 'none', t);
    L.check('reduced motion: the press still opens the menu', !!(await page.waitForSelector('#sheets [role="dialog"][aria-label="Host Menu"]', { timeout: 3000 }).catch(() => null)));
    await ctx.close();
  }
} catch (e) {
  L.check('run completed', false, String(e?.stack || e));
} finally {
  await browser.close(); L.done();
}
