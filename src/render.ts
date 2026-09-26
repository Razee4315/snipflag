import { LIMITS, type Annotation, type CaptureImage } from './model';

export const FONT_FAMILY = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
export const LINE_HEIGHT = 1.2;
/** Arrow head length in image pixels, shared by editor and export. */
export const arrowHead = (stroke: number) => Math.max(12, stroke * 4);
/** Paint order: highlights sit under every other mark; legacy solid redactions stay last so nothing can expose their pixels. */
export function paintOrder(annotations: Annotation[]) {
  return [
    ...annotations.filter(a => a.kind === 'highlight'),
    ...annotations.filter(a => a.kind !== 'highlight' && a.kind !== 'redact'),
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

/** Pixel block size for a pixelation area: large enough that text and faces are unreadable, even on small areas. */
export const pixelBlock = (width: number, height: number) => Math.max(12, Math.round(Math.min(width, height) / 6));

/**
 * Pixelates the source pixels under `a` with true per-block color averages (not smoothed resampling, which can
 * keep recoverable detail). Blocks are aligned to the image grid so neighboring areas match. The result is burned
 * into exports.
 */
export function pixelate(source: CanvasImageSource, a: Pick<Annotation, 'x' | 'y' | 'width' | 'height'>) {
  const x0 = Math.round(a.x); const y0 = Math.round(a.y);
  const w = Math.max(1, Math.round(a.width)); const h = Math.max(1, Math.round(a.height));
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
  if (a.kind === 'redact') { ctx.globalAlpha = 1; ctx.fillStyle = '#000000'; ctx.fillRect(Math.floor(a.x), Math.floor(a.y), Math.ceil(a.width) + 1, Math.ceil(a.height) + 1); }
  if (a.kind === 'pixelate' && a.width >= 1 && a.height >= 1) ctx.drawImage(pixelate(source, a), Math.round(a.x), Math.round(a.y));
  if (a.kind === 'text') {
    ctx.font = `bold ${a.fontSize}px ${FONT_FAMILY}`; ctx.textBaseline = 'middle';
    a.text.split('\n').forEach((line, i) => ctx.fillText(line, a.x, a.y + (i + 0.5) * a.fontSize * LINE_HEIGHT));
  }
  if (a.kind === 'highlight' && a.points.length >= 4) {
    ctx.translate(a.x, a.y); ctx.globalAlpha = HIGHLIGHT_ALPHA; ctx.globalCompositeOperation = 'multiply';
    strokeSmooth(ctx, a.points);
  }
  if ((a.kind === 'pen' || a.kind === 'arrow') && a.points.length >= 4) {
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
    } else strokeSmooth(ctx, p);
  }
  ctx.restore();
}
/** Authoritative export: original dimensions, flattened pixels, pixelation burned in. */
export async function flatten(image: CaptureImage): Promise<string> {
  const source = await loadImage(image.dataUrl);
  const c = canvas(image.width, image.height); const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  for (const a of paintOrder(image.annotations)) drawAnnotation(ctx, source, a);
  return c.toDataURL('image/png');
}
