import { describe, expect, it } from 'vitest';
import { acceleratorFromEvent, clampRect, newSession, normalizeRect, reorder, shortcutLabel, toFramePixels, validateSession } from './model';

describe('model', () => {
  it('reorders without mutating and ignores out-of-range moves', () => {
    const items = ['a', 'b', 'c'];
    expect(reorder(items, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(reorder(items, 0, 5)).toBe(items);
    expect(items).toEqual(['a', 'b', 'c']);
  });
  it('validates a session before sending', () => {
    const s = newSession();
    expect(validateSession(s)).toMatch(/screenshot/);
    s.images = [{ id: crypto.randomUUID(), name: '', width: 1, height: 1, dataUrl: 'data:,', annotations: [] }];
    expect(validateSession(s)).toMatch(/title/);
    s.title = 'Broken button';
    expect(validateSession(s)).toMatch(/team/);
    s.teamId = crypto.randomUUID();
    expect(validateSession(s)).toBeNull();
    s.issue = { id: 'x', identifier: 'ENG-1', url: 'https://linear.app/x' };
    expect(validateSession(s)).toMatch(/already been sent/);
  });
  it('normalizes and clamps rectangles to the image', () => {
    expect(normalizeRect(10, 10, 2, 4)).toEqual({ x: 2, y: 4, width: 8, height: 6 });
    expect(clampRect({ x: -5, y: 90, width: 20, height: 20 }, 100, 100)).toEqual({ x: 0, y: 90, width: 15, height: 10 });
  });
  it('converts overlay selections to frame pixels (high DPI)', () => {
    expect(toFramePixels({ x: 10, y: 20, width: 100, height: 50 }, { width: 1280, height: 720 }, { width: 2560, height: 1440 }))
      .toEqual({ x: 20, y: 40, width: 200, height: 100 });
  });
  it('builds accelerators only with modifiers', () => {
    const base = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };
    expect(acceleratorFromEvent({ ...base, ctrlKey: true, shiftKey: true, code: 'Digit2' })).toBe('CommandOrControl+Shift+Digit2');
    expect(acceleratorFromEvent({ ...base, code: 'KeyA' })).toBeNull();
    expect(acceleratorFromEvent({ ...base, code: 'F9' })).toBe('F9');
    expect(acceleratorFromEvent({ ...base, ctrlKey: true, code: 'ShiftLeft' })).toBeNull();
    expect(shortcutLabel('CommandOrControl+Shift+Digit2', false)).toBe('Ctrl+Shift+2');
    expect(shortcutLabel('CommandOrControl+Shift+Digit2', true)).toBe('Cmd+Shift+2');
  });
});
