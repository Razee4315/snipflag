import type { Annotation } from './model';

export interface Box { x: number; y: number; width: number; height: number }
const HEAD = (stroke: number) => Math.max(12, stroke * 4);

/** Bounding box in image pixels, padded to include strokes and arrow heads. */
export function bounds(a: Annotation): Box {
  if (a.kind === 'pen' || a.kind === 'arrow') {
    const xs = a.points.filter((_, i) => i % 2 === 0); const ys = a.points.filter((_, i) => i % 2 === 1);
    const pad = a.kind === 'arrow' ? Math.max(HEAD(a.stroke), a.stroke) : a.stroke;
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x: a.x + minX - pad, y: a.y + minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
  }
  if (a.kind === 'rectangle') return { x: a.x - a.stroke / 2, y: a.y - a.stroke / 2, width: a.width + a.stroke, height: a.height + a.stroke };
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
  if (a.kind === 'pen' || a.kind === 'arrow') return { ...a, x, y, points: a.points.map((v, i) => i % 2 === 0 ? v * sx : v * sy) };
  if (a.kind === 'text') {
    const fontSize = Math.max(8, Math.min(400, Math.round(a.fontSize * sy)));
    return { ...a, x: box.x, y: box.y, fontSize, width: a.width * (fontSize / a.fontSize), height: a.height * (fontSize / a.fontSize) };
  }
  return { ...a, x, y, width: Math.max(1, a.width * sx), height: Math.max(1, a.height * sy) };
}
/** Whether a finished drag produced something worth keeping. */
export function isMeaningful(a: Annotation): boolean {
  if (a.kind === 'text') return a.text.trim().length > 0;
  if (a.kind === 'pen') return a.points.length >= 4;
  if (a.kind === 'arrow') return Math.hypot(a.points[2] - a.points[0], a.points[3] - a.points[1]) >= 6;
  return a.width >= 3 && a.height >= 3;
}
