import { beforeEach, describe, expect, it } from 'vitest';
import type { Annotation, CaptureImage } from './model';
import { useStore } from './store';

const image = (): CaptureImage => ({ id: crypto.randomUUID(), name: '', width: 10, height: 10, dataUrl: 'data:image/png;base64,AAAA', annotations: [] });
const mark = (): Annotation => ({ id: crypto.randomUUID(), kind: 'rectangle', x: 1, y: 1, width: 5, height: 5, points: [], color: '#f00', stroke: 3, text: '', fontSize: 22 });
const state = () => useStore.getState();

describe('session store', () => {
  beforeEach(() => state().reset());

  it('keeps independent annotation histories per image', () => {
    const a = image(); const b = image();
    state().addImages([a, b]);
    state().select(a.id); state().edit([mark()]);
    state().select(b.id); state().edit([mark()]); state().edit([...state().session.images[1].annotations, mark()]);
    state().undo();
    expect(state().session.images[1].annotations).toHaveLength(1);
    expect(state().session.images[0].annotations).toHaveLength(1);
    state().select(a.id); state().undo();
    expect(state().session.images[0].annotations).toHaveLength(0);
    expect(state().session.images[1].annotations).toHaveLength(1);
    state().redo();
    expect(state().session.images[0].annotations).toHaveLength(1);
  });
  it('reorders and removes images without touching the others', () => {
    const [a, b, c] = [image(), image(), image()];
    state().addImages([a, b, c]);
    state().moveImage(2, 0);
    expect(state().session.images.map(i => i.id)).toEqual([c.id, a.id, b.id]);
    state().select(a.id); state().removeImage(a.id);
    expect(state().session.images.map(i => i.id)).toEqual([c.id, b.id]);
    expect(state().activeId).toBe(b.id);
  });
  it('enforces the per-session image limit before mutating', () => {
    state().addImages(Array.from({ length: 9 }, image));
    expect(() => state().addImages([image(), image()])).toThrow(/up to 10/);
    expect(state().session.images).toHaveLength(9);
  });
  it('freezes a sent session and starts a new draft for new screenshots', () => {
    const a = image(); state().addImages([a]); state().patch({ title: 'Bug' });
    const sentId = state().session.id;
    // A sent session reaches the editor the way it does in the app: loaded with its issue.
    state().hydrate({ ...state().session, issue: { id: 'i', identifier: 'ENG-7', url: 'https://linear.app/x' } });
    state().patch({ title: 'Changed' }); state().edit([mark()]); state().removeImage(a.id);
    expect(state().session.title).toBe('Bug');
    expect(state().session.images).toHaveLength(1);
    state().addImages([image()]);
    expect(state().session.id).not.toBe(sentId);
    expect(state().session.images).toHaveLength(1);
    expect(state().session.issue).toBeNull();
  });
  it('blocks edits while a submission is running', () => {
    const a = image(); state().addImages([a]);
    state().setBusy(true); state().edit([mark()]); state().patch({ title: 'x' });
    expect(state().session.images[0].annotations).toHaveLength(0);
    expect(state().session.title).toBe('');
    expect(() => state().addImages([image()])).toThrow();
  });
  it('restores independent undo and redo from durable JSON, including old drafts', () => {
    const a = image(), b = image(); state().addImages([a, b]);
    state().select(a.id); state().edit([mark()]);
    state().select(b.id); state().edit([mark()]); state().undo();
    const saved = JSON.parse(JSON.stringify(state().session));
    state().reset(); state().hydrate(saved);
    state().select(a.id); state().undo();
    expect(state().session.images[0].annotations).toHaveLength(0);
    state().select(b.id); state().redo();
    expect(state().session.images[1].annotations).toHaveLength(1);
    delete saved.annotationHistories; state().hydrate(saved);
    expect(state().histories[a.id].past).toHaveLength(0);
  });
  it('bounds persisted history and clears histories belonging to removed images', () => {
    const a = image(); state().addImages([a]);
    for (let i = 0; i < 110; i++) state().edit([mark()]);
    expect(state().session.annotationHistories?.[a.id].past).toHaveLength(100);
    state().markPersisted(state().session.id, [a.id]); state().removeImage(a.id);
    expect(state().durable).toBe(true);
    expect(state().session.annotationHistories?.[a.id]).toBeUndefined();
  });
  it('locks a restored uncertain submission before any edits and unlocks only after reconciliation', () => {
    state().addImages([image()]);
    state().hydrate({ ...state().session, submissionLocked: true });
    state().patch({ title: 'Not sent' }); state().edit([mark()]); state().removeImage(state().activeId);
    expect(state().session.title).toBe(''); expect(state().session.images).toHaveLength(1);
    expect(state().session.images[0].annotations).toHaveLength(0);
    expect(() => state().addImages([image()])).toThrow();
    state().setSubmissionLocked(false); state().patch({ title: 'Now editable' });
    expect(state().session.title).toBe('Now editable');
  });
  it('replaces an image with a changed copy: mentions follow, order stays, undo history starts over or is restored', () => {
    const [a, b] = [image(), image()];
    state().addImages([a, b]); state().select(a.id); state().edit([mark()]);
    const history = state().histories[a.id];
    const cropped = { ...image(), width: 5, height: 5 };
    state().replaceImage(a.id, cropped);
    expect(state().session.images.map(i => i.id)).toEqual([cropped.id, b.id]);
    expect(state().activeId).toBe(cropped.id);
    expect(state().session.imageReferences).toEqual({ image1: cropped.id, image2: b.id });
    expect(state().histories[cropped.id]).toEqual({ past: [], future: [] });
    expect(state().histories[a.id]).toBeUndefined();
    const restored = { ...a, id: crypto.randomUUID(), annotations: state().session.images[0].annotations };
    state().replaceImage(cropped.id, restored, history);
    expect(state().session.imageReferences?.image1).toBe(restored.id);
    expect(state().histories[restored.id]).toEqual(history);
    state().replaceImage('missing', image());
    expect(state().session.images).toHaveLength(2);
  });
  it('puts a removed image back in place with its alias and history under a new identity', () => {
    const [a, b] = [image(), image()];
    state().addImages([a, b]); state().select(a.id); state().edit([mark()]);
    const removed = state().session.images[0]; const history = state().histories[a.id];
    state().removeImage(a.id);
    state().restoreImage(removed, 0, history);
    const restored = state().session.images[0];
    expect(restored.id).not.toBe(a.id);
    expect(restored.annotations).toHaveLength(1);
    expect(state().session.images[1].id).toBe(b.id);
    expect(state().session.imageReferences).toEqual({ image1: restored.id, image2: b.id });
    expect(state().histories[restored.id]).toEqual(history);
    expect(state().activeId).toBe(restored.id);
  });
  it('writes step notes without adding undo entries', () => {
    const a = image(); state().addImages([a]);
    const step = { ...mark(), kind: 'step' as const, text: '1' };
    state().edit([step]); state().noteAnnotation(step.id, 'Open the cart');
    expect(state().session.images[0].annotations[0].note).toBe('Open the cart');
    expect(state().histories[a.id].past).toHaveLength(1);
  });
});
