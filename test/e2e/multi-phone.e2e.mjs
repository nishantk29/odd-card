// Multi-phone e2e: a Host and 4 phones in one room through a local Worker, then One phone and Mixed seating.
//   BASE=http://127.0.0.1:8956 SHOTS=/path/to/shots node test/e2e/multi-phone.e2e.mjs   (BASE unset: starts a local Worker itself)
// Asserts: each phone sees only its own secret (and only while held), the Odd Card phone sees the odd text, the server never
// sends the word to the Odd Card's socket during the round, a reload mid-round rejoins the same card, a full game plays to the
// winner, no console errors, no sideways scroll at 390x844, 375x667 and 1280x800.
import { server, launch, phone, ledger, checkPhones } from './phones.mjs';

const L = ledger('odd card multi-phone e2e');
const SHOTS = process.env.SHOTS || '';
const ODD = 'You are the Odd Card';
const PLAY = ['pass', 'clues', 'vote', 'reveal', 'guess'];
const srv = await server(new URL('../..', import.meta.url).pathname);
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, f) => (SHOTS ? p.shot(SHOTS, f) : Promise.resolve());

// ---- helpers -------------------------------------------------------------------------------------------
async function holdRead(p, key = 'me', ms = 450) {
  const card = p.page.locator(`.holdcard[data-hold="${key}"]`);
  await card.waitFor({ state: 'visible', timeout: 8000 });
  const b = await card.boundingBox();
  await p.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.page.mouse.down();
  await sleep(ms);
  const front = await p.page.locator(`.holdcard[data-hold="${key}"] .hc-front`).innerText();
  await p.page.mouse.up();
  await sleep(60);
  return front.replace(/\s+/g, ' ').trim();
}
const wordOf = (t) => (t.match(/^Category: .+? (\S.*?) Let go to hide it\.$/) || [])[1] || t;
const phase = (p) => p.page.locator('main[data-phase]').first().getAttribute('data-phase').catch(() => null);
const waitPhase = async (p, ph, t = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if ((await phase(p)) === ph) return true; await sleep(100); } return false; };
const frames = (p) => { p.frames = []; p.page.on('websocket', (ws) => ws.on('framereceived', (f) => { p.frames.push(String(f.payload)); })); };
const html = (p) => p.page.evaluate(() => document.documentElement.outerHTML);
const faceEmpty = (h) => !/class="hc-front"[^>]*>\s*[^<\s]/.test(h);
const next = (p) => p.page.click('.su [data-su="next"]');

async function hostRoom(host, nGuests, base) {
  await host.goto('/');
  await host.page.click('[data-act="play"]');
  const code = await host.page.locator('.code').first().getAttribute('data-code', { timeout: 15000 });
  const guests = [];
  for (let i = 0; i < nGuests; i++) {
    const g = await phone(browser, base, `guest${i + 1}`); frames(g);
    await g.goto(`/?room=${code}`);
    await g.page.fill('[data-pin="name"]', `Guest${i + 1}`);
    await g.page.click('[data-pa="join"]');
    await g.page.locator('.pill', { hasText: `Room ${code}` }).waitFor({ timeout: 15000 });
    guests.push(g);
  }
  return { code, guests };
}

// ---- A. own phones: host + 4 phones --------------------------------------------------------------------
const host = await phone(browser, srv.base, 'host'); frames(host);
const { code, guests } = await hostRoom(host, 4, srv.base);
const all = [host, ...guests];
L.check('room code is 6 letters', /^[A-Z]{6}$/.test(code), code);
await host.page.locator('.pchip').nth(4).waitFor({ timeout: 10000 });
L.check('step 1 lists the host and 4 joined phones', (await host.page.locator('.pchip').count()) === 5);
L.check('step 1 shows "Step 1 of 4: Players" and the code', /Step 1 of 4: Players/.test(await host.text()) && (await host.text()).includes(code));
await shot(host, 'setup-1-players-390');
await next(host);
await host.page.locator('.panel[data-step="1"] h1').waitFor();
await sleep(400);
L.check('step 2 is Round with Opening Hand preselected', /Opening Hand/.test(await host.page.locator('.panel[data-step="1"]').innerText()));
await shot(host, 'setup-2-round-390');
await host.page.click('[data-su="presets"]');
await host.page.locator('.pg').waitFor();
const names = await host.page.locator('.pre h2').allInnerTexts();
L.check('presets page lists the six names in order', JSON.stringify(names) === JSON.stringify(['Opening Hand', 'Quick Hand', 'The Grid', 'Long Game', 'Crowded Table', 'Full Grid']), names.join(','));
L.check('Crowded Table is dimmed with "Needs 8+ players" at 5 players', /Needs 8\+ players/.test(await host.page.locator('.pre.off').first().innerText()));
await shot(host, 'presets-390');
await host.page.click('[data-su="preview"][data-id="quick-hand"]');
await host.page.locator('.su-sheet').waitFor();
await shot(host, 'preset-preview-390');
await host.page.click('[data-su="usepreset"]');
await host.page.locator('.su .panel[data-step="1"]').waitFor();
L.check('Use this picks Quick Hand', /Quick Hand/.test(await host.page.locator('.panel[data-step="1"]').innerText()));
await next(host); await sleep(400);
L.check('step 3 preselects Own phones (everyone joined)', (await host.page.locator('.opt.on b').innerText()) === 'Own phones');
await shot(host, 'setup-3-seating-390');
await next(host); await sleep(400);
L.check('step 4 summary names the round', /Quick Hand/.test(await host.page.locator('.panel[data-step="3"]').innerText()));
await shot(host, 'setup-4-start-390');
await host.page.click('.su details.adv summary'); await sleep(100);
await shot(host, 'setup-4-advanced-390');
await host.page.click('.su details.adv summary');
await checkPhones(L, all, 'setup');
await host.page.click('.su [data-su="start"]');
for (const p of all) L.check(`${p.name} reaches the card screen`, await waitPhase(p, 'pass'));

// secrets: hold each card once and read it
const secret = {};
for (const p of all) {
  const idle = await html(p);
  secret[p.name] = await holdRead(p);
  L.check(`${p.name}: card face is empty when not held`, faceEmpty(idle));
}
const oddOnes = all.filter((p) => secret[p.name].includes(ODD));
L.check('exactly one phone shows the Odd Card text', oddOnes.length === 1, JSON.stringify(secret));
const holders = all.filter((p) => !secret[p.name].includes(ODD));
const W = wordOf(secret[holders[0].name]);
L.check('every Word Holder sees the same word', holders.every((p) => wordOf(secret[p.name]) === W), W);
const oddP = oddOnes[0];
L.check('the Odd Card phone shows the category but not the word', secret[oddP.name].startsWith('Category:') && !secret[oddP.name].includes(W));
for (const p of all) {
  const h = await html(p);
  L.check(`${p.name}: no secret in the DOM, title or aria while not held`, !h.includes(W) && !h.includes(ODD) && !/Category: /.test(h));
}
for (const p of [host, guests[0]]) {
  const r = await p.page.evaluate(() => { const b = document.querySelector('.holdcard').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: innerHeight, sy: scrollY }; });
  L.check(`${p.name}: card sits at the top, fully on screen, no scroll`, r.top < 200 && r.bottom <= r.h && r.sy === 0, JSON.stringify(r));
}
await shot(guests[0], 'card-hidden-390');
{
  const g = guests[0]; const b = await g.page.locator('.holdcard').boundingBox();
  await g.page.mouse.move(b.x + 40, b.y + 40); await g.page.mouse.down(); await sleep(450); await shot(g, 'card-held-390'); await g.page.mouse.up();
}

// ---- the round -----------------------------------------------------------------------------------------
for (const p of [...guests, host]) { await p.page.click('.dock [data-pa="ready"], .dock [data-pa="begin"]'); await sleep(120); }
for (const p of all) L.check(`${p.name} reaches clues`, await waitPhase(p, 'clues'));
const re = guests[2];
await re.page.reload({ waitUntil: 'domcontentloaded' });
L.check('reloaded phone rejoins the room mid-round', await waitPhase(re, 'clues'));
const again = await holdRead(re);
L.check('reloaded phone sees the same card as before', again === secret[re.name], again);
const rh = await html(re);
L.check('reloaded phone hides the card again after release', !rh.includes(W) && !rh.includes(ODD));
await shot(host, 'play-clues-390');
{
  const g = guests[3]; await g.down(); await sleep(1500); g.up(); await g.wake('online');
  L.check('a dropped phone reconnects', await waitPhase(g, 'clues', 20000));
  L.check('the reconnected phone still shows only its own card', (await holdRead(g)) === secret[g.name]);
}

// ---- play to a winner ----------------------------------------------------------------------------------
let rounds = 0, finished = false;
for (let i = 0; i < 700 && !finished; i++) {
  const ph = await phase(host);
  if (ph === 'clues') await host.page.click('[data-pa="clueDone"]').catch(() => {});
  else if (ph === 'vote') {
    for (const p of all) { const b = p.page.locator('.pbtn[data-pa="vote"]').first(); if (await b.count()) { await b.click().catch(() => {}); await sleep(60); } }
  } else if (ph === 'reveal') await host.page.click('.dock [data-pa="next"]').catch(() => {});
  else if (ph === 'guess') {
    for (const p of all) if (await p.page.locator('[data-pa="guess"]:has-text("Submit Guess")').count()) { await p.page.fill('[data-pin="guess"]', 'banana'); await p.page.click('[data-pa="guess"]'); await sleep(200); }
    await host.page.click('[data-pa="judge"][data-right="0"]').catch(() => {});
  } else if (ph === 'flip' || ph === 'score') { if (ph === 'score') rounds++; await host.page.click('.dock [data-pa="next"]').catch(() => {}); }
  else if (ph === 'pass') {
    for (const p of all) await holdRead(p).catch(() => '');
    for (const p of [...guests, host]) { await p.page.click('.dock [data-pa="ready"], .dock [data-pa="begin"]').catch(() => {}); await sleep(100); }
  } else await sleep(120);
  if (await host.page.locator('.win').count()) finished = true;
}
L.check('a full game plays through to the winner screen', finished, `rounds ${rounds}`);
L.check('every phone shows the game-over dialog', (await Promise.all(all.map((p) => p.page.locator('.win').count()))).every((n) => n === 1));
await shot(host, 'game-over-390');
// the server never put round 1's word on the Odd Card's socket while the round was being played
const leaked = oddP.frames.filter((f) => { try { const v = JSON.parse(f).view; return v && PLAY.includes(v.phase) && f.includes(`"${W}"`) && !(v.game && v.game.result); } catch { return false; } });
L.check(`Odd Card socket never received the word during its round (${oddP.frames.length} frames checked)`, leaked.length === 0, leaked[0]?.slice(0, 120));
await checkPhones(L, all, 'play');

// ---- B. viewports and One phone ------------------------------------------------------------------------
for (const [name, dev] of [['375', 'p375'], ['1280', 'd1280']]) {
  const p = await phone(browser, srv.base, `setup-${name}`, dev);
  await p.goto('/');
  await p.page.click('[data-act="play"]');
  await p.page.locator('.su .panel[data-step="0"]').waitFor();
  for (const n of ['Ana', 'Bo', 'Cleo']) { await p.page.fill('#su-add', n); await p.page.click('.field .add'); }
  await sleep(300);
  await shot(p, `setup-1-players-${name}`);
  L.check(`${name}: step 1 fits the screen with the Next button visible`, await p.page.evaluate(() => document.querySelector('.su .dock .btn').getBoundingClientRect().bottom <= innerHeight + 1));
  await next(p); await sleep(350); await shot(p, `setup-2-round-${name}`);
  await next(p); await sleep(350);
  L.check(`${name}: alone with local names preselects One phone`, (await p.page.locator('.opt.on b').innerText()) === 'One phone');
  await shot(p, `setup-3-seating-${name}`);
  await next(p); await sleep(350); await shot(p, `setup-4-start-${name}`);
  await p.page.click('.su [data-su="start"]');
  await p.page.click('[data-act="next"]'); // Start Passing
  await p.page.locator('.holdcard').waitFor();
  const r = await p.page.evaluate(() => { const b = document.querySelector('.holdcard').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: innerHeight, sy: scrollY }; });
  L.check(`${name}: One phone card at the top, on screen, no scroll`, r.top < 220 && r.bottom <= r.h && r.sy === 0, JSON.stringify(r));
  await shot(p, `pass-the-phone-${name}`);
  await checkPhones(L, [p], `viewport ${name}`);
  await p.close();
}

// ---- C. mixed seating: 2 local seats + the host + 2 phones ---------------------------------------------
{
  const h = await phone(browser, srv.base, 'mixhost'); frames(h);
  const { guests: gs } = await hostRoom(h, 2, srv.base);
  for (const n of ['Cleo', 'Dev']) { await h.page.fill('#su-add', n); await h.page.click('.field .add'); }
  await h.page.locator('.pchip').nth(4).waitFor({ timeout: 10000 });
  await next(h); await sleep(300); await next(h); await sleep(300);
  L.check('mixed: seating preselects Mixed', (await h.page.locator('.opt.on b').innerText()) === 'Mixed');
  await shot(h, 'setup-3-mixed-390');
  await next(h); await sleep(300);
  await h.page.click('.su [data-su="start"]');
  L.check('mixed: host reaches the pass screen', await waitPhase(h, 'pass'));
  const seen = [];
  for (let i = 0; i < 2; i++) {
    const before = await html(h);
    seen.push(await holdRead(h, 'local'));
    L.check(`mixed: local card ${i + 1} is empty in the DOM until held`, faceEmpty(before));
    await h.page.click('.dock [data-pa="localReady"]'); await sleep(250);
  }
  L.check('mixed: both local seats saw a card, then the pass queue is empty', seen.every((t) => /Category:/.test(t)) && (await h.page.locator('.holdcard[data-hold="local"]').count()) === 0);
  L.check('mixed: host still sees their own card', /Category:/.test(await holdRead(h, 'me')));
  const hh = await html(h);
  L.check('mixed: host DOM holds no secret after the pass', !seen.some((t) => !t.includes(ODD) && hh.includes(wordOf(t))) && !hh.includes(ODD));
  // Live rooms: the card can arrive a moment after the screen, so hold again until Got it unlocks (max 5 holds).
  for (const g of gs) {
    for (let t = 0; t < 5 && !(await g.page.locator('.dock [data-pa="ready"]:not([disabled])').count()); t++) { await holdRead(g); await sleep(300); }
    await g.page.click('.dock [data-pa="ready"]');
  }
  await h.page.click('.dock [data-pa="begin"]');
  L.check('mixed: clues start once everyone has looked', await waitPhase(h, 'clues'));
  await checkPhones(L, [h, ...gs], 'mixed');
  for (const p of [h, ...gs]) await p.close();
}

L.done();
for (const p of all) await p.close();
await browser.close();
srv.stop();
