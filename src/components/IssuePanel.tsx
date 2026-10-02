import { lazy, Suspense, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { FIELD_ERRORS, LIMITS, PRIORITIES, type Connection, type Named, type TeamDefaults, type TeamOptions, type Template } from '../model';
import { detailsToFill } from '../templates';
import { copyText, desktop, errorText, openIssue, teamOptions } from '../native';
import { stepNotesText } from '../share';
import { isLocked, useStore } from '../store';
import { Icon } from './icons';
import DescriptionEditor from './DescriptionEditor';
import LabelPicker from './LabelPicker';
import type { PreparedReport } from './ReportPreview';

// The preview and its Markdown reader are loaded when the preview is first opened.
const ReportPreview = lazy(() => import('./ReportPreview'));

/** `unreachable`: a saved connection exists but Linear (or the credential store) could not be reached. */
export type ConnectionState = 'idle' | 'loading' | 'connecting' | 'error' | 'unreachable';
interface Props {
  /** Tucked away for quick sharing; the form keeps its state. */
  hidden?: boolean;
  connection: Connection | null; connectionState: ConnectionState; connectionError: string; hasClientId: boolean;
  progress: string; progressFraction: number | null; submitError: string; pendingState: string | null;
  templates: Template[]; teamMemory: Record<string, string>; teamDefaults: Record<string, TeamDefaults>;
  onConnect: () => void; onCancelConnect: () => void; onRetryConnection: () => void; onOpenSettings: () => void;
  onSubmit: (report?: PreparedReport) => void; onNewSession: () => void; onTeamChosen: (teamId: string) => void; notify: (text: string, kind?: 'error' | 'info') => void;
}
/** A select with a filter for long Linear lists. The chosen item always stays listed. */
function Picker({ label, value, disabled, items, none, missing, error, onChange }: { label: string; value: string; disabled: boolean; items: { id: string; label: string }[]; none: string; missing: string; error?: string; onChange: (id: string) => void }) {
  const id = useId(); const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = items.filter(x => x.id === value || x.label.toLowerCase().includes(q));
  return (
    <div className="field picker">
      <label htmlFor={id} className="picker-label">{label}</label>
      {items.length > 8 && <input className="filter" autoComplete="off" placeholder={`Search ${items.length}`} aria-label={`Search ${label.toLowerCase()}`} value={query} disabled={disabled} onChange={e => setQuery(e.target.value)} />}
      <select id={id} value={value} disabled={disabled} aria-invalid={error ? true : undefined} onChange={e => onChange(e.target.value)}>
        <option value="">{none}</option>
        {shown.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
        {value && !items.some(x => x.id === value) && <option value={value}>{missing}</option>}
      </select>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
const named = (list: Named[] | undefined) => list?.map(x => ({ id: x.id, label: x.displayName || x.name })) ?? [];

export default function IssuePanel(p: Props) {
  const session = useStore(s => s.session); const busy = useStore(s => s.busy); const locked = useStore(isLocked);
  const submissionLocked = useStore(s => s.submissionLocked);
  const { patch } = useStore.getState();
  const [options, setOptions] = useState<TeamOptions | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [attempt, setAttempt] = useState(0); const [filledFor, setFilledFor] = useState('');
  const teamId = session.teamId; const connected = !!p.connection;
  const teamDefaults = useRef(p.teamDefaults); teamDefaults.current = p.teamDefaults;
  // Issue details open by themselves when a draft has some, and only the user closes them.
  const hasDetails = !!(session.projectId || session.assigneeId || session.labelIds.length || session.priority);
  const [detailsOpen, setDetailsOpen] = useState(hasDetails);
  const detailsFor = useRef(session.id);
  useEffect(() => {
    if (detailsFor.current !== session.id) { detailsFor.current = session.id; setDetailsOpen(hasDetails); }
    else if (hasDetails) setDetailsOpen(true);
  }, [session.id, hasDetails]);

  // Drafts without a team start with the one last chosen in this workspace, once per draft.
  const autoTeam = useRef(new Set<string>());
  useEffect(() => {
    const c = p.connection;
    if (!c || session.issue || teamId || locked || autoTeam.current.has(session.id)) return;
    autoTeam.current.add(session.id);
    const team = c.teams.find(t => t.id === p.teamMemory[c.workspaceId]) ?? (c.teams.length === 1 ? c.teams[0] : undefined);
    if (team) patch({ teamId: team.id });
  }, [p.connection, p.teamMemory, session.id, session.issue, teamId, locked, patch]);
  // Remembered details apply only when a draft's team changes, never to a restored draft.
  const pendingDetails = useRef<{ sessionId: string; teamId: string } | null>(null);
  const previous = useRef({ sessionId: session.id, teamId });
  useEffect(() => {
    const before = previous.current; previous.current = { sessionId: session.id, teamId };
    if (before.sessionId !== session.id || before.teamId === teamId) return;
    pendingDetails.current = teamId ? { sessionId: session.id, teamId } : null; setFilledFor('');
  }, [session.id, teamId]);

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
      const pending = pendingDetails.current;
      const due = pending?.sessionId === s.id && pending.teamId === teamId;
      if (due) pendingDetails.current = null;
      const fill = due ? detailsToFill({ ...s, ...fix }, teamDefaults.current[teamId], o) : null;
      if (Object.keys(fix).length || fill) useStore.getState().patch({ ...fix, ...fill });
      if (fill) setFilledFor(s.id);
    }).catch(e => { if (live) setOptionsError(errorText(e)); });
    return () => { live = false; };
  }, [teamId, connected, attempt]);

  if (session.issue) {
    const issue = session.issue;
    return (
      <aside className="panel" aria-label="Linear issue" hidden={p.hidden}>
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
              <button type="button" className="button primary" onClick={() => openIssue(issue.url).catch(e => p.notify(errorText(e), 'error'))}><Icon name="external" size={16} /> Open issue</button>
              <button type="button" className="button" onClick={() => copyText(issue.url).then(() => p.notify('Link copied.')).catch(e => p.notify(errorText(e), 'error'))}><Icon name="link" size={16} /> Copy link</button>
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
  // Errors that name one field appear beside it; everything else stays above the buttons.
  const titleError = p.submitError === FIELD_ERRORS.title && !session.title.trim() ? p.submitError : '';
  const teamError = p.submitError === FIELD_ERRORS.team && !teamId ? p.submitError : '';
  const footError = p.submitError === FIELD_ERRORS.title || p.submitError === FIELD_ERRORS.team ? '' : p.submitError;
  const refreshing = p.connectionState === 'loading';
  const notes = stepNotesText(session.images);
  return (
    <aside className="panel" aria-label="Linear issue" hidden={p.hidden}>
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
          ) : p.connectionState === 'unreachable' ? (
            <div className="connect-card">
              <p className="error small" role="alert">{p.connectionError}</p>
              <p className="small muted">You are still signed in. Your draft is saved; retry when you are back online.</p>
              <div className="row">
                <button type="button" className="button" onClick={p.onRetryConnection}><Icon name="refresh" size={16} /> Retry</button>
                {p.hasClientId && <button type="button" className="link-button" onClick={p.onConnect}>Sign in again</button>}
              </div>
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
            <input value={session.title} maxLength={LIMITS.title} disabled={locked} autoComplete="off" placeholder="What needs fixing?" aria-invalid={titleError ? true : undefined} onChange={e => patch({ title: e.target.value })} />
            {titleError && <small className="error" role="alert">{titleError}</small>}
          </label>
          <DescriptionEditor key={session.id} value={session.description} images={session.images} references={session.imageReferences ?? {}} disabled={locked} onChange={description => patch({ description })} />
          {!session.description && p.templates.length > 0 && (
            <div className="templates" role="group" aria-label="Start from a template">
              {p.templates.map(t => <button key={t.id} type="button" className="template-button" disabled={locked} onClick={() => patch({ description: t.body })}><Icon name="plus" size={14} /> {t.name}</button>)}
            </div>
          )}
          {notes && !session.description.includes(notes) && (
            <button type="button" className="template-button" disabled={locked} onClick={() => patch({ description: session.description.trim() ? `${session.description.trimEnd()}\n\n${notes}\n` : `${notes}\n` })}><Icon name="note" size={14} /> Add step notes</button>
          )}
          <Picker label="Team" value={teamId} disabled={locked || !connected} items={named(p.connection?.teams)} none={connected ? 'Choose a team' : 'Connect Linear to choose'} missing={connected ? 'Unavailable team' : 'Saved team'} error={teamError} onChange={setTeam} />
          {connected && p.connection?.teams.length === 0 && <p className="error small">This Linear account has no teams you can post to.</p>}
          <details className="more" open={detailsOpen} onToggle={e => setDetailsOpen(e.currentTarget.open)}>
            <summary><Icon name="right" size={14} /> Issue details</summary>
            <div className="more-body">
              {optionsError && <div className="row between"><p className="error small" role="alert">{optionsError}</p><button type="button" className="button small-button" onClick={() => setAttempt(n => n + 1)}>Retry</button></div>}
              {filledFor === session.id && <p className="small muted">Filled in from your last issue for this team.</p>}
              <label className="field">
                <span>Priority</span>
                <select value={session.priority} disabled={locked} onChange={e => patch({ priority: Number(e.target.value) })}>
                  {PRIORITIES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </label>
              <Picker label="Project" value={session.projectId} disabled={locked || !options} items={named(options?.projects)} none="No project" missing={options ? 'Unavailable project' : 'Loading…'} onChange={projectId => patch({ projectId })} />
              <Picker label="Assignee" value={session.assigneeId} disabled={locked || !options} items={named(options?.members)} none="Unassigned" missing={options ? 'Unavailable member' : 'Loading…'} onChange={assigneeId => patch({ assigneeId })} />
              <LabelPicker labels={options?.labels ?? null} selected={session.labelIds} disabled={locked || !options} hint={teamId ? 'Loading…' : 'Choose a team first.'}
                onChange={labelIds => patch({ labelIds })} />
            </div>
          </details>
        </form>
      </div>

      <footer className="panel-foot">
        {submissionLocked && !busy && <p className="small warn">A previous attempt may already have created this issue. This report is locked to the attempted revision. Check its outcome before editing; checking does not upload or create another issue.</p>}
        {footError && <p className="error small" role="alert">{footError}</p>}
        {busy && p.progress && <div role="status" aria-live="polite" className="small progress"><span className="spinner" aria-hidden="true" /> {p.progress}</div>}
        {busy && p.progress && p.progressFraction !== null && (
          <div className="progress-bar" role="progressbar" aria-label="Submission progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.progressFraction * 100)}>
            <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, p.progressFraction))})` }} />
          </div>
        )}
        <div className="foot-actions">
          <button type="button" className="button" onClick={p.onNewSession} disabled={busy}><Icon name="plus" size={16} /> New session</button>
          <button type="button" className="button square" onClick={() => setPreviewing(true)} disabled={busy || !count} aria-label="Preview report" title="Preview report"><Icon name="eye" size={16} /></button>
          <button type="submit" form="issue-form" className={busy ? 'button primary busy' : 'button primary'} disabled={busy || !count} aria-keyshortcuts="Control+Enter">
            {busy ? 'Working…' : submissionLocked ? 'Check previous attempt' : desktop && !connected ? 'Connect Linear to send' : p.pendingState && p.pendingState !== 'retryable' ? 'Retry create issue' : 'Create issue'}<Icon name="right" size={16} />
          </button>
        </div>
      </footer>
      {previewing && <Suspense fallback={null}><ReportPreview connection={p.connection} options={options} onClose={() => setPreviewing(false)}
        onCreate={report => { setPreviewing(false); p.onSubmit(report); }} /></Suspense>}
    </aside>
  );
}
