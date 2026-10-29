// E2E (browser, Chromium): Back (page.goBack(), as Android Back or the iOS edge swipe) closes the open sheet first.
// Covers: the home FAQ sheet, the host's preset preview sheet in setup, a guest's phone menu; a sheet closed by a tap
// leaves no extra entry (one Back leaves); Back is never trapped (the next Back leaves); the round still starts.
// Run: node test/e2e/back-nav.e2e.mjs   (starts wrangler dev)   |   BASE=https://oddcard.hatethespurs.com node test/e2e/back-nav.e2e.mjs
import { server, launch, phone, ledger, checkPhones } from './phones.mjs';

const L = ledger('odd card back-nav e2e');
const srv = await server(new URL('../..', import.meta.url).pathname);
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const layer = (p) => p.page.evaluate(() => [...document.querySelectorAll('#sheets [aria-modal="true"]')].filter((x) => x.getClientRects().length).length);
const back = async (p) => { await p.page.goBack({ timeout: 5000 }).catch(() => {}); await sleep(500); };
const all = [];
try {
  const v = await phone(browser, srv.base, 'visitor'); all.push(v);
  await v.goto('/');
  await v.page.click('[data-act="faq"]'); await sleep(300);
  L.check('home: the FAQ sheet opens', (await layer(v)) === 1);
  await back(v);
  L.check('home: Back closes it and stays on the site', (await layer(v)) === 0 && v.page.url().startsWith(srv.base), v.page.url());
  await v.page.click('[data-act="faq"]'); await sleep(300);
  await v.page.mouse.click(195, 20); await sleep(300);
  L.check('home: a tap on the backdrop closes it', (await layer(v)) === 0);
  await back(v);
  L.check('home: after a tap-close, one Back leaves (no leftover entry)', !v.page.url().startsWith(srv.base), v.page.url());

  const host = await phone(browser, srv.base, 'host'); all.push(host);
  await host.goto('/');
  await host.page.click('[data-act="play"]');
  const code = await host.page.locator('.code').first().getAttribute('data-code', { timeout: 15000 });
  const g = await phone(browser, srv.base, 'guest'); all.push(g);
  await g.goto(`/?room=${code}`);
  await g.page.fill('[data-pin="name"]', 'Guest1'); await g.page.click('[data-pa="join"]');
  await g.page.locator('.pill', { hasText: `Room ${code}` }).waitFor({ timeout: 15000 });
  for (const n of ['Guest2', 'Guest3']) { // a round needs 4 players
    const q = await phone(browser, srv.base, n.toLowerCase()); all.push(q);
    await q.goto(`/?room=${code}`);
    await q.page.fill('[data-pin="name"]', n); await q.page.click('[data-pa="join"]');
    await q.page.locator('.pill', { hasText: `Room ${code}` }).waitFor({ timeout: 15000 });
  }
  await g.page.click('[data-act="pmenu"]'); await sleep(300);
  L.check('guest: the phone menu opens', (await layer(g)) === 1);
  await back(g);
  L.check('guest: Back closes it and stays in the room', (await layer(g)) === 0 && (await g.page.locator('.pill', { hasText: `Room ${code}` }).count()) > 0);
  await g.page.click('[data-act="pmenu"]'); await sleep(300);
  await back(g); await back(g);
  L.check('guest: the next Back leaves (never trapped)', !g.page.url().startsWith(srv.base), g.page.url());
  await g.page.goForward().catch(() => {}); await sleep(2500);
  L.check('guest: Forward brings the room back', (await g.page.locator('.pill', { hasText: `Room ${code}` }).count()) > 0);

  await host.page.locator('.pchip').nth(3).waitFor({ timeout: 10000 });
  await host.page.click('.su [data-su="next"]'); await sleep(400);
  await host.page.click('[data-su="presets"]');
  await host.page.click('[data-su="preview"][data-id="quick-hand"]');
  await host.page.locator('.su-sheet').waitFor();
  await back(host);
  L.check('host: Back closes the preset preview and keeps the presets page', (await host.page.locator('.su-sheet').count()) === 0 && (await host.page.locator('.pg').count()) > 0);
  await host.page.click('[data-su="preview"][data-id="quick-hand"]');
  await host.page.click('[data-su="usepreset"]');
  await host.page.locator('.su .panel[data-step="1"]').waitFor();
  L.check('host: Use this still picks the preset', /Quick Hand/.test(await host.page.locator('.panel[data-step="1"]').innerText()));
  await host.page.click('.su [data-su="next"]'); await sleep(400);
  await host.page.click('.su [data-su="next"]'); await sleep(400);
  await host.page.click('.su [data-su="start"]');
  await host.page.locator('main[data-phase="pass"]').waitFor({ timeout: 15000 }).catch(() => {});
  L.check('host: the round still starts after the Backs', (await host.page.locator('main[data-phase="pass"]').count()) > 0);
  await checkPhones(L, all, 'after Backs');
} catch (e) {
  L.check('suite ran to the end', false, String(e && e.message || e).split('\n')[0]);
} finally {
  await browser.close(); srv.stop(); L.done();
}
