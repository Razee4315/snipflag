import { describe, expect, it } from 'vitest';
import type { CaptureImage } from './model';
import { composeDescription, reportParts, sectionHeading } from './report';
import cases from './report.fixtures.json';

type Case = { name: string; session: { description: string; imageReferences?: Record<string, string>; images: { id: string; name: string }[] }; urls: Record<string, string>; expected: string };
const image = (i: { id: string; name: string }): CaptureImage => ({ ...i, width: 1, height: 1, dataUrl: '', annotations: [] });

describe('outgoing report', () => {
  it.each(cases as unknown as Case[])('matches the Rust submission for: $name', c => {
    const parts = reportParts({ ...c.session, images: c.session.images.map(image) });
    expect(composeDescription(parts, id => c.urls[id])).toBe(c.expected);
  });
  it('shows captions as Linear renders them while the Markdown stays escaped', () => {
    const parts = reportParts({ description: '', imageReferences: { image1: 'a' }, images: [image({ id: 'a', name: 'Cart * total\nfooter' })] });
    expect(sectionHeading(parts.sections[0], 0)).toBe('1. @image1 · Cart * total footer');
    expect(composeDescription(parts, () => 'u')).toContain('### 1. @image1 · Cart \\* total footer');
  });
  it('refuses references to images that are no longer attached', () => {
    expect(() => reportParts({ description: 'See @image2', imageReferences: { image1: 'a', image2: 'gone' }, images: [image({ id: 'a', name: '' })] })).toThrow('@image2 is not attached');
  });
});
