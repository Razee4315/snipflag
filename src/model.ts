export type Tool = 'select' | 'arrow' | 'line' | 'rectangle' | 'ellipse' | 'pen' | 'highlight' | 'text' | 'step' | 'pixelate' | 'crop';
/** 'redact' is no longer a tool but older drafts may still contain solid redactions; they keep rendering. */
export type Shape = Exclude<Tool, 'select' | 'crop'> | 'redact';
/** Freehand kinds share points, Shift snapping and smoothing. */
export const isFreehand = (kind: Tool | Shape) => kind === 'pen' || kind === 'highlight';
/** Straight two-point kinds: an arrow, or a plain line without a head. */
export const isSegment = (kind: Tool | Shape) => kind === 'arrow' || kind === 'line';
/** Outlined box kinds drawn by dragging; Shift makes them square or round. */
export const isOutline = (kind: Tool | Shape) => kind === 'rectangle' || kind === 'ellipse';
/** Numbered step badges scale with the stroke width. */
export const stepSize = (stroke: number) => Math.round(26 + stroke * 2.5);
/** Next step number on an image: one more than the highest badge already placed. */
export function nextStep(annotations: Annotation[]) {
  return annotations.reduce((max, a) => a.kind === 'step' ? Math.max(max, Number(a.text) || 0) : max, 0) + 1;
}
/** Geometry is always in IMAGE pixels. Pen and arrow points are relative to (x, y). */
export interface Annotation {
  id: string; kind: Shape; x: number; y: number;
  width: number; height: number; points: number[]; color: string; stroke: number; text: string; fontSize: number;
  /** What a numbered step means. Shared as text; never drawn on the image. */
  note?: string;
}
export interface CaptureImage { id: string; name: string; width: number; height: number; dataUrl: string; annotations: Annotation[] }
export interface IssueResult { id: string; identifier: string; url: string }
export interface AnnotationHistory { past: Annotation[][]; future: Annotation[][] }
export interface Session {
  schemaVersion: 1; id: string; createdAt: number; updatedAt: number;
  title: string; description: string; teamId: string; projectId: string; assigneeId: string; labelIds: string[];
  priority: number; images: CaptureImage[]; issue: IssueResult | null;
  /** Optional for older drafts; stable aliases map to image UUIDs, including removed images. */
  imageReferences?: Record<string, string>;
  /** Optional for v1 drafts. Bounded per-image undo/redo snapshots survive restart. */
  annotationHistories?: Record<string, AnnotationHistory>;
  deletionPending?: boolean;
  /** Small flattened thumbnail of the first screenshot, written at save time for History. Never the original pixels. */
  preview?: string;
  /** Native hydration marks an unresolved attempt before the editor permits mutations. */
  submissionLocked?: boolean;
}
export interface Named { id: string; name: string; displayName?: string; key?: string; color?: string }
export interface Connection { name: string; workspace: string; workspaceId: string; teams: Named[] }
export interface TeamOptions { projects: Named[]; members: Named[]; labels: Named[] }
export interface Settings {
  clientId: string; shortcut: string; theme: Theme; retentionDays: number; launchAtLogin: boolean;
  /** Keep the dragged selection on screen to resize or move it before confirming. Off: releasing the drag captures. */
  adjustSelection: boolean;
  /** Zoomed pixel view beside the pointer while selecting. */
  magnifier: boolean;
  /** Also put every capture on the clipboard. */
  copyOnCapture: boolean;
  /** Also write every capture, unmarked, to Pictures/Snipflag. */
  saveOnCapture: boolean;
  /** Seconds to wait before the screen is frozen: 0, 3, 5 or 10. */
  captureDelay: number;
  /** Short synthesized cues for capture, success and failure. */
  sounds: boolean;
  /** Interface animations; the system reduced-motion preference always wins. */
  motion: boolean;
  /** Look for signed updates at startup and every few hours. */
  autoUpdate: boolean;
  teamMemory: Record<string, string>;
  /** Null means the built-in templates; an array is the user's edited list. */
  templates: Template[] | null;
  /** Issue details last sent to each Linear team, keyed by team ID. */
  teamDefaults: Record<string, TeamDefaults>;
}
export type Theme = 'system' | 'light' | 'dark' | 'paper' | 'blossom' | 'midnight' | 'graphite';
export interface Template { id: string; name: string; body: string }
export type TeamDefaults = Pick<Session, 'projectId' | 'assigneeId' | 'labelIds' | 'priority'>;

export const LIMITS = { images: 10, imageBytes: 20 * 1024 * 1024, sessionBytes: 100 * 1024 * 1024, pixels: 40_000_000, title: 250 };
export const PRIORITIES = [
  { value: 0, label: 'No priority' }, { value: 1, label: 'Urgent' }, { value: 2, label: 'High' }, { value: 3, label: 'Medium' }, { value: 4, label: 'Low' },
];
export const defaults: Settings = { clientId: '', shortcut: 'CommandOrControl+Shift+Digit2', theme: 'system', retentionDays: 30, launchAtLogin: false, sounds: true, motion: true, autoUpdate: true, adjustSelection: false, magnifier: false, copyOnCapture: false, saveOnCapture: false, captureDelay: 0, teamMemory: {}, templates: null, teamDefaults: {} };
export const REDIRECT_URI = 'http://127.0.0.1:47839/callback';

export function newSession(): Session {
  const now = Date.now();
  return { schemaVersion: 1, id: crypto.randomUUID(), createdAt: now, updatedAt: now, title: '', description: '', teamId: '', projectId: '', assigneeId: '', labelIds: [], priority: 0, images: [], issue: null };
}
export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const copy = [...items]; const [moved] = copy.splice(from, 1); copy.splice(to, 0, moved); return copy;
}
/** Validation messages that belong to one field; the issue panel shows them beside it. */
export const FIELD_ERRORS = { title: 'Add an issue title.', team: 'Choose a Linear team.' } as const;
export function validateSession(s: Session): string | null {
  if (s.issue) return 'This session has already been sent. Start a new session.';
  if (!s.images.length) return 'Add at least one screenshot.';
  if (s.images.length > LIMITS.images) return 'A session can contain up to 10 images.';
  if (!s.title.trim()) return FIELD_ERRORS.title;
  if (s.title.trim().length > LIMITS.title) return 'Keep the title under 250 characters.';
  if (!s.teamId) return FIELD_ERRORS.team;
  return null;
}
export function normalizeRect(x: number, y: number, endX: number, endY: number) {
  return { x: Math.min(x, endX), y: Math.min(y, endY), width: Math.abs(endX - x), height: Math.abs(endY - y) };
}
/** Clamps a rectangle to the image so redactions and pixelation never reach outside real pixels. */
export function clampRect(r: { x: number; y: number; width: number; height: number }, width: number, height: number) {
  const x = Math.max(0, Math.min(r.x, width)); const y = Math.max(0, Math.min(r.y, height));
  return { x, y, width: Math.max(0, Math.min(r.x + r.width, width) - x), height: Math.max(0, Math.min(r.y + r.height, height) - y) };
}
export type RectHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
/** Moves or resizes a capture selection by a pointer delta, kept inside `bounds`. An edge dragged past its opposite flips the rectangle. */
export function adjustRect(r: { x: number; y: number; width: number; height: number }, handle: RectHandle, dx: number, dy: number, bounds: { width: number; height: number }) {
  const within = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(0, max));
  if (handle === 'move') return { ...r, x: within(r.x + dx, bounds.width - r.width), y: within(r.y + dy, bounds.height - r.height) };
  let x0 = r.x; let y0 = r.y; let x1 = r.x + r.width; let y1 = r.y + r.height;
  if (handle.includes('w')) x0 += dx;
  if (handle.includes('e')) x1 += dx;
  if (handle.includes('n')) y0 += dy;
  if (handle.includes('s')) y1 += dy;
  return normalizeRect(within(x0, bounds.width), within(y0, bounds.height), within(x1, bounds.width), within(y1, bounds.height));
}
/** Converts a selection in overlay CSS pixels to frame pixels. */
export function toFramePixels(sel: { x: number; y: number; width: number; height: number }, viewport: { width: number; height: number }, frame: { width: number; height: number }) {
  const sx = frame.width / viewport.width; const sy = frame.height / viewport.height;
  return { x: Math.round(sel.x * sx), y: Math.round(sel.y * sy), width: Math.round(sel.width * sx), height: Math.round(sel.height * sy) };
}
export function estimateBytes(dataUrl: string) { return Math.floor(Math.max(0, dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75); }
export function sessionLabel(s: Pick<Session, 'title' | 'images'>) { return s.title.trim() || (s.images.length ? 'Untitled session' : 'New session'); }
export function imageLabel(image: CaptureImage, index: number) { return image.name.trim() || `Screenshot ${index + 1}`; }
/** Human-readable shortcut label for the current platform. */
export function shortcutLabel(shortcut: string, mac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')) {
  return shortcut.split('+').map(part => ({ CommandOrControl: mac ? 'Cmd' : 'Ctrl', Control: 'Ctrl', Command: 'Cmd', Super: mac ? 'Cmd' : 'Win', Alt: mac ? 'Option' : 'Alt' } as Record<string, string>)[part]
    ?? part.replace(/^Digit/, '').replace(/^Key/, '')).join('+');
}
/** Builds an accelerator string from a keyboard event, or null if it needs more modifiers. */
export function acceleratorFromEvent(e: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'code'>): string | null {
  if (/^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/.test(e.code) || !e.code) return null;
  if (!/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Space|PrintScreen)$/.test(e.code)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (!parts.length && !/^(F\d+|PrintScreen)$/.test(e.code)) return null;
  return [...parts, e.code].join('+');
}
