// Install hint: iOS Safari has no install prompt, so show a short how-to; Chromium gets an "Install app" button.
// Page can set document.documentElement.dataset.pwaQuiet = '1' during a game to hold it back. ?pwahint=1 skips the 20s wait.
const KEY = 'pwa-dismissed', DAY = 864e5, q = new URLSearchParams(location.search).has('pwahint');
const ua = navigator.userAgent;
const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const dismissed = () => { try { return Date.now() - Number(localStorage.getItem(KEY)) < 14 * DAY; } catch { return false; } };
let deferred = null, el = null, done = standalone();
const t0 = Date.now();

const share = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 15V3M8 7l4-4 4 4M6 11H5v10h14V11h-1"/></svg>';

function css() {
  const s = document.createElement('style');
  s.textContent = `.pwa-bar{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:50;max-width:480px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:8px 8px 8px 14px;background:var(--pwa-bg,#17171c);color:var(--pwa-fg,#fff7e6);border:1px solid rgba(255,255,255,.18);border-radius:12px;font:inherit;font-size:15px;line-height:1.3;animation:pwa-in .2s ease-out}
.pwa-bar span{flex:1}.pwa-bar button{font:inherit;min-height:44px;min-width:44px;padding:0 14px;border-radius:8px;border:0;cursor:pointer}
.pwa-go{background:var(--pwa-accent,#f5c542);color:#111}.pwa-x{background:transparent;color:inherit;border:1px solid rgba(255,255,255,.3)!important}
@keyframes pwa-in{from{opacity:0;transform:translateY(8px)}}@media(prefers-reduced-motion:reduce){.pwa-bar{animation:none}}`;
  document.head.append(s);
}

function hide(remember) {
  if (remember) try { localStorage.setItem(KEY, String(Date.now())); } catch {}
  el?.remove(); el = null;
}

function show() {
  if (el || done || !document.body) return;
  if (!q && (dismissed() || Date.now() - t0 < 20000 || document.documentElement.dataset.pwaQuiet === '1')) return;
  if (!ios && !deferred) return;
  if (!document.querySelector('style[data-pwa]')) { css(); document.head.lastChild.dataset.pwa = ''; }
  el = document.createElement('div');
  el.className = 'pwa-bar';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Install this app');
  el.innerHTML = ios
    ? `<span>Install: tap Share ${share}, then Add to Home Screen</span><button class="pwa-x" type="button">Dismiss</button>`
    : `<span>Play full screen, even offline</span><button class="pwa-go" type="button">Install app</button><button class="pwa-x" type="button" aria-label="Dismiss">Not now</button>`;
  el.querySelector('.pwa-x').onclick = () => hide(true);
  const go = el.querySelector('.pwa-go');
  if (go) go.onclick = async () => {
    const p = deferred; deferred = null; hide(false);
    if (!p) return;
    p.prompt();
    try { (await p.userChoice).outcome === 'dismissed' && hide(true); } catch {}
  };
  document.body.append(el);
}

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; schedule(); });
addEventListener('appinstalled', () => { done = true; deferred = null; hide(false); });

function schedule() {
  if (done) return;
  const wait = q ? 0 : Math.max(0, 20000 - (Date.now() - t0));
  setTimeout(function tick() {
    if (done || el) return;
    if (document.documentElement.dataset.pwaQuiet === '1' && !q) return setTimeout(tick, 5000);
    show();
  }, wait);
}
if (ios && !standalone()) (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', schedule) : schedule());
