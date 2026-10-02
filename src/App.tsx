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
import Toolbar, { TOOLS } from './components/Toolbar';
import { defaults, imageLabel, shortcutLabel, validateSession, type CaptureImage, type Connection, type Settings } from './model';
import {
  appStatus, cancelLogin, clearHistory, connectLinear, deleteSession, desktop, disconnectLinear, editorWindow, errorText, exportPng, linearConnection, listSessions, loadSession,
  copyText, loadSettings, on, PREVIEW_MESSAGE, readClipboardImage, saveSession, saveSettings, startCapture, submissionStatus, submitIssue, reconcileIssue, finishQuit, checkUpdate, installUpdate, shareImages, type AppStatus, type AvailableUpdate, type RawImage,
} from './native';
import { fileBaseName, flatten, importImage } from './render';
import { activeImage, isLocked, useStore } from './store';
import { missingImageReferences } from './mentions';
import { smooth } from './motion';
import { sharePrompt } from './share';
import { play, primeSound, setSoundEnabled } from './sound';
import { saveBeforeQuit } from './lifecycle';
import { rememberDetails, templatesOf } from './templates';

const PANEL_KEY = 'snipflag-panel';
type Notice = { kind: 'error' | 'info'; text: string; id: number } | null;
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

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
  const [notice, setNotice] = useState<Notice>(null);
  const [zoom, setZoom] = useState<Zoom>('fit'); const [scale, setScale] = useState(1);
  const [progress, setProgress] = useState(''); const [submitError, setSubmitError] = useState('');
  const [pendingState, setPendingState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(0);
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
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

  const notify = useCallback((text: string, kind: 'error' | 'info' = 'info') => setNotice({ kind, text, id: Date.now() }), []);
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(null), notice.kind === 'error' ? 9000 : 3500); return () => window.clearTimeout(t); }, [notice]);

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
        await saveSession(s, persisted); markPersisted(s.id, s.images.map(i => i.id));
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
    } catch (e) { setConnection(null); setConnectionError(errorText(e)); setConnectionState('error'); }
  }, []);

  useEffect(() => {
    primeSound();
    (async () => {
      try {
        // Independent startup reads run together.
        const [loaded, appState, sessions] = await Promise.all([loadSettings(), appStatus(), listSessions()]);
        setSettings(loaded); setStatus(appState);
        const draft = sessions.find(s => !s.issue && !s.deletionPending);
        if (draft) useStore.getState().hydrate(await loadSession(draft.id));
      } catch (e) { notify(`Could not restore your last draft: ${errorText(e)}`, 'error'); }
      setReady(true);
      void refreshConnection();
    })();
  }, [notify, refreshConnection]);
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
  useEffect(() => {
    setPendingState(null); setSubmitError(''); setProgress('');
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
    if (s.submissionLocked) { notify('Check the previous submission or start a new session before capturing.', 'error'); return; }
    if (!s.session.issue && s.session.images.length >= 10) { notify('This session already has 10 screenshots. Start a new session to capture more.', 'error'); return; }
    s.setBusy(true);
    try { await flush(); await startCapture(); } catch (e) { useStore.getState().setBusy(false); notify(errorText(e), 'error'); }
  }, [flush, notify]);
  const captureRef = useRef(capture); captureRef.current = capture;

  useEffect(() => {
    const listener = on<string>('quit-requested', requestId => {
      void saveBeforeQuit({
        isBusy: () => useStore.getState().busy,
        commit: () => { (document.activeElement as HTMLElement | null)?.blur(); window.dispatchEvent(new Event('snipflag-commit-edit')); },
        lock: value => useStore.getState().setBusy(value), save: flush,
        finish: saved => finishQuit(requestId, saved),
      }).catch(e => notify(`Snipflag is still open: ${errorText(e)}`, 'error'));
    });
    return () => { void listener.then(unlisten => unlisten()); };
  }, [flush, notify]);

  useEffect(() => {
    const subs = [
      on('capture-requested', () => { void captureRef.current(); }),
      on<RawImage & { copied?: boolean | null }>('capture-complete', p => {
        useStore.getState().setBusy(false);
        if (addImages([{ id: crypto.randomUUID(), name: '', width: p.width, height: p.height, dataUrl: p.dataUrl, annotations: [] }])) {
          play('capture'); setFlash(f => f + 1);
          if (p.copied) notify('Capture copied to the clipboard.');
          else if (p.copied === false) notify('The capture was added, but it could not be copied to the clipboard.', 'error');
        }
      }),
      on('capture-cancelled', () => useStore.getState().setBusy(false)),
      on<string>('capture-failed', m => { useStore.getState().setBusy(false); notify(m, 'error'); play('error'); }),
      on<string>('submission-progress', m => setProgress(m)),
    ];
    return () => { subs.forEach(p => p.then(u => u())); };
  }, [addImages, notify]);

  const newSession = useCallback(async () => {
    if (useStore.getState().busy) return;
    try { await flush(); } catch { notify('The current draft could not be saved. Fix the problem before starting a new session.', 'error'); return; }
    useStore.getState().reset(); setZoom('fit');
  }, [flush, notify]);
  const openSession = useCallback(async (id: string) => {
    await flush();
    useStore.getState().hydrate(await loadSession(id)); setZoom('fit'); setDialog(null);
  }, [flush]);

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
      s.setBusy(true); setSubmitError(''); setProgress('Checking the previous report…');
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
      finally { useStore.getState().setBusy(false); setProgress(''); }
      return;
    }
    const invalid = validateSession(s.session);
    if (invalid) { fail(invalid); return; }
    const missing = missingImageReferences(s.session.description, s.session.images, s.session.imageReferences ?? {});
    if (missing.length) { fail(`Fix the missing image reference: @${missing[0]}.`); return; }
    if (!connection) { fail('Connect Linear before creating the issue.'); return; }
    s.setBusy(true); setSubmitError(''); setProgress('Saving draft…');
    try {
      await flush();
      const { session: snapshot, persisted } = useStore.getState();
      // A reviewed preview supplies the exact pixels shown, valid only for the unchanged revision.
      const exports: { id: string; dataUrl: string }[] = prepared && prepared.session === snapshot ? prepared.exports : [];
      if (!exports.length) for (const [i, img] of snapshot.images.entries()) {
        setProgress(`Preparing screenshot ${i + 1} of ${snapshot.images.length}…`);
        exports.push({ id: img.id, dataUrl: await flatten(img) });
      }
      await submitIssue(snapshot, persisted, exports);
      useStore.getState().hydrate(await loadSession(snapshot.id)); useStore.getState().setBusy(false); setPendingState('sent'); setProgress('');
      play('success');
      // New drafts for this team start from what was just sent; failing to remember never affects the sent issue.
      void updateSettings(v => ({ ...v, teamDefaults: rememberDetails(v.teamDefaults, snapshot) })).catch(() => undefined);
    } catch (e) {
      try {
        const status = await submissionStatus(s.session.id);
        setPendingState(status?.state ?? null);
        useStore.getState().setSubmissionLocked(status?.state === 'creating' || status?.state === 'sent');
      } catch { useStore.getState().setSubmissionLocked(true); }
      useStore.getState().setBusy(false); setProgress(''); fail(errorText(e));
    }
  }, [connection, flush, notify, updateSettings]);

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
  const applyUpdate = useCallback(async () => {
    notify('Saving your draft and installing the update…');
    try {
      // Same guarantees as Quit: active edits are committed and the draft is saved before the app restarts.
      await saveBeforeQuit({
        isBusy: () => useStore.getState().busy,
        commit: () => { (document.activeElement as HTMLElement | null)?.blur(); window.dispatchEvent(new Event('snipflag-commit-edit')); },
        lock: value => useStore.getState().setBusy(value), save: flush,
        finish: async saved => { if (saved) await installUpdate(); },
      });
    } catch (e) { setUpdate(null); notify(`Update not installed: ${errorText(e)}`, 'error'); }
  }, [flush, notify]);

  const exportActive = useCallback(async (clipboard: boolean) => {
    const s = useStore.getState(); const img = activeImage(s); if (!img) return;
    const index = s.session.images.indexOf(img);
    try {
      const ok = await exportPng(await flatten(img), imageLabel(img, index), clipboard);
      if (ok) notify(clipboard ? 'Image copied to the clipboard.' : 'Image saved.');
    } catch (e) { notify(errorText(e), 'error'); }
  }, [notify]);

  /** Saves every flattened screenshot to Pictures/Snipflag and copies their paths with the report text and step notes. */
  const shareForAi = useCallback(async () => {
    const { session: s } = useStore.getState(); if (!s.images.length) return;
    try {
      const images: { dataUrl: string }[] = [];
      for (const img of s.images) images.push({ dataUrl: await flatten(img) });
      const paths = await shareImages(images);
      await copyText(sharePrompt(s, paths));
      notify(`${paths.length === 1 ? 'Screenshot' : `${paths.length} screenshots`} saved to Pictures/Snipflag. Paths and notes are on the clipboard.`);
    } catch (e) { notify(errorText(e), 'error'); }
  }, [notify]);

  // Keyboard: tool keys, undo/redo, submit, paste.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || document.querySelector('dialog[open]')) return;
      const mod = e.ctrlKey || e.metaKey; const key = e.key.toLowerCase();
      if (mod && key === 'enter') { e.preventDefault(); void submit(); return; }
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
  }, [dialog, submit, importFiles, pasteImage, exportActive, shareForAi]);

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
        <div className="drag-space" aria-hidden="true" />
        {update && <button type="button" className="update-chip" disabled={busy} title={update.notes || undefined} onClick={() => void applyUpdate()}>
          <Icon name="refresh" size={14} /> Update to {update.version}</button>}
        <div className="top-actions">
          <button type="button" className={panelOpen ? 'icon-button active' : 'icon-button'} aria-pressed={panelOpen} aria-label={panelOpen ? 'Hide issue panel' : 'Show issue panel'} title={panelOpen ? 'Hide issue panel' : 'Show issue panel'} onClick={() => showPanel(!panelOpen)}><Icon name="panel" /></button>
          <button type="button" className="icon-button" aria-label="History" title="History" disabled={busy} onClick={() => setDialog('history')}><Icon name="history" /></button>
          <button type="button" className="icon-button" aria-label="Settings" title="Settings" disabled={busy} onClick={() => setDialog('settings')}><Icon name="settings" /></button>
        </div>
        {desktop && <div className="window-actions">
          <button type="button" className="window-button" aria-label="Minimize" title="Minimize" onClick={() => void editorWindow('minimize').catch(e => notify(errorText(e), 'error'))}><Icon name="minus" size={16} /></button>
          <button type="button" className="window-button close" aria-label="Save and hide to tray" title="Save and hide to tray" disabled={busy} onClick={() => void tuckAway()}><Icon name="close" size={16} /></button>
        </div>}
      </header>
      <main className="stage-area" aria-label="Screenshot editor">
        {image ? (
          <>
            <Toolbar />
            <div className="canvas-wrap">
              <Editor image={image} zoom={zoom} onZoom={setZoom} onScale={setScale} />
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
                <button type="button" className="tool" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(Math.max(0.1, scale / 1.25))}><Icon name="zoomOut" /></button>
                <button type="button" className="zoom-value" aria-label="Actual size" title="Actual size (100%)" onClick={() => setZoom(1)}>{Math.round(scale * 100)}%</button>
                <button type="button" className="tool" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(Math.min(8, scale * 1.25))}><Icon name="zoomIn" /></button>
                <button type="button" className={zoom === 'fit' ? 'tool active' : 'tool'} aria-label="Fit to window" title="Fit to window" onClick={() => setZoom('fit')}><Icon name="fit" /></button>
              </div>
            </div>
            <div className="share" role="group" aria-label="Share this screenshot">
              <button type="button" className="button primary" onClick={() => void exportActive(true)}><Icon name="copy" size={16} /> Copy image</button>
              <button type="button" className="button" disabled={!desktop} onClick={() => void shareForAi()}><Icon name="spark" size={16} /> Copy for AI</button>
              <button type="button" className="button" onClick={() => void exportActive(false)}><Icon name="save" size={16} /> Save image</button>
              <span className="share-hint small muted">{desktop ? 'Copy for AI saves the screenshots and copies their paths with your notes.' : 'Copy for AI works in the desktop app.'}</span>
              {!panelOpen && <button type="button" className="button share-linear" onClick={() => showPanel(true)}><Icon name="panel" size={16} /> Linear issue</button>}
            </div>
            {flash > 0 && <div key={flash} className="capture-flash" aria-hidden="true" />}
          </>
        ) : (
          <EmptyState shortcut={shortcutLabel(settings.shortcut)} onCapture={() => void capture()} onAdd={() => fileInput.current?.click()} onPaste={() => void pasteImage()} onDragWindow={dragWindow} />
        )}
        {count > 0 && <Filmstrip canCapture={desktop} onCapture={() => void capture()} onAdd={() => fileInput.current?.click()} />}
      </main>
      <IssuePanel hidden={!panelOpen} connection={connection} connectionState={connectionState} connectionError={connectionError} hasClientId={!!settings.clientId || !!status?.builtinLinearClient}
        progress={progress} submitError={submitError} pendingState={pendingState}
        templates={templatesOf(settings)} teamMemory={settings.teamMemory} teamDefaults={settings.teamDefaults}
        onConnect={() => void connect()} onCancelConnect={() => void cancelLogin().catch(() => undefined)} onRetryConnection={() => void refreshConnection()}
        onOpenSettings={() => setDialog('settings')} onSubmit={report => void submit(report)} onNewSession={() => void newSession()} onTeamChosen={rememberTeam} notify={notify} />
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden aria-label="Add images"
        onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) void importFiles(files); }} />
      <div className="toast-region" role={notice?.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
        {notice && <div key={notice.id} className={`toast ${notice.kind}`}>
          <Icon name={notice.kind === 'error' ? 'alert' : 'check'} size={16} />
          <span>{notice.text}</span>
          <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setNotice(null)}><Icon name="close" size={14} /></button>
        </div>}
      </div>
      {dialog === 'settings' && (
        <SettingsDialog settings={settings} status={status} connection={connection} connectionState={connectionState} connectionError={connectionError}
          onSave={async next => { setSettings(await saveSettings(next)); setStatus(await appStatus()); }}
          onConnect={() => void connect()} onCancelConnect={() => void cancelLogin().catch(() => undefined)} onDisconnect={disconnect}
          onClearHistory={() => deleteLocal()} onCheckUpdate={findUpdate} onInstallUpdate={() => { setDialog(null); void applyUpdate(); }} onClose={() => setDialog(null)} />
      )}
      {dialog === 'history' && (
        <HistoryDialog currentId={session.id} onOpen={openSession} onClose={() => setDialog(null)} onDelete={deleteLocal} />
      )}
    </div>
  );
}
