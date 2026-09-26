/** Tiny synthesized interface sounds. No audio files, no network; everything is generated with Web Audio. */
export type Sound = 'capture' | 'add' | 'success' | 'error';

let context: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(value: boolean) { enabled = value; }

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  return context;
}
/** Webviews start audio suspended until a gesture; unlock on the first one so later cues (like a tray capture) play. */
export function primeSound() {
  const unlock = () => { if (enabled) audio(); };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

function tone(c: AudioContext, out: AudioNode, freq: number, at: number, length: number, gain: number, type: OscillatorType = 'sine', endFreq?: number) {
  const osc = c.createOscillator(); const env = c.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, at);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + length);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(out); osc.start(at); osc.stop(at + length + 0.02);
}
function click(c: AudioContext, out: AudioNode, at: number, length: number, gain: number, freq: number) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * length), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = c.createBufferSource(); const filter = c.createBiquadFilter(); const env = c.createGain();
  src.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = 0.9; env.gain.value = gain;
  src.connect(filter).connect(env).connect(out); src.start(at);
}

export function play(sound: Sound, force = false) {
  if (!enabled && !force) return;
  try {
    const c = audio(); if (!c) return;
    const out = c.createGain(); out.gain.value = 0.7; out.connect(c.destination);
    const t = c.currentTime + 0.01;
    if (sound === 'capture') {
      // Two-part shutter: blade close then open.
      click(c, out, t, 0.045, 0.5, 2600);
      click(c, out, t + 0.075, 0.06, 0.32, 1700);
      tone(c, out, 1900, t, 0.05, 0.025, 'triangle', 900);
    } else if (sound === 'add') {
      tone(c, out, 620, t, 0.11, 0.06, 'sine', 980);
    } else if (sound === 'success') {
      tone(c, out, 659.25, t, 0.22, 0.05);
      tone(c, out, 987.77, t + 0.09, 0.34, 0.045);
      tone(c, out, 1318.5, t + 0.18, 0.42, 0.03);
    } else {
      tone(c, out, 330, t, 0.13, 0.05, 'triangle');
      tone(c, out, 247, t + 0.11, 0.2, 0.05, 'triangle');
    }
  } catch { /* Sound is decorative; never let it interrupt work. */ }
}
