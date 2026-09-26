import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, normalizeHex } from './color';

describe('color', () => {
  it('normalizes hex input', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('ef4444')).toBe('#EF4444');
    expect(normalizeHex(' #12345 ')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });
  it('round-trips through HSV', () => {
    for (const hex of ['#EF4444', '#FDE047', '#000000', '#FFFFFF', '#3B82F6', '#0F6B62']) expect(hsvToHex(hexToHsv(hex)!)).toBe(hex);
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00FF00');
  });
});
