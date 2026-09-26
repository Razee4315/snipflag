export type Tool = 'select' | 'arrow' | 'rectangle' | 'ellipse' | 'pen' | 'highlight' | 'text' | 'step' | 'pixelate';
/** 'redact' is no longer a tool but older drafts may still contain solid redactions; they keep rendering. */
export type Shape = Exclude<Tool, 'select'> | 'redact';
/** Freehand kinds share points, Shift snapping and smoothing. */
export const isFreehand = (kind: Tool | Shape) => kind === 'pen' || kind === 'highlight';
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
}
export interface CaptureImage { id: string; name: string; width: number; height: number; dataUrl: string; annotations: Annotation[] }
export interface IssueResult { id: string; identifier: string; url: string }
export interface Session {
  schemaVersion: 1; id: string; createdAt: number; updatedAt: number;
  title: string; description: string; teamId: string; projectId: string; assigneeId: string; labelIds: string[];
  priority: number; images: CaptureImage[]; issue: IssueResult | null;
  /** Optional for older drafts; stable aliases map to image UUIDs, including removed images. */
  imageReferences?: Record<string, string>;
}
export interface Named { id: string; name: string; displayName?: string; key?: string; color?: string }
export interface Connection { name: string; workspace: string; workspaceId: string; teams: Named[] }
export interface TeamOptions { projects: Named[]; members: Named[]; labels: Named[] }
export interface Settings {
  clientId: string; shortcut: string; theme: 'system' | 'light' | 'dark'; retentionDays: number; launchAtLogin: boolean;
  /** Short synthesized cues for capture, success and failure. */
  sounds: boolean;
  /** Interface animations; the system reduced-motion preference always wins. */
  motion: boolean;
  teamMemory: Record<string, string>;
}

export const LIMITS = { images: 10, imageBytes: 20 * 1024 * 1024, sessionBytes: 100 * 1024 * 1024, pixels: 40_000_000, title: 250 };
export const PRIORITIES = [
  { value: 0, label: 'No priority' }, { value: 1, label: 'Urgent' }, { value: 2, label: 'High' }, { value: 3, label: 'Medium' }, { value: 4, label: 'Low' },
];
export const defaults: Settings = { clientId: '', shortcut: 'CommandOrControl+Shift+Digit2', theme: 'system', retentionDays: 30, launchAtLogin: false, sounds: true, motion: true, teamMemory: {} };
export const REDIRECT_URI = 'http://127.0.0.1:47839/callback';

export function newSession(): Session {
  const now = Date.now();
  return { schemaVersion: 1, id: crypto.randomUUID(), createdAt: now, updatedAt: now, title: '', description: '', teamId: '', projectId: '', assigneeId: '', labelIds: [], priority: 0, images: [], issue: null };
}
export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const copy = [...items]; const [moved] = copy.splice(from, 1); copy.splice(to, 0, moved); return copy;
}
export function validateSession(s: Session): string | null {
  if (s.issue) return 'This session has already been sent. Start a new session.';
  if (!s.images.length) return 'Add at least one screenshot.';
  if (s.images.length > LIMITS.images) return 'A session can contain up to 10 images.';
  if (!s.title.trim()) return 'Add an issue title.';
  if (s.title.trim().length > LIMITS.title) return 'Keep the title under 250 characters.';
  if (!s.teamId) return 'Choose a Linear team.';
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
