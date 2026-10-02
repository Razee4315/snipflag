import { useEffect, useState } from 'react';
import { filterSessions, type HistoryFilter } from '../history';
import { sessionLabel, type Session } from '../model';
import { errorText, listSessions } from '../native';
import Dialog from './Dialog';
import { Icon } from './icons';

const when = (t: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t));
const FILTERS: { value: HistoryFilter; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'drafts', label: 'Drafts' }, { value: 'sent', label: 'Sent' }];

export default function HistoryDialog({ currentId, onOpen, onDelete, onClose }: { currentId: string; onOpen: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onClose: () => void }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState(''); const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState<HistoryFilter>('all');
  useEffect(() => { listSessions().then(setSessions).catch(e => setError(errorText(e))); }, []);
  const remove = async (id: string) => {
    if (deleting) return;
    setDeleting(true); setError('');
    try { await onDelete(id); setSessions(s => s?.filter(x => x.id !== id) ?? null); setConfirm(''); }
    catch (e) { setError(errorText(e)); await listSessions().then(setSessions).catch(() => undefined); }
    finally { setDeleting(false); }
  };
  const shown = sessions ? filterSessions(sessions, query, filter) : [];
  return (
    <Dialog title="History" onClose={onClose} wide>
      {error && <p className="error" role="alert">{error}</p>}
      {!sessions ? <p className="muted">Loading…</p> : !sessions.length ? <p className="muted">No saved sessions yet. Drafts appear here automatically.</p> : (
        <>
          <div className="history-tools">
            <input type="search" className="history-search" autoComplete="off" spellCheck={false} placeholder="Search titles, descriptions and issue IDs" aria-label="Search history" value={query} onChange={e => setQuery(e.target.value)} />
            <div className="segmented" role="radiogroup" aria-label="Show">
              {FILTERS.map(f => (
                <button key={f.value} type="button" role="radio" aria-checked={filter === f.value} className={filter === f.value ? 'active' : undefined} onClick={() => setFilter(f.value)}>
                  {f.label} <span>{filterSessions(sessions, query, f.value).length}</span>
                </button>
              ))}
            </div>
          </div>
          {!shown.length && <p className="muted">Nothing matches. Try fewer words or another filter.</p>}
          <ul className="history">
            {shown.map(s => (
              <li key={s.id} className={s.id === currentId ? 'current' : undefined}>
                {/* The stored preview is the flattened first screenshot, so pixelated areas stay hidden here too. */}
                <span className="history-thumb" aria-hidden="true">{s.preview ? <img src={s.preview} alt="" draggable={false} decoding="async" /> : <Icon name="image" size={20} />}</span>
                <div className="history-main">
                  <strong>{sessionLabel(s)}</strong>
                  <span className="small muted">
                    {s.images.length} {s.images.length === 1 ? 'image' : 'images'} · {when(s.updatedAt)} · {s.deletionPending ? <span className="tag">Deletion incomplete — retry Delete</span> : s.issue ? <span className="tag ok">Sent {s.issue.identifier}</span> : <span className="tag">Draft</span>}
                    {s.id === currentId && ' · open now'}
                  </span>
                </div>
                <div className="row">
                  {confirm === s.id ? (
                    <>
                      <button type="button" className="button danger" disabled={deleting} onClick={() => void remove(s.id)}>Delete</button>
                      <button type="button" className="button" onClick={() => setConfirm('')}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="button" disabled={deleting || s.deletionPending || s.id === currentId} onClick={() => onOpen(s.id).catch(e => setError(errorText(e)))} aria-label={`Open ${sessionLabel(s)}`}>Open</button>
                      <button type="button" className="button danger-outline" onClick={() => setConfirm(s.id)} aria-label={`Delete ${sessionLabel(s)}`}>Delete</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
