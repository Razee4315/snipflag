import { useState } from 'react';
import { acceleratorFromEvent, REDIRECT_URI, shortcutLabel, type Connection, type Settings } from '../model';
import { clearHistory, copyText, desktop, errorText, openLinearSetup, type AppStatus } from '../native';
import Dialog from './Dialog';
import type { ConnectionState } from './IssuePanel';

interface Props {
  settings: Settings; status: AppStatus | null; connection: Connection | null; connectionState: ConnectionState; connectionError: string;
  onSave: (settings: Settings) => Promise<void>; onConnect: () => void; onCancelConnect: () => void; onDisconnect: () => Promise<void>;
  onHistoryCleared: () => void; onClose: () => void;
}
const RETENTION = [{ v: 7, l: '7 days' }, { v: 30, l: '30 days' }, { v: 90, l: '90 days' }, { v: 365, l: '1 year' }, { v: 0, l: 'Keep until I delete' }];

export default function SettingsDialog(p: Props) {
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
      {error && <p className="error" role="alert">{error}</p>}
      <section className="settings-section">
        <h3>Linear</h3>
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

      <section className="settings-section">
        <h3>Capture</h3>
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
        <label className="check">
          <input type="checkbox" checked={draft.launchAtLogin} disabled={!desktop} onChange={e => setDraft({ ...draft, launchAtLogin: e.target.checked })} />
          Start Snipflag in the tray when I sign in
        </label>
      </section>

      <section className="settings-section">
        <h3>Appearance</h3>
        <label className="field">
          <span>Theme</span>
          <select value={draft.theme} onChange={e => setDraft({ ...draft, theme: e.target.value as Settings['theme'] })}>
            <option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
      </section>

      <section className="settings-section">
        <h3>Local history</h3>
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
      <p className="small muted">Snipflag {p.status?.version ?? ''} · {p.status?.platform ?? ''} · development build</p>
    </Dialog>
  );
}
