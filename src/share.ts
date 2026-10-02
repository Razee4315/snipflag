import { imageLabel, type CaptureImage, type Session } from './model';

/** Numbered steps on an image that carry a note, in badge order. */
export function stepNotes(image: Pick<CaptureImage, 'annotations'>) {
  return image.annotations
    .filter(a => a.kind === 'step' && a.note?.trim())
    .sort((a, b) => (Number(a.text) || 0) - (Number(b.text) || 0))
    .map(a => ({ number: a.text, note: a.note!.trim() }));
}
const notesBlock = (image: Pick<CaptureImage, 'annotations'>) => stepNotes(image).map(s => `${s.number}. ${s.note}`).join('\n');

/** Step notes of every image as plain text, for the issue description. Empty when no step has a note. */
export function stepNotesText(images: CaptureImage[]) {
  const noted = images.map((image, index) => ({ image, index, notes: notesBlock(image) })).filter(x => x.notes);
  return noted.map(x => (images.length > 1 ? `${imageLabel(x.image, x.index)}\n${x.notes}` : x.notes)).join('\n\n');
}

/**
 * Text to paste into an assistant or a chat next to saved screenshots: what the report says, where each flattened
 * image is on disk, and what every numbered step means. `paths` are in image order.
 */
export function sharePrompt(session: Pick<Session, 'title' | 'description' | 'images'>, paths: string[]) {
  const many = session.images.length > 1;
  const shots = session.images.map((image, index) => {
    const caption = image.name.trim();
    const heading = `${many ? `Screenshot ${index + 1}` : 'Screenshot'}${caption ? ` (${caption})` : ''}: ${paths[index] ?? ''}`;
    const notes = notesBlock(image);
    return notes ? `${heading}\n${notes}` : heading;
  });
  return [session.title.trim(), session.description.trim(), ...shots].filter(Boolean).join('\n\n');
}
