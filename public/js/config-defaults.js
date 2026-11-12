// Open-question defaults for setup, in one place so each is easy to change. Nothing else hard-codes these.

// The preset that is preselected and marked "Recommended" (id from presets.js).
export const DEFAULT_PRESET_ID = 'opening-hand';

// Seating when nobody has joined on their own phone yet. 'one' keeps Pass the phone as the zero-setup path (works offline).
export const DEFAULT_SEATING = 'one';

// Where the room code and QR sit: on step 1 (Players) as approved, not on a step of their own.
export const ROOM_CODE_STEP = 1;

// Step 3 is called "Seating" in the carousel (could be renamed to "How you're playing").
export const SEATING_STEP_LABEL = 'Seating';

// Carousel slide time in ms (transform only). Reduced motion swaps it for a short fade.
export const SLIDE_MS = 240;
export const FADE_MS = 120;

// Version of the saved setup shape under oddcard.setup.v1; older shapes are mapped on load.
export const SETUP_KEY = 'oddcard.setup.v1';
export const SAVED_PRESETS_KEY = 'oddcard.presets.v1';
export const MAX_SAVED_PRESETS = 12;
