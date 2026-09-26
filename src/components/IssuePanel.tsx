import { useEffect, useState } from 'react';
import { LIMITS, PRIORITIES, type Connection, type TeamOptions } from '../model';
import { copyText, desktop, errorText, openIssue, teamOptions } from '../native';
import { isLocked, useStore } from '../store';
import { Icon } from './icons';

export type ConnectionState = 'idle' | 'loading' | 'connecting' | 'error';
interface Props {
  connection: Connection | null; connectionState: ConnectionState; connectionError: string; hasClientId: boolean;
  progress: string; submitError: string; pendingState: string | null;
  onConnect: () => void; onCancelConnect: () => void; onRetryConnection: () => void; onOpenSettings: () => void;
  onSubmit: () => void; onNewSession: () => void; onTeamChosen: (teamId: string) => void; notify: (text: string) => void;
}

export default function IssuePanel(p: Props) {
  const session = useStore(s => s.session); const busy = useStore(s => s.busy); const locked = useStore(isLocked);
  const { patch } = useStore.getState();
  const [options, setOptions] = useState<TeamOptions | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const teamId = session.teamId; const connected = !!p.connection;

  useEffect(() => {
    setOptions(null); setOptionsError('');
    if (!connected || !teamId) return;
    let live = true;
    teamOptions(teamId).then(o => {
      if (!live) return; setOptions(o);
      // Drop selections that do not exist in this team anymore.
      const s = useStore.getState().session; if (s.issue) return;
      const fix: Partial<typeof s> = {};
      if (s.projectId && !o.projects.some(x => x.id === s.projectId)) fix.projectId = '';
      if (s.assigneeId && !o.members.some(x => x.id === s.assigneeId)) fix.assigneeId = '';
      const labels = s.labelIds.filter(id => o.labels.some(x => x.id === id));
      if (labels.length !== s.labelIds.length) fix.labelIds = labels;
      if (Object.keys(fix).length) useStore.getState().patch(fix);
    }).catch(e => { if (live) setOptionsError(errorText(e)); });
    return () => { live = false; };
  }, [teamId, connected]);

  if (session.issue) {
    const issue = session.issue;
    return (
      <aside className="panel" aria-label="Linear issue">
        <div className="sent" role="status">
          <span className="sent-badge"><Icon name="check" /> Sent to Linear</span>
          <p className="sent-id">{issue.identifier}</p>
          <p className="muted">{session.title}</p>
          <p className="muted">{session.images.length} {session.images.length === 1 ? 'screenshot' : 'screenshots'} attached in order.</p>
          <div className="stack">
            <button type="button" className="button primary" onClick={() => openIssue(issue.url).catch(e => p.notify(errorText(e)))}><Icon name="external" /> Open issue</button>
            <button type="button" className="button" onClick={() => copyText(issue.url).then(() => p.notify('Link copied.')).catch(e => p.notify(errorText(e)))}><Icon name="link" /> Copy link</button>
            <button type="button" className="button" onClick={p.onNewSession}><Icon name="plus" /> New session</button>
          </div>
        </div>
      </aside>
    );
  }

  const count = session.images.length;
  const setTeam = (id: string) => { patch({ teamId: id, projectId: '', assigneeId: '', labelIds: [] }); if (id) p.onTeamChosen(id); };
  const labels = options?.labels.filter(l => l.name.toLowerCase().includes(labelFilter.toLowerCase())) ?? [];
  return (
    <aside className="panel" aria-label="Linear issue">
      <div className="composer-heading"><span className="eyebrow">THE REPORT</span><h2>A little context.<br />A clear next step.</h2></div>
      <section className="connection" aria-live="polite">
        {!desktop ? (
          <p className="muted small">Browser preview. Connecting to Linear and creating issues work in the installed desktop app.</p>
        ) : p.connectionState === 'connecting' ? (
          <div className="row"><span className="spinner" aria-hidden="true" /> <span className="small">Finish signing in to Linear in your browser…</span>
            <button type="button" className="link-button" onClick={p.onCancelConnect}>Cancel</button></div>
        ) : p.connectionState === 'loading' && !p.connection ? (
          <div className="row"><span className="spinner" aria-hidden="true" /> <span className="small">Checking Linear connection…</span></div>
        ) : p.connection ? (
          <div className="row"><span className="dot ok" aria-hidden="true" /><span className="small"><strong>{p.connection.workspace}</strong> · {p.connection.name}</span>
            <button type="button" className="link-button" onClick={p.onRetryConnection} aria-label="Refresh Linear teams">Refresh</button></div>
        ) : !p.hasClientId ? (
          <div className="stack-tight"><p className="small">Connect Linear to send this issue. Add your Linear OAuth client ID first.</p>
            <button type="button" className="button" onClick={p.onOpenSettings}>Set up Linear</button></div>
        ) : (
          <div className="stack-tight">
            {p.connectionError && <p className="error small" role="alert">{p.connectionError}</p>}
            <p className="small">Your screenshots stay on this computer until you choose Create issue.</p>
            <button type="button" className="button" onClick={p.onConnect}>Connect Linear</button>
          </div>
        )}
      </section>

      <form className="issue-form" onSubmit={e => { e.preventDefault(); p.onSubmit(); }}>
        <label className="field">
          <span>Title</span>
          <input value={session.title} maxLength={LIMITS.title} disabled={locked} placeholder="What needs fixing?" onChange={e => patch({ title: e.target.value })} />
        </label>
        <label className="field grow">
          <span>Description</span>
          <textarea value={session.description} disabled={locked} rows={4} placeholder="What happened? What should happen instead?" onChange={e => patch({ description: e.target.value })} />
        </label>
        {!session.description && <button type="button" className="template-button" disabled={locked} onClick={() => patch({ description: '## Steps to reproduce\n1. \n\n## Expected result\n\n## Actual result\n\n## Environment\n' })}><Icon name="plus" size={14} /> Add reproduction steps</button>}
        <label className="field">
          <span>Team</span>
          <select value={teamId} disabled={locked || !connected} onChange={e => setTeam(e.target.value)}>
            <option value="">{connected ? 'Choose a team' : 'Connect Linear to choose'}</option>
            {p.connection?.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            {teamId && connected && !p.connection?.teams.some(t => t.id === teamId) && <option value={teamId}>Unavailable team</option>}
          </select>
        </label>
        {connected && p.connection?.teams.length === 0 && <p className="error small">This Linear account has no teams you can post to.</p>}
        <details className="more" open={!!(session.projectId || session.assigneeId || session.labelIds.length || session.priority)}>
          <summary>Issue details <span className="muted">· priority, project & more</span></summary>
          {optionsError && <p className="error small" role="alert">{optionsError}</p>}
          <label className="field">
            <span>Priority</span>
            <select value={session.priority} disabled={locked} onChange={e => patch({ priority: Number(e.target.value) })}>
              {PRIORITIES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Project</span>
            <select value={session.projectId} disabled={locked || !options} onChange={e => patch({ projectId: e.target.value })}>
              <option value="">No project</option>
              {options?.projects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Assignee</span>
            <select value={session.assigneeId} disabled={locked || !options} onChange={e => patch({ assigneeId: e.target.value })}>
              <option value="">Unassigned</option>
              {options?.members.map(x => <option key={x.id} value={x.id}>{x.displayName || x.name}</option>)}
            </select>
          </label>
          <fieldset className="field labels" disabled={locked || !options}>
            <legend>Labels{session.labelIds.length ? ` (${session.labelIds.length})` : ''}</legend>
            {(options?.labels.length ?? 0) > 8 && <input className="filter" placeholder="Filter labels" aria-label="Filter labels" value={labelFilter} onChange={e => setLabelFilter(e.target.value)} />}
            <div className="label-list">
              {labels.map(l => (
                <label key={l.id} className="check">
                  <input type="checkbox" checked={session.labelIds.includes(l.id)}
                    onChange={e => patch({ labelIds: e.target.checked ? [...session.labelIds, l.id] : session.labelIds.filter(x => x !== l.id) })} />
                  <span className="label-dot" style={{ background: l.color || 'var(--muted)' }} aria-hidden="true" />{l.name}
                </label>
              ))}
              {options && !options.labels.length && <span className="muted small">No labels in this team.</span>}
              {!options && <span className="muted small">{teamId ? 'Loading…' : 'Choose a team first.'}</span>}
            </div>
          </fieldset>
        </details>

        <div className="submit-area">
          <p className="small muted">{count ? `${count} ${count === 1 ? 'screenshot' : 'screenshots'} will be attached in filmstrip order.` : 'Add at least one screenshot.'}</p>
          {p.pendingState === 'creating' && !busy && <p className="small warn">A previous attempt may already have created this issue. Create issue checks Linear before sending anything new.</p>}
          {p.submitError && <p className="error small" role="alert">{p.submitError}</p>}
          <div role="status" aria-live="polite" className="small">{busy && p.progress && <><span className="spinner" aria-hidden="true" /> {p.progress}</>}</div>
          <button type="submit" className="button primary wide" disabled={busy} aria-keyshortcuts="Control+Enter">
            {busy ? 'Sending…' : p.pendingState ? 'Retry create issue' : 'Create issue'}<Icon name="right" size={16} />
          </button>
          <span className="privacy-note">Local until you send · Ctrl / ⌘ + Enter</span>
        </div>
      </form>
    </aside>
  );
}
