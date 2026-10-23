// Original inline SVG art + small HTML helpers for drawn playing cards.
import { SUITS } from './engine.js';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const glyph = suit => SUITS[suit].glyph + '︎';

// A drawn playing-card chip: rank + suit glyph, red or black.
export function cardChip(c, big = false) {
  const col = SUITS[c.suit].color;
  return `<span class="chip ${col}${big ? ' big' : ''}" role="img" aria-label="${c.rank} of ${SUITS[c.suit].name}"><b>${c.rank}</b><i>${glyph(c.suit)}</i></span>`;
}

// Title art: a flat row of red cards with one black card pulled up out of line (the odd one).
export function titleArt() {
  const suit = (k, col) => ({
    h: `<path fill="${col}" d="M12 21C4 14 2 9 5 6c3-3 6-1 7 1 1-2 4-4 7-1 3 3 1 8-7 15z"/>`,
    d: `<path fill="${col}" d="M12 2l8 10-8 10-8-10z"/>`,
    c: `<g fill="${col}"><circle cx="12" cy="7" r="5"/><circle cx="6.5" cy="14" r="5"/><circle cx="17.5" cy="14" r="5"/><path d="M10 14h4l2 8H8z"/></g>`,
  })[k];
  const cards = [['Q', 'h', 0, 36], ['7', 'd', 0, 32], ['5', 'h', 0, 38], ['8', 'c', 1, 8], ['9', 'd', 0, 34], ['2', 'h', 0, 38]];
  const gap = 9, wOf = odd => (odd ? 66 : 44), total = cards.reduce((n, c) => n + wOf(c[2]), 0) + (cards.length - 1) * gap;
  let x = (360 - total) / 2;
  const face = ([rank, k, odd, y]) => {
    const w = wOf(odd), h = odd ? 100 : 72, ink = odd ? '#FFF7E6' : '#E5383B', at = x;
    x += w + gap;
    return `<g transform="translate(${at} ${y})"><rect width="${w}" height="${h}" rx="${odd ? 9 : 6}" fill="${odd ? '#111114' : '#FFF7E6'}" stroke="${odd ? '#F5C542' : '#E5383B'}" stroke-width="3"/>
      <text x="${odd ? 10 : 7}" y="${odd ? 30 : 22}" font-size="${odd ? 25 : 18}" font-weight="900" fill="${odd ? '#F5C542' : ink}" font-family="Rubik,system-ui,sans-serif">${rank}</text>
      <g transform="translate(${odd ? 12 : 10} ${odd ? 44 : 34}) scale(${odd ? 1.75 : 1})">${suit(k, ink)}</g></g>`;
  };
  return `<svg viewBox="0 0 360 120" role="img" aria-label="Six playing cards in a row: five red, and one black card pulled up out of line" class="title-art">
    <rect width="360" height="120" fill="#0E7A4B"/>${cards.map(face).join('')}
  </svg>`;
}

// Drawn UI marks, one stroke weight, drawn in currentColor.
const mark = (d, w = 2.6) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icons = {
  back: () => mark('<path d="M15 5l-7 7 7 7"/>'),
  menu: () => mark('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: () => mark('<path d="M6 6l12 12M18 6L6 18"/>'),
  go: () => mark('<path d="M9 5l7 7-7 7"/>'),
};

// One icon per role (SVG, 64x64).
export const agentIcon = () => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="6" width="36" height="52" rx="7" fill="#FFF7E6" stroke="#E5383B" stroke-width="3"/><path fill="#E5383B" d="M32 44c-12-8-14-14-10-18 3-3 8-2 10 2 2-4 7-5 10-2 4 4 2 10-10 18z"/><circle cx="21" cy="17" r="3" fill="#E5383B"/></svg>`;
export const spyIcon = () => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="6" width="36" height="52" rx="7" fill="#111114" stroke="#F5C542" stroke-width="3"/><path fill="#FFF7E6" d="M14 26c4-3 8-4 18-4s14 1 18 4l-3 4c-4-2-9-3-15-3s-11 1-15 3zM22 22c0-8 4-13 10-13s10 5 10 13c-4-2-7-3-10-3s-6 1-10 3z"/><circle cx="32" cy="43" r="8" fill="none" stroke="#1FB6B0" stroke-width="4"/><circle cx="32" cy="43" r="2.5" fill="#1FB6B0"/></svg>`;
