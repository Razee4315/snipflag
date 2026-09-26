import type { CaptureImage } from './model';

export type ImageReferences = Record<string, string>;
/** Aliases are never recycled: deleted images keep their identity until the draft is discarded. */
export function ensureImageReferences(images: CaptureImage[], existing: ImageReferences = {}): ImageReferences {
  const refs = { ...existing };
  let next = Math.max(0, ...Object.keys(refs).map(key => /^image[1-9]\d*$/.test(key) ? Number(key.slice(5)) : 0)) + 1;
  for (const image of images) if (!Object.values(refs).includes(image.id)) refs[`image${next++}`] = image.id;
  return refs;
}
export const imageReference = (id: string, refs: ImageReferences) => Object.keys(refs).find(key => refs[key] === id);

export interface Mention { start: number; end: number; key: string }
/** Literal code, escaped text, emails and URLs are not image references. Kept in sync with Rust. */
export function imageMentions(text: string): Mention[] {
  const mentions: Mention[] = [];
  let code = ''; let i = 0;
  while (i < text.length) {
    if (text[i] === '\\' && !code) { i += 2; continue; }
    if (text[i] === '`' || text[i] === '~') {
      const c = text[i]; let end = i + 1; while (text[end] === c) end++;
      const marker = text.slice(i, end);
      if (c === '`' || marker.length >= 3) { if (!code) code = marker; else if (code === marker) code = ''; }
      i = end; continue;
    }
    if (!code && text[i] === '@' && (i === 0 || /[\s(,;:]/.test(text[i - 1]))) {
      const match = /^@image([1-9]\d*)(?![\w])/i.exec(text.slice(i));
      if (match) { mentions.push({ start: i, end: i + match[0].length, key: `image${match[1]}` }); i += match[0].length; continue; }
    }
    i++;
  }
  return mentions;
}
export function missingImageReferences(text: string, images: CaptureImage[], refs: ImageReferences): string[] {
  return [...new Set(imageMentions(text).map(m => m.key).filter(key => !images.some(image => image.id === refs[key])))];
}

export function mentionQuery(text: string, caret: number): { start: number; end: number; query: string } | null {
  const match = /(?:^|[\s(,;:])@([\p{L}\p{N}_-]*)$/u.exec(text.slice(0, caret));
  if (!match) return null;
  const start = caret - match[1].length - 1;
  // An artificial complete token lets the same literal-code rules govern the picker.
  if (!imageMentions(`${text.slice(0, start)}@image1 `).some(m => m.start === start)) return null;
  return { start, end: caret, query: match[1].toLowerCase() };
}
