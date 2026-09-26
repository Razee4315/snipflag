import { describe, expect, it } from 'vitest';
import { isBrowserShortcut } from './desktop';

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) =>
  ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

describe('desktop guards', () => {
  it('blocks browser commands everywhere', () => {
    for (const k of ['j', 'p', 'f', 'r', 's', 'u', 'h', 'o', 'n', 't', 'g', 'l', '1', '=', '-', '0']) {
      expect(isBrowserShortcut(key(k, { ctrlKey: true }), false)).toBe(true);
      expect(isBrowserShortcut(key(k, { ctrlKey: true }), true)).toBe(true);
    }
    for (const k of ['F5', 'F12', 'F3', 'F7', 'F11', 'BrowserBack']) expect(isBrowserShortcut(key(k), false)).toBe(true);
    expect(isBrowserShortcut(key('ArrowLeft', { altKey: true }), false)).toBe(true);
    for (const k of ['I', 'J', 'C', 'S', 'Y', 'N']) expect(isBrowserShortcut(key(k, { ctrlKey: true, shiftKey: true }), true)).toBe(true);
  });
  it('keeps app and text editing shortcuts', () => {
    for (const k of ['z', 'y', 'v', 'c', 'x', 'Enter']) expect(isBrowserShortcut(key(k, { ctrlKey: true }), false)).toBe(false);
    expect(isBrowserShortcut(key('Z', { ctrlKey: true, shiftKey: true }), false)).toBe(false);
    expect(isBrowserShortcut(key('a', { ctrlKey: true }), true)).toBe(false);
    expect(isBrowserShortcut(key('a', { ctrlKey: true }), false)).toBe(true);
    expect(isBrowserShortcut(key('End', { ctrlKey: true }), true)).toBe(false);
    expect(isBrowserShortcut(key('ArrowLeft', { ctrlKey: true, shiftKey: true }), true)).toBe(false);
    for (const k of ['a', 'r', 'Escape', 'Delete', 'Enter', 'ArrowLeft']) expect(isBrowserShortcut(key(k), false)).toBe(false);
  });
});
