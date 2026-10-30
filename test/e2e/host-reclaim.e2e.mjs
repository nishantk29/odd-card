// E2E (engine-1030 audit O1): the Host's phone loses its seat mid-game (a bad token after a storage mix-up) and gets it
// back with the host key it still holds. Before the fix the room was stuck: nobody could tap Start clues or Next.
//   node test/e2e/host-reclaim.e2e.mjs   (starts wrangler dev --local itself; BASE=... to use a running Worker)
import { server, launch, phone, ledger, checkPhones } from './phones.mjs';

const L = ledger('odd card host reclaim e2e');
const srv = await server(new URL('../..', import.meta.url).pathname);
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const phase = (p) => p.page.locator('main[data-phase]').first().getAttribute('data-phase').catch(() => null);
const waitPhase = async (p, ph, t = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if ((await phase(p)) === ph) return true; await sleep(100); } return false; };
const all = [];
try {
  const host = await phone(browser, srv.base, 'host'); all.push(host);
  await host.goto('/');
  await host.page.click('[data-act="play"]');
  const code = await host.page.locator('.code').first().getAttribute('data-code', { timeout: 15000 });
  for (let i = 0; i < 3; i++) {
    const g = await phone(browser, srv.base, `guest${i + 1}`); all.push(g);
    await g.goto(`/?room=${code}`);
    await g.page.fill('[data-pin="name"]', `Guest${i + 1}`);
    await g.page.click('[data-pa="join"]');
    await g.page.locator('.pill', { hasText: `Room ${code}` }).waitFor({ timeout: 15000 });
  }
  await host.page.locator('.pchip').nth(3).waitFor({ timeout: 10000 });
  for (let i = 0; i < 3; i++) { await host.page.click('.su [data-su="next"]'); await sleep(400); }
  await host.page.click('.su [data-su="start"]');
  for (const p of all) L.check(`${p.name} reaches the card screen`, await waitPhase(p, 'pass'));

  // The Host's seat is lost: the stored token no longer matches (the server answers "fatal, clear").
  const kept = await host.page.evaluate((c) => { const k = `oddcard.player.${c}`; const rec = JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify({ ...rec, token: 'lost' })); return !!localStorage.getItem(`oddcard.host.${c}`); }, code);
  L.check('the host phone still holds the host key', kept);
  await host.page.reload({ waitUntil: 'domcontentloaded' });
  await host.page.locator('[data-pin="name"]').waitFor({ timeout: 15000 });
  L.check('the bad token sends the host phone to the join form', true);
  await host.page.fill('[data-pin="name"]', 'Host again');
  await host.page.click('[data-pa="join"]');
  L.check('the host phone is back on the card screen', await waitPhase(host, 'pass'));
  const begin = host.page.locator('[data-pa="begin"]');
  await begin.waitFor({ timeout: 8000 }).catch(() => {});
  L.check('it is the Host again: Start clues is on its dock', (await begin.count()) === 1);
  // the Host looks at their own card first (Start clues stays off until then), as at any table
  const card = host.page.locator('.holdcard[data-hold="me"]'); await card.waitFor({ timeout: 8000 });
  const b = await card.boundingBox();
  await host.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await host.page.mouse.down(); await sleep(450); await host.page.mouse.up(); await sleep(150);
  await begin.click({ timeout: 8000 });
  for (const p of all) L.check(`${p.name} moves on to the clues`, await waitPhase(p, 'clues'));
  await checkPhones(L, all, 'after the host came back');
} catch (e) {
  L.check('no crash', false, e.message);
} finally {
  await browser.close().catch(() => {});
  srv.stop();
  L.done();
}
