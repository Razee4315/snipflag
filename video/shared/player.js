/* Shared preview player and render contract for every demo in video/.
   A demo calls Player.mount({ seek, DUR, FPS, checks?, away?, review?, poster? }) once its scene is built.
   - ?render   : render mode for render.mjs (no controls, no scaling, exposes window.__film).
   - ?t=12.5   : open the preview at that time.
   - ?full     : start with Lite off (full-quality playback).
   Lite mode (default in preview) plays at 30 fps and drops blur/backdrop filters while playing; pausing or
   scrubbing always shows the exact final frame. Lite never affects render mode. */
(() => {
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function toWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  let peak = 0; for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const norm = peak > 0 ? .93 / peak : 1;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => [...s].forEach((x, i) => out.setUint8(o + i, x.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44; for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i] * norm)); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true); o += 2; }
  return { bytes: new Uint8Array(out.buffer), peak };
}
/** Used by render.mjs when the demo defines window.buildSoundtrack(sampleRate) → AudioBuffer. */
window.soundtrackWavBase64 = async () => {
  const { bytes, peak } = toWav(await window.buildSoundtrack(48000));
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { b64: btoa(s), peak };
};

function mount({ seek, DUR, FPS = 60, checks, away, review, poster }) {
  const q = new URLSearchParams(location.search);
  const render = q.has('render');
  const stage = document.getElementById('stage');
  document.body.classList.toggle('render', render);

  let t = clamp(parseFloat(q.get('t') || '0') || 0, 0, DUR);
  seek(t);
  window.__film = { seek, DUR, FPS, checks, away, review, poster, ready: true };
  if (render) { stage.style.transform = ''; return; }

  const bar = document.createElement('div');
  bar.id = 'controls';
  bar.innerHTML = `<button id="play">Play</button><input id="scrub" type="range" min="0" step="0.001" value="0"><span id="time">0.00</span>` +
    `<button id="lite" title="Lite: 30 fps, no blur while playing">Lite: on</button><button id="snd">Sound: off</button>`;
  document.body.append(bar);
  const $ = id => document.getElementById(id);
  const play = $('play'), scrub = $('scrub'), time = $('time'), liteBtn = $('lite'), snd = $('snd');
  scrub.max = DUR;
  if (!window.buildSoundtrack) snd.hidden = true;

  function fit() {
    const k = Math.min(innerWidth / 1920, (innerHeight - 48) / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 48 - 1080 * k) / 2}px) scale(${k})`;
  }
  fit(); addEventListener('resize', fit);

  let playing = false, lite = !q.has('full'), sound = false, t0 = 0, start = 0, last = -1, src = null, ctx = null, buf = null;
  const set = v => { t = clamp(v, 0, DUR); scrub.value = t; time.textContent = t.toFixed(2); seek(t); };
  const applyLite = () => { document.body.classList.toggle('lite', lite && playing); liteBtn.textContent = 'Lite: ' + (lite ? 'on' : 'off'); };
  function stopAudio() { if (src) { try { src.stop(); } catch { } src = null; } }
  function stop() {
    if (!playing) return;
    playing = false; play.textContent = 'Play'; stopAudio(); applyLite();
    seek(t); // exact full-quality frame once paused
  }
  async function startAudio() {
    if (!sound || !window.buildSoundtrack) return;
    ctx ??= new AudioContext();
    buf ??= await window.buildSoundtrack(48000);
    src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(0, t);
  }
  async function toggle() {
    if (playing) return stop();
    if (t >= DUR - .01) set(0);
    await startAudio();
    playing = true; play.textContent = 'Pause'; t0 = t; start = performance.now(); last = -1; applyLite();
    const step = 1 / (lite ? 30 : FPS);
    const loop = now => {
      if (!playing) return;
      const v = t0 + (now - start) / 1000;
      if (v >= DUR) { set(DUR); return stop(); }
      if (v - last >= step - .002) { last = v; set(v); } // Lite: skip redraws above 30 fps
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  play.onclick = toggle;
  scrub.oninput = () => { stop(); set(+scrub.value); };
  liteBtn.onclick = () => { lite = !lite; applyLite(); if (playing) { stop(); toggle(); } };
  snd.onclick = () => { sound = !sound; snd.textContent = 'Sound: ' + (sound ? 'on' : 'off'); if (!sound) stopAudio(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }); // no work in background tabs
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.key === 'ArrowRight') { stop(); set(t + (e.shiftKey ? 1 : 1 / FPS)); }
    if (e.key === 'ArrowLeft') { stop(); set(t - (e.shiftKey ? 1 : 1 / FPS)); }
  });
  set(t);
}

window.Player = { mount };
})();
