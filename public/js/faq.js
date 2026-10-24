import { esc } from './art.js';

// FAQ content for the searchable FAQ sheet. Fields: q, a (text), steps (numbered list), list (bullet list), k (extra search words).
export const FAQ = [
  { q: 'What is The Odd Card?', a: 'A word game for 4–12 players. Everyone gets a secret card on one phone, passed around the table. Most players are Word Holders who know the secret word. One player (two with 8 or more) is the Odd Card and has to bluff.' },
  { q: 'How does a round work?', steps: ['Pass the phone. Each player secretly looks at their card.', 'Clues. Two laps, one word each.', 'Vote. Everyone points on three. The Host taps the most-pointed-at player, or Tie.', 'The accused Odd Card gets one guess at the word.', 'Scores update and the next round starts.'] },
  { q: 'Who is the Host?', a: 'The Host is whoever holds the phone and taps Next, the vote and the scores. The Host plays like everyone else, and you don’t need a deck of cards.' },
  { q: 'How do we set up a game?', steps: ['Tap New Game.', 'Enter every player’s name in seat order. You can add up to 12.', 'Pick a mode: Classic or Grid.', 'Pick the target score, 4–10 points (default 6).', 'Tap Start Game.'] },
  { q: 'How many Odd Cards are there?', list: ['4–7 players: 1 Odd Card.', '8–12 players: 2 Odd Cards.'], k: 'spy spies' },
  { q: 'What are Classic and Grid modes?', list: ['Classic: one secret word. Word Holders see the word and its category. The Odd Card sees only the category.', 'Grid: a 4×4 grid of 16 words from one category is shown to everyone before clues. The secret word is one of them. The Odd Card guesses by tapping a word on the grid.'] },
  { q: 'How does passing the phone work?', steps: ['The screen says “Pass to” and a name. Hand the phone to that player.', 'They press and hold the card back to see it. Let go and it hides again.', 'They tap Done, Pass On. The button unlocks after one reveal.', 'The next player gets the phone. After the last player, clues begin.'] , k: 'reveal hold card secret' },
  { q: 'What do the two cards look like?', a: 'Both cards have the same size, colours, timing and vibration, so nobody can tell them apart by watching.', list: ['Word card: the category and the secret word.', 'Odd Card: the category and “You’re the Odd Card”.'] },
  { q: 'How does Phones mode work?', a: 'Everyone plays on their own phone. The phones need an internet connection.', steps: ['Tap Phones on the home screen, type your name, and tap Host a Room.', 'Everyone else scans the QR code or opens the join link, types a name, and taps Join Room. The room code is 6 letters.', 'The Host picks Classic or Grid and the target score, then taps Start Game once 4 or more players have joined.', 'Press and hold your card to see it. Tap Got It, and the Host taps Start Clues.', 'Give clues in person. The phone shows whose turn it is. The player taps Done, Next Player.', 'Vote on your own phone. You can’t vote for yourself. The most votes is accused, and a tie accuses no one.', 'The accused Odd Card guesses on their own phone. Scores and the next round show on every phone.'], k: 'room code qr join link scan phones online everyone own phone multiplayer' },
  { q: 'What if someone loses connection in Phones mode?', list: ['Reopen the join link on the same phone. You keep your seat, your score and your card.', 'If someone is gone, the Host can tap Next Player to skip a clue or Close Vote to count the votes so far.', 'The Host can remove a player in the lobby, before the game starts.', 'The room closes after 12 hours, or when the Host taps End Game in the menu.'], k: 'reconnect refresh rejoin disconnect kick end game' },
  { q: 'How do clues work?', a: 'The app picks a random starting player and a direction. There are two laps. Each player says exactly one word that hints at the secret word, then the Host taps Next Player. Don’t say the secret word itself.' },
  { q: 'How does the vote work?', steps: ['After the second lap, everyone counts down “One, two, three”.', 'On three, everyone points at who they think is the Odd Card.', 'The Host taps the player with the most fingers.', 'If no one clearly has the most, the Host taps Tie.'] },
  { q: 'What happens on a tie vote?', a: 'No one is accused and every Odd Card escapes. Each Odd Card scores 2 points.' },
  { q: 'What happens when the accused player is revealed?', a: 'The app shows whether they were the Odd Card. A Word Holder means the Odd Cards win the round. An Odd Card gets one guess at the secret word.' },
  { q: 'How is a round scored?', list: ['Odd Card not accused: 2 points.', 'Accused Odd Card guesses the word: 1 point.', 'Accused Odd Card guesses wrong: every Word Holder gets 1 point.', 'Accused Word Holder: each Odd Card gets 2 points.', 'Tie vote: each Odd Card gets 2 points.'] },
  { q: 'How do I win?', a: 'Scores carry across rounds. The first player to reach the target score (default 6, you choose 4–10) wins. If the top score is shared, play one more round until one player is alone on top.' },
  { q: 'What if the guess is close?', a: 'In Classic mode the Host decides. A good house rule: the exact word, a plural, or an obvious synonym counts as Right. In Grid mode the app checks the tapped word for you.' },
  { q: 'Can I play without internet?', a: 'Yes. The Odd Card is an installable app. After the first load it works with no signal, and only the phone you pass around needs it. Phones mode needs an internet connection.', steps: ['Open The Odd Card once while you’re online.', 'iPhone: tap Share, then Add to Home Screen, then Add.', 'Android: tap Install app, or the browser menu, then Install.', 'Open it from your home screen. It now loads with no signal.'], k: 'offline wifi internet install pwa home screen' },
  { q: 'Can I undo a mistake?', a: 'Yes. Open the menu and tap Undo Last Step. You can step back as many times as you need, even across rounds.' },
  { q: 'What if I refresh the page?', a: 'The game is saved on this device after every step, so a refresh resumes where you were. Nothing is sent over the network.' },
  { q: 'The screen keeps turning off.', a: 'The app asks your phone to keep the screen on during a game. If it still locks, check that Keep Screen On is switched on in Settings, and that low-power mode is off.', k: 'wake lock sleep dim' },
  { q: 'Where are the settings?', a: 'Tap Settings on the home screen or in the menu. You can turn animations, vibration, and Keep Screen On on or off.', k: 'animations vibration haptics motion' },
];

function highlight(text, q) {
  if (!q) return esc(text);
  const lt = text.toLowerCase(), lq = q.toLowerCase();
  let out = '', i = 0, j;
  while ((j = lt.indexOf(lq, i)) >= 0) { out += esc(text.slice(i, j)) + `<mark>${esc(text.slice(j, j + q.length))}</mark>`; i = j + q.length; }
  return out + esc(text.slice(i));
}
const bodyText = f => [f.a, ...(f.steps || []), ...(f.list || [])].filter(Boolean);
export function faqResults(q) {
  const t = q.trim().toLowerCase();
  const hits = FAQ.filter(f => !t || f.q.toLowerCase().includes(t) || bodyText(f).some(x => x.toLowerCase().includes(t)) || (f.k || '').includes(t));
  if (!hits.length) return '<p class="nomatch">No matches</p>';
  const li = arr => arr.map(x => `<li>${highlight(x, t)}</li>`).join('');
  return hits.map(f => `<details class="qa"${t ? ' open' : ''}><summary>${highlight(f.q, t)}</summary><div class="ans">${f.a ? `<p>${highlight(f.a, t)}</p>` : ''}${f.steps ? `<ol>${li(f.steps)}</ol>` : ''}${f.list ? `<ul>${li(f.list)}</ul>` : ''}</div></details>`).join('');
}
