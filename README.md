# The Odd Card

A quick spy/impostor party game for 4 to 12 players, played with a regular 52-card deck. One person (the storyteller) runs this app on their phone and does not play. The app picks the secret word, lists the cards to pull, and reads out every line and gesture. No accounts, no server state, no network calls after load.

## How to play

1. **Deal.** The app lists the exact cards to pull (red = Agents, black = Spies). Shuffle them face down, deal one each, look and keep it secret.
2. **Night.** Red cards see the secret word on the host's screen. Black cards see only the category; the host taps who opened their eyes.
3. **Clues.** Random start and direction, two laps, ONE hint word each.
4. **Vote.** On three, everyone points at a suspected spy. The host taps the player with the most fingers (or Tie).
5. **Reveal.** Red: not a spy. Black: caught, and that spy gets one guess at the word.
6. **Score.** Spy not accused +2. Accused spy guesses the word +1. Accused spy guesses wrong: every agent +1. Accused agent: each spy +2. Tie vote: every spy +2. First to the target (default 6, host sets 4 to 10) wins. If the top score is shared, play another round with everyone.

## Card table

| Players | Spies | Black cards | Red cards |
|---|---|---|---|
| 4 to 7 | 1 | 1 | players - 1 |
| 8 to 12 | 2 | 2 | players - 2 |

The values (for example 2♥ 5♦ 7♥ 9♦ Q♥ and 8♣) are random every round.

## Run it

```
npm test            # node --test test/
npx wrangler dev    # local preview
npx wrangler deploy # deploy
```

## Layout

- `public/index.html`, `public/styles.css`: the static page and styles (Rubik is bundled in `public/fonts/`, OFL).
- `public/js/engine.js`: pure game logic, `createGame(settings)` / `apply(state, action)`, cues, scoring, win checks, undo.
- `public/js/words.js`: 168 words in 12 categories.
- `public/js/faq.js`: searchable FAQ data and search.
- `public/js/art.js`: inline SVG art and card chips.
- `public/js/app.js`: the host UI. State is saved to localStorage after every action.
- `src/worker.js`, `wrangler.jsonc`: Worker serving the assets.
- `test/`: engine, FAQ and file-reference tests.
