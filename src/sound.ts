/** Tiny synthesized interface sounds. No audio files, no network; everything is generated with Web Audio. */
export type Sound = 'capture' | 'add' | 'success' | 'error';

let context: AudioContext | null = null;
let bus: { dry: GainNode; wet: GainNode } | null = null;
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

/** Shared output: a gentle compressor plus a short synthesized room so cues sound soft and physical rather than beepy. */
function output(c: AudioContext) {
  if (bus) return bus;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(c.destination);
  const master = c.createGain(); master.gain.value = 0.55; master.connect(comp);
  const dry = c.createGain(); dry.connect(master);
  const room = c.createConvolver(); const length = Math.floor(c.sampleRate * 0.9);
  const impulse = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2;
  }
  room.buffer = impulse;
  const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5200;
  const wet = c.createGain(); wet.connect(room).connect(tone).connect(master);
  bus = { dry, wet };
  return bus;
}
function send(c: AudioContext, node: AudioNode, reverb: number) {
  const { dry, wet } = output(c);
  node.connect(dry);
  const amount = c.createGain(); amount.gain.value = reverb; node.connect(amount).connect(wet);
}
function envelope(c: AudioContext, at: number, attack: number, peak: number, decay: number) {
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(peak, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return env;
}
function tone(c: AudioContext, freq: number, at: number, decay: number, peak: number, opts: { type?: OscillatorType; to?: number; reverb?: number; attack?: number } = {}) {
  const osc = c.createOscillator(); osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, at);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, at + decay * 0.6);
  const env = envelope(c, at, opts.attack ?? 0.006, peak, decay);
  osc.connect(env); send(c, env, opts.reverb ?? 0.2);
  osc.start(at); osc.stop(at + (opts.attack ?? 0.006) + decay + 0.05);
}
/** A struck bell: inharmonic partials with faster decay on the upper ones. */
function bell(c: AudioContext, freq: number, at: number, peak: number) {
  tone(c, freq, at, 0.9, peak, { reverb: 0.35, attack: 0.004 });
  tone(c, freq * 2.01, at, 0.45, peak * 0.32, { reverb: 0.35, attack: 0.003 });
  tone(c, freq * 3.02, at, 0.22, peak * 0.12, { reverb: 0.3, attack: 0.002 });
}
function noise(c: AudioContext, at: number, length: number, peak: number, freq: number, q: number, reverb = 0.12) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * length), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buffer;
  const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = q;
  const env = envelope(c, at, 0.0015, peak, length);
  src.connect(filter).connect(env); send(c, env, reverb);
  src.start(at); src.stop(at + length + 0.02);
}

export function play(sound: Sound, force = false) {
  if (!enabled && !force) return;
  try {
    const c = audio(); if (!c) return;
    const t = c.currentTime + 0.012;
    if (sound === 'capture') {
      // Mirror slap, body thump, then the shutter closing: a small physical camera, not a beep.
      noise(c, t, 0.03, 0.55, 4200, 1.6);
      tone(c, 150, t, 0.07, 0.22, { to: 55, reverb: 0.08 });
      noise(c, t + 0.068, 0.045, 0.38, 2600, 1.2);
      tone(c, 120, t + 0.068, 0.06, 0.12, { to: 50, reverb: 0.08 });
    } else if (sound === 'add') {
      // Soft bubble pop with a faint sparkle.
      tone(c, 420, t, 0.12, 0.2, { to: 820, reverb: 0.15, attack: 0.004 });
      tone(c, 1640, t + 0.03, 0.12, 0.035, { reverb: 0.3 });
    } else if (sound === 'success') {
      // Rising major arpeggio on bells (G5, B5, D6, G6).
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => bell(c, f, t + i * 0.075, i === 3 ? 0.14 : 0.12));
    } else {
      // Two muted, descending wood-like knocks: noticeable, never alarming.
      tone(c, 392, t, 0.16, 0.18, { type: 'triangle', to: 360, reverb: 0.12 });
      tone(c, 294, t + 0.12, 0.24, 0.18, { type: 'triangle', to: 262, reverb: 0.15 });
    }
  } catch { /* Sound is decorative; never let it interrupt work. */ }
}
