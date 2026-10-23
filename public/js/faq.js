import { esc } from './art.js';

// FAQ content for the searchable FAQ sheet. Answers are plain text.
export const FAQ = [
  { q: 'What is The Odd Card?', a: 'A quick spy game for 4 to 12 players and a storyteller. You use a regular 52-card deck for secret roles. The app tells the story: it picks a secret word, tells you which cards to pull, and reads the host script. The storyteller does not play.' },
  { q: 'How do I win?', a: 'Play several quick rounds. The first player to reach the target score (default 6, the host can choose 4 to 10) wins. Scores carry across rounds, and anyone can win, agent or spy.' },
  { q: 'What does a RED card mean?', a: 'Red cards (hearts and diamonds) are Agents. Agents see the secret word on the storyteller\'s screen during the night. Give a clue that proves you know it without giving it away, and try to spot the spy.' },
  { q: 'What does a BLACK card mean?', a: 'Black cards (clubs and spades) are Spies. A spy only learns the category of the secret word, never the word. Blend in with your clues. If you get accused, you get one guess at the word.' },
  { q: 'Which cards do we pull for each player count?', a: '4 to 7 players: 1 black card and the rest red (4 players = 3 red + 1 black, up to 7 players = 6 red + 1 black). 8 to 12 players: 2 black cards and the rest red (8 players = 6 red + 2 black, up to 12 players = 10 red + 2 black). The deal screen lists the exact values each round, so they change every time.' },
  { q: 'How many spies are there?', a: 'One spy with 4 to 7 players. Two spies with 8 to 12 players. The two spies open their eyes together, so they know each other.' },
  { q: 'How does the night work?', a: 'Everyone closes their eyes. Red cards open their eyes and look at the word on the host\'s phone. Red cards close. Black cards open and see only the category, and the host taps who opened (exactly the spy count). The host gives a nod, black cards close, and everyone opens their eyes.' },
  { q: 'How do clues work?', a: 'The app picks a random starting player and a direction. There are two laps: each player says exactly ONE word that hints at the secret word. The host taps Next after each clue. Do not say the secret word itself.' },
  { q: 'How does the vote work?', a: 'On three, everyone points at who they think is a spy. The host counts fingers and taps the player with the most. If it is a tie, tap Tie.' },
  { q: 'What happens on a tie vote?', a: 'No one is accused and every spy escapes. Each spy scores +2.' },
  { q: 'What happens when the accused flips their card?', a: 'If it is RED, the host shakes their head or gives a thumbs down: not a spy, and the spies escape. If it is BLACK, the host nods or gives a thumbs up: caught a spy. That spy gets one guess at the secret word, and the host taps Right or Wrong.' },
  { q: 'How is a round scored?', a: 'Each spy who was not accused: +2. Accused spy who guesses the word: +1. Accused spy who guesses wrong: every agent +1. Accused agent (red card): each spy +2.' },
  { q: 'What if two players tie for the top score?', a: 'If the top score is at or above the target and two or more players share it, the game keeps going: play one more round, everyone still plays. The tied leaders are shown. Repeat until one player is alone on top.' },
  { q: 'What if the accused spy guesses a word that is close?', a: 'The host decides. A good house rule: the exact word, or an obvious synonym or plural, counts as Right.' },
  { q: 'Can I undo a mistake?', a: 'Yes. Open the menu and tap "Undo last step". You can step back as many times as you need, even across rounds.' },
  { q: 'What if I refresh the page?', a: 'The game is saved on this device after every step, so a refresh resumes where you were. Nothing is sent over the network.' },
  { q: 'Quick reference', a: 'Red = Agent, sees the word. Black = Spy, sees the category. One clue word each, two laps. Vote on three. Spy not accused +2. Accused spy right +1. Accused spy wrong: agents +1. Accused agent: spies +2. Tie vote: spies +2.' },
];

function highlight(text, q) {
  if (!q) return esc(text);
  const lt = text.toLowerCase(), lq = q.toLowerCase();
  let out = '', i = 0, j;
  while ((j = lt.indexOf(lq, i)) >= 0) { out += esc(text.slice(i, j)) + `<mark>${esc(text.slice(j, j + q.length))}</mark>`; i = j + q.length; }
  return out + esc(text.slice(i));
}
export function faqResults(q) {
  const t = q.trim().toLowerCase();
  const hits = FAQ.filter(f => !t || f.q.toLowerCase().includes(t) || f.a.toLowerCase().includes(t));
  if (!hits.length) return '<p class="nomatch">No matches</p>';
  return hits.map(f => `<details class="qa"${t ? ' open' : ''}><summary>${highlight(f.q, t)}</summary><p>${highlight(f.a, t)}</p></details>`).join('');
}
