import { describe, expect, it } from 'vitest';
import { bounds, isMeaningful, snapAngle, transform, translate } from './geometry';
import type { Annotation } from './model';

const a = (patch: Partial<Annotation>): Annotation => ({ id: 'a', kind: 'rectangle', x: 10, y: 10, width: 20, height: 10, points: [], color: '#f00', stroke: 4, text: '', fontSize: 22, ...patch });

describe('geometry', () => {
  it('snaps every quadrant to 15-degree increments without changing segment length', () => {
    for (const degrees of [0, 15, 30, 45, 90, 135, 180, -15, -45, -90, -135]) {
      const raw = (degrees + 3) * Math.PI / 180;
      const end = snapAngle({ x: 200, y: 200 }, { x: 200 + 80 * Math.cos(raw), y: 200 + 80 * Math.sin(raw) }, { width: 400, height: 400 });
      expect(end.x).toBeCloseTo(200 + 80 * Math.cos(degrees * Math.PI / 180));
      expect(end.y).toBeCloseTo(200 + 80 * Math.sin(degrees * Math.PI / 180));
    }
  });
  it('shortens snapped segments at the image boundary while preserving the angle', () => {
    const end = snapAngle({ x: 90, y: 50 }, { x: 100, y: 70 }, { width: 100, height: 100 });
    expect(end.x).toBeCloseTo(100);
    expect((end.y - 50) / (end.x - 90)).toBeCloseTo(Math.tan(Math.PI / 3));
    expect(snapAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { width: 100, height: 100 })).toEqual({ x: 0, y: 0 });
  });
  it('pads rectangles and arrows by their strokes', () => {
    expect(bounds(a({}))).toEqual({ x: 8, y: 8, width: 24, height: 14 });
    const arrow = bounds(a({ kind: 'arrow', points: [0, 0, 100, 0] }));
    expect(arrow.x).toBe(10 - 16); expect(arrow.width).toBe(100 + 32);
  });
  it('moves and scales in image coordinates', () => {
    expect(translate(a({}), 5, -5)).toMatchObject({ x: 15, y: 5 });
    const box = bounds(a({ stroke: 0 }));
    expect(transform(a({ stroke: 0 }), { ...box, x: 0, y: 0 }, 2, 3)).toMatchObject({ x: 0, y: 0, width: 40, height: 30 });
    const pen = transform(a({ kind: 'pen', stroke: 0, points: [0, 0, 10, 10] }), { x: 10, y: 10, width: 20, height: 20 }, 2, 2);
    expect(pen.points).toEqual([0, 0, 20, 20]);
  });
  it('discards accidental clicks', () => {
    expect(isMeaningful(a({ width: 1, height: 1 }))).toBe(false);
    expect(isMeaningful(a({ kind: 'arrow', points: [0, 0, 2, 2] }))).toBe(false);
    expect(isMeaningful(a({ kind: 'pen', points: [0, 0, 0, 0] }))).toBe(false);
    expect(isMeaningful(a({ kind: 'text', text: '  ' }))).toBe(false);
    expect(isMeaningful(a({}))).toBe(true);
  });
});
