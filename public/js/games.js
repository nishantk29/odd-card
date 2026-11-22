// The Game Night family: the hub and all five games, as plain links (no fetches). The home screen shows an
// "All games" link back to the hub and a small footer listing every game; this one is marked, not linked.
export const HUB = 'https://gamenight.hatethespurs.com';
export const GAMES = [
  { name: 'Mafia Night', url: 'https://mafia.hatethespurs.com' },
  { name: 'Quest Night', url: 'https://avalon.hatethespurs.com' },
  { name: 'The Gilded Chamber', url: 'https://gilded.hatethespurs.com' },
  { name: 'Brass Wallet', url: 'https://brass.hatethespurs.com' },
  { name: 'The Odd Card', url: '' }, // this site
];

export const allGamesLink = (icon = '') => `<a class="allgames" href="${HUB}">${icon}<span>All games</span></a>`;
export const gamesFooter = () => `<footer class="games"><h2>Game Night games</h2><ul>${GAMES.map((g) => g.url
  ? `<li><a href="${g.url}">${g.name}</a></li>`
  : `<li><span aria-current="page">${g.name}</span></li>`).join('')}</ul></footer>`;
