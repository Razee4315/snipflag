import { create } from 'zustand';
import { normalizeHex } from './color';
import { ensureImageReferences } from './mentions';
import { estimateBytes, LIMITS, newSession, reorder, type Annotation, type AnnotationHistory, type CaptureImage, type Session, type Tool } from './model';

type History = AnnotationHistory;
const snapshotSizes = new WeakMap<Annotation[], number>();
/** Serialized size of one undo snapshot. Snapshots are never changed in place, so each is measured once. */
function snapshotSize(snapshot: Annotation[]) {
  let size = snapshotSizes.get(snapshot);
  if (size === undefined) { size = JSON.stringify(snapshot).length + 1; snapshotSizes.set(snapshot, size); }
  return size;
}
/** Keep recent history within 100 operations and 512 KiB per image. */
function boundedHistory(history: History): History {
  const past = history.past.slice(-100), future = history.future.slice(0, 100);
  let size = [...past, ...future].reduce((sum, snapshot) => sum + snapshotSize(snapshot), 0);
  while (past.length + future.length > 100 || size > 512 * 1024) {
    const dropped = past.length ? past.shift() : future.pop();
    if (!dropped) break;
    size -= snapshotSize(dropped);
  }
  return { past, future };
}
/**
 * A removal, crop or reorder that Undo can take back. `at` is the edit count when it happened: while no mark has
 * changed since, it is the newest change and Undo reverses it before any mark. Kept for this run only, not saved.
 */
export type StructureChange = { key: string; at: number } & (
  | { kind: 'remove'; image: CaptureImage; index: number; history?: History }
  | { kind: 'crop'; croppedId: string; before: CaptureImage; history?: History }
  | { kind: 'move'; imageId: string; from: number });
const MAX_STRUCTURE = 10;
export const removalKey = (imageId: string) => `remove:${imageId}`;
export const cropKey = (croppedId: string) => `crop:${croppedId}`;
/** Points remembered changes at an image's new identity after it was put back or uncropped. */
function renamed(structure: StructureChange[], from: string, to: string): StructureChange[] {
  return structure.map(change => change.kind === 'crop' && change.croppedId === from ? { ...change, croppedId: to }
    : change.kind === 'move' && change.imageId === from ? { ...change, imageId: to } : change);
}
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
interface State {
  session: Session; activeId: string; tool: Tool; color: string; stroke: number; fontSize: number; highlightColor: string; highlightSize: number;
  /** New text marks get a plate behind them. */
  textBackdrop: boolean;
  histories: Record<string, History>; busy: boolean; selection: string | null; saveState: SaveState; saveError: string;
  /** Counts mark edits, undos and redos in this session. */
  edits: number;
  structure: StructureChange[];
  /** Image IDs whose pixels are already durable for the current session. */
  persisted: string[];
  durable: boolean;
  submissionLocked: boolean; setSubmissionLocked: (locked: boolean) => void;
  hydrate: (session: Session) => void; reset: () => void; patch: (patch: Partial<Session>) => void;
  addImages: (images: CaptureImage[]) => void; select: (id: string) => void;
  updateImage: (id: string, patch: Partial<CaptureImage>) => void;
  edit: (annotations: Annotation[]) => void; undo: () => void; redo: () => void;
  removeImage: (id: string) => void;
  /** Crops an image: `next` replaces it under a new identity and the uncropped image stays undoable. */
  cropImage: (id: string, next: CaptureImage) => void;
  /** Takes back the remembered change with this key, or the newest one. Returns whether anything was undone. */
  undoStructure: (key?: string) => boolean;
  /** Puts a removed image back at `index` under a new identity; its `@image` alias and undo history return with it. */
  restoreImage: (removed: CaptureImage, index: number, history?: History) => void;
  /** Swaps an image for a changed copy with a new identity (crop and its undo). Mentions follow; undo history is `history` or empty. */
  replaceImage: (id: string, next: CaptureImage, history?: History) => void;
  moveImage: (from: number, to: number) => void;
  setTool: (tool: Tool) => void; setStyle: (style: Partial<ToolStyle>) => void;
  setBusy: (busy: boolean) => void; setSelection: (id: string | null) => void;
  /** Sets a step's note without an undo entry: notes are text about the image, not marks on it. */
  noteAnnotation: (id: string, note: string) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void; removeAnnotation: (id: string) => void;
  setSaveState: (state: SaveState, error?: string) => void; markPersisted: (sessionId: string, ids: string[]) => void;
}
const locked = (s: State) => s.busy || s.submissionLocked || !!s.session.issue;

type ToolStyle = Pick<State, 'color' | 'stroke' | 'fontSize' | 'highlightColor' | 'highlightSize' | 'textBackdrop'>;
const STYLE_KEY = 'snipflag-tool-style';
const DEFAULT_STYLE: ToolStyle = { color: '#EF4444', stroke: 8, fontSize: 22, highlightColor: '#FDE047', highlightSize: 24, textBackdrop: false };
/** The colors and sizes used last on this device. A convenience: anything missing or unreadable is the default. */
function loadStyle(): ToolStyle {
  try {
    const saved = JSON.parse(localStorage.getItem(STYLE_KEY) || '{}') as Record<string, unknown>;
    const size = (value: unknown, fallback: number) => typeof value === 'number' && value >= 1 && value <= 400 ? value : fallback;
    return {
      color: normalizeHex(String(saved.color ?? '')) ?? DEFAULT_STYLE.color, stroke: size(saved.stroke, DEFAULT_STYLE.stroke), fontSize: size(saved.fontSize, DEFAULT_STYLE.fontSize),
      highlightColor: normalizeHex(String(saved.highlightColor ?? '')) ?? DEFAULT_STYLE.highlightColor, highlightSize: size(saved.highlightSize, DEFAULT_STYLE.highlightSize), textBackdrop: saved.textBackdrop === true,
    };
  } catch { return DEFAULT_STYLE; }
}
function saveStyle({ color, stroke, fontSize, highlightColor, highlightSize, textBackdrop }: ToolStyle) {
  try { localStorage.setItem(STYLE_KEY, JSON.stringify({ color, stroke, fontSize, highlightColor, highlightSize, textBackdrop })); } catch { /* The style still applies for this run. */ }
}

export const useStore = create<State>((set, get) => ({
  session: newSession(), activeId: '', tool: 'arrow', ...loadStyle(),
  histories: {}, busy: false, selection: null, saveState: 'idle', saveError: '', persisted: [], durable: false, submissionLocked: false,
  edits: 0, structure: [],
  hydrate: (session) => {
    const histories = Object.fromEntries(session.images.map(i => [i.id, boundedHistory(session.annotationHistories?.[i.id] ?? { past: [], future: [] })]));
    set({ session: { ...session, annotationHistories: histories, ...(!session.issue ? { imageReferences: ensureImageReferences(session.images, session.imageReferences) } : {}) }, submissionLocked: !!session.submissionLocked, selection: null, activeId: session.images[0]?.id ?? '', histories, persisted: session.images.map(i => i.id), durable: true, saveState: 'saved', saveError: '', edits: 0, structure: [] });
  },
  reset: () => set({ session: newSession(), activeId: '', selection: null, histories: {}, persisted: [], durable: false, submissionLocked: false, saveState: 'idle', saveError: '', busy: false, edits: 0, structure: [] }),
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
      ...(fresh ? { histories: {}, persisted: [], durable: false, edits: 0, structure: [] } : {}),
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
    set({ histories, edits: s.edits + 1, session: { ...s.session, annotationHistories: histories, updatedAt: Date.now(), images: s.session.images.map(i => i.id === image.id ? { ...i, annotations } : i) } });
  },
  undo: () => {
    const s = get(); set({ selection: null });
    // The newest change goes first: a removal, crop or reorder made after the last mark edit.
    if (newestIsStructure(s)) { get().undoStructure(); return; }
    const image = s.session.images.find(i => i.id === s.activeId); const h = s.histories[s.activeId];
    if (!image || !h?.past.length || locked(s)) return;
    const histories = { ...s.histories, [image.id]: boundedHistory({ past: h.past.slice(0, -1), future: [image.annotations, ...h.future] }) };
    set({ histories, edits: s.edits + 1, session: { ...s.session, annotationHistories: histories, updatedAt: Date.now(), images: s.session.images.map(i => i.id === image.id ? { ...i, annotations: h.past[h.past.length - 1] } : i) } });
  },
  redo: () => {
    const s = get(); set({ selection: null }); const image = s.session.images.find(i => i.id === s.activeId); const h = s.histories[s.activeId];
    if (!image || !h?.future.length || locked(s)) return;
    const histories = { ...s.histories, [image.id]: boundedHistory({ past: [...h.past, image.annotations], future: h.future.slice(1) }) };
    set({ histories, edits: s.edits + 1, session: { ...s.session, annotationHistories: histories, updatedAt: Date.now(), images: s.session.images.map(i => i.id === image.id ? { ...i, annotations: h.future[0] } : i) } });
  },
  removeImage: (id) => {
    const s = get(); if (locked(s)) return;
    const index = s.session.images.findIndex(i => i.id === id); if (index < 0) return;
    const images = s.session.images.filter(i => i.id !== id); const histories = { ...s.histories }; delete histories[id];
    const activeId = s.activeId === id ? (images[Math.min(index, images.length - 1)]?.id ?? '') : s.activeId;
    const change: StructureChange = { key: removalKey(id), at: s.edits, kind: 'remove', image: s.session.images[index], index, history: s.histories[id] };
    set({ session: { ...s.session, images, annotationHistories: histories, updatedAt: Date.now() }, activeId, histories, structure: [...s.structure, change].slice(-MAX_STRUCTURE) });
  },
  cropImage: (id, next) => {
    const s = get(); const before = s.session.images.find(i => i.id === id); if (!before || locked(s)) return;
    const history = s.histories[id];
    get().replaceImage(id, next);
    set(now => ({ structure: [...now.structure, { key: cropKey(next.id), at: now.edits, kind: 'crop' as const, croppedId: next.id, before, history }].slice(-MAX_STRUCTURE) }));
  },
  undoStructure: (key) => {
    const s = get(); if (locked(s)) return false;
    const change = key === undefined ? s.structure[s.structure.length - 1] : s.structure.find(c => c.key === key);
    if (!change) return false;
    set({ structure: s.structure.filter(c => c !== change) });
    if (change.kind === 'remove') get().restoreImage(change.image, change.index, change.history);
    // The uncropped copy gets a new identity too: its original file may already have been cleaned up.
    else if (change.kind === 'crop') get().replaceImage(change.croppedId, { ...change.before, id: crypto.randomUUID() }, change.history);
    else {
      const images = get().session.images; const now = images.findIndex(i => i.id === change.imageId);
      if (now >= 0) get().patch({ images: reorder(images, now, Math.min(change.from, images.length - 1)) });
    }
    return true;
  },
  restoreImage: (removed, index, history = { past: [], future: [] }) => {
    const s = get(); if (locked(s) || s.session.images.length >= LIMITS.images) return;
    // The removed file may already be cleaned up, so the copy is saved again under a fresh ID.
    const image = { ...removed, id: crypto.randomUUID() };
    const images = [...s.session.images]; images.splice(Math.max(0, Math.min(index, images.length)), 0, image);
    const histories = { ...s.histories, [image.id]: boundedHistory(history) };
    const imageReferences = Object.fromEntries(Object.entries(s.session.imageReferences ?? {}).map(([alias, target]) => [alias, target === removed.id ? image.id : target]));
    set({ session: { ...s.session, images, imageReferences: ensureImageReferences(images, imageReferences), annotationHistories: histories, updatedAt: Date.now() }, histories, activeId: image.id, selection: null, structure: renamed(s.structure, removed.id, image.id) });
  },
  replaceImage: (id, next, history = { past: [], future: [] }) => {
    const s = get(); if (locked(s) || !s.session.images.some(i => i.id === id)) return;
    const histories = { ...s.histories, [next.id]: boundedHistory(history) }; delete histories[id];
    const imageReferences = Object.fromEntries(Object.entries(s.session.imageReferences ?? {}).map(([alias, target]) => [alias, target === id ? next.id : target]));
    set({
      session: { ...s.session, images: s.session.images.map(i => i.id === id ? next : i), imageReferences, annotationHistories: histories, updatedAt: Date.now() },
      histories, activeId: s.activeId === id ? next.id : s.activeId, selection: null, structure: renamed(s.structure, id, next.id),
    });
  },
  moveImage: (from, to) => {
    const s = get(); const images = reorder(s.session.images, from, to);
    if (images === s.session.images || locked(s)) return;
    const change: StructureChange = { key: `move:${s.structure.length}:${s.edits}:${s.session.images[from].id}`, at: s.edits, kind: 'move', imageId: s.session.images[from].id, from };
    set({ session: { ...s.session, images, updatedAt: Date.now() }, structure: [...s.structure, change].slice(-MAX_STRUCTURE) });
  },
  setTool: (tool) => set({ tool }),
  setStyle: (style) => { set(style); saveStyle(get()); },
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
  setSaveState: (saveState, saveError = '') => set({ saveState, saveError }),
  markPersisted: (sessionId, ids) => { if (get().session.id === sessionId) set(s => ({ persisted: [...new Set([...s.persisted, ...ids])], durable: true })); },
}));

export const activeImage = (s: Pick<State, 'session' | 'activeId'>) => s.session.images.find(i => i.id === s.activeId);
/** Whether the newest change in the session is a removal, crop or reorder rather than a mark. */
const newestIsStructure = (s: State) => !locked(s) && s.structure[s.structure.length - 1]?.at === s.edits;
export const canUndo = (s: State) => !locked(s) && (!!s.histories[s.activeId]?.past.length || newestIsStructure(s));
export const canRedo = (s: State) => !!s.histories[s.activeId]?.future.length && !locked(s);
export const isLocked = locked;
