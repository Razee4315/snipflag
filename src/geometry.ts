import { isFreehand, isSegment, type Annotation } from './model';

export interface Box { x: number; y: number; width: number; height: number }
export interface Point { x: number; y: number }

/** Snap a segment to 15-degree increments, shortening at image edges without changing its angle. */
export function snapAngle(origin: Point, pointer: Point, size: { width: number; height: number }): Point {
  const dx = pointer.x - origin.x, dy = pointer.y - origin.y;
  const step = Math.PI / 12;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  const length = Math.hypot(dx, dy);
  const x = Math.cos(angle) * length, y = Math.sin(angle) * length;
  const tx = Math.abs(x) < 1e-9 ? 1 : (x > 0 ? size.width - origin.x : -origin.x) / x;
  const ty = Math.abs(y) < 1e-9 ? 1 : (y > 0 ? size.height - origin.y : -origin.y) / y;
  const ratio = Math.max(0, Math.min(1, tx, ty));
  return { x: origin.x + x * ratio, y: origin.y + y * ratio };
}
const HEAD = (stroke: number) => Math.max(12, stroke * 4);

/** Bounding box in image pixels, padded to include strokes and arrow heads. */
export function bounds(a: Annotation): Box {
  if (isFreehand(a.kind) || isSegment(a.kind)) {
    const xs = a.points.filter((_, i) => i % 2 === 0); const ys = a.points.filter((_, i) => i % 2 === 1);
    const pad = a.kind === 'arrow' ? Math.max(HEAD(a.stroke), a.stroke) : a.stroke;
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x: a.x + minX - pad, y: a.y + minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
  }
  if (a.kind === 'rectangle' || a.kind === 'ellipse') return { x: a.x - a.stroke / 2, y: a.y - a.stroke / 2, width: a.width + a.stroke, height: a.height + a.stroke };
  return { x: a.x, y: a.y, width: a.width, height: a.height };
}
export function translate(a: Annotation, dx: number, dy: number): Annotation { return { ...a, x: a.x + dx, y: a.y + dy }; }
/**
 * Applies a Konva-style transform (the bounding box moved to `box.x/y` and scaled by `sx/sy`).
 * Stroke widths are preserved; text scales its font size.
 */
export function transform(a: Annotation, box: Box, sx: number, sy: number): Annotation {
  const old = bounds(a);
  const x = box.x + (a.x - old.x) * sx; const y = box.y + (a.y - old.y) * sy;
  if (isFreehand(a.kind) || isSegment(a.kind)) return { ...a, x, y, points: a.points.map((v, i) => i % 2 === 0 ? v * sx : v * sy) };
  if (a.kind === 'step') {
    // Badges stay round: scale by the larger factor.
    const side = Math.max(12, Math.min(400, a.width * Math.max(sx, sy)));
    return { ...a, x: box.x, y: box.y, width: side, height: side };
  }
  if (a.kind === 'text') {
    const fontSize = Math.max(8, Math.min(400, Math.round(a.fontSize * sy)));
    return { ...a, x: box.x, y: box.y, fontSize, width: a.width * (fontSize / a.fontSize), height: a.height * (fontSize / a.fontSize) };
  }
  return { ...a, x, y, width: Math.max(1, a.width * sx), height: Math.max(1, a.height * sy) };
}
/** Whether two boxes share any area. */
export function intersects(a: Box, b: Box) { return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height; }
/** A copy placed a little down and to the right of the original, kept on the image where possible. */
export function duplicate(a: Annotation, size: { width: number; height: number }): Annotation {
  const box = bounds(a);
  const dx = box.x + box.width + 16 <= size.width ? 16 : -16; const dy = box.y + box.height + 16 <= size.height ? 16 : -16;
  return { ...translate(a, dx, dy), id: crypto.randomUUID(), points: [...a.points] };
}
export interface Snap { dx: number; dy: number; x: number | null; y: number | null }
/**
 * Nudges a moving box so one of its edges or its middle lines up with the image's edges or middle, or with
 * another mark's, when it is within `threshold`. `x`/`y` are the guide lines to draw, or null.
 */
export function snapBox(box: Box, others: Box[], size: { width: number; height: number }, threshold: number): Snap {
  const axis = (start: number, length: number, targets: number[]) => {
    let best: { delta: number; line: number } | null = null;
    for (const target of targets) for (const edge of [start, start + length / 2, start + length]) {
      const delta = target - edge;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line: target };
    }
    return best;
  };
  const x = axis(box.x, box.width, [0, size.width / 2, size.width, ...others.flatMap(o => [o.x, o.x + o.width / 2, o.x + o.width])]);
  const y = axis(box.y, box.height, [0, size.height / 2, size.height, ...others.flatMap(o => [o.y, o.y + o.height / 2, o.y + o.height])]);
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, x: x?.line ?? null, y: y?.line ?? null };
}
/** Whether a finished drag produced something worth keeping. */
export function isMeaningful(a: Annotation): boolean {
  if (a.kind === 'text') return a.text.trim().length > 0;
  if (a.kind === 'step') return true;
  if (isFreehand(a.kind)) return a.points.some((x, i) => i % 2 === 0 && Math.hypot(x - a.points[0], a.points[i + 1] - a.points[1]) >= 1);
  if (isSegment(a.kind)) return Math.hypot(a.points[2] - a.points[0], a.points[3] - a.points[1]) >= 6;
  return a.width >= 3 && a.height >= 3;
}
