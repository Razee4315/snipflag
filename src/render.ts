import { bounds, intersects, translate, type Box } from './geometry';
import { arrowHead, LIMITS, type Annotation, type CaptureImage } from './model';

export const FONT_FAMILY = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
export const LINE_HEIGHT = 1.2;
/** Privacy regions cover all ordinary marks; legacy solid redactions always stay last. */
export function paintOrder(annotations: Annotation[]) {
  return [
    ...annotations.filter(a => a.kind === 'highlight'),
    ...annotations.filter(a => a.kind !== 'highlight' && a.kind !== 'pixelate' && a.kind !== 'redact'),
    ...annotations.filter(a => a.kind === 'pixelate'),
    ...annotations.filter(a => a.kind === 'redact'),
  ];
}
/** Highlighter look: a translucent marker multiplied into the pixels, so dark text stays crisp underneath. */
export const HIGHLIGHT_ALPHA = 0.7;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('This image could not be read.')); img.src = src;
  });
}
/** Decoded pixels of the screenshots used most recently, so thumbnails and exports do not decode the same PNG again. */
const decoded = new Map<string, { dataUrl: string; image: Promise<HTMLImageElement> }>();
const MAX_DECODED = 3;
function sourceOf(image: Pick<CaptureImage, 'id' | 'dataUrl'>): Promise<HTMLImageElement> {
  const hit = decoded.get(image.id);
  // Re-inserting keeps the most recently used image last.
  decoded.delete(image.id);
  const entry = hit && hit.dataUrl === image.dataUrl ? hit : { dataUrl: image.dataUrl, image: loadImage(image.dataUrl) };
  decoded.set(image.id, entry);
  entry.image.catch(() => { if (decoded.get(image.id) === entry) decoded.delete(image.id); });
  for (const oldest of decoded.keys()) { if (decoded.size <= MAX_DECODED) break; decoded.delete(oldest); }
  return entry.image;
}
function canvas(width: number, height: number) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; return c;
}
/** Converts an imported file or blob to a PNG session image, enforcing Snipflag's limits before mutation. */
export async function importImage(file: Blob, name = 'Screenshot'): Promise<CaptureImage> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > LIMITS.imageBytes) throw new Error('Each image must be under 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return fromDrawable(img, img.naturalWidth, img.naturalHeight, name);
  } finally { URL.revokeObjectURL(url); }
}
export function fromDrawable(source: CanvasImageSource, width: number, height: number, name: string): CaptureImage {
  if (!width || !height) throw new Error('This image is empty.');
  if (width * height > LIMITS.pixels) throw new Error('Each image must be under 40 megapixels.');
  const c = canvas(width, height); c.getContext('2d')!.drawImage(source, 0, 0);
  const dataUrl = c.toDataURL('image/png');
  if (dataUrl.length * 0.75 > LIMITS.imageBytes) throw new Error('The converted PNG exceeds 20 MB. Choose a smaller image.');
  return { id: crypto.randomUUID(), name, width, height, dataUrl, annotations: [] };
}
export function fileBaseName(name: string) { return name.replace(/\.[^.]+$/, '').slice(0, 120); }

/** Minimum privacy block size. Pixelation is not a guarantee of anonymization. */
export const pixelBlock = (width: number, height: number) => Math.max(12, Math.round(Math.min(width, height) / 6));

/**
 * Pixelates the source pixels under `a` with true per-block color averages (not smoothed resampling, which can
 * keep recoverable detail). Blocks are aligned to the image grid so neighboring areas match. The result is burned
 * into exports.
 */
export function pixelRect(a: Pick<Annotation, 'x' | 'y' | 'width' | 'height'>) {
  const x = Math.floor(a.x), y = Math.floor(a.y);
  return { x, y, width: Math.max(1, Math.ceil(a.x + a.width) - x), height: Math.max(1, Math.ceil(a.y + a.height) - y) };
}
export function pixelate(source: CanvasImageSource, a: Pick<Annotation, 'x' | 'y' | 'width' | 'height'>) {
  const { x: x0, y: y0, width: w, height: h } = pixelRect(a);
  const block = pixelBlock(w, h);
  // Expand to whole grid blocks, read them once, then paint each block's average color.
  const gx = Math.floor(x0 / block) * block; const gy = Math.floor(y0 / block) * block;
  const gw = Math.ceil((x0 + w - gx) / block) * block; const gh = Math.ceil((y0 + h - gy) / block) * block;
  const read = canvas(gw, gh); const r = read.getContext('2d', { willReadFrequently: true })!;
  r.drawImage(source, -gx, -gy);
  const data = r.getImageData(0, 0, gw, gh).data;
  const out = canvas(w, h); const ctx = out.getContext('2d')!;
  for (let by = 0; by < gh; by += block) {
    for (let bx = 0; bx < gw; bx += block) {
      // Alpha-weighted average over real pixels only: grid cells past the image edge must not thin out a block
      // and let original pixels show through.
      let red = 0, green = 0, blue = 0, alpha = 0, visible = 0;
      for (let y = by; y < by + block; y++) {
        for (let x = bx; x < bx + block; x++) {
          const i = (y * gw + x) * 4; const o = data[i + 3];
          if (!o) continue;
          red += data[i] * o; green += data[i + 1] * o; blue += data[i + 2] * o; alpha += o; visible++;
        }
      }
      if (!visible) continue;
      ctx.fillStyle = `rgba(${Math.round(red / alpha)}, ${Math.round(green / alpha)}, ${Math.round(blue / alpha)}, ${(alpha / visible / 255).toFixed(3)})`;
      ctx.fillRect(gx + bx - x0, gy + by - y0, block, block);
    }
  }
  return out;
}
/** Replace, never alpha-blend with the sensitive original underneath. Shared by editor and all exports. */
export function paintPixelation(ctx: CanvasRenderingContext2D, pixels: HTMLCanvasElement, a: Annotation) {
  const rect = pixelRect(a);
  ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
  ctx.drawImage(pixels, rect.x, rect.y);
}
/** How far the plate behind a text mark reaches past the letters, in image pixels. */
export const textPlatePad = (fontSize: number) => fontSize * 0.3;
/** Black or white, whichever reads better on a badge color. */
export function contrastText(hex: string) {
  const v = hex.replace('#', ''); const n = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#111827' : '#FFFFFF';
}
/** Smooth freehand stroke: quadratic curves through segment midpoints remove the jagged polyline look. */
function strokeSmooth(ctx: CanvasRenderingContext2D, p: number[]) {
  const n = p.length;
  ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  if (n <= 4) { ctx.lineTo(p[n - 2], p[n - 1]); ctx.stroke(); return; }
  for (let i = 2; i < n - 2; i += 2) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
  ctx.lineTo(p[n - 2], p[n - 1]); ctx.stroke();
}

export function drawAnnotation(ctx: CanvasRenderingContext2D, source: CanvasImageSource, a: Annotation) {
  ctx.save();
  ctx.strokeStyle = a.color; ctx.fillStyle = a.color; ctx.lineWidth = a.stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (a.kind === 'rectangle') ctx.strokeRect(a.x, a.y, a.width, a.height);
  if (a.kind === 'ellipse' && a.width > 0 && a.height > 0) {
    ctx.beginPath(); ctx.ellipse(a.x + a.width / 2, a.y + a.height / 2, a.width / 2, a.height / 2, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (a.kind === 'step') {
    const r = a.width / 2; const cx = a.x + r; const cy = a.y + r;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.14); ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    ctx.fillStyle = contrastText(a.color); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(r * (a.text.length > 1 ? 0.95 : 1.1))}px ${FONT_FAMILY}`;
    ctx.fillText(a.text, cx, cy + r * 0.04);
  }
  if (a.kind === 'redact') { ctx.globalAlpha = 1; ctx.fillStyle = '#000000'; ctx.fillRect(Math.floor(a.x), Math.floor(a.y), Math.ceil(a.width) + 1, Math.ceil(a.height) + 1); }
  if (a.kind === 'pixelate' && a.width >= 1 && a.height >= 1) paintPixelation(ctx, pixelate(source, a), a);
  if (a.kind === 'text') {
    ctx.font = `bold ${a.fontSize}px ${FONT_FAMILY}`; ctx.textBaseline = 'middle';
    const lines = a.text.split('\n');
    if (a.backdrop) {
      const pad = textPlatePad(a.fontSize); const width = Math.max(...lines.map(line => ctx.measureText(line).width));
      ctx.save(); ctx.fillStyle = contrastText(a.color); ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.roundRect(a.x - pad, a.y - pad / 2, width + pad * 2, lines.length * a.fontSize * LINE_HEIGHT + pad, pad); ctx.fill();
      ctx.restore();
    }
    lines.forEach((line, i) => ctx.fillText(line, a.x, a.y + (i + 0.5) * a.fontSize * LINE_HEIGHT));
  }
  if (a.kind === 'highlight' && a.points.length >= 4) {
    ctx.translate(a.x, a.y); ctx.globalAlpha = HIGHLIGHT_ALPHA; ctx.globalCompositeOperation = 'multiply';
    strokeSmooth(ctx, a.points);
  }
  if ((a.kind === 'pen' || a.kind === 'arrow' || a.kind === 'line') && a.points.length >= 4) {
    ctx.translate(a.x, a.y);
    const p = a.points; const n = p.length;
    let endX = p[n - 2], endY = p[n - 1];
    if (a.kind === 'arrow') {
      // Stop the shaft at the head's base so the tip stays sharp.
      const angle = Math.atan2(endY - p[1], endX - p[0]); const head = arrowHead(a.stroke);
      ctx.beginPath(); ctx.moveTo(endX, endY);
      ctx.lineTo(endX - head * Math.cos(angle - Math.PI / 6), endY - head * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - head * Math.cos(angle + Math.PI / 6), endY - head * Math.sin(angle + Math.PI / 6));
      ctx.closePath(); ctx.fill();
      endX -= Math.cos(angle) * head * 0.8; endY -= Math.sin(angle) * head * 0.8;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(endX, endY); ctx.stroke();
    } else if (a.kind === 'line') { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(endX, endY); ctx.stroke(); }
    else strokeSmooth(ctx, p);
  }
  ctx.restore();
}
/** The crop rectangle in whole pixels inside the image. */
export function cropBox(image: Pick<CaptureImage, 'width' | 'height'>, rect: Box): Box {
  const x = Math.max(0, Math.min(image.width - 1, Math.floor(rect.x))); const y = Math.max(0, Math.min(image.height - 1, Math.floor(rect.y)));
  return { x, y, width: Math.max(1, Math.min(image.width, Math.ceil(rect.x + rect.width)) - x), height: Math.max(1, Math.min(image.height, Math.ceil(rect.y + rect.height)) - y) };
}
/** Marks moved into the cropped image's coordinates; marks entirely outside the crop are dropped. */
export function cropAnnotations(annotations: Annotation[], box: Box) {
  return annotations.filter(a => intersects(bounds(a), box)).map(a => translate(a, -box.x, -box.y));
}
/**
 * Crops the original pixels and returns a new image with a new identity (saved images are immutable per ID).
 * Marks stay editable in the new coordinates.
 */
export async function cropImage(image: CaptureImage, rect: Box): Promise<CaptureImage> {
  const box = cropBox(image, rect);
  const source = await sourceOf(image);
  const c = canvas(box.width, box.height); c.getContext('2d')!.drawImage(source, -box.x, -box.y);
  return { ...image, id: crypto.randomUUID(), width: box.width, height: box.height, dataUrl: c.toDataURL('image/png'), annotations: cropAnnotations(image.annotations, box) };
}
/** Authoritative export: original dimensions, flattened pixels, pixelation burned in. */
export async function flattenedCanvas(image: CaptureImage): Promise<HTMLCanvasElement> {
  const source = await sourceOf(image);
  const c = canvas(image.width, image.height); const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  for (const a of paintOrder(image.annotations)) drawAnnotation(ctx, source, a);
  return c;
}
export async function flatten(image: CaptureImage): Promise<string> { return (await flattenedCanvas(image)).toDataURL('image/png'); }

const thumbnails = new WeakMap<Annotation[], { source: string; result: Promise<string> }>();
let thumbnailQueue: Promise<void> = Promise.resolve();
/** Bounded previews of exactly the exported revision. Never fall back to the original. */
export function thumbnail(image: CaptureImage): Promise<string> {
  const cached = thumbnails.get(image.annotations);
  if (cached?.source === image.dataUrl) return cached.result;
  const result = thumbnailQueue.then(() => flattenedCanvas(image)).then(source => {
    const scale = Math.min(1, 160 / Math.max(image.width, image.height));
    const out = canvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
    out.getContext('2d')!.drawImage(source, 0, 0, out.width, out.height);
    const url = out.toDataURL('image/png'); source.width = 0; source.height = 0;
    return url;
  });
  thumbnailQueue = result.then(() => undefined, () => undefined);
  thumbnails.set(image.annotations, { source: image.dataUrl, result });
  return result;
}
