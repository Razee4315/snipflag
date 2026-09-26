import { useState, type CSSProperties } from 'react';
import { acceleratorFromEvent, REDIRECT_URI, shortcutLabel, type Connection, type Settings } from '../model';
import { clearHistory, copyText, desktop, errorText, openLinearSetup, type AppStatus } from '../native';
import Dialog from './Dialog';
import { Logo } from './icons';
import { play } from '../sound';
import type { ConnectionState } from './IssuePanel';

interface Props {
  settings: Settings; status: AppStatus | null; connection: Connection | null; connectionState: ConnectionState; connectionError: string;
  onSave: (settings: Settings) => Promise<void>; onConnect: () => void; onCancelConnect: () => void; onDisconnect: () => Promise<void>;
  onHistoryCleared: () => void; onClose: () => void;
}
const SECTIONS = ['Connection', 'Capture', 'Appearance', 'Privacy', 'Shortcuts'] as const;
const RETENTION = [{ v: 7, l: '7 days' }, { v: 30, l: '30 days' }, { v: 90, l: '90 days' }, { v: 365, l: '1 year' }, { v: 0, l: 'Keep until I delete' }];

export default function SettingsDialog(p: Props) {
  const [section, setSection] = useState<typeof SECTIONS[number]>('Connection');
  const [draft, setDraft] = useState<Settings>(p.settings);
  const [error, setError] = useState(''); const [saved, setSaved] = useState('');
  const [recording, setRecording] = useState(false); const [confirmClear, setConfirmClear] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(p.settings);
  const save = async (next = draft) => {
    setError(''); setSaved('');
    try { await p.onSave(next); setSaved('Settings saved.'); return true; } catch (e) { setError(errorText(e)); return false; }
  };
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
            <button type="button" className="button" onClick={() => p.onDisconnect().catch(e => setError(errorText(e)))}>Disconnect</button>
          </div>
        ) : p.connectionState === 'connecting' ? (
          <div className="row between"><p className="small">Waiting for you to approve access in the browser…</p><button type="button" className="button" onClick={p.onCancelConnect}>Cancel</button></div>
        ) : (
          <>
            <details className="setup" open={!draft.clientId}>
              <summary>How to set up the Linear connection</summary>
              <ol className="small">
                <li>In Linear, open Settings → API → OAuth applications and create a new application.</li>
                <li>Add this callback URL: <code>{REDIRECT_URI}</code> <button type="button" className="link-button" onClick={() => copyText(REDIRECT_URI).then(() => setSaved('Callback URL copied.')).catch(e => setError(errorText(e)))}>Copy</button></li>
                <li>Copy the application's <strong>Client ID</strong> (not the secret) into the field below, then choose Connect Linear.</li>
              </ol>
              {desktop && <button type="button" className="button" onClick={() => openLinearSetup().catch(e => setError(errorText(e)))}>Open Linear OAuth settings</button>}
            </details>
            <label className="field">
              <span>Linear OAuth client ID</span>
              <input value={draft.clientId} spellCheck={false} autoComplete="off" placeholder="Paste the public client ID" onChange={e => setDraft({ ...draft, clientId: e.target.value.trim() })} />
              <small className="muted">Snipflag uses PKCE and never needs a client secret. Tokens are kept in your system credential store.</small>
            </label>
            {p.connectionError && <p className="error small" role="alert">{p.connectionError}</p>}
            <button type="button" className="button primary" disabled={!draft.clientId || !desktop} onClick={() => void connect()}>Connect Linear</button>
            {!desktop && <p className="small muted">Connecting works in the installed desktop app.</p>}
          </>
        )}
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
        <label className="check switch">
          <input type="checkbox" role="switch" checked={draft.launchAtLogin} disabled={!desktop} onChange={e => setDraft({ ...draft, launchAtLogin: e.target.checked })} />
          Start Snipflag in the tray when I sign in
        </label>
      </section>

      <section className="settings-section" hidden={section !== 'Appearance'}><h3>Appearance</h3><div className="theme-preview" aria-hidden="true"><div className="theme-sample light-sample"><i /><span>Daylight</span></div><div className="theme-sample dark-sample"><i /><span>After hours</span></div></div>
        <label className="field">
          <span>Theme</span>
          <select value={draft.theme} onChange={e => setDraft({ ...draft, theme: e.target.value as Settings['theme'] })}>
            <option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
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

      <section className="settings-section" hidden={section !== 'Privacy'}><h3>Privacy</h3><div className="privacy-card"><strong>Only shared when you choose Create issue.</strong><p className="small muted">Use solid redaction to remove private details before sending. Pixelation is cosmetic.</p></div>
        <p className="small muted">Drafts and their screenshots are stored only on this computer, unencrypted in the app data folder.</p>
        <label className="field">
          <span>Delete drafts not opened for</span>
          <select value={draft.retentionDays} onChange={e => setDraft({ ...draft, retentionDays: Number(e.target.value) })}>
            {RETENTION.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </label>
        {confirmClear ? (
          <div className="row">
            <span className="small">Delete every local draft and screenshot?</span>
            <button type="button" className="button danger" onClick={() => clearHistory().then(() => { setConfirmClear(false); p.onHistoryCleared(); setSaved('Local history deleted.'); }).catch(e => setError(errorText(e)))}>Delete all</button>
            <button type="button" className="button" onClick={() => setConfirmClear(false)}>Keep</button>
          </div>
        ) : <button type="button" className="button danger-outline" onClick={() => setConfirmClear(true)}>Delete local history…</button>}
      </section>
      <section className="settings-section" hidden={section !== 'Shortcuts'}>
        <h3>Keyboard shortcuts</h3>
        <dl className="shortcut-list">
          {[['Capture from anywhere', shortcutLabel(draft.shortcut)], ['Select / Arrow / Rectangle', 'V / A / R'], ['Pen / Text', 'P / T'], ['Snap arrow / pen to 15°', 'Hold Shift'], ['Draw a square', 'Shift + Rectangle'], ['Pixelate / Solid redaction', 'B / X'], ['Undo / Redo', 'Ctrl / ⌘ + Z / Shift + Z'], ['Delete selected mark', 'Delete'], ['Paste screenshot', 'Ctrl / ⌘ + V'], ['Create issue', 'Ctrl / ⌘ + Enter'], ['Zoom canvas', 'Ctrl / ⌘ + scroll']].map(([label, keys]) => <div key={label}><dt>{label}</dt><dd><kbd>{keys}</kbd></dd></div>)}
        </dl>
        <p className="small muted">Tool shortcuts pause while you type. Each screenshot keeps its own undo history.</p>
      </section>
      <p className="about small muted"><Logo size={18} /> Snipflag {p.status?.version ?? ''} · {p.status?.platform ?? ''} · development build</p>
    </Dialog>
  );
}
