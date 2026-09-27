/* Demo template. Copy this folder, then edit the scenes.
   The one rule: seek(t) must set EVERY animated property from t alone (no timers, no CSS transitions or
   animations, no Math.random, no state carried from the previous frame). Then any frame can be rendered
   in any order, the scrubber is exact, and render.mjs's determinism check passes. */
(() => {
const DUR = 12, FPS = 60;
const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const E = {
  lin: k => k,
  outCubic: k => 1 - (1 - k) ** 3,
  inOutCubic: k => k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2,
  outExpo: k => k >= 1 ? 1 : 1 - 2 ** (-10 * k),
};
/** Progress 0 → 1 between times a and b, eased. */
const P = (t, a, b, e = E.outExpo) => e(clamp((t - a) / (b - a)));

// Scene id → [start, end) in seconds. Overlap them for cross-fades.
const SCENES = { title: [0, 3.6], work: [3.2, 9], outro: [8.6, DUR] };

const FN = {
  title(t) {
    const inn = P(t, .2, 1.2), out = P(t, 3.1, 3.6, E.inOutCubic);
    $('#headline').style.opacity = inn * (1 - out);
    $('#headline').style.transform = `translateY(${lerp(40, 0, inn) - out * 30}px)`;
    const sub = P(t, .6, 1.6);
    $('#sub').style.opacity = sub * (1 - out);
    $('#sub').style.transform = `translateY(${lerp(30, 0, sub)}px)`;
  },
  work(t) {
    const inn = P(t, 3.3, 4.3), out = P(t, 8.5, 9, E.inOutCubic);
    const card = $('#card');
    card.style.opacity = inn * (1 - out);
    card.style.transform = `translateY(${lerp(60, 0, inn)}px) scale(${lerp(.96, 1, inn)})`;
    // Cursor glides to the card and "clicks" at 6.2 s.
    const move = P(t, 4.6, 6.1, E.inOutCubic), click = P(t, 6.1, 6.25, E.lin) * (1 - P(t, 6.25, 6.5, E.lin));
    const c = $('#cursor');
    c.style.opacity = P(t, 4.4, 4.7) * (1 - out);
    c.style.transform = `translate(${lerp(1500, 1180, move)}px, ${lerp(900, 560, move)}px) scale(${1 - click * .25})`;
    card.style.borderColor = t >= 6.2 ? '#4fd1a5' : '#25413a';
  },
  outro(t) {
    const inn = P(t, 8.8, 9.8);
    $('#brand').style.opacity = inn;
    $('#brand').style.transform = `scale(${lerp(.9, 1, inn)})`;
  },
};

function seek(t) {
  for (const id in SCENES) {
    const [a, b] = SCENES[id], on = t >= a && t < b || id === 'outro' && t >= a;
    $('#' + id).style.display = on ? 'block' : 'none';
    if (on) FN[id](t);
  }
  $('#fade').style.opacity = P(t, DUR - .6, DUR, E.lin);
}

async function boot() {
  await document.fonts.ready;
  await Promise.all(['400 40px Inter', '800 120px Inter'].map(f => document.fonts.load(f)));
  // checks: times render.mjs uses to prove seek(t) is deterministic; review: stills pulled from the final MP4.
  Player.mount({ seek, DUR, FPS, checks: [1.5, 6.3], away: 10, poster: 10.5, review: [1, 5, 6.3, 10] });
}
boot();
})();
