# The Odd Card: feature map

Read this before a change, then open only the files listed for the feature.

## Test commands

| Command | What it runs | When |
|---|---|---|
| `npm run test:quick` | all `node --test` suites in `test/` (about 6 s) | every change |
| `npm run check` | `scripts/guard.mjs`: repeat-mistake checks (names, paths, secrets, theme switch, root scripts) | every change |
| `npm run test:e2e` | multi-phone browser run (`test/e2e/multi-phone.e2e.mjs`, needs `npm run dev`) | UI changes |
| `npm run fuzz` | engine sim: 300 games per table size and mode; `SIM_SEED` shifts the seeds | releases (CI on `v*` tags) |

## Features → files

| Feature (user's view) | Files | Tests |
|---|---|---|
| Pass the Phone game (offline, one device) | `public/js/engine.js` (all rules), `public/js/app.js` | `engine.test.js`, `sim.test.js`, `game-invariants.test.js` |
| Phones mode: room code, link, QR, one card per phone | `src/worker.js` (`/api/create`, `/api/room/:code`, `/ws/:code`), `public/js/room.js`, `public/js/phones.js`, `public/js/qr.js` | `room.test.js` |
| Press-and-hold card reveal | `public/js/holdcard.js` | `room.test.js` |
| Classic and Grid modes, words and categories | `public/js/engine.js`, `public/js/words.js` | `engine.test.js` |
| Host tools: seats on the host phone, remove players, reclaim host | `public/js/room.js`, `public/js/phones.js` | `host-reclaim.test.js`, `e2e/host-reclaim.e2e.mjs` |
| Setup carousel, presets | `public/js/setup.js`, `presets.js`, `config-defaults.js`, `public/setup.css` | `presets.test.js` |
| Deep links (`#/faq`, `#/join/CODE`, ...) | `public/js/deep-link.js` | `deep-link.test.js`, `e2e/deep-links.e2e.mjs` |
| FAQ and "Ask a rule" | `public/js/faq.js`, `src/ask.js`, `src/ai.js`, `src/rules-index.js` (generated) | `faq-numbers.test.js`, `ask.test.js`, `rules-index.test.js` |
| Menu pill, Back closes sheets, family links | `public/js/more-pill.js`, `back-sheet.js`, `games.js` | `back-sheet.test.js`, `back-nav-wiring.test.js`, `family-links.test.js` |
| Install / offline (PWA), safe areas | `public/sw.js`, `public/pwa-install.js`, `pwa/pwa.json` | `files.test.js`, `safe-area.test.js` |
| Deploy config | `wrangler.jsonc`, `scripts/build-deploy.mjs`, `scripts/deploy-config.mjs`, `scripts/embedded-assets.mjs` | `deploy-*.test.js`, `embedded-assets.test.js` |
