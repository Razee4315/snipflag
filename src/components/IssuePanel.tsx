import { useEffect, useState, type CSSProperties } from 'react';
import { LIMITS, PRIORITIES, type Connection, type TeamOptions } from '../model';
import { copyText, desktop, errorText, openIssue, teamOptions } from '../native';
import { isLocked, useStore } from '../store';
import { Icon } from './icons';
import DescriptionEditor from './DescriptionEditor';

export type ConnectionState = 'idle' | 'loading' | 'connecting' | 'error';
interface Props {
  connection: Connection | null; connectionState: ConnectionState; connectionError: string; hasClientId: boolean;
  progress: string; submitError: string; pendingState: string | null;
  onConnect: () => void; onCancelConnect: () => void; onRetryConnection: () => void; onOpenSettings: () => void;
  onSubmit: () => void; onNewSession: () => void; onTeamChosen: (teamId: string) => void; notify: (text: string) => void;
}
const TEMPLATE = '## Steps to reproduce\n1. \n\n## Expected result\n\n## Actual result\n\n## Environment\n';

export default function IssuePanel(p: Props) {
  const session = useStore(s => s.session); const busy = useStore(s => s.busy); const locked = useStore(isLocked);
  const submissionLocked = useStore(s => s.submissionLocked);
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
        <div className="panel-scroll">
          <div className="sent" role="status">
            <div className="sent-mark" aria-hidden="true">
              <span className="burst">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</span>
              <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" /><path d="M15 27l7 7 15-16" /></svg>
            </div>
            <span className="sent-badge">Sent to Linear</span>
            <p className="sent-id">{issue.identifier}</p>
            {session.title && <p className="sent-title">{session.title}</p>}
            <p className="muted small">{session.images.length} {session.images.length === 1 ? 'screenshot' : 'screenshots'} attached in order.</p>
            <div className="stack">
              <button type="button" className="button primary" onClick={() => openIssue(issue.url).catch(e => p.notify(errorText(e)))}><Icon name="external" size={16} /> Open issue</button>
              <button type="button" className="button" onClick={() => copyText(issue.url).then(() => p.notify('Link copied.')).catch(e => p.notify(errorText(e)))}><Icon name="link" size={16} /> Copy link</button>
            </div>
          </div>
        </div>
        <footer className="panel-foot">
          <button type="button" className="button wide" onClick={p.onNewSession}><Icon name="plus" size={16} /> New session</button>
        </footer>
      </aside>
    );
  }

  const count = session.images.length;
  const setTeam = (id: string) => { patch({ teamId: id, projectId: '', assigneeId: '', labelIds: [] }); if (id) p.onTeamChosen(id); };
  const labels = options?.labels.filter(l => l.name.toLowerCase().includes(labelFilter.toLowerCase())) ?? [];
  const refreshing = p.connectionState === 'loading';
  return (
    <aside className="panel" aria-label="Linear issue">
      <div className="panel-scroll">
        <section className="connection" aria-live="polite">
          {!desktop ? (
            <div className="workspace-chip preview">
              <span className="ws-text"><strong>Browser preview</strong><small>Linear works in the desktop app</small></span>
            </div>
          ) : p.connectionState === 'connecting' ? (
            <div className="workspace-chip"><span className="spinner" aria-hidden="true" /><span className="ws-text"><strong>Waiting for Linear…</strong><small>Finish signing in in your browser</small></span>
              <button type="button" className="link-button" onClick={p.onCancelConnect}>Cancel</button></div>
          ) : refreshing && !p.connection ? (
            <div className="workspace-chip"><span className="spinner" aria-hidden="true" /><span className="ws-text"><strong>Checking Linear…</strong></span></div>
          ) : p.connection ? (
            <div className="workspace-chip">
              <span className="ws-text"><strong>{p.connection.workspace}</strong><small>{p.connection.name}</small></span>
              <button type="button" className={refreshing ? 'icon-button spinning' : 'icon-button'} onClick={p.onRetryConnection} aria-label="Refresh Linear teams" title="Refresh teams"><Icon name="refresh" size={16} /></button>
            </div>
          ) : (
            <div className="connect-card">
              {p.connectionError && <p className="error small" role="alert">{p.connectionError}</p>}
              <p className="small muted">Connect your Linear workspace to send issues.</p>
              {!p.hasClientId
                ? <button type="button" className="button" onClick={p.onOpenSettings}>Set up Linear</button>
                : <button type="button" className="button" onClick={p.onConnect}>Connect Linear</button>}
            </div>
          )}
        </section>

        <form id="issue-form" className="issue-form" onSubmit={e => { e.preventDefault(); p.onSubmit(); }}>
          <label className="field">
            <span>Title</span>
            <input value={session.title} maxLength={LIMITS.title} disabled={locked} autoComplete="off" placeholder="What needs fixing?" onChange={e => patch({ title: e.target.value })} />
          </label>
          <DescriptionEditor key={session.id} value={session.description} images={session.images} references={session.imageReferences ?? {}} disabled={locked} onChange={description => patch({ description })} />
          {!session.description && <button type="button" className="template-button" disabled={locked} onClick={() => patch({ description: TEMPLATE })}><Icon name="plus" size={14} /> Add reproduction steps</button>}
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
            <summary><Icon name="right" size={14} /> Issue details</summary>
            <div className="more-body">
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
                {(options?.labels.length ?? 0) > 8 && <input className="filter" autoComplete="off" placeholder="Filter labels" aria-label="Filter labels" value={labelFilter} onChange={e => setLabelFilter(e.target.value)} />}
                <div className="label-list">
                  {labels.map(l => (
                    <label key={l.id} className="check label-row">
                      <input type="checkbox" checked={session.labelIds.includes(l.id)}
                        onChange={e => patch({ labelIds: e.target.checked ? [...session.labelIds, l.id] : session.labelIds.filter(x => x !== l.id) })} />
                      <span className="label-dot" style={{ background: l.color || 'var(--muted)' }} aria-hidden="true" />{l.name}
                    </label>
                  ))}
                  {options && !options.labels.length && <span className="muted small">No labels in this team.</span>}
                  {!options && <span className="muted small">{teamId ? 'Loading…' : 'Choose a team first.'}</span>}
                </div>
              </fieldset>
            </div>
          </details>
        </form>
      </div>

      <footer className="panel-foot">
        {submissionLocked && !busy && <p className="small warn">A previous attempt may already have created this issue. This report is locked to the attempted revision. Check its outcome before editing; checking does not upload or create another issue.</p>}
        {p.submitError && <p className="error small" role="alert">{p.submitError}</p>}
        {busy && p.progress && <div role="status" aria-live="polite" className="small progress"><span className="spinner" aria-hidden="true" /> {p.progress}</div>}
        <div className="foot-actions">
          <button type="button" className="button" onClick={p.onNewSession} disabled={busy}><Icon name="plus" size={16} /> New session</button>
          <button type="submit" form="issue-form" className={busy ? 'button primary busy' : 'button primary'} disabled={busy || !count} aria-keyshortcuts="Control+Enter">
            {busy ? 'Working…' : submissionLocked ? 'Check previous attempt' : p.pendingState && p.pendingState !== 'retryable' ? 'Retry create issue' : 'Create issue'}<Icon name="right" size={16} />
          </button>
        </div>
      </footer>
    </aside>
  );
}
