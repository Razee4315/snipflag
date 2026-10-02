import { describe, expect, it } from 'vitest';
import { bounds, duplicate, intersects, isMeaningful, snapAngle, transform, translate } from './geometry';
import { cropAnnotations, cropBox } from './render';
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
  it('treats a line as a two-point segment padded by its stroke only', () => {
    const line = a({ kind: 'line', points: [0, 0, 30, 0] });
    expect(bounds(line)).toEqual({ x: 6, y: 6, width: 38, height: 8 });
    expect(isMeaningful(line)).toBe(true);
    expect(isMeaningful(a({ kind: 'line', points: [0, 0, 2, 2] }))).toBe(false);
    expect(transform(line, { x: 6, y: 6, width: 76, height: 8 }, 2, 1).points).toEqual([0, 0, 60, 0]);
  });
  it('duplicates beside the original with a new identity, turning back at the image edge', () => {
    const copy = duplicate(a({}), { width: 400, height: 300 });
    expect(copy).toMatchObject({ x: 26, y: 26, width: 20, height: 10 });
    expect(copy.id).not.toBe('a');
    expect(duplicate(a({ x: 375, y: 285 }), { width: 400, height: 300 })).toMatchObject({ x: 359, y: 269 });
  });
  it('crops to whole pixels inside the image and keeps only the marks that still show', () => {
    expect(cropBox({ width: 400, height: 300 }, { x: 10.6, y: 20.2, width: 100.1, height: 50 })).toEqual({ x: 10, y: 20, width: 101, height: 51 });
    expect(cropBox({ width: 400, height: 300 }, { x: -20, y: 280, width: 900, height: 900 })).toEqual({ x: 0, y: 280, width: 400, height: 20 });
    const box = { x: 100, y: 100, width: 100, height: 100 };
    expect(intersects(bounds(a({})), box)).toBe(false);
    const kept = cropAnnotations([a({}), a({ id: 'b', x: 150, y: 120 }), a({ id: 'c', kind: 'pen', x: 190, y: 190, points: [0, 0, 40, 40] })], box);
    expect(kept.map(k => [k.id, k.x, k.y])).toEqual([['b', 50, 20], ['c', 90, 90]]);
  });
});
