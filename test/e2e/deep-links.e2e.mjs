// E2E (browser): deep links open the page they name, not the last saved view (audit Oct 30: #/faq, #/rules, #/presets
// and the room links all showed "Who's at the table?" once a setup had been started).
// Serves public/ from disk and stubs /api and /ws, so no Worker is needed. Chromium and WebKit at 390x844.
//   PW=/workspace/forge/pw/node_modules/playwright-core node test/e2e/deep-links.e2e.mjs   (exit 1 on any failure)
// WebKit needs its libraries on LD_LIBRARY_PATH; without them the WebKit pass is skipped and says so.
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const PW = process.env.PW || '/workspace/forge/pw/node_modules/playwright-core';
const { chromium, webkit } = await import(`${PW}/index.mjs`);
const ROOT = fileURLToPath(new URL('../../public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const ORIGIN = 'http://odd.test';
const fails = [], passes = [];
const check = (label, ok, info = '') => { (ok ? passes : fails).push(`${label}${info ? ` (${info})` : ''}`); console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${info ? ` (${info})` : ''}`); };

async function newPage(browser, errors) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/create') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SETUPX', hostKey: 'test' }) });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    let p = join(ROOT, decodeURIComponent(url.pathname)); if (url.pathname === '/' || !existsSync(p)) p = join(ROOT, 'index.html');
    return route.fulfill({ status: 200, body: readFileSync(p), contentType: TYPES[extname(p)] || 'application/octet-stream' });
  });
  await page.routeWebSocket(/\/ws\//, () => {}); // accepted, silent
  return { ctx, page };
}
const state = (view) => ({ view, setup: { names: ['Ana', 'Bo', 'Cleo', 'Dev'], target: 6, mode: 'classic' } });
async function open(page, saved, hash) {
  await page.goto(`${ORIGIN}/404-blank`); // same origin, so localStorage can be primed before the app boots
  await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('oddcard.v2', JSON.stringify(s)); }, saved);
  await page.goto(`${ORIGIN}/${hash}`);
  await page.waitForTimeout(500);
}
const faqOpen = (page) => page.locator('#sheets .sheet h2', { hasText: 'Rules & FAQ' }).isVisible();
const h1 = (page) => page.locator('#app h1').first().innerText().catch(() => '');
const hash = (page) => page.evaluate(() => location.hash);

async function run(engine, browser) {
  const errors = [];
  const { ctx, page } = await newPage(browser, errors);
  const t = (s) => `${engine}: ${s}`;
  await open(page, null, '#/faq');
  check(t('fresh #/faq opens the FAQ'), await faqOpen(page));
  check(t('the hash is dropped once read'), (await hash(page)) === '', await hash(page));
  for (const h of ['#/faq', '#/rules']) {
    await open(page, state('setup'), h);
    check(t(`${h} after a setup was started opens the FAQ`), await faqOpen(page), await h1(page));
  }
  await page.reload(); await page.waitForTimeout(500);
  check(t('a reload after a deep link restores the saved view (no FAQ)'), !(await faqOpen(page)), await h1(page));
  await open(page, state('setup'), '#/faq');
  await page.goBack(); await page.waitForTimeout(400);
  check(t('Back closes the deep-linked FAQ and stays in the app'), !(await faqOpen(page)) && page.url().startsWith(ORIGIN), page.url());
  for (const saved of [null, state('setup')]) {
    await open(page, saved, '#/presets');
    check(t(`#/presets (${saved ? 'setup saved' : 'fresh'}) opens Presets`), (await h1(page)) === 'Presets', await h1(page));
  }
  for (const r of ['join', 'play', 'host']) {
    await open(page, state('setup'), `#/${r}/abcdef`);
    const name = await page.locator('[data-pin="name"]').isVisible().catch(() => false);
    check(t(`#/${r}/CODE opens the join screen for that room`), name && (await page.content()).includes('ABCDEF'), await h1(page));
  }
  await open(page, state('home'), '');
  await page.evaluate(() => { location.hash = '#/faq'; }); await page.waitForTimeout(400);
  check(t('a hash change while open (#/faq) opens the FAQ'), await faqOpen(page));
  await open(page, state('home'), '#/nope');
  check(t('an unknown hash leaves the saved view alone'), !(await faqOpen(page)) && (await h1(page)) !== 'Presets', await h1(page));
  check(t('no page errors'), errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

for (const [engine, launcher] of [['chromium', () => chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] })], ['webkit', () => webkit.launch()]]) {
  let b; try { b = await launcher(); } catch (e) { console.log(`SKIP ${engine}: ${e.message.split('\n')[0]}`); continue; }
  try { await run(engine, b); } catch (e) { check(`${engine}: run finished`, false, e.message.split('\n')[0]); }
  await b.close();
}
console.log(`\nodd deep links e2e: ${passes.length} passed, ${fails.length} failed`);
process.exit(fails.length || !passes.length ? 1 : 0);
