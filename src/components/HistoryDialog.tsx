import { useEffect, useState } from 'react';
import { sessionLabel, type Session } from '../model';
import { deleteSession, errorText, listSessions } from '../native';
import Dialog from './Dialog';

const when = (t: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t));

export default function HistoryDialog({ currentId, onOpen, onDeleted, onClose }: { currentId: string; onOpen: (id: string) => Promise<void>; onDeleted: (id: string) => void; onClose: () => void }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState(''); const [confirm, setConfirm] = useState('');
  useEffect(() => { listSessions().then(setSessions).catch(e => setError(errorText(e))); }, []);
  const remove = async (id: string) => {
    try { await deleteSession(id); setSessions(s => s?.filter(x => x.id !== id) ?? null); setConfirm(''); onDeleted(id); } catch (e) { setError(errorText(e)); }
  };
  return (
    <Dialog title="History" onClose={onClose} wide>
      {error && <p className="error" role="alert">{error}</p>}
      {!sessions ? <p className="muted">Loading…</p> : !sessions.length ? <p className="muted">No saved sessions yet. Drafts appear here automatically.</p> : (
        <ul className="history">
          {sessions.map(s => (
            <li key={s.id} className={s.id === currentId ? 'current' : undefined}>
              <div className="history-main">
                <strong>{sessionLabel(s)}</strong>
                <span className="small muted">
                  {s.images.length} {s.images.length === 1 ? 'image' : 'images'} · {when(s.updatedAt)} · {s.issue ? <span className="tag ok">Sent {s.issue.identifier}</span> : <span className="tag">Draft</span>}
                  {s.id === currentId && ' · open now'}
                </span>
              </div>
              <div className="row">
                {confirm === s.id ? (
                  <>
                    <button type="button" className="button danger" onClick={() => void remove(s.id)}>Delete</button>
                    <button type="button" className="button" onClick={() => setConfirm('')}>Keep</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="button" disabled={s.id === currentId} onClick={() => onOpen(s.id).catch(e => setError(errorText(e)))} aria-label={`Open ${sessionLabel(s)}`}>Open</button>
                    <button type="button" className="button danger-outline" onClick={() => setConfirm(s.id)} aria-label={`Delete ${sessionLabel(s)}`}>Delete</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
