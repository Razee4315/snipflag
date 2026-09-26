/** Hue 0–360, saturation and value 0–1. */
export interface Hsv { h: number; s: number; v: number }

/** Accepts `#abc`, `abc`, `#aabbcc` or `aabbcc`; returns uppercase `#RRGGBB`, or null when invalid. */
export function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(v)) return `#${v.split('').map(c => c + c).join('')}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v}`.toUpperCase();
  return null;
}
export function hexToHsv(hex: string): Hsv | null {
  const n = normalizeHex(hex); if (!n) return null;
  const r = parseInt(n.slice(1, 3), 16) / 255, g = parseInt(n.slice(3, 5), 16) / 255, b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return `#${[f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

const KEY = 'snipflag-custom-colors';
export type ColorSet = 'pen' | 'marker';
/** Recently picked custom colors, newest first. A per-device convenience; storage failures just mean no history. */
export function loadCustomColors(set: ColorSet): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}')[set]; return Array.isArray(v) ? v.map(String).map(normalizeHex).filter((x): x is string => !!x).slice(0, 5) : []; }
  catch { return []; }
}
export function saveCustomColor(set: ColorSet, hex: string, builtIn: string[]): string[] {
  const color = normalizeHex(hex); const current = loadCustomColors(set);
  if (!color || builtIn.includes(color)) return current;
  const next = [color, ...current.filter(c => c !== color)].slice(0, 5);
  try { const all = JSON.parse(localStorage.getItem(KEY) || '{}'); localStorage.setItem(KEY, JSON.stringify({ ...all, [set]: next })); } catch { /* keep in memory only */ }
  return next;
}
