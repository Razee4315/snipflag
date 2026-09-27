/* Optional soundtrack. Delete this file (and its <script> tag) for a silent video.
   buildSoundtrack(sampleRate) must return an AudioBuffer of the full demo length, rendered offline so it is
   sample-locked to the picture. Put cue times here in the same seconds film.js uses. */
(() => {
const DUR = 12;

async function buildSoundtrack(sr = 48000) {
  const c = new OfflineAudioContext(2, Math.ceil(DUR * sr), sr);
  const master = c.createGain(); master.gain.value = .8; master.connect(c.destination);

  // Soft pad under the whole demo.
  for (const f of [220, 277.18, 329.63]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(.05, 1.5);
    g.gain.setValueAtTime(.05, DUR - 1); g.gain.linearRampToValueAtTime(0, DUR);
    o.connect(g).connect(master); o.start(0); o.stop(DUR);
  }
  // Click at 6.2 s, matching the cursor in film.js.
  pop(6.2, 880);
  // Rising tone into the outro.
  pop(8.8, 440, .5);

  function pop(t, f, len = .12) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.3, t + .005); g.gain.exponentialRampToValueAtTime(.001, t + len);
    o.connect(g).connect(master); o.start(t); o.stop(t + len + .02);
  }
  return c.startRendering();
}

window.buildSoundtrack = buildSoundtrack;
})();
