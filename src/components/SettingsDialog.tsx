import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { acceleratorFromEvent, REDIRECT_URI, shortcutLabel, type Connection, type Settings, type Template } from '../model';
import { TEMPLATE_LIMITS, templatesOf, tidyTemplates } from '../templates';
import { captureTiming, copyText, desktop, errorText, openAboutLink, openLinearSetup, type AboutLink, type AppStatus, type AvailableUpdate, type CaptureTiming } from '../native';
import Dialog from './Dialog';
import { Icon, Mark, type IconName } from './icons';
import { play } from '../sound';
import type { ConnectionState } from './IssuePanel';

interface Props {
  settings: Settings; status: AppStatus | null; connection: Connection | null; connectionState: ConnectionState; connectionError: string;
  onSave: (settings: Settings) => Promise<void>; onConnect: () => void; onCancelConnect: () => void; onRetryConnection: () => void; onDisconnect: () => Promise<void>;
  onClearHistory: () => Promise<void>; onCheckUpdate: () => Promise<AvailableUpdate | null>; onInstallUpdate: () => void; onClose: () => void;
}
const SECTIONS = ['Connection', 'Capture', 'Templates', 'Appearance', 'Privacy', 'Shortcuts', 'About'] as const;
const CREATOR: { target: AboutLink; label: string; detail: string; icon: IconName }[] = [
  { target: 'github', label: 'GitHub', detail: 'Razee4315', icon: 'github' },
  { target: 'linkedin', label: 'LinkedIn', detail: 'saqlainrazee', icon: 'linkedin' },
];
/** Preview colors mirror each theme's background, surface and primary tokens in style.css. */
const THEMES: { value: Settings['theme']; label: string; colors: [string, string, string] }[] = [
  { value: 'system', label: 'Match system', colors: ['#EFEEE8', '#FCFBF8', '#8CDCC1'] },
  { value: 'light', label: 'Light', colors: ['#EFEEE8', '#FCFBF8', '#0F6B62'] },
  { value: 'dark', label: 'Dark', colors: ['#111C1A', '#1A2A27', '#8CDCC1'] },
  { value: 'paper', label: 'Paper', colors: ['#EADFCB', '#FAF3E4', '#A4502C'] },
  { value: 'blossom', label: 'Blossom', colors: ['#F1E4E9', '#FFF9FB', '#B03A68'] },
  { value: 'midnight', label: 'Midnight', colors: ['#0C0F1F', '#171B33', '#9DA8FF'] },
  { value: 'graphite', label: 'Graphite', colors: ['#121212', '#1F1F1F', '#FFB454'] },
];
const DELAYS = [{ v: 0, l: 'No delay' }, { v: 3, l: '3 seconds' }, { v: 5, l: '5 seconds' }, { v: 10, l: '10 seconds' }];
const RETENTION = [{ v: 7, l: '7 days' }, { v: 30, l: '30 days' }, { v: 90, l: '90 days' }, { v: 365, l: '1 year' }, { v: 0, l: 'Keep until I delete' }];

export default function SettingsDialog(p: Props) {
  const [section, setSection] = useState<typeof SECTIONS[number]>('Connection');
  const [draft, setDraft] = useState<Settings>(p.settings);
  const [error, setError] = useState(''); const [saved, setSaved] = useState('');
  const [recording, setRecording] = useState(false); const [confirmClear, setConfirmClear] = useState(false);
  const [added, setAdded] = useState('');
  const [updateState, setUpdateState] = useState<{ checking?: boolean; found?: AvailableUpdate | null; error?: string }>({});
  const [timing, setTiming] = useState<CaptureTiming | null>(null);
  useEffect(() => { captureTiming().then(setTiming).catch(() => undefined); }, []);
  const builtin = !!p.status?.builtinLinearClient;
  // A picked theme previews at once; closing without saving returns to the saved one.
  const savedTheme = useRef(p.settings.theme); savedTheme.current = p.settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    const apply = (theme: Settings['theme']) => { if (theme === 'system') delete root.dataset.theme; else root.dataset.theme = theme; };
    apply(draft.theme);
    return () => apply(savedTheme.current);
  }, [draft.theme]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(p.settings);
  const save = async (next = draft) => {
    setError(''); setSaved('');
    const tidy = { ...next, templates: tidyTemplates(next.templates) }; setDraft(tidy);
    try { await p.onSave(tidy); setSaved('Settings saved.'); return true; } catch (e) { setError(errorText(e)); return false; }
  };
  const templates = templatesOf(draft);
  const setTemplates = (next: Template[]) => setDraft({ ...draft, templates: next });
  const changeTemplate = (id: string, change: Partial<Template>) => setTemplates(templates.map(t => t.id === id ? { ...t, ...change } : t));
  const addTemplate = () => { const id = crypto.randomUUID(); setAdded(id); setTemplates([...templates, { id, name: 'New template', body: '' }]); };
  const remembered = Object.keys(draft.teamDefaults).length;
  const connect = async () => { if (dirty && !(await save())) return; p.onConnect(); };

  return (
    <Dialog title="Settings" onClose={p.onClose} wide footer={<>
      <span className="small muted" role="status">{saved}</span>
      <button type="button" className="button" onClick={p.onClose}>Close</button>
      <button type="button" className="button primary" disabled={!dirty} onClick={() => void save()}>Save settings</button>
    </>}>

      <nav className="settings-nav" aria-label="Settings sections" style={{ '--i': SECTIONS.indexOf(section), '--n': SECTIONS.length } as CSSProperties}>
        {SECTIONS.map(name => <button key={name} type="button" className={section === name ? 'active' : ''} aria-pressed={section === name} onClick={() => setSection(name)}>{name}</button>)}
      </nav>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="settings-section" hidden={section !== 'Connection'}><h3>Your Linear workspace</h3>
        {p.connection ? (
          <div className="row between">
            <p className="small">Connected to <strong>{p.connection.workspace}</strong> as {p.connection.name}.</p>
            <button type="button" className="button" onClick={() => p.onDisconnect().then(() => setDraft(d => ({ ...d, teamMemory: {}, teamDefaults: {} }))).catch(e => setError(errorText(e)))}>Disconnect</button>
          </div>
        ) : p.connectionState === 'connecting' ? (
          <div className="row between"><p className="small">Waiting for you to approve access in the browser…</p><button type="button" className="button" onClick={p.onCancelConnect}>Cancel</button></div>
        ) : (
          <>
            <p className="small muted">Sign in through your browser. Screenshots stay here until you choose Create issue.</p>
            {!builtin && !draft.clientId && <p className="warn small">This build has no built-in Linear connection. Use a configured installer or add your own public client ID below.</p>}
            {draft.clientId && <p className="small muted">Using your custom Linear application.</p>}
            <details className="setup">
              <summary>Advanced: custom Linear application</summary>
              <ol className="small">
                <li>In Linear, open Settings → API → OAuth applications and create a new application.</li>
                <li>Add this callback URL: <code>{REDIRECT_URI}</code> <button type="button" className="link-button" onClick={() => copyText(REDIRECT_URI).then(() => setSaved('Callback URL copied.')).catch(e => setError(errorText(e)))}>Copy</button></li>
                <li>Copy the application's <strong>Client ID</strong> (not the secret) into the field below, then choose Connect Linear.</li>
              </ol>
              {desktop && <button type="button" className="button" onClick={() => openLinearSetup().catch(e => setError(errorText(e)))}>Open Linear OAuth settings</button>}
            <label className="field">
              <span>Linear OAuth client ID</span>
              <input value={draft.clientId} spellCheck={false} autoComplete="off" placeholder="Paste the public client ID" onChange={e => setDraft({ ...draft, clientId: e.target.value.trim() })} />
              <small className="muted">{builtin ? 'Leave blank to use the built-in connection. ' : ''}Use the public ID only, never a client secret.</small>
            </label>
            {builtin && draft.clientId && <button type="button" className="button" onClick={() => setDraft({ ...draft, clientId: '' })}>Use built-in connection</button>}
            </details>
            <p className="small muted">Snipflag uses PKCE. Tokens stay in your system credential store.</p>
            {p.connectionState === 'unreachable'
              ? <div className="row between"><p className="error small" role="alert">{p.connectionError} You are still signed in.</p><button type="button" className="button" onClick={p.onRetryConnection}>Retry</button></div>
              : p.connectionError && <p className="error small" role="alert">{p.connectionError}</p>}
            <button type="button" className="button primary" disabled={(!draft.clientId && !builtin) || !desktop} onClick={() => void connect()}>Connect Linear</button>
            {!desktop && <p className="small muted">Connecting works in the installed desktop app.</p>}
          </>
        )}
        {remembered > 0 && (
          <div className="row between">
            <p className="small muted">New drafts reuse the project, assignee, labels and priority last sent to {remembered === 1 ? 'a team' : `${remembered} teams`}.</p>
            <button type="button" className="button small-button" onClick={() => setDraft({ ...draft, teamDefaults: {} })}>Forget</button>
          </div>
        )}
      </section>

      <section className="settings-section" hidden={section !== 'Templates'}><h3>Description templates</h3>
        <p className="small muted">Offered under an empty description. A template fills the description; it never replaces text you wrote.</p>
        <div className="template-list">
          {templates.map(t => (
            <details key={t.id} className="setup" open={t.id === added || undefined}>
              <summary>{t.name.trim() || 'Untitled template'}</summary>
              <div className="template-fields">
                <label className="field">
                  <span>Template name</span>
                  <input value={t.name} maxLength={TEMPLATE_LIMITS.name} autoComplete="off" onChange={e => changeTemplate(t.id, { name: e.target.value })} />
                </label>
                <label className="field">
                  <span>Template text</span>
                  <textarea rows={7} value={t.body} maxLength={TEMPLATE_LIMITS.body} spellCheck={false} onChange={e => changeTemplate(t.id, { body: e.target.value })} />
                </label>
                <button type="button" className="button danger-outline small-button" onClick={() => setTemplates(templates.filter(x => x.id !== t.id))}>Remove template</button>
              </div>
            </details>
          ))}
          {!templates.length && <p className="small muted">No templates. The description starts empty.</p>}
        </div>
        <div className="row">
          <button type="button" className="button" disabled={templates.length >= TEMPLATE_LIMITS.count} onClick={addTemplate}><Icon name="plus" size={16} /> Add template</button>
          {draft.templates && <button type="button" className="link-button" onClick={() => setDraft({ ...draft, templates: null })}>Restore built-in templates</button>}
        </div>
      </section>

      <section className="settings-section" hidden={section !== 'Capture'}><h3>Capture</h3><p className="small muted">Every capture opens the full editor. Closing saves your draft and tucks Snipflag into the tray.</p>
        <label className="field">
          <span>Global capture shortcut</span>
          <input readOnly value={recording ? 'Press the new shortcut…' : shortcutLabel(draft.shortcut)} aria-describedby="shortcut-help"
            onFocus={() => setRecording(true)} onBlur={() => setRecording(false)}
            onKeyDown={e => {
              if (e.key === 'Tab') return;
              e.preventDefault();
              if (e.key === 'Escape') { (e.target as HTMLInputElement).blur(); return; }
              const accelerator = acceleratorFromEvent(e.nativeEvent);
              if (accelerator) { setDraft({ ...draft, shortcut: accelerator }); (e.target as HTMLInputElement).blur(); }
            }} />
          <small id="shortcut-help" className="muted">Focus the field and press a combination with Ctrl, Alt, or Shift. It captures even when Snipflag is in the tray.</small>
        </label>
        {p.status?.shortcutError && <p className="warn small">{p.status.shortcutError}</p>}
        {timing && <p className="small muted">Last capture was ready in {timing.total} ms (save {timing.editor}, hide {timing.settle}, read screen {timing.grab}, show {timing.overlay}).</p>}
        <label className="check switch">
          <input type="checkbox" role="switch" checked={draft.launchAtLogin} disabled={!desktop} onChange={e => setDraft({ ...draft, launchAtLogin: e.target.checked })} />
          Start Snipflag in the tray when I sign in
        </label>
        <h3 className="subhead">Selecting an area</h3>
        <label className="check switch">
          <input type="checkbox" role="switch" checked={draft.adjustSelection} onChange={e => setDraft({ ...draft, adjustSelection: e.target.checked })} />
          Adjust the selection before capturing
        </label>
        <small className="muted">Off: releasing the drag captures at once. On: resize or move the selection, then press Enter or Capture.</small>
        <label className="check switch">
          <input type="checkbox" role="switch" checked={draft.magnifier} onChange={e => setDraft({ ...draft, magnifier: e.target.checked })} />
          Show a magnifier at the pointer
        </label>
        <small className="muted">A zoomed pixel view with the position, for exact edges.</small>
        <h3 className="subhead">Clipboard and timing</h3>
        <label className="check switch">
          <input type="checkbox" role="switch" checked={draft.copyOnCapture} onChange={e => setDraft({ ...draft, copyOnCapture: e.target.checked })} />
          Copy every capture to the clipboard
        </label>
        <small className="muted">The capture still opens in the editor; the unmarked image is also ready to paste elsewhere.</small>
        <label className="check switch">
          <input type="checkbox" role="switch" checked={draft.saveOnCapture} onChange={e => setDraft({ ...draft, saveOnCapture: e.target.checked })} />
          Save every capture to Pictures/Snipflag
        </label>
        <small className="muted">A PNG of each capture as taken, before any marks. These files stay until you delete them.</small>
        <label className="field">
          <span>Delay before the screen is frozen</span>
          <select value={draft.captureDelay} onChange={e => setDraft({ ...draft, captureDelay: Number(e.target.value) })}>
            {DELAYS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
          </select>
          <small className="muted">Time to open a menu or tooltip. Snipflag hides, waits, then shows the selection screen.</small>
        </label>
      </section>

      <section className="settings-section" hidden={section !== 'Appearance'}><h3>Appearance</h3>
        <div className="theme-options" role="radiogroup" aria-label="Theme">
          {THEMES.map(t => (
            <label key={t.value} className={draft.theme === t.value ? 'theme-option selected' : 'theme-option'}>
              <input type="radio" name="theme" value={t.value} checked={draft.theme === t.value} onChange={() => setDraft({ ...draft, theme: t.value })} />
              <span className={`theme-swatch ${t.value}`} aria-hidden="true" style={{ '--sw-bg': t.colors[0], '--sw-surface': t.colors[1], '--sw-primary': t.colors[2] } as CSSProperties}><i /><b /><b /></span>
              <span className="theme-name">{t.label}</span>
            </label>
          ))}
        </div>
        <h3 className="subhead">Sound and motion</h3>
        <div className="row between">
          <label className="check switch">
            <input type="checkbox" role="switch" checked={draft.sounds} onChange={e => setDraft({ ...draft, sounds: e.target.checked })} />
            Play sound effects
          </label>
          <button type="button" className="button small-button" onClick={() => play('success', true)}>Preview sound</button>
        </div>
        <small className="muted">A soft shutter when a capture lands, and a chime when Linear confirms the issue.</small>
        <label className="check switch">
          <input type="checkbox" role="switch" checked={draft.motion} onChange={e => setDraft({ ...draft, motion: e.target.checked })} />
          Interface animations
        </label>
        <small className="muted">Your system's reduce-motion setting is always respected.</small>
      </section>

      <section className="settings-section" hidden={section !== 'Privacy'}><h3>Privacy</h3><div className="privacy-card"><strong>Only shared when you choose Create issue.</strong><p className="small muted">Use Pixelate (B) to hide private details before sending. Pixelated areas are burned into the uploaded image.</p></div>
        <p className="small muted">Drafts and their screenshots are stored only on this computer, unencrypted in the app data folder. Old sessions are removed whether they were sent or not.</p>
        <label className="field">
          <span>Delete sessions not opened for</span>
          <select value={draft.retentionDays} onChange={e => setDraft({ ...draft, retentionDays: Number(e.target.value) })}>
            {RETENTION.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </label>
        {confirmClear ? (
          <div className="row">
            <span className="small">Delete every local draft and screenshot?</span>
            <button type="button" className="button danger" onClick={() => { setSaved(''); setError(''); void p.onClearHistory().then(() => { setConfirmClear(false); setSaved('Local history deleted.'); }).catch(e => setError(errorText(e))); }}>Delete all</button>
            <button type="button" className="button" onClick={() => setConfirmClear(false)}>Keep</button>
          </div>
        ) : <button type="button" className="button danger-outline" onClick={() => setConfirmClear(true)}>Delete local history…</button>}
      </section>
      <section className="settings-section" hidden={section !== 'Shortcuts'}>
        <h3>Keyboard shortcuts</h3>
        <dl className="shortcut-list">
          {[['Capture from anywhere', shortcutLabel(draft.shortcut)], ['Select / Arrow / Line', 'V / A / L'], ['Rectangle / Ellipse', 'R / E'], ['Pen / Highlighter / Text', 'P / H / T'], ['Numbered step / Pixelate / Crop', 'N / B / C'], ['Move selected mark', 'Arrow keys (Shift: 10 px)'], ['Duplicate selected mark', 'Ctrl / ⌘ + D'], ['Pan the canvas', 'Hold Space and drag, or middle mouse'], ['Copy image / Copy for AI', 'Ctrl / ⌘ + C / Shift + C'], ['Snap arrow / pen to 15°', 'Hold Shift'], ['Square or circle', 'Shift + Rectangle / Ellipse'], ['Undo / Redo', 'Ctrl / ⌘ + Z / Shift + Z'], ['Delete selected mark', 'Delete'], ['Paste screenshot', 'Ctrl / ⌘ + V'], ['Create issue', 'Ctrl / ⌘ + Enter'], ['Zoom canvas', 'Ctrl / ⌘ + scroll']].map(([label, keys]) => <div key={label}><dt>{label}</dt><dd><kbd>{keys}</kbd></dd></div>)}
        </dl>
        <p className="small muted">Tool shortcuts pause while you type. Each screenshot keeps its own undo history.</p>
      </section>
      <section className="settings-section" hidden={section !== 'About'}>
        <div className="about-hero">
          <span className="about-mark" aria-hidden="true"><Mark size={30} /></span>
          <div>
            <h3>Snipflag</h3>
            <p className="small muted">Version {p.status?.version ?? ''} · {p.status?.platform ?? ''}</p>
          </div>
        </div>
        <p className="small">Screenshots to clear Linear issues. Capture, mark up and send several screenshots as one issue.</p>
        <h3 className="subhead">Updates</h3>
        {p.status?.updates ? (
          <>
            <label className="check switch">
              <input type="checkbox" role="switch" checked={draft.autoUpdate} onChange={e => setDraft({ ...draft, autoUpdate: e.target.checked })} />
              Check for updates automatically
            </label>
            <small className="muted">Snipflag asks GitHub for the latest release. Updates are signature-checked and install only when you choose, after your draft is saved.</small>
            <div className="row">
              {updateState.found
                ? <button type="button" className="button primary" onClick={p.onInstallUpdate}>Install {updateState.found.version} and restart</button>
                : <button type="button" className="button" disabled={updateState.checking} onClick={() => {
                    setUpdateState({ checking: true });
                    p.onCheckUpdate().then(found => setUpdateState({ found })).catch(e => setUpdateState({ error: errorText(e) }));
                  }}>{updateState.checking ? 'Checking…' : 'Check for updates'}</button>}
              <span className="small muted" role="status">{updateState.found === null ? 'Snipflag is up to date.' : ''}</span>
            </div>
            {updateState.error && <p className="error small" role="alert">{updateState.error}</p>}
          </>
        ) : <p className="small muted">{desktop ? 'This build does not include automatic updates. Download new versions from the releases page.' : 'Updates are available in the installed desktop app.'}</p>}
        <div className="creator">
          <p className="small muted">Designed and built by <strong>Saqlain Razee</strong></p>
          <div className="creator-links">
            {CREATOR.map(link => (
              <button key={link.target} type="button" className="creator-link" onClick={() => openAboutLink(link.target).catch(e => setError(errorText(e)))}>
                <Icon name={link.icon} size={18} /><span><strong>{link.label}</strong><small>{link.detail}</small></span><Icon name="external" size={14} />
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <button type="button" className="link-button" onClick={() => openAboutLink('repository').catch(e => setError(errorText(e)))}>Source code</button>
          <span className="muted small">·</span>
          <button type="button" className="link-button" onClick={() => openAboutLink('license').catch(e => setError(errorText(e)))}>MIT License</button>
        </div>
      </section>
    </Dialog>
  );
}
