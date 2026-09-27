/* Soundtrack for the Snipflag launch film, synthesized offline with Web Audio so it is sample-locked to the picture.
   120 BPM in D major (vi–IV–I–V). The UI cues reuse the app's own recipes from src/sound.ts. */
(() => {
const DUR = 57, SHIFT = 3, BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4;
const midi = n => 440 * 2 ** ((n - 69) / 12);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Bm7, Gmaj7, Dmaj7, A6
const PROG = [
  { root: 35, pad: [62, 66, 69, 71], arp: [71, 74, 78, 81] },
  { root: 31, pad: [59, 62, 66, 67], arp: [67, 71, 74, 78] },
  { root: 38, pad: [57, 61, 62, 66], arp: [69, 73, 74, 78] },
  { root: 33, pad: [57, 61, 64, 66], arp: [69, 73, 76, 78] },
];
const chordAt = t => PROG[Math.floor(t / BAR) % 4];

async function buildSoundtrack(sr = 48000) {
  const c = new OfflineAudioContext(2, Math.ceil(DUR * sr), sr);
  const R = rng(42);
  // Shared noise.
  const nb = c.createBuffer(1, sr * 3, sr); { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }
  // Master
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = .004; comp.release.value = .18;
  const master = c.createGain(); master.gain.value = .8;
  master.gain.setValueAtTime(.8, 55.6); master.gain.linearRampToValueAtTime(0, DUR);
  comp.connect(master).connect(c.destination);
  // Reverb
  const rv = c.createConvolver(); { const len = sr * 2.6, ir = c.createBuffer(2, len, sr); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * (1 - i / len) ** 3.4; } rv.buffer = ir; }
  const rvTone = c.createBiquadFilter(); rvTone.type = 'lowpass'; rvTone.frequency.value = 5000;
  const rvIn = c.createGain(); rvIn.gain.value = .5; rvIn.connect(rv).connect(rvTone).connect(comp);
  // Music bus with a "freeze" filter for the capture moment.
  const musicLP = c.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.Q.value = .7;
  const mlp = musicLP.frequency;
  mlp.setValueAtTime(18000, 0);
  mlp.setValueAtTime(18000, 16.1); mlp.exponentialRampToValueAtTime(520, 16.45); mlp.setValueAtTime(520, 18.1); mlp.exponentialRampToValueAtTime(18000, 18.35);
  mlp.setValueAtTime(18000, 48.9); mlp.exponentialRampToValueAtTime(900, 49.4); mlp.exponentialRampToValueAtTime(14000, 50.8); mlp.setValueAtTime(18000, 50.85);
  const music = c.createGain(); music.gain.value = 1;
  music.connect(musicLP).connect(comp);
  const musicRv = c.createGain(); musicRv.gain.value = .35; musicLP.connect(musicRv).connect(rvIn);
  // Sidechain duck for pads and bass.
  const duck = c.createGain(); duck.connect(music);
  const drums = c.createGain(); drums.gain.value = .95; drums.connect(comp);
  const sfx = c.createGain(); sfx.gain.value = .9; sfx.connect(comp);
  const sfxRv = c.createGain(); sfxRv.gain.value = .5; sfx.connect(sfxRv).connect(rvIn);
  // Delay for plucks.
  const dl = c.createDelay(1); dl.delayTime.value = BEAT * .75; const fb = c.createGain(); fb.gain.value = .32; const dlf = c.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2600;
  dl.connect(dlf).connect(fb).connect(dl); const dlOut = c.createGain(); dlOut.gain.value = .45; dlf.connect(dlOut).connect(music);

  let SH = 0;
  const env = (g, at, a, peak, d, curve = 'exp') => {
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(.0001, at + a + d); else g.gain.linearRampToValueAtTime(0, at + a + d);
  };
  const osc = (type, f, at, stop, dest) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.connect(dest); o.start(at); o.stop(stop); return o; };
  const noise = (at, dur, dest, rate = 1) => { const s = c.createBufferSource(); s.buffer = nb; s.playbackRate.value = rate; s.connect(dest); s.start(at, R() * 2, dur + .05); return dest; };
  const filt = (type, f, q = .7) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = (v, dest) => { const g = c.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };

  /* --- Instruments --- */
  function kick(at, v = 1) { at += SH;
    const g = gain(0, drums); env(g, at, .003, v, .42);
    const o = osc('sine', 155, at, at + .5, g); o.frequency.exponentialRampToValueAtTime(52, at + .08); o.frequency.exponentialRampToValueAtTime(41, at + .4);
    const cg = gain(0, drums); env(cg, at, .001, .18 * v, .015); noise(at, .03, filt('highpass', 2500)).connect(cg);
    duck.gain.setValueAtTime(.32, at); duck.gain.setTargetAtTime(1, at + .02, .09);
  }
  function clap(at, v = .5) { at += SH;
    const bp = filt('bandpass', 1700, .9); const g = gain(0); bp.connect(g); g.connect(drums);
    g.gain.setValueAtTime(.0001, at);
    [0, .011, .022].forEach(o => { g.gain.exponentialRampToValueAtTime(v, at + o + .002); g.gain.exponentialRampToValueAtTime(v * .25, at + o + .009); });
    g.gain.exponentialRampToValueAtTime(v * .7, at + .035); g.gain.exponentialRampToValueAtTime(.0001, at + .22);
    noise(at, .25, bp);
    const s = gain(.25, rvIn); g.connect(s);
    const bg = gain(0, drums); env(bg, at, .002, v * .35, .09); osc('triangle', 190, at, at + .15, bg).frequency.exponentialRampToValueAtTime(150, at + .1);
  }
  function hat(at, v = .12, open = false) { at += SH;
    const g = gain(0, drums); env(g, at, .001, v, open ? .22 : .035);
    noise(at, open ? .3 : .06, filt('highpass', 7800)).connect(g);
  }
  function snare(at, v) { at += SH;
    const g = gain(0, drums); env(g, at, .001, v, .11); noise(at, .14, filt('bandpass', 2400, .6)).connect(g);
    const s = gain(.3, rvIn); g.connect(s);
  }
  function bass(at, n, dur, v = .3) { at += SH;
    const g = gain(0, duck); env(g, at, .008, v, dur);
    osc('sine', midi(n), at, at + dur + .1, g);
    const lp = filt('lowpass', 260, 1.2); lp.connect(g);
    const sg = gain(.35, lp); osc('sawtooth', midi(n), at, at + dur + .1, sg);
  }
  function pad(at, notes, dur, v = .028, cutoff = 1800) { at += SH;
    const lp = filt('lowpass', cutoff, .5); const g = gain(0); lp.connect(g); g.connect(duck);
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(1, at + .45); g.gain.setValueAtTime(1, at + dur - .1); g.gain.exponentialRampToValueAtTime(.0001, at + dur + .9);
    notes.forEach(n => [-7, 7].forEach(det => { const og = gain(v, lp); const o = osc('sawtooth', midi(n), at, at + dur + 1, og); o.detune.value = det; }));
    notes.slice(0, 2).forEach(n => { const og = gain(v * 1.2, lp); osc('triangle', midi(n - 12), at, at + dur + 1, og); });
  }
  function pluck(at, n, v = .07, bright = 3800) { at += SH;
    const lp = filt('lowpass', bright, 2); lp.frequency.setValueAtTime(bright, at); lp.frequency.exponentialRampToValueAtTime(500, at + .22);
    const g = gain(0); env(g, at, .003, v, .32); lp.connect(g); g.connect(music); g.connect(dl);
    osc('triangle', midi(n), at, at + .4, lp); const sq = gain(.25, lp); osc('square', midi(n) * 1.002, at, at + .4, sq);
  }
  function bell(f, at, peak, dest = sfx) { at += SH;
    [[1, .9, 1], [2.01, .45, .32], [3.02, .22, .12]].forEach(([m, d, p]) => { const g = gain(0, dest); env(g, at, .004, peak * p, d); osc('sine', f * m, at, at + d + .1, g); });
  }
  function riser(a, b, v = .22) { a += SH; b += SH;
    const bp = filt('bandpass', 400, 1.4); bp.frequency.setValueAtTime(400, a); bp.frequency.exponentialRampToValueAtTime(9000, b);
    const g = gain(0); g.gain.setValueAtTime(.0001, a); g.gain.exponentialRampToValueAtTime(v, b - .02); g.gain.linearRampToValueAtTime(0, b);
    bp.connect(g); g.connect(sfx); for (let t = a; t < b; t += 2.5) noise(t, Math.min(2.6, b - t), bp);
    const sg = gain(0, sfx); sg.gain.setValueAtTime(.0001, a); sg.gain.exponentialRampToValueAtTime(v * .12, b - .02); sg.gain.linearRampToValueAtTime(0, b);
    const o = osc('sawtooth', 110, a, b, filt('lowpass', 1400)); o.frequency.exponentialRampToValueAtTime(880, b); o.disconnect(); const lp = filt('lowpass', 1600); o.connect(lp); lp.connect(sg);
  }
  function impact(at, v = .8) { at += SH;
    const g = gain(0, sfx); env(g, at, .004, v, 1.6); const o = osc('sine', 72, at, at + 1.8, g); o.frequency.exponentialRampToValueAtTime(31, at + 1.2);
    const ng = gain(0, sfx); env(ng, at, .002, v * .5, 1.4); noise(at, 1.5, filt('lowpass', 1400)).connect(ng);
    const s = gain(.9, rvIn); ng.connect(s);
  }
  function whoosh(at, dur, v = .16) { at += SH;
    const bp = filt('bandpass', 300, 1.1); bp.frequency.setValueAtTime(300, at); bp.frequency.exponentialRampToValueAtTime(3200, at + dur * .6); bp.frequency.exponentialRampToValueAtTime(500, at + dur);
    const g = gain(0); g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(v, at + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, at + dur);
    bp.connect(g); g.connect(sfx); noise(at, dur, bp);
  }
  // App cues (src/sound.ts)
  const tone = (f, at, d, peak, o = {}) => { at += SH; const g = gain(0, sfx); env(g, at, o.attack ?? .006, peak, d); const x = osc(o.type ?? 'sine', f, at, at + d + .05, g); if (o.to) x.frequency.exponentialRampToValueAtTime(o.to, at + d * .6); };
  const nhit = (at, len, peak, f, q) => { at += SH; const g = gain(0, sfx); env(g, at, .0015, peak, len); noise(at, len, filt('bandpass', f, q)).connect(g); };
  function shutter(at, v = 1.3) {
    nhit(at, .03, .55 * v, 4200, 1.6); tone(150, at, .07, .22 * v, { to: 55 });
    nhit(at + .068, .045, .38 * v, 2600, 1.2); tone(120, at + .068, .06, .12 * v, { to: 50 });
  }
  function pop(at, f = 420, v = 1) { tone(f, at, .12, .2 * v, { to: f * 1.95, attack: .004 }); tone(f * 3.9, at + .03, .12, .035 * v); }
  function success(at) { [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => bell(f, at + i * .075, i === 3 ? .16 : .14)); }
  function click(at, v = .5) { nhit(at, .012, .22 * v, 3200, 1.5); tone(1800, at, .025, .05 * v); }
  function keycap(at) { nhit(at, .02, .3, 1800, 1.2); tone(220, at, .05, .1, { to: 120 }); }
  function tick(at, v = 1) { nhit(at, .014, .1 * v, 3000 + R() * 1500, 2.2); }

  /* --- Arrangement --- */
  // Intro, film time. "You found a bug", then the old way: a ticking clock under six manual steps.
  { const g = gain(0, music); g.gain.setValueAtTime(.0001, 0); g.gain.exponentialRampToValueAtTime(.12, 1.2); g.gain.setValueAtTime(.12, 10.6); g.gain.exponentialRampToValueAtTime(.0001, 11.0);
    osc('sine', midi(35), 0, 11.1, g); const g2 = gain(.03, g); osc('triangle', midi(47), 0, 11.1, g2); }
  pad(0, PROG[0].pad, 1.3, .014, 700);
  for (let i = 0; i < 16; i++) tick(.08 + i * .025, .6);
  // Clock: tick-tock on every beat while the timer runs.
  for (let t = 1.3; t < 8.4; t += BEAT) { const g = gain(0, sfx); env(g, t, .001, .09, .03); noise(t, .04, filt('bandpass', Math.round((t - 1.3) / BEAT) % 2 ? 2400 : 3200, 6)).connect(g); }
  // A restless pulse that tightens as the steps pile up.
  for (let t = 1.3; t < 8.4; t += BEAT / 2) { const ch = PROG[Math.floor((t - 1.3) / BAR) % 4]; pluck(t, ch.arp[Math.round((t - 1.3) / (BEAT / 2)) % 4] - 12, .026, 700 + (t - 1.3) * 260); }
  for (let t = 1.3; t < 8.4; t += BAR) pad(t, PROG[Math.floor((t - 1.3) / BAR) % 4].pad, BAR, .016, 900 + (t - 1.3) * 120);
  for (let t = 1.3; t < 8.4; t += BEAT) bass(t, PROG[Math.floor((t - 1.3) / BAR) % 4].root, BEAT * .5, .11);
  [1.3, 2.5, 3.7, 4.9, 6.0, 7.2].forEach(t => whoosh(t - .08, .45, .11));
  // Step sounds.
  keycap(1.75); shutter(2.16, 1);
  click(2.85, .5);
  { const bp = filt('bandpass', 1900, .8); const g = gain(0, sfx); g.gain.setValueAtTime(.0001, 3.0); g.gain.exponentialRampToValueAtTime(.07, 3.08); g.gain.setValueAtTime(.07, 3.42); g.gain.exponentialRampToValueAtTime(.0001, 3.5); bp.connect(g); noise(3.0, .5, bp); }
  for (let i = 0; i < 19; i++) tick(4.0 + i * (.42 / 19), .8);
  click(4.7, .7);
  click(5.2, .5);
  for (let i = 0; i < 16; i++) tick(5.3 + i * (.45 / 16), .8);
  click(6.1, .5);
  for (let i = 0; i < 60; i++) tick(6.15 + i * (.95 / 60), .7);
  click(7.48, .5); pop(8.0, 300, .7);
  // Now do that twelve times: an avalanche of pops, a riser and a roll into the drop.
  for (let i = 0; i < 14; i++) pop(8.45 + i * .1, 380 + ((i * 53) % 160), .9);
  [8.85, 9.1, 9.35, 9.6].forEach(t => pop(t, 300, .8));
  riser(8.4, 10.93, .26);
  { let t = 9.4, step = .25; while (t < 10.9) { snare(t, .05 + (t - 9.4) * .12); t += step; if (t > 10.0) step = .125; if (t > 10.5) step = .0625; } }
  whoosh(10.25, .7, .2);
  SH = SHIFT;
  // Drop.
  impact(7.97, .95); kick(7.97, 1);
  // Bars 4..22 (8s → 46s): the groove.
  for (let bar = 4; bar < 23; bar++) {
    const t0 = bar * BAR, ch = PROG[bar % 4];
    const full = t0 >= 18, capture = t0 >= 12 && t0 < 18;
    pad(t0, ch.pad, BAR, full ? .024 : .02, full ? 2600 : 1800);
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * BEAT;
      if (t < 46) kick(t, .95);
      bass(t, ch.root + (b === 3 && full ? 7 : 0), BEAT * .9, .32);
      bass(t + BEAT / 2, ch.root + 12, BEAT * .35, .1);
      if (t >= 12 && t < 46) hat(t + BEAT / 2, .1);
      if (full && t < 46) { hat(t + BEAT / 4, .045); hat(t + BEAT * .75, .05); }
      if ((b === 1 || b === 3) && t >= 12 && t < 46) clap(t, capture ? .32 : .45);
    }
    for (let s = 0; s < 8; s++) {
      const t = t0 + s * BEAT / 2; if (t >= 46) break;
      const n = ch.arp[[0, 1, 2, 3, 2, 1, 2, 3][s]];
      pluck(t, n, full ? .06 : .05, full ? 4200 : 2600);
      if (t0 >= 40 && s % 2 === 1) pluck(t + BEAT / 4, n + 12, .03, 5000);
    }
  }
  hat(18 - BEAT / 2, .12, true);
  // Breakdown into the outro.
  riser(45.9, 47.83, .26);
  { let t = 46.8, step = .125; while (t < 47.8) { snare(t, .04 + (t - 46.8) * .16); t += step; if (t > 47.3) step = .0625; } }
  impact(47.85, .9); kick(47.85, .9);
  pad(47.85, [50, 57, 61, 64, 66], 6.2, .022, 2200);
  bass(47.85, 38, 5.5, .28);
  [0, 1, 2, 3, 4, 5].forEach(i => pluck(48.35 + i * BEAT, [74, 78, 81, 85, 81, 78][i], .045, 3000));
  success(49.55); success(51.0);

  /* --- Picture-locked effects --- */
  whoosh(11.35, .9, .22);
  [12.6, 12.75, 12.9].forEach(keycap);
  tone(90, 13.18, .5, .18, { to: 45 });        // freeze
  shutter(15.15); impact(15.17, .35);
  impact(15.45, .25);
  whoosh(17.15, 1.2, .16);
  pop(18.4, 360, .8);
  [20.12, 21.92, 23.42, 24.72, 28.72, 32.56, 32.98, 33.26].forEach(t => click(t));
  // Drawing strokes: soft marker scratches.
  [[20.55, 21.25], [22.2, 22.9], [23.7, 24.3]].forEach(([a, b]) => { a += SH; b += SH; const bp = filt('bandpass', 2200, .8); const g = gain(0, sfx); g.gain.setValueAtTime(.0001, a); g.gain.exponentialRampToValueAtTime(.05, a + .1); g.gain.setValueAtTime(.05, b - .08); g.gain.exponentialRampToValueAtTime(.0001, b); bp.connect(g); noise(a, b - a, bp); });
  pop(24.97, 520, .9);
  whoosh(25.3, .9, .15); impact(25.4, .3);
  pop(28.85, 420, 1.1);
  click(29.35, .4); pop(29.95, 480, .6);
  for (let i = 0; i < 40; i++) tick(30.5 + i * (.5 / 40), .8);
  for (let i = 0; i < 70; i++) tick(31.08 + i * (1.22 / 70), .8);
  click(34.0, .8);
  for (let t = 34.1; t < 35.4; t += .08) tick(t, .35);
  success(35.6); impact(35.6, .3);
  whoosh(36.45, 1.1, .18); impact(37.0, .35);
  whoosh(39.9, .7, .16);
  [40.95, 41.2, 41.45, 41.7, 41.95].forEach((t, i) => pop(t, 330 + i * 40, .7));
  whoosh(47.2, .8, .2);

  return c.startRendering();
}

window.buildSoundtrack = buildSoundtrack;
})();
