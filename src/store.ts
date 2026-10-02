import { create } from 'zustand';
import { ensureImageReferences } from './mentions';
import { estimateBytes, LIMITS, newSession, reorder, type Annotation, type AnnotationHistory, type CaptureImage, type IssueResult, type Session, type Tool } from './model';

type History = AnnotationHistory;
/** Keep recent history within 100 operations and 512 KiB per image. */
function boundedHistory(history: History): History {
  const past = history.past.slice(-100), future = history.future.slice(0, 100);
  while (past.length + future.length > 100 || JSON.stringify({ past, future }).length > 512 * 1024) {
    if (past.length) past.shift(); else if (future.length) future.pop(); else break;
  }
  return { past, future };
}
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
interface State {
  session: Session; activeId: string; tool: Tool; color: string; stroke: number; fontSize: number; highlightColor: string; highlightSize: number;
  histories: Record<string, History>; busy: boolean; selection: string | null; saveState: SaveState; saveError: string;
  /** Image IDs whose pixels are already durable for the current session. */
  persisted: string[];
  durable: boolean;
  submissionLocked: boolean; setSubmissionLocked: (locked: boolean) => void;
  hydrate: (session: Session) => void; reset: () => void; patch: (patch: Partial<Session>) => void;
  addImages: (images: CaptureImage[]) => void; select: (id: string) => void;
  updateImage: (id: string, patch: Partial<CaptureImage>) => void;
  edit: (annotations: Annotation[]) => void; undo: () => void; redo: () => void;
  removeImage: (id: string) => void;
  /** Swaps an image for a changed copy with a new identity (crop and its undo). Mentions follow; undo history is `history` or empty. */
  replaceImage: (id: string, next: CaptureImage, history?: History) => void;
  moveImage: (from: number, to: number) => void;
  setTool: (tool: Tool) => void; setStyle: (style: Partial<Pick<State, 'color' | 'stroke' | 'fontSize' | 'highlightColor' | 'highlightSize'>>) => void;
  setBusy: (busy: boolean) => void; setSelection: (id: string | null) => void;
  /** Sets a step's note without an undo entry: notes are text about the image, not marks on it. */
  noteAnnotation: (id: string, note: string) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void; removeAnnotation: (id: string) => void; setIssue: (issue: IssueResult) => void;
  setSaveState: (state: SaveState, error?: string) => void; markPersisted: (sessionId: string, ids: string[]) => void;
}
const locked = (s: State) => s.busy || s.submissionLocked || !!s.session.issue;

export const useStore = create<State>((set, get) => ({
  session: newSession(), activeId: '', tool: 'arrow', color: '#EF4444', stroke: 8, fontSize: 22, highlightColor: '#FDE047', highlightSize: 24,
  histories: {}, busy: false, selection: null, saveState: 'idle', saveError: '', persisted: [], durable: false, submissionLocked: false,
  hydrate: (session) => {
    const histories = Object.fromEntries(session.images.map(i => [i.id, boundedHistory(session.annotationHistories?.[i.id] ?? { past: [], future: [] })]));
    set({ session: { ...session, annotationHistories: histories, ...(!session.issue ? { imageReferences: ensureImageReferences(session.images, session.imageReferences) } : {}) }, submissionLocked: !!session.submissionLocked, selection: null, activeId: session.images[0]?.id ?? '', histories, persisted: session.images.map(i => i.id), durable: true, saveState: 'saved', saveError: '' });
  },
  reset: () => set({ session: newSession(), activeId: '', selection: null, histories: {}, persisted: [], durable: false, submissionLocked: false, saveState: 'idle', saveError: '', busy: false }),
  patch: (patch) => { if (!locked(get())) set(s => ({ session: { ...s.session, ...patch, updatedAt: Date.now() } })); },
  select: (activeId) => set({ activeId, selection: null }),
  addImages: (images) => {
    const s = get(); if (s.busy || s.submissionLocked) throw new Error('Check the previous operation before adding more images.');
    if (!images.length) return;
    // A sent session is immutable; new screenshots start a fresh draft.
    const fresh = !!s.session.issue; const session = fresh ? newSession() : s.session;
    if (session.images.length + images.length > LIMITS.images) throw new Error(`A session holds up to ${LIMITS.images} images. Remove one or start a new session.`);
    const total = [...session.images, ...images].reduce((sum, i) => sum + estimateBytes(i.dataUrl), 0);
    if (total > LIMITS.sessionBytes) throw new Error('This session would exceed the 100 MB image limit.');
    set({
      session: { ...session, images: [...session.images, ...images], imageReferences: ensureImageReferences([...session.images, ...images], session.imageReferences), updatedAt: Date.now() }, activeId: images[images.length - 1].id,
      ...(fresh ? { histories: {}, persisted: [], durable: false } : {}),
    });
  },
  updateImage: (id, patch) => {
    if (locked(get())) return;
    set(s => ({ session: { ...s.session, updatedAt: Date.now(), images: s.session.images.map(i => i.id === id ? { ...i, ...patch } : i) } }));
  },
  edit: (annotations) => {
    const s = get(); const image = s.session.images.find(i => i.id === s.activeId); if (!image || locked(s)) return;
    const h = s.histories[image.id] ?? { past: [], future: [] };
    const histories = { ...s.histories, [image.id]: boundedHistory({ past: [...h.past, image.annotations], future: [] }) };
    set({ histories, session: { ...s.session, annotationHistories: histories, updatedAt: Date.now(), images: s.session.images.map(i => i.id === image.id ? { ...i, annotations } : i) } });
  },
  undo: () => {
    const s = get(); set({ selection: null }); const image = s.session.images.find(i => i.id === s.activeId); const h = s.histories[s.activeId];
    if (!image || !h?.past.length || locked(s)) return;
    const histories = { ...s.histories, [image.id]: boundedHistory({ past: h.past.slice(0, -1), future: [image.annotations, ...h.future] }) };
    set({ histories, session: { ...s.session, annotationHistories: histories, updatedAt: Date.now(), images: s.session.images.map(i => i.id === image.id ? { ...i, annotations: h.past[h.past.length - 1] } : i) } });
  },
  redo: () => {
    const s = get(); set({ selection: null }); const image = s.session.images.find(i => i.id === s.activeId); const h = s.histories[s.activeId];
    if (!image || !h?.future.length || locked(s)) return;
    const histories = { ...s.histories, [image.id]: boundedHistory({ past: [...h.past, image.annotations], future: h.future.slice(1) }) };
    set({ histories, session: { ...s.session, annotationHistories: histories, updatedAt: Date.now(), images: s.session.images.map(i => i.id === image.id ? { ...i, annotations: h.future[0] } : i) } });
  },
  removeImage: (id) => {
    const s = get(); if (locked(s)) return;
    const index = s.session.images.findIndex(i => i.id === id); if (index < 0) return;
    const images = s.session.images.filter(i => i.id !== id); const histories = { ...s.histories }; delete histories[id];
    const activeId = s.activeId === id ? (images[Math.min(index, images.length - 1)]?.id ?? '') : s.activeId;
    set({ session: { ...s.session, images, annotationHistories: histories, updatedAt: Date.now() }, activeId, histories });
  },
  replaceImage: (id, next, history = { past: [], future: [] }) => {
    const s = get(); if (locked(s) || !s.session.images.some(i => i.id === id)) return;
    const histories = { ...s.histories, [next.id]: boundedHistory(history) }; delete histories[id];
    const imageReferences = Object.fromEntries(Object.entries(s.session.imageReferences ?? {}).map(([alias, target]) => [alias, target === id ? next.id : target]));
    set({
      session: { ...s.session, images: s.session.images.map(i => i.id === id ? next : i), imageReferences, annotationHistories: histories, updatedAt: Date.now() },
      histories, activeId: s.activeId === id ? next.id : s.activeId, selection: null,
    });
  },
  moveImage: (from, to) => { const s = get(); s.patch({ images: reorder(s.session.images, from, to) }); },
  setTool: (tool) => set({ tool }),
  setStyle: (style) => set(style),
  setBusy: (busy) => set({ busy, selection: busy ? null : get().selection }),
  setSubmissionLocked: (submissionLocked) => set({ submissionLocked, selection: null }),
  setSelection: (selection) => set({ selection }),
  noteAnnotation: (id, note) => {
    const s = get(); if (locked(s)) return;
    set({ session: { ...s.session, updatedAt: Date.now(), images: s.session.images.map(i => i.id !== s.activeId ? i : { ...i, annotations: i.annotations.map(a => a.id === id ? { ...a, note } : a) }) } });
  },
  updateAnnotation: (id, patch) => {
    const image = activeImage(get()); if (!image) return;
    get().edit(image.annotations.map(a => a.id === id ? { ...a, ...patch } : a));
  },
  removeAnnotation: (id) => {
    const image = activeImage(get()); if (!image) return;
    get().edit(image.annotations.filter(a => a.id !== id)); set({ selection: null });
  },
  setIssue: (issue) => set(s => ({ session: { ...s.session, issue, updatedAt: Date.now() }, busy: false })),
  setSaveState: (saveState, saveError = '') => set({ saveState, saveError }),
  markPersisted: (sessionId, ids) => { if (get().session.id === sessionId) set(s => ({ persisted: [...new Set([...s.persisted, ...ids])], durable: true })); },
}));

export const activeImage = (s: Pick<State, 'session' | 'activeId'>) => s.session.images.find(i => i.id === s.activeId);
export const canUndo = (s: State) => !!s.histories[s.activeId]?.past.length && !locked(s);
export const canRedo = (s: State) => !!s.histories[s.activeId]?.future.length && !locked(s);
export const isLocked = locked;
