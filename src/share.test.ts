import { describe, expect, it } from 'vitest';
import type { Annotation, CaptureImage } from './model';
import { sharePrompt, stepNotes, stepNotesText } from './share';

const mark = (kind: Annotation['kind'], text: string, note?: string): Annotation =>
  ({ id: crypto.randomUUID(), kind, x: 0, y: 0, width: 10, height: 10, points: [], color: '#EF4444', stroke: 8, text, fontSize: 22, note });
const image = (name: string, annotations: Annotation[] = []): CaptureImage => ({ id: crypto.randomUUID(), name, width: 10, height: 10, dataUrl: '', annotations });

describe('sharing', () => {
  it('lists noted steps in badge order and skips empty notes and other marks', () => {
    const shot = image('', [mark('step', '2', ' Total is wrong '), mark('text', 'label', 'ignored'), mark('step', '1', 'Open the cart'), mark('step', '3', '  ')]);
    expect(stepNotes(shot)).toEqual([{ number: '1', note: 'Open the cart' }, { number: '2', note: 'Total is wrong' }]);
  });
  it('writes one screenshot as a path with its notes', () => {
    const shot = image('', [mark('step', '1', 'Click here')]);
    expect(sharePrompt({ title: '', description: '', images: [shot] }, ['C:\\Pictures\\Snipflag\\a.png']))
      .toBe('Screenshot: C:\\Pictures\\Snipflag\\a.png\n1. Click here');
  });
  it('writes the report text, then each screenshot with caption, path and notes', () => {
    const first = image('Cart', [mark('step', '1', 'Open the cart')]); const second = image('');
    expect(sharePrompt({ title: ' Total is wrong ', description: 'Seen on staging.', images: [first, second] }, ['/p/1.png', '/p/2.png']))
      .toBe('Total is wrong\n\nSeen on staging.\n\nScreenshot 1 (Cart): /p/1.png\n1. Open the cart\n\nScreenshot 2: /p/2.png');
  });
  it('collects step notes for the description, labelled per image only when there are several', () => {
    const noted = image('Cart', [mark('step', '1', 'Open the cart')]);
    expect(stepNotesText([noted])).toBe('1. Open the cart');
    expect(stepNotesText([image(''), noted])).toBe('Cart\n1. Open the cart');
    expect(stepNotesText([image('')])).toBe('');
  });
});
