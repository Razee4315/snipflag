import { describe, expect, it } from 'vitest';
import { ensureImageReferences, imageMentions, mentionQuery, missingImageReferences } from './mentions';
import type { CaptureImage } from './model';

const image = (id: string): CaptureImage => ({ id, name: '', width: 1, height: 1, dataUrl: '', annotations: [] });
describe('image references', () => {
  it('never retargets references after reorder, deletion, or adding another image', () => {
    const refs = ensureImageReferences([image('a'), image('b')]);
    expect(ensureImageReferences([image('b'), image('a')], refs)).toEqual(refs);
    const updated = ensureImageReferences([image('b'), image('c')], refs);
    expect(updated).toEqual({ image1: 'a', image2: 'b', image3: 'c' });
    expect(missingImageReferences('Wrong in @image1; correct in @image2.', [image('b'), image('c')], updated)).toEqual(['image1']);
  });
  it('does not reinterpret code, emails, links, escaped tokens, or longer words', () => {
    const text = '`@image1`\n```\n@image2\n```\n~~~\n@image3\n~~~\nqa@image4 https://example.com/@image5 \\@image6 @image7suffix [@image8](url) @IMAGE9';
    expect(imageMentions(text).map(m => m.key)).toEqual(['image9']);
  });
  it('finds repeated references in multilingual prose and punctuation', () => {
    const text = 'یہ @image1, then (@image2) and @image1.';
    expect(imageMentions(text).map(m => text.slice(m.start, m.end))).toEqual(['@image1', '@image2', '@image1']);
  });
  it('opens the picker only at a valid mention caret', () => {
    expect(mentionQuery('Bug in @', 8)).toEqual({ start: 7, end: 8, query: '' });
    expect(mentionQuery('Bug in @ima', 11)?.query).toBe('ima');
    expect(mentionQuery('email@ima', 9)).toBeNull();
    expect(mentionQuery('`@ima', 5)).toBeNull();
  });
});
