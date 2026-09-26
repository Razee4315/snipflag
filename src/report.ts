import { imageMentions, type ImageReferences } from './mentions';
import type { Session } from './model';

type ReportSource = Pick<Session, 'description' | 'images' | 'imageReferences'>;
export type ProseSegment = { text: string } | { key: string; imageId: string };
export interface ReportSection { imageId: string; caption: string; alt: string; fileName: string }
export interface ReportParts { prose: ProseSegment[]; sections: ReportSection[] }

/** Mirrors Rust `markdown_caption`: at most 200 characters, one line, Markdown punctuation escaped. */
export function markdownCaption(text: string) {
  return Array.from(text).slice(0, 200).map(c => '\\`*_{}[]<>#|!'.includes(c) ? `\\${c}` : c === '\n' || c === '\r' ? ' ' : c).join('');
}
/** Rust's `char::is_whitespace` set, which differs from JavaScript `trim` (U+0085, U+FEFF). */
const WHITESPACE = '[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]';
const LEADING = new RegExp(`^${WHITESPACE}+`), TRAILING = new RegExp(`${WHITESPACE}+$`);
export const trimEnd = (text: string) => text.replace(TRAILING, '');
const trim = (text: string) => trimEnd(text).replace(LEADING, '');
/** Older drafts without stored aliases refer to images by position, exactly as Rust does. */
function references(source: ReportSource): ImageReferences {
  return source.imageReferences ?? Object.fromEntries(source.images.map((image, i) => [`image${i + 1}`, image.id]));
}

/**
 * The report exactly as `compose_description` in src-tauri/src/linear.rs builds it, with upload addresses left open.
 * Both implementations are checked against src/report.fixtures.json.
 */
export function reportParts(source: ReportSource): ReportParts {
  const refs = references(source);
  const prose: ProseSegment[] = []; let cursor = 0;
  for (const m of imageMentions(source.description)) {
    const imageId = refs[m.key];
    if (!imageId || !source.images.some(i => i.id === imageId)) throw new Error(`@${m.key} is not attached. Remove the reference or choose another image.`);
    if (m.start > cursor) prose.push({ text: source.description.slice(cursor, m.start) });
    prose.push({ key: m.key, imageId }); cursor = m.end;
  }
  if (cursor < source.description.length) prose.push({ text: source.description.slice(cursor) });
  const sections = source.images.map((image, i) => {
    const alias = source.imageReferences ? Object.keys(refs).sort().find(key => refs[key] === image.id) : undefined;
    const caption = alias ? (image.name ? `@${alias} · ${image.name}` : `@${alias}`) : image.name;
    return { imageId: image.id, caption: trim(caption), alt: `Screenshot ${i + 1}`, fileName: `screenshot-${i + 1}.png` };
  });
  return { prose, sections };
}
/** Section heading as Linear displays it (the Markdown source escapes it; see `markdownCaption`). */
export function sectionHeading(section: ReportSection, index: number) {
  const caption = Array.from(section.caption).slice(0, 200).join('').replace(/[\r\n]/g, ' ');
  return `${index + 1}. ${caption || `Screenshot ${index + 1}`}`;
}
/** Assembles the Markdown description. `url` receives each image ID and returns its upload address. */
export function composeDescription(parts: ReportParts, url: (imageId: string) => string) {
  let out = parts.prose.map(s => 'text' in s ? s.text : `[@${s.key}](<${url(s.imageId)}>)`).join('');
  out = trimEnd(out);
  parts.sections.forEach((section, i) => {
    const heading = markdownCaption(section.caption) || `Screenshot ${i + 1}`;
    if (out) out += '\n\n';
    out += `### ${i + 1}. ${heading}\n\n![${section.alt}](${url(section.imageId)})`;
  });
  return out;
}
