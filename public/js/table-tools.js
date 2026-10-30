// Table tools in the Host menu (combo C, Nishant 30 Oct 2026): flip a coin, roll a die, pick a player, the same three as
// the other Game Night games. The result shows inline under the buttons. It stays on this phone and never touches the game
// (no dispatch, nothing saved). Unbiased crypto randomness, so a result can't be steered.
const rnd = (n) => {
  const a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return a[0] % n;
};
const out = { text: '', n: 0 };
export const resetTools = () => { out.text = ''; };
export function toolAct(kind, names = []) {
  if (kind === 'coin') out.text = rnd(2) ? 'Heads' : 'Tails';
  else if (kind === 'die') out.text = `Rolled ${rnd(6) + 1}`;
  else if (kind === 'pick') out.text = names.length ? `Picked ${names[rnd(names.length)]}` : 'Add players first';
  out.n++;
  return out.text;
}
export function toolsHTML(esc, canPick = true) {
  return `<section class="tt" aria-label="Table tools"><p class="tt-h">Table tools</p>
    <div class="tt-row"><button class="mbtn" data-act="tcoin">Coin</button><button class="mbtn" data-act="tdie">Die</button><button class="mbtn" data-act="tpick"${canPick ? '' : ' disabled'}>Pick</button></div>
    <p class="tt-out" role="status" aria-live="polite"${out.text ? '' : ' hidden'}>${esc(out.text)}</p></section>`;
}
