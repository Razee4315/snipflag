import { describe, expect, it } from 'vitest';
import { addToast, MAX_TOASTS, toastLife, type Toast } from './toasts';

const toast = (id: number, text: string, extra: Partial<Toast> = {}): Toast => ({ id, kind: 'info', text, ...extra });
const undo = { label: 'Put back', run: () => undefined };

describe('toast stack', () => {
  it('stacks messages, newest last, and replaces a repeated message', () => {
    let list = addToast([], toast(1, 'Image saved.'));
    list = addToast(list, toast(2, 'Link copied.'));
    list = addToast(list, toast(3, 'Image saved.'));
    expect(list.map(t => t.id)).toEqual([2, 3]);
  });
  it('keeps an offer to undo when confirmations fill the stack', () => {
    let list = [toast(1, 'Screenshot 1 removed.', { action: undo })];
    for (let id = 2; id <= MAX_TOASTS + 2; id++) list = addToast(list, toast(id, `Message ${id}`));
    expect(list).toHaveLength(MAX_TOASTS);
    expect(list[0].id).toBe(1);
    expect(list[list.length - 1].id).toBe(MAX_TOASTS + 2);
  });
  it('drops the oldest offer only when every toast has one', () => {
    let list: Toast[] = [];
    for (let id = 1; id <= MAX_TOASTS + 1; id++) list = addToast(list, toast(id, `Removed ${id}`, { action: undo }));
    expect(list.map(t => t.id)).toEqual([2, 3, 4]);
  });
  it('shows errors longest and plain confirmations shortest', () => {
    expect(toastLife({ kind: 'error' })).toBeGreaterThan(toastLife({ kind: 'info', action: undo }));
    expect(toastLife({ kind: 'info', action: undo })).toBeGreaterThan(toastLife({ kind: 'info' }));
  });
});
