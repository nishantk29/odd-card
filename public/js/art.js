// Original inline SVG art + small HTML helpers for drawn playing cards.
import { SUITS } from './engine.js';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const glyph = suit => SUITS[suit].glyph + '︎';

// A drawn playing-card chip: rank + suit glyph, red or black.
export function cardChip(c, big = false) {
  const col = SUITS[c.suit].color;
  return `<span class="chip ${col}${big ? ' big' : ''}" role="img" aria-label="${c.rank} of ${SUITS[c.suit].name}"><b>${c.rank}</b><i>${glyph(c.suit)}</i></span>`;
}

// Title art: a fan of red cards with one black card sticking out, wearing a tiny fedora shadow.
export function titleArt() {
  const face = (a, x, y, suit, rank, red = true) => `
    <g transform="rotate(${a} 180 250)${x || y ? ` translate(${x} ${y})` : ''}">
      <rect x="138" y="52" width="84" height="124" rx="11" fill="#FFF7E6" stroke="${red ? '#E5383B' : '#111114'}" stroke-width="3"/>
      <text x="150" y="82" font-size="24" font-weight="900" fill="${red ? '#E5383B' : '#111114'}" font-family="Rubik,system-ui,sans-serif">${rank}</text>
      <text x="180" y="138" font-size="46" text-anchor="middle" fill="${red ? '#E5383B' : '#111114'}" font-family="system-ui,'Segoe UI Symbol',sans-serif">${suit}</text>
    </g>`;
  return `<svg viewBox="0 0 360 250" role="img" aria-label="A fan of red playing cards with one black card sticking out, wearing a tiny fedora shadow" class="title-art">
    <ellipse cx="180" cy="238" rx="130" ry="9" fill="#000" opacity=".35"/>
    ${face(-44, 0, 0, '♥︎', 'Q')}${face(-26, 0, 0, '♦︎', '7')}${face(-8, 0, 0, '♥︎', '5')}
    ${face(30, 0, 0, '♦︎', '9')}${face(46, 0, 0, '♥︎', '2')}
    <g transform="rotate(11 180 250) translate(0 -26)">
      <rect x="138" y="52" width="84" height="124" rx="11" fill="#111114" stroke="#F5C542" stroke-width="3"/>
      <text x="150" y="82" font-size="24" font-weight="900" fill="#FFF7E6" font-family="Rubik,system-ui,sans-serif">8</text>
      <text x="180" y="138" font-size="46" text-anchor="middle" fill="#FFF7E6" font-family="system-ui,'Segoe UI Symbol',sans-serif">♣︎</text>
      <g opacity=".55" fill="#000"><ellipse cx="180" cy="62" rx="52" ry="8"/><path d="M148 60c0-22 10-34 32-34s32 12 32 34c-10-6-20-8-32-8s-22 2-32 8z"/></g>
      <path d="M150 54c4-4 10-5 30-5s26 1 30 5" stroke="#F5C542" stroke-width="2" fill="none" opacity=".7"/>
    </g>
  </svg>`;
}

// One icon per role (SVG, 64x64).
export const agentIcon = () => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="6" width="36" height="52" rx="7" fill="#FFF7E6" stroke="#E5383B" stroke-width="3"/><path fill="#E5383B" d="M32 44c-12-8-14-14-10-18 3-3 8-2 10 2 2-4 7-5 10-2 4 4 2 10-10 18z"/><circle cx="21" cy="17" r="3" fill="#E5383B"/></svg>`;
export const spyIcon = () => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="6" width="36" height="52" rx="7" fill="#111114" stroke="#F5C542" stroke-width="3"/><path fill="#FFF7E6" d="M14 26c4-3 8-4 18-4s14 1 18 4l-3 4c-4-2-9-3-15-3s-11 1-15 3zM22 22c0-8 4-13 10-13s10 5 10 13c-4-2-7-3-10-3s-6 1-10 3z"/><circle cx="32" cy="43" r="8" fill="none" stroke="#1FB6B0" stroke-width="4"/><circle cx="32" cy="43" r="2.5" fill="#1FB6B0"/></svg>`;
export const hostIcon = () => `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="#F5C542"/><path fill="#111114" d="M20 38c3 6 8 9 12 9s9-3 12-9c-4 2-8 3-12 3s-8-1-12-3z"/><circle cx="24" cy="27" r="3.5" fill="#111114"/><circle cx="40" cy="27" r="3.5" fill="#111114"/></svg>`;
export const faqIcon = () => `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="#111114"/><path d="M24 25c0-5 4-9 9-9s9 3 9 8c0 7-9 7-9 14" stroke="#F5C542" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="33" cy="48" r="3.8" fill="#F5C542"/></svg>`;
export const playIcon = () => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="12" width="30" height="42" rx="6" fill="#FFF7E6" transform="rotate(-14 25 33)"/><rect x="24" y="10" width="30" height="42" rx="6" fill="#111114" transform="rotate(10 39 31)"/><path fill="#F5C542" d="M39 22l9 10-9 10z"/></svg>`;
