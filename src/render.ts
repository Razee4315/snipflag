import { LIMITS, type Annotation, type CaptureImage } from './model';

export const FONT_FAMILY = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
export const LINE_HEIGHT = 1.2;
/** Arrow head length in image pixels, shared by editor and export. */
export const arrowHead = (stroke: number) => Math.max(12, stroke * 4);
/** Paint order: redactions always last so nothing drawn later can expose their pixels. */
export function paintOrder(annotations: Annotation[]) {
  return [...annotations.filter(a => a.kind !== 'redact'), ...annotations.filter(a => a.kind === 'redact')];
}

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

/** Cosmetic pixelation of the source pixels under `a`. Not a secure redaction. */
export function pixelate(source: CanvasImageSource, a: Pick<Annotation, 'x' | 'y' | 'width' | 'height'>) {
  const w = Math.max(1, Math.round(a.width)); const h = Math.max(1, Math.round(a.height));
  const block = Math.max(6, Math.round(Math.min(w, h) / 12));
  const tiny = canvas(Math.max(1, Math.ceil(w / block)), Math.max(1, Math.ceil(h / block)));
  const t = tiny.getContext('2d')!; t.imageSmoothingEnabled = true;
  t.drawImage(source, Math.round(a.x), Math.round(a.y), w, h, 0, 0, tiny.width, tiny.height);
  const out = canvas(w, h); const ctx = out.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, w, h); return out;
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
    } else {
      ctx.beginPath(); ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < n; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}
/** Authoritative export: original dimensions, flattened pixels, redaction painted last. */
export async function flatten(image: CaptureImage): Promise<string> {
  const source = await loadImage(image.dataUrl);
  const c = canvas(image.width, image.height); const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  for (const a of paintOrder(image.annotations)) drawAnnotation(ctx, source, a);
  return c.toDataURL('image/png');
}
