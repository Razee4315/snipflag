import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import EmptyState from './components/EmptyState';
import Editor, { type Zoom } from './components/Editor';
import Filmstrip from './components/Filmstrip';
import HistoryDialog from './components/HistoryDialog';
import { Icon, Mark } from './components/icons';
import IssuePanel, { type ConnectionState } from './components/IssuePanel';
import SettingsDialog from './components/SettingsDialog';
import StepNotes from './components/StepNotes';
import type { PreparedReport } from './components/ReportPreview';
import Toasts from './components/Toasts';
import Toolbar, { TOOLS } from './components/Toolbar';
import { defaults, FIELD_ERRORS, imageLabel, shortcutLabel, validateSession, type CaptureImage, type Connection, type Settings } from './model';
import {
  appStatus, cancelLogin, clearHistory, connectLinear, deleteSession, desktop, disconnectLinear, editorWindow, errorText, exportPng, linearConnection, listSessions, loadSession,
  copyText, loadSettings, on, PREVIEW_MESSAGE, readClipboardImage, saveSession, saveSettings, startCapture, submissionStatus, submitIssue, reconcileIssue, finishQuit, checkUpdate, installUpdate, shareImages, type AppStatus, type AvailableUpdate, type RawImage,
} from './native';
import type { Box } from './geometry';
import { cropImage, fileBaseName, flatten, importImage, thumbnail } from './render';
import { activeImage, cropKey, isLocked, removalKey, useStore } from './store';
import { missingImageReferences } from './mentions';
import { ease, smooth } from './motion';
import { sharePrompt } from './share';
import { play, primeSound, setSoundEnabled } from './sound';
import { saveBeforeQuit } from './lifecycle';
import { isTyping } from './desktop';
import { rememberDetails, templatesOf } from './templates';
import { addToast, type Toast, type ToastAction } from './toasts';

const PANEL_KEY = 'snipflag-panel';
/** The session that was open last on this device; only that one is restored at launch. */
const LAST_SESSION_KEY = 'snipflag-last-session';
const NOT_FOUND = 'Draft was not found.';

export default function App() {
  const session = useStore(s => s.session); const image = useStore(activeImage); const busy = useStore(s => s.busy);
  const saveState = useStore(s => s.saveState); const saveError = useStore(s => s.saveError); const locked = useStore(isLocked);
  const [settings, setSettings] = useState<Settings>(defaults);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  /** Background preference updates build on the latest saved settings. */
  const updateSettings = useCallback((change: (s: Settings) => Settings) => saveSettings(change(settingsRef.current)).then(setSettings), []);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionError, setConnectionError] = useState('');
  const [dialog, setDialog] = useState<'settings' | 'history' | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [zoom, setZoom] = useState<Zoom>('fit'); const [scale, setScale] = useState(1);
  /** What a submission is doing, and how far it is (0 to 1) when that can be estimated. */
  const [progress, setProgress] = useState<{ text: string; fraction: number | null }>({ text: '', fraction: null });
  const report = useCallback((text = '', fraction: number | null = null) => setProgress({ text, fraction }), []);
  const [submitError, setSubmitError] = useState('');
  const [pendingState, setPendingState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(0);
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  /** The share action in progress; its button says so and the others wait. */
  const [sharing, setSharing] = useState<'copy' | 'save' | 'ai' | null>(null);
  const sharingNow = useRef(false);
  // The issue panel can be tucked away for quick mark-up-and-share work; the choice is remembered on this device.
  const [panelOpen, setPanelOpen] = useState(() => { try { return localStorage.getItem(PANEL_KEY) !== 'closed'; } catch { return true; } });
  const showPanel = useCallback((open: boolean) => {
    smooth(() => setPanelOpen(open));
    try { localStorage.setItem(PANEL_KEY, open ? 'open' : 'closed'); } catch { /* The panel still works for this run. */ }
  }, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const saveTimer = useRef<number | undefined>(undefined);
  const saveAttempts = useRef(new Set<string>());

  const notify = useCallback((text: string, kind: 'error' | 'info' = 'info', action?: ToastAction, undoKey?: string) => {
    const id = ++toastId.current;
    setToasts(list => addToast(list, { id, kind, text, action, undoKey }));
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), []);

  // Durable drafts: every change is saved shortly after it happens, and immediately before capture or network work.
  const saveNow = useCallback(() => {
    const run = async () => {
      const { session: s, persisted, durable, submissionLocked, setSaveState, markPersisted } = useStore.getState();
      if (submissionLocked) {
        // A failed status read must not turn a failed draft save into permission to exit.
        if (useStore.getState().saveState === 'error') throw new Error(useStore.getState().saveError || 'The draft has not been saved.');
        setSaveState('saved'); return; // The durable attempted revision is immutable until reconciliation.
      }
      if (!durable && !saveAttempts.current.has(s.id) && !s.images.length && !s.title.trim() && !s.description.trim()) { setSaveState('idle'); return; }
      saveAttempts.current.add(s.id); // A failed save can have committed metadata before cleanup failed.
      setSaveState('saving');
      try {
        // History shows this protected thumbnail; a failed render only leaves the entry without a picture.
        const preview = s.images[0] ? await thumbnail(s.images[0]).catch(() => '') : '';
        await saveSession({ ...s, preview }, persisted); markPersisted(s.id, s.images.map(i => i.id));
        if (useStore.getState().session.id === s.id) setSaveState(useStore.getState().session === s ? 'saved' : 'saving');
      } catch (e) { if (useStore.getState().session.id === s.id) setSaveState('error', errorText(e)); throw e; }
    };
    const next = saveChain.current.then(run, run); saveChain.current = next.catch(() => undefined); return next;
  }, []);
  const flush = useCallback(() => { window.clearTimeout(saveTimer.current); return saveNow(); }, [saveNow]);
  useEffect(() => {
    if (!ready) return;
    // Pending edits are never reported as saved: the status only returns to "saved" after this change is durable.
    const { session: s, durable, saveState: current, setSaveState } = useStore.getState();
    if (current === 'saved' && (durable || s.images.length || s.title.trim() || s.description.trim())) setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { saveNow().catch(() => undefined); }, 400);
    return () => window.clearTimeout(saveTimer.current);
  }, [session, ready, saveNow]);

  const refreshConnection = useCallback(async () => {
    if (!desktop) return;
    setConnectionState('loading');
    try {
      const c = await linearConnection(); setConnection(c); setConnectionError(''); setConnectionState('idle');
      // The issue panel picks the remembered team for drafts without one.
      const { session: s, patch } = useStore.getState();
      if (c && !s.issue && s.teamId && !c.teams.some(t => t.id === s.teamId)) patch({ teamId: '', projectId: '', assigneeId: '', labelIds: [] });
    } catch (e) { setConnection(null); setConnectionError(errorText(e)); setConnectionState('unreachable'); }
  }, []);

  useEffect(() => {
    primeSound();
    /** The draft to continue: the session open last time if it is still unsent. A sent or deleted one starts fresh. */
    const lastDraft = async () => {
      let last: string | null = null;
      try { last = localStorage.getItem(LAST_SESSION_KEY); } catch { /* Start with a new session. */ }
      if (last) {
        const opened = await loadSession(last).catch(e => { if (errorText(e) === NOT_FOUND) return null; throw e; });
        return opened && !opened.issue ? opened : null;
      }
      // Before this was remembered (first launch after an update): the newest unsent draft, as earlier versions did.
      const draft = (await listSessions()).find(s => !s.issue && !s.deletionPending);
      return draft ? loadSession(draft.id) : null;
    };
    (async () => {
      try {
        // Independent startup reads run together.
        const [loaded, appState, draft] = await Promise.all([loadSettings(), appStatus(), lastDraft()]);
        setSettings(loaded); setStatus(appState);
        if (draft) useStore.getState().hydrate(draft);
      } catch (e) { notify(`Could not restore your last draft: ${errorText(e)}`, 'error'); }
      setReady(true);
      void refreshConnection();
    })();
  }, [notify, refreshConnection]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(LAST_SESSION_KEY, session.id); } catch { /* The next launch starts with a new session. */ }
  }, [ready, session.id]);
  // Show the native window only after the restored workspace has painted.
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => { void editorWindow('reveal').catch(() => undefined); }));
    return () => cancelAnimationFrame(frame);
  }, [ready]);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme; else root.dataset.theme = settings.theme;
    if (settings.motion) delete root.dataset.motion; else root.dataset.motion = 'off';
    setSoundEnabled(settings.sounds);
  }, [settings.theme, settings.motion, settings.sounds]);
  useEffect(() => { if (status?.shortcutError) notify(status.shortcutError, 'error'); }, [status, notify]);
  // A field error goes away once that field is filled in.
  useEffect(() => { setSubmitError(e => (e === FIELD_ERRORS.title && session.title.trim()) || (e === FIELD_ERRORS.team && session.teamId) ? '' : e); }, [session.title, session.teamId]);
  useEffect(() => {
    setPendingState(null); setSubmitError(''); report();
    let live = true;
    submissionStatus(session.id).then(s => { if (live) setPendingState(s?.state ?? null); }).catch(() => undefined);
    return () => { live = false; };
  }, [session.id]);

  const addImages = useCallback((images: CaptureImage[]) => {
    try {
      useStore.getState().addImages(images); setZoom('fit');
      // Screenshots open in the full workspace (it only grows a smaller window); one too large for it maximizes the editor.
      if (!images.length) return false;
      const largest = images.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
      void editorWindow('workspace', largest.width, largest.height).catch(e => notify(errorText(e), 'error'));
      return true;
    } catch (e) { notify(errorText(e), 'error'); play('error'); return false; }
  }, [notify]);
  const importFiles = useCallback(async (files: File[]) => {
    const images: CaptureImage[] = [];
    try { for (const f of files) images.push(await importImage(f, fileBaseName(f.name))); if (addImages(images)) play('add'); }
    catch (e) { notify(errorText(e), 'error'); }
  }, [addImages, notify]);
  const pasteImage = useCallback(async () => {
    try {
      const data = await readClipboardImage();
      const added = data instanceof Blob ? addImages([await importImage(data, '')])
        : addImages([{ id: crypto.randomUUID(), name: '', width: (data as RawImage).width, height: (data as RawImage).height, dataUrl: (data as RawImage).dataUrl, annotations: [] }]);
      if (added) play('add');
    } catch (e) { notify(errorText(e), 'error'); }
  }, [addImages, notify]);

  const capture = useCallback(async () => {
    if (!desktop) { notify(PREVIEW_MESSAGE, 'error'); return; }
    const s = useStore.getState();
    if (s.busy) return;
    // The shortcut also works from the tray: a refusal has to bring the editor forward, or nothing seems to happen.
    const refuse = (text: string) => { void editorWindow('show').catch(() => undefined); notify(text, 'error'); play('error'); };
    if (s.submissionLocked) { refuse('Check the previous submission or start a new session before capturing.'); return; }
    if (!s.session.issue && s.session.images.length >= 10) { refuse('This session already has 10 screenshots. Start a new session to capture more.'); return; }
    s.setBusy(true);
    try { await flush(); await startCapture(); } catch (e) { useStore.getState().setBusy(false); notify(errorText(e), 'error'); }
  }, [flush, notify]);
  const captureRef = useRef(capture); captureRef.current = capture;

  /** The handshake before the app exits (Quit, update install): commit active edits, freeze changes, save, then `finish`. */
  const saveThenExit = useCallback((finish: (saved: boolean) => Promise<void>) => saveBeforeQuit({
    isBusy: () => useStore.getState().busy,
    commit: () => { (document.activeElement as HTMLElement | null)?.blur(); window.dispatchEvent(new Event('snipflag-commit-edit')); },
    lock: value => useStore.getState().setBusy(value), save: flush, finish,
  }), [flush]);
  useEffect(() => {
    const listener = on<string>('quit-requested', requestId => {
      void saveThenExit(saved => finishQuit(requestId, saved)).catch(e => notify(`Snipflag is still open: ${errorText(e)}`, 'error'));
    });
    return () => { void listener.then(unlisten => unlisten()); };
  }, [saveThenExit, notify]);

  useEffect(() => {
    const subs = [
      on('capture-requested', () => { void captureRef.current(); }),
      on<RawImage & { copied?: boolean | null; saved?: boolean | null }>('capture-complete', p => {
        useStore.getState().setBusy(false);
        if (addImages([{ id: crypto.randomUUID(), name: '', width: p.width, height: p.height, dataUrl: p.dataUrl, annotations: [] }])) {
          play('capture'); setFlash(f => f + 1);
          if (p.copied) notify('Capture copied to the clipboard.');
          else if (p.copied === false) notify('The capture was added, but it could not be copied to the clipboard.', 'error');
          if (p.saved === false) notify('The capture was added, but it could not be saved to Pictures/Snipflag.', 'error');
        }
      }),
      on('capture-cancelled', () => useStore.getState().setBusy(false)),
      on<string>('capture-failed', m => { useStore.getState().setBusy(false); notify(m, 'error'); play('error'); }),
      on<{ message: string; fraction: number | null }>('submission-progress', p => report(p.message, p.fraction)),
    ];
    return () => { subs.forEach(p => p.then(u => u())); };
  }, [addImages, notify, report]);

  /** Saves the open session before another takes its place. Returns whether an unsent draft stays behind in History. */
  const leaveSession = useCallback(async () => {
    await flush();
    const { session: s, durable } = useStore.getState();
    if (!durable || s.issue) return false;
    if (s.images.length || s.title.trim() || s.description.trim()) return true;
    // An emptied draft has nothing to come back to; it would only clutter History.
    await deleteSession(s.id).catch(() => undefined);
    return false;
  }, [flush]);
  const newSession = useCallback(async () => {
    if (useStore.getState().busy) return;
    let kept = false;
    try { kept = await leaveSession(); } catch { notify('The current draft could not be saved. Fix the problem before starting a new session.', 'error'); return; }
    useStore.getState().reset(); setZoom('fit');
    if (kept) notify('The draft you left is in History.');
  }, [leaveSession, notify]);
  const openSession = useCallback(async (id: string) => {
    await leaveSession();
    useStore.getState().hydrate(await loadSession(id)); setZoom('fit'); setDialog(null);
  }, [leaveSession]);

  const deleteLocal = useCallback(async (id?: string) => {
    const s = useStore.getState();
    if (s.busy) throw new Error('Wait for the current operation to finish.');
    s.setBusy(true); window.clearTimeout(saveTimer.current);
    try {
      // Drain old saves before deletion; never flush content back into a deletion tombstone.
      await saveChain.current;
      if (id) await deleteSession(id); else await clearHistory();
    } finally {
      if (!id || useStore.getState().session.id === id) useStore.getState().reset();
      else useStore.getState().setBusy(false);
      void appStatus().then(setStatus).catch(() => undefined);
    }
  }, []);

  const submit = useCallback(async (prepared?: PreparedReport) => {
    const s = useStore.getState();
    if (s.busy) return;
    const fail = (message: string) => { setSubmitError(message); play('error'); };
    if (!desktop) { fail(PREVIEW_MESSAGE); return; }
    if (s.submissionLocked) {
      s.setBusy(true); setSubmitError(''); report('Checking the previous report…');
      try {
        const issue = await reconcileIssue(s.session.id);
        if (issue) {
          useStore.getState().hydrate(await loadSession(s.session.id)); setPendingState('sent'); play('success');
          void updateSettings(v => ({ ...v, teamDefaults: rememberDetails(v.teamDefaults, useStore.getState().session) })).catch(() => undefined);
        } else {
          useStore.getState().setSubmissionLocked(false); setPendingState(null);
          notify('Linear confirmed no issue exists. You can edit this report and choose Create issue when ready.');
        }
      } catch (e) { fail(errorText(e)); }
      finally { useStore.getState().setBusy(false); report(); }
      return;
    }
    // The connection comes first: without it the team cannot be chosen, so field errors would point at a disabled picker.
    if (!connection) { fail(connectionState === 'unreachable' ? 'Linear could not be reached. Retry the connection, then create the issue.' : 'Connect Linear before creating the issue.'); return; }
    const invalid = validateSession(s.session);
    if (invalid) { fail(invalid); return; }
    const missing = missingImageReferences(s.session.description, s.session.images, s.session.imageReferences ?? {});
    if (missing.length) { fail(`Fix the missing image reference: @${missing[0]}.`); return; }
    s.setBusy(true); setSubmitError(''); report('Saving draft…', 0.02);
    try {
      await flush();
      const { session: snapshot, persisted } = useStore.getState();
      // A reviewed preview supplies the exact pixels shown, valid only for the unchanged revision.
      const exports: { id: string; dataUrl: string }[] = prepared && prepared.session === snapshot ? prepared.exports : [];
      if (!exports.length) for (const [i, img] of snapshot.images.entries()) {
        report(`Preparing screenshot ${i + 1} of ${snapshot.images.length}…`, 0.05 + 0.25 * i / snapshot.images.length);
        exports.push({ id: img.id, dataUrl: await flatten(img) });
      }
      await submitIssue(snapshot, persisted, exports);
      useStore.getState().hydrate(await loadSession(snapshot.id)); useStore.getState().setBusy(false); setPendingState('sent'); report();
      play('success');
      // New drafts for this team start from what was just sent; failing to remember never affects the sent issue.
      void updateSettings(v => ({ ...v, teamDefaults: rememberDetails(v.teamDefaults, snapshot) })).catch(() => undefined);
    } catch (e) {
      try {
        const status = await submissionStatus(s.session.id);
        setPendingState(status?.state ?? null);
        useStore.getState().setSubmissionLocked(status?.state === 'creating' || status?.state === 'sent');
      } catch { useStore.getState().setSubmissionLocked(true); }
      useStore.getState().setBusy(false); report(); fail(errorText(e));
    }
  }, [connection, connectionState, flush, notify, report, updateSettings]);

  const connect = useCallback(async () => {
    setConnectionState('connecting'); setConnectionError('');
    try { await connectLinear(); await refreshConnection(); notify('Linear connected.'); play('success'); }
    catch (e) { setConnectionState('error'); setConnectionError(errorText(e)); }
  }, [notify, refreshConnection]);
  const disconnect = useCallback(async () => {
    await disconnectLinear(); setConnection(null); setConnectionState('idle');
    setSettings(await loadSettings()); notify('Linear disconnected.');
  }, [notify]);
  const rememberTeam = useCallback((teamId: string) => {
    if (!connection) return;
    updateSettings(v => ({ ...v, teamMemory: { ...v.teamMemory, [connection.workspaceId]: teamId } })).catch(() => undefined);
  }, [connection, updateSettings]);

  // Signed updates: checked quietly in the background, installed only when the user asks.
  const findUpdate = useCallback(async () => { const found = await checkUpdate(); setUpdate(found); return found; }, []);
  useEffect(() => {
    if (!ready || !status?.updates || !settings.autoUpdate) return;
    const run = () => { void findUpdate().catch(() => undefined); };
    const first = window.setTimeout(run, 8000); const every = window.setInterval(run, 6 * 60 * 60 * 1000);
    return () => { window.clearTimeout(first); window.clearInterval(every); };
  }, [ready, status?.updates, settings.autoUpdate, findUpdate]);
  /** What the update chip says while an install is running; null otherwise. */
  const [updating, setUpdating] = useState<string | null>(null);
  useEffect(() => {
    const listener = on<{ percent: number | null }>('update-progress', p => setUpdating(p.percent === null ? 'Downloading…' : p.percent < 100 ? `Downloading ${p.percent}%` : 'Installing…'));
    return () => { void listener.then(unlisten => unlisten()); };
  }, []);
  const applyUpdate = useCallback(async () => {
    setUpdating('Saving your draft…');
    try {
      // Same guarantees as Quit: active edits are committed and the draft is saved before the app restarts.
      await saveThenExit(async saved => { if (saved) await installUpdate(); });
    } catch (e) {
      notify(`Update not installed: ${errorText(e)}`, 'error');
      // Checking again makes the update installable once more, so the chip stays for another try.
      void findUpdate().catch(() => setUpdate(null));
    } finally { setUpdating(null); }
  }, [saveThenExit, notify, findUpdate]);

  /** Runs one share action at a time and shows which one is working. */
  const share = useCallback(async (kind: 'copy' | 'save' | 'ai', run: () => Promise<void>) => {
    if (sharingNow.current) return;
    sharingNow.current = true; setSharing(kind);
    try { await run(); } catch (e) { notify(errorText(e), 'error'); }
    finally { sharingNow.current = false; setSharing(null); }
  }, [notify]);
  const exportActive = useCallback((clipboard: boolean) => share(clipboard ? 'copy' : 'save', async () => {
    const s = useStore.getState(); const img = activeImage(s); if (!img) return;
    const index = s.session.images.indexOf(img);
    const ok = await exportPng(await flatten(img), imageLabel(img, index), clipboard);
    if (ok) notify(clipboard ? 'Image copied to the clipboard.' : 'Image saved.');
  }), [notify, share]);

  // Zoom buttons glide to the new scale instead of jumping.
  const scaleNow = useRef(scale); scaleNow.current = scale;
  const stopZoom = useRef<() => void>(() => undefined);
  const zoomTo = useCallback((target: number) => { stopZoom.current(); stopZoom.current = ease(scaleNow.current, target, 150, setZoom); }, []);
  /** Removes a screenshot. The toast or Undo puts it back in the same place with its marks and undo history. */
  const removeImage = useCallback((id: string) => {
    const s = useStore.getState(); const index = s.session.images.findIndex(i => i.id === id); const removed = s.session.images[index];
    if (!removed || isLocked(s)) return;
    smooth(() => useStore.getState().removeImage(id));
    notify(`${imageLabel(removed, index)} removed.`, 'info', { label: 'Put back', run: () => smooth(() => { useStore.getState().undoStructure(removalKey(id)); }) }, removalKey(id));
  }, [notify]);
  /** Crops the active screenshot. The toast or Undo puts the uncropped image and its undo history back. */
  const cropActive = useCallback(async (rect: Box) => {
    const s = useStore.getState(); const before = activeImage(s); if (!before || isLocked(s)) return;
    try {
      const next = await cropImage(before, rect);
      useStore.getState().cropImage(before.id, next); useStore.getState().setTool('select'); setZoom('fit');
      notify(`Cropped to ${next.width} × ${next.height}.`, 'info', { label: 'Undo crop', run: () => { if (useStore.getState().undoStructure(cropKey(next.id))) setZoom('fit'); } }, cropKey(next.id));
    } catch (e) { notify(errorText(e), 'error'); }
  }, [notify]);
  // An offer to undo leaves once Undo (or anything else) has already taken that change back.
  const structure = useStore(s => s.structure);
  useEffect(() => { setToasts(list => list.some(t => t.undoKey && !structure.some(c => c.key === t.undoKey)) ? list.filter(t => !t.undoKey || structure.some(c => c.key === t.undoKey)) : list); }, [structure]);
  /** Saves every flattened screenshot to Pictures/Snipflag and copies their paths with the report text and step notes. */
  const shareForAi = useCallback(() => share('ai', async () => {
    const { session: s } = useStore.getState(); if (!s.images.length) return;
    const images: { dataUrl: string }[] = [];
    for (const img of s.images) images.push({ dataUrl: await flatten(img) });
    const paths = await shareImages(images);
    await copyText(sharePrompt(s, paths));
    notify(`${paths.length === 1 ? 'Screenshot' : `${paths.length} screenshots`} saved to Pictures/Snipflag. Paths and notes are on the clipboard.`);
  }), [notify, share]);

  // Keyboard: tool keys, undo/redo, submit, paste.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || document.querySelector('dialog[open]')) return;
      const mod = e.ctrlKey || e.metaKey; const key = e.key.toLowerCase();
      if (mod && key === 'enter') {
        e.preventDefault();
        // Never send from a hidden panel: show the report first, and let a second press create it.
        if (panelOpen) void submit(); else showPanel(true);
        return;
      }
      if (isTyping(e.target)) return;
      const { undo, redo, setTool } = useStore.getState();
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && key === 'y') { e.preventDefault(); redo(); return; }
      // Copy the marked-up image (Shift: paths and notes for an assistant) unless text is selected.
      if (mod && key === 'c' && !window.getSelection()?.toString() && activeImage(useStore.getState())) {
        e.preventDefault(); void (e.shiftKey ? shareForAi() : exportActive(true)); return;
      }
      if (mod || e.altKey) return;
      const tool = TOOLS.find(t => t.key.toLowerCase() === key);
      if (tool && !isLocked(useStore.getState())) { e.preventDefault(); setTool(tool.tool); }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (dialog || document.querySelector('dialog[open]') || isTyping(e.target)) return;
      const files = [...(e.clipboardData?.files ?? [])].filter(f => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); void importFiles(files); }
      else if (desktop) { e.preventDefault(); void pasteImage(); }
    };
    window.addEventListener('keydown', onKey); window.addEventListener('paste', onPaste);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('paste', onPaste); };
  }, [dialog, submit, importFiles, pasteImage, exportActive, shareForAi, panelOpen, showPanel]);

  const count = session.images.length; const index = image ? session.images.indexOf(image) : -1;
  const dragWindow = (e: MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('button, input, select, textarea, a, label')) void editorWindow('drag').catch(err => notify(errorText(err), 'error'));
  };
  const tuckAway = async () => {
    try { await flush(); await editorWindow('hide'); } catch (e) { notify(errorText(e), 'error'); }
  };
  const saveText = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved on this computer' : saveState === 'error' ? `Not saved: ${saveError}` : 'Nothing to save yet';
  return (
    <div className={panelOpen ? 'app' : 'app solo'} onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }}
      onDrop={e => { const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); void importFiles(files); } }}>
      <header className="titlebar" onMouseDown={dragWindow}>
        <span className="brand-chip" aria-hidden="true"><Mark size={15} /></span>
        <span className="grip" aria-hidden="true" />
        <span className="visually-hidden" role="status" aria-label={saveText}>{saveText}</span>
        {saveState === 'error' && <span className="save-error" role="alert" title={saveText}><Icon name="alert" size={14} /> {saveText}</span>}
        {status?.cleanupError && <span className="save-error" role="alert" title={status.cleanupError}><Icon name="alert" size={14} /> Local cleanup incomplete. Retry in History or Settings.</span>}
        <div className="drag-space" aria-hidden="true" onDoubleClick={() => void editorWindow('maximize').catch(() => undefined)} />
        {update && <button type="button" className="update-chip" disabled={busy} title={update.notes || undefined} onClick={() => void applyUpdate()}>
          {updating ? <span className="spinner" aria-hidden="true" /> : <Icon name="refresh" size={14} />} <span role="status">{updating ?? `Update to ${update.version}`}</span></button>}
        <div className="top-actions">
          <button type="button" className={panelOpen ? 'icon-button active' : 'icon-button'} aria-pressed={panelOpen} aria-label={panelOpen ? 'Hide issue panel' : 'Show issue panel'} title={panelOpen ? 'Hide issue panel' : 'Show issue panel'} onClick={() => showPanel(!panelOpen)}><Icon name="panel" /></button>
          <button type="button" className="icon-button" aria-label="History" title="History" disabled={busy} onClick={() => setDialog('history')}><Icon name="history" /></button>
          <button type="button" className="icon-button" aria-label="Settings" title="Settings" disabled={busy} onClick={() => setDialog('settings')}><Icon name="settings" /></button>
        </div>
        {desktop && <div className="window-actions">
          <button type="button" className="window-button" aria-label="Minimize" title="Minimize" onClick={() => void editorWindow('minimize').catch(e => notify(errorText(e), 'error'))}><Icon name="minus" size={16} /></button>
          <button type="button" className="window-button" aria-label="Maximize or restore" title="Maximize or restore" onClick={() => void editorWindow('maximize').catch(e => notify(errorText(e), 'error'))}><Icon name="maximize" size={14} /></button>
          <button type="button" className="window-button close" disabled={busy} onClick={() => void tuckAway()}
            aria-label={status?.tray === false ? 'Save and minimize' : 'Save and hide to tray'}
            title={status?.tray === false ? 'Minimize. Your draft is saved; this desktop has no tray to hide in.' : 'Hide to tray. Your draft is saved; Quit is in the tray menu.'}><Icon name="close" size={16} /></button>
        </div>}
      </header>
      <main className="stage-area" aria-label="Screenshot editor">
        {image ? (
          <>
            <Toolbar onDragWindow={dragWindow} />
            <div className="canvas-wrap">
              <Editor image={image} zoom={zoom} onZoom={setZoom} onScale={setScale} onCrop={rect => void cropActive(rect)} />
              <StepNotes image={image} />
            </div>
            <div className="image-bar">
              <label className="caption-field">
                <span className="visually-hidden">Caption for screenshot {index + 1}</span>
                <input value={image.name} placeholder={`Screenshot ${index + 1} caption`} disabled={locked} maxLength={200} autoComplete="off"
                  onChange={e => useStore.getState().updateImage(image.id, { name: e.target.value })} />
              </label>
              <span className="dims">{image.width} × {image.height}</span>
              <div className="zoom" role="group" aria-label="Zoom">
                <button type="button" className="tool" aria-label="Zoom out" title="Zoom out" onClick={() => zoomTo(Math.max(0.1, scale / 1.25))}><Icon name="zoomOut" /></button>
                <button type="button" className="zoom-value" aria-label="Actual size" title="Actual size (100%)" onClick={() => zoomTo(1)}>{Math.round(scale * 100)}%</button>
                <button type="button" className="tool" aria-label="Zoom in" title="Zoom in" onClick={() => zoomTo(Math.min(8, scale * 1.25))}><Icon name="zoomIn" /></button>
                <button type="button" className={zoom === 'fit' ? 'tool active' : 'tool'} aria-label="Fit to window" title="Fit to window" onClick={() => setZoom('fit')}><Icon name="fit" /></button>
              </div>
            </div>
            <div className="share" role="group" aria-label="Share this screenshot" onMouseDown={dragWindow}>
              <button type="button" className="button primary" disabled={!!sharing} onClick={() => void exportActive(true)}><Icon name="copy" size={16} /> {sharing === 'copy' ? 'Copying…' : 'Copy image'}</button>
              <button type="button" className="button" disabled={!desktop || !!sharing} onClick={() => void shareForAi()}><Icon name="terminal" size={16} /> {sharing === 'ai' ? 'Saving copies…' : 'Copy for AI'}</button>
              <button type="button" className="button" disabled={!!sharing} onClick={() => void exportActive(false)}><Icon name="save" size={16} /> {sharing === 'save' ? 'Saving…' : 'Save image'}</button>
              <span className="share-hint small muted">{desktop ? 'Copy for AI saves the screenshots and copies their paths with your notes.' : 'Copy for AI works in the desktop app.'}</span>
              {!panelOpen && <button type="button" className="button share-linear" onClick={() => showPanel(true)}><Icon name="panel" size={16} /> Linear issue</button>}
            </div>
            {flash > 0 && <div key={flash} className="capture-flash" aria-hidden="true" />}
          </>
        ) : (
          <EmptyState shortcut={shortcutLabel(settings.shortcut)} onCapture={() => void capture()} onAdd={() => fileInput.current?.click()} onPaste={() => void pasteImage()} onDragWindow={dragWindow} />
        )}
        {count > 0 && <Filmstrip canCapture={desktop} onCapture={() => void capture()} onAdd={() => fileInput.current?.click()} onRemove={removeImage} />}
      </main>
      <IssuePanel hidden={!panelOpen} connection={connection} connectionState={connectionState} connectionError={connectionError} hasClientId={!!settings.clientId || !!status?.builtinLinearClient}
        progress={progress.text} progressFraction={progress.fraction} submitError={submitError} pendingState={pendingState}
        templates={templatesOf(settings)} teamMemory={settings.teamMemory} teamDefaults={settings.teamDefaults}
        onConnect={() => void connect()} onCancelConnect={() => void cancelLogin().catch(() => undefined)} onRetryConnection={() => void refreshConnection()}
        onOpenSettings={() => setDialog('settings')} onSubmit={report => void submit(report)} onNewSession={() => void newSession()} onTeamChosen={rememberTeam} notify={notify} />
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden aria-label="Add images"
        onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) void importFiles(files); }} />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      {dialog === 'settings' && (
        <SettingsDialog settings={settings} status={status} connection={connection} connectionState={connectionState} connectionError={connectionError}
          onSave={async next => { setSettings(await saveSettings(next)); setStatus(await appStatus()); }}
          onConnect={() => void connect()} onCancelConnect={() => void cancelLogin().catch(() => undefined)} onRetryConnection={() => void refreshConnection()} onDisconnect={disconnect}
          onClearHistory={() => deleteLocal()} onCheckUpdate={findUpdate} onInstallUpdate={() => { setDialog(null); void applyUpdate(); }} onClose={() => setDialog(null)} />
      )}
      {dialog === 'history' && (
        <HistoryDialog currentId={session.id} onOpen={openSession} onClose={() => setDialog(null)} onDelete={deleteLocal} />
      )}
    </div>
  );
}
