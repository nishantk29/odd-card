# The Odd Card

A word game for 4–12 players. Two ways to play: **Pass the Phone** (one phone runs the whole game, no accounts, no network calls after load) or **Phones** (everyone plays on their own phone through a room code or QR code). Everyone plays. No deck of cards, no accounts.

## How to play

1. **Pass.** The phone says "Pass to" a name. That player presses and holds the card back to look, and lets go to hide it. Word Holders see the category and the secret word. The Odd Card sees the category and "You're the Odd Card". Both reveals look and behave the same.
2. **Clues.** Random start and direction, two laps, one hint word each.
3. **Vote.** On three, everyone points at a suspected Odd Card. The Host taps the player with the most fingers (or Tie).
4. **Guess and score.** An accused Odd Card gets one guess at the word. Odd Card not accused +2. Accused Odd Card guesses the word +1. Accused Odd Card guesses wrong: every Word Holder +1. Accused Word Holder: each Odd Card +2. Tie vote: each Odd Card +2. First to the target (default 6, 4–10) wins. If the top score is shared, play another round.

| Players | Odd Cards |
|---|---|
| 4–7 | 1 |
| 8–12 | 2 |

## Modes

- **Classic.** One secret word. The Odd Card sees only the category. The Host taps Right or Wrong for the guess.
- **Grid.** A 4×4 grid of 16 words from one category is shown to everyone before clues and stays viewable during clues and the guess. The secret word is one of them. The accused Odd Card taps a grid word and the app checks it.

## Phones mode

The Host taps Phones, then Host a Room. The lobby shows a QR code (with a Fullscreen button), a 6-letter room code and a join link (`/?room=CODE`). Players join with a name (no duplicates, 4–12 players). The server picks the Odd Card and the word; each phone receives only its own card. Vote, guess and scoring use the same engine as Pass the Phone: each player votes on their own phone, the most votes is accused, and a tie accuses no one. The Host can remove players in the lobby and end the game. A phone that reconnects with its stored key keeps its seat.

- `src/worker.js`: Worker plus a `Room` Durable Object (binding `ROOM`, sqlite migration `v1`): `/api/create`, `/api/room/:code`, `/ws/:code`.
- `public/js/room.js`: the pure room reducer and per-player views (tested without a network).
- `public/js/phones.js`: the Phones client (join flow, WebSocket, screens). `public/js/holdcard.js` is the hold-to-reveal card shared with Pass the Phone.
- Phones mode needs an internet connection. Pass the Phone still works offline.

## Platform

- Screen Wake Lock during a game (re-acquired when the tab becomes visible again).
- Vibration on reveal through `navigator.vibrate`, the same pattern for every card, guarded where unsupported.
- Animations follow `prefers-reduced-motion`; Settings has toggles for animations, vibration and Keep Screen On.
- Installable and works offline after the first load. Game state is saved in localStorage under `oddcard.v2`; saves from the old format are ignored.

## Run it

```
npm test            # node --test test/*.test.js
npx wrangler dev    # local preview (Phones mode needs this, or a deploy)
npx wrangler deploy # deploy
```

## Layout

- `public/index.html`, `public/styles.css`: the static page and styles (Rubik is bundled in `public/fonts/`, OFL).
- `public/js/engine.js`: pure game logic, `createGame(settings)` / `apply(state, action)`, role assignment from the state rng, grid, cues, scoring, win checks, undo.
- `public/js/words.js`: 204 words in 12 categories (17 each, so a 16-word grid always fits).
- `public/js/faq.js`: searchable FAQ data (`a`, `steps`, `list` fields) and search.
- `public/js/art.js`: inline SVG art.
- `public/js/app.js`: the UI, press-and-hold card, wake lock and settings.
- `src/worker.js`, `wrangler.jsonc`: Worker, Durable Object and static assets. `scripts/build-embedded.mjs` builds `dist-embedded/worker.js` (assets inlined, not committed).
- `test/`: engine, room, FAQ and file-reference tests.
