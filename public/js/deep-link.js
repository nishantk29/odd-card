// Deep links shared across the Game Night sites: #/faq, #/rules, #/presets, #/join/CODE, #/play/CODE, #/host/CODE.
// The Odd Card has no hash router. It restores the last saved view, so before this a shared link opened whatever was
// saved (often the setup wizard) instead of the page it names. Pure, so the unit tests can import it.
const ROOM = ['join', 'play', 'host'];

/** @param {string} hash location.hash @returns {{ to: 'faq' | 'presets' } | { to: 'room', code: string } | null} */
export function parseDeepLink(hash) {
  const m = /^#\/(faq|rules|presets|join|play|host)(?:\/([A-Za-z]{6}))?\/?$/.exec(String(hash || ''));
  if (!m) return null;
  const [, name, code] = m;
  if (ROOM.includes(name)) return code ? { to: 'room', code: code.toUpperCase() } : null;
  if (code) return null;
  return { to: name === 'presets' ? 'presets' : 'faq' };
}
