// E2E (browser, Chromium): The Odd Card on three screens (390 and 375 phones, 1280 desktop) on the shared harness (phones.mjs).
// Single device, no server state: home, setup, deal round 1, step through the round, a reload keeps the game (Resume),
// the FAQ opens, the installed copy opens offline (service worker on), and no console errors or sideways scroll.
// Run: node test/e2e/phones.e2e.mjs                 (starts wrangler dev from this repo)
//      BASE=https://<live host> node test/e2e/phones.e2e.mjs   (live smoke, read-only)
// Shots: SHOTS=<dir>. Exit 1 on any failure.
import { fileURLToPath } from 'node:url';
import { ledger, server, launch, phone, checkPhones, DEVICES } from './phones.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SHOTS = process.env.SHOTS || '';
const L = ledger('odd card phones e2e');
const srv = await server(ROOT);
const browser = await launch();
const all = [];
const eyebrow = (p) => p.page.locator('.eyebrow').first().innerText({ timeout: 3000 }).catch(() => '');
try {
  for (const dev of /** @type {(keyof typeof DEVICES)[]} */ (['p390', 'p375', 'd1280'])) {
    const p = await phone(browser, srv.base, dev, dev); all.push(p);
    await p.goto('/');
    await p.page.locator('[data-act="play"]').waitFor({ timeout: 10000 });
    L.check(`${dev}: home shows New game`, await p.page.locator('[data-act="play"]').isVisible());
    await checkPhones(L, [p], `${dev} home`);
    await p.page.locator('[data-act="play"]').click();
    await p.page.locator('[data-act="start"]').waitFor({ timeout: 5000 });
    L.check(`${dev}: setup starts with 5 seats`, (await p.page.locator('input[data-name]').count()) === 5);
    await p.page.locator('[data-act="start"]').click();
    const seen = [await eyebrow(p)];
    L.check(`${dev}: Deal round 1 opens the deal screen`, /Round 1/.test(seen[0]), seen[0]);
    if (SHOTS) await p.shot(SHOTS, `odd-${dev}-deal`);
    await checkPhones(L, [p], `${dev} deal`);
    for (let i = 0; i < 3; i++) {
      const next = p.page.locator('[data-act="next"]');
      if (!(await next.count())) break;
      await next.first().click(); seen.push(await eyebrow(p));
      await checkPhones(L, [p], `${dev} step ${i + 1} (${seen.at(-1) || 'no eyebrow'})`);
    }
    L.check(`${dev}: Next moves the round on`, new Set(seen).size > 1, seen.join(' → '));
    await p.page.reload({ waitUntil: 'domcontentloaded' });
    await p.page.waitForTimeout(300);
    const kept = (await eyebrow(p)) === seen.at(-1) || (await p.page.locator('[data-act="resume"]').count()) > 0;
    L.check(`${dev}: a reload keeps the game`, kept, await eyebrow(p));
  }
  // FAQ from home, on a fresh phone (the others now open straight into their saved game).
  const p = await phone(browser, srv.base, 'faq'); all.push(p);
  await p.goto('/'); await p.page.locator('.home [data-act="faq"]').first().click();
  await p.page.locator('input[type="search"], #sheets input').first().waitFor({ timeout: 5000 }).catch(() => {});
  L.check('the FAQ opens from home', (await p.page.locator('#sheets').innerText()).length > 40);
  await checkPhones(L, all, 'all screens');

  // Installed copy: with the service worker on, the game opens with no network.
  const ctx = await browser.newContext({ ...DEVICES.p390, reducedMotion: 'reduce' });
  const off = await ctx.newPage(); const offErr = [];
  off.on('pageerror', (e) => offErr.push(e.message));
  await off.goto(srv.base + '/', { waitUntil: 'load' });
  await off.evaluate(() => navigator.serviceWorker.ready);
  await off.reload({ waitUntil: 'load' });
  await off.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  await off.waitForTimeout(1500);
  await ctx.setOffline(true);
  await off.reload({ waitUntil: 'load' }).catch(() => {});
  const ok = await off.locator('[data-act="play"]').count().catch(() => 0);
  L.check('offline, the installed game still opens', ok > 0);
  L.check('offline: no page errors', offErr.length === 0, offErr.slice(0, 2).join(' | '));
  await ctx.close();
} catch (e) {
  L.check('suite ran to the end', false, String(e && e.message || e).split('\n')[0]);
} finally {
  await browser.close(); srv.stop(); L.done();
}
