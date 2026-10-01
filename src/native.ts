import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { defaults, type Connection, type IssueResult, type Session, type Settings, type TeamOptions } from './model';

/** Browser preview (used by automated tests) stores drafts in IndexedDB and never contacts Linear. */
export const desktop = isTauri();
export const PREVIEW_MESSAGE = 'This action is available in the installed desktop app.';
/** `workspace` with image dimensions maximizes the editor when that screenshot cannot fit the normal workspace. */
export async function editorWindow(action: 'hide' | 'minimize' | 'drag' | 'workspace' | 'reveal', imageWidth?: number, imageHeight?: number) {
  if (desktop) await native<void>('editor_window', { action, imageWidth, imageHeight });
}
export async function native<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!desktop) throw new Error(PREVIEW_MESSAGE);
  return invoke<T>(command, args);
}
export function errorText(e: unknown) { return typeof e === 'string' ? e : e instanceof Error ? e.message : 'Something went wrong.'; }
export async function on<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!desktop) return () => undefined;
  return listen<T>(event, e => handler(e.payload));
}

async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('snipflag-preview', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sessions', { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
async function previewOp<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sessions', mode); const r = operation(tx.objectStore('sessions'));
    tx.oncomplete = () => { database.close(); resolve(r.result); };
    tx.onerror = () => { database.close(); reject(tx.error); };
  });
}

/** Sends pixels only for images that are not yet durable; saved images are immutable per ID. */
export function forSave(session: Session, persisted: string[]): Session {
  return { ...session, images: session.images.map(i => persisted.includes(i.id) ? { ...i, dataUrl: '' } : i) };
}
export const saveSession = (session: Session, persisted: string[]) =>
  desktop ? native<void>('save_session', { session: forSave(session, persisted) }) : previewOp('readwrite', s => s.put(session)).then(() => undefined);
export const listSessions = async (): Promise<Session[]> =>
  desktop ? native('list_sessions') : ((await previewOp('readonly', s => s.getAll())) as Session[]).sort((a, b) => b.updatedAt - a.updatedAt);
export const loadSession = async (id: string): Promise<Session> => {
  if (desktop) return native('load_session', { id });
  const session = await previewOp('readonly', s => s.get(id)) as Session | undefined;
  if (!session) throw new Error('Draft was not found.');
  return session;
};
export const deleteSession = (id: string) => desktop ? native<void>('delete_session', { id }) : previewOp('readwrite', s => s.delete(id)).then(() => undefined);
export const clearHistory = () => desktop ? native<void>('clear_history') : previewOp('readwrite', s => s.clear()).then(() => undefined);

function previewSettings(): Settings {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('snipflag-settings') || '{}') }; } catch { return defaults; }
}
export const loadSettings = async (): Promise<Settings> => desktop ? { ...defaults, ...await native<Settings>('load_settings') } : previewSettings();
export const saveSettings = async (settings: Settings): Promise<Settings> => {
  if (desktop) return { ...defaults, ...await native<Settings>('save_settings', { settings }) };
  localStorage.setItem('snipflag-settings', JSON.stringify(settings)); return settings;
};
export interface AppStatus { version: string; platform: string; shortcutError: string | null; cleanupError?: string | null; builtinLinearClient?: boolean; updates?: boolean }
export const appStatus = (): Promise<AppStatus> => desktop ? native('app_status') : Promise.resolve({ version: 'preview', platform: 'browser', shortcutError: null });

export const linearConnection = () => native<Connection | null>('linear_connection');
export const teamOptions = (teamId: string) => native<TeamOptions>('linear_team_options', { teamId });
export const connectLinear = () => native<void>('connect_linear');
export const cancelLogin = () => native<void>('cancel_login');
export const disconnectLinear = () => native<void>('disconnect_linear');
export const openLinearSetup = () => native<void>('open_linear_setup');
export type AboutLink = 'github' | 'linkedin' | 'repository' | 'license';
export const ABOUT_LINKS: Record<AboutLink, string> = {
  github: 'https://github.com/Razee4315', linkedin: 'https://www.linkedin.com/in/saqlainrazee/',
  repository: 'https://github.com/Razee4315/snipflag', license: 'https://github.com/Razee4315/snipflag/blob/main/LICENSE',
};
/** Opens a fixed creator/project page in the default browser (Rust enforces the same allowlist). */
export async function openAboutLink(target: AboutLink) {
  if (desktop) return native<void>('open_about_link', { target });
  window.open(ABOUT_LINKS[target], '_blank', 'noopener,noreferrer');
}
export const submitIssue = (session: Session, persisted: string[], exports: { id: string; dataUrl: string }[]) =>
  native<IssueResult>('submit_issue', { session: forSave(session, persisted), exports });
export const submissionStatus = (id: string) => desktop ? native<{ state: string } | null>('submission_status', { id }) : Promise.resolve(null);
export const reconcileIssue = (id: string) => native<IssueResult | null>('reconcile_issue', { id });
export const openIssue = (url: string) => native<void>('open_issue', { url });
export async function copyText(text: string) {
  if (desktop) return native<void>('copy_text', { text });
  await navigator.clipboard.writeText(text);
}
export interface AvailableUpdate { version: string; notes: string }
export const checkUpdate = () => native<AvailableUpdate | null>('check_update');
/** Downloads, verifies and installs the checked update, then restarts. Save the draft first. */
export const installUpdate = () => native<void>('install_update');
export const startCapture = () => native<void>('start_capture');
/** Milliseconds of the last capture: saving the draft, hiding the editor, reading the screen, showing the overlay. */
export interface CaptureTiming { total: number; editor: number; settle: number; grab: number; overlay: number }
export const captureTiming = () => desktop ? native<CaptureTiming | null>('capture_timing') : Promise.resolve(null);
export const finishQuit = (requestId: string, saved: boolean) => native<void>('finish_quit', { requestId, saved });

export interface RawImage { dataUrl: string; width: number; height: number }
export async function readClipboardImage(): Promise<RawImage | Blob> {
  if (desktop) return native<RawImage>('read_clipboard_image');
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find(t => t.startsWith('image/'));
    if (type) return item.getType(type);
  }
  throw new Error('The clipboard does not contain an image.');
}
/** Saves via the native picker (desktop) or a download (preview). Returns false if the user cancelled. */
export async function exportPng(dataUrl: string, name: string, clipboard = false): Promise<boolean> {
  if (desktop) return native<boolean>('export_png', { dataUrl, name, clipboard });
  const blob = await (await fetch(dataUrl)).blob();
  if (clipboard) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); return true; }
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `${name || 'screenshot'}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
