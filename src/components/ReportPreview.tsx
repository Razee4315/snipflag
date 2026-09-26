import { useEffect, useMemo, useRef, useState } from 'react';
import { estimateBytes, PRIORITIES, validateSession, type Annotation, type Connection, type Session, type TeamOptions } from '../model';
import { desktop, errorText, PREVIEW_MESSAGE } from '../native';
import { flatten } from '../render';
import { composeDescription, reportParts, sectionHeading, trimEnd, type ReportParts } from '../report';
import { useStore } from '../store';
import Dialog from './Dialog';
import { Icon } from './icons';

/** The exact revision and flattened pixels a user reviewed; submission reuses them only if nothing changed since. */
export interface PreparedReport { session: Session; exports: { id: string; dataUrl: string }[] }
interface Props { connection: Connection | null; options: TeamOptions | null; onClose: () => void; onCreate: (report: PreparedReport) => void }
type Flattened = { dataUrl: string; annotations: Annotation[]; url: string };

const megabytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function ReportPreview({ connection, options, onClose, onCreate }: Props) {
  const session = useStore(s => s.session); const locked = useStore(s => s.submissionLocked); const busy = useStore(s => s.busy);
  const [ready, setReady] = useState<{ session: Session; urls: Map<string, string> } | null>(null);
  const [progress, setProgress] = useState(''); const [renderError, setRenderError] = useState('');
  // Unchanged images are not flattened again when an unrelated field changes.
  const cache = useRef(new Map<string, Flattened>());

  useEffect(() => {
    let live = true; setRenderError('');
    (async () => {
      const urls = new Map<string, string>();
      for (const [i, image] of session.images.entries()) {
        const hit = cache.current.get(image.id);
        if (hit && hit.dataUrl === image.dataUrl && hit.annotations === image.annotations) { urls.set(image.id, hit.url); continue; }
        setProgress(`Preparing image ${i + 1} of ${session.images.length}…`);
        const url = await flatten(image);
        if (!live) return;
        cache.current.set(image.id, { dataUrl: image.dataUrl, annotations: image.annotations, url }); urls.set(image.id, url);
      }
      if (live) { setReady({ session, urls }); setProgress(''); }
    })().catch(e => { if (live) { setRenderError(errorText(e)); setProgress(''); } });
    return () => { live = false; };
  }, [session]);

  const report = useMemo((): { parts: ReportParts | null; error: string } => {
    try { return { parts: reportParts(session), error: '' }; } catch (e) { return { parts: null, error: errorText(e) }; }
  }, [session]);
  const current = ready?.session === session ? ready.urls : null;
  const blocker = validateSession(session) ?? (report.error || null) ?? (!desktop ? PREVIEW_MESSAGE : !connection ? 'Connect Linear before creating the issue.' : null);
  const bytes = current ? [...current.values()].reduce((sum, url) => sum + estimateBytes(url), 0) : 0;

  const team = connection?.teams.find(t => t.id === session.teamId);
  const named = (id: string, list: { id: string; name: string; displayName?: string }[] | undefined, none: string, unknown: string) =>
    !id ? none : list?.find(x => x.id === id)?.displayName || list?.find(x => x.id === id)?.name || unknown;
  const labels = session.labelIds.map(id => options?.labels.find(l => l.id === id)?.name ?? 'Selected label');
  const position = (imageId: string) => session.images.findIndex(i => i.id === imageId) + 1;
  const markdown = report.parts ? composeDescription(report.parts, id => `linear-upload:screenshot-${position(id)}.png`) : '';
  const prose = report.parts?.prose.map((s, i, all) => i === all.length - 1 && 'text' in s ? { text: trimEnd(s.text) } : s) ?? [];

  const create = () => {
    if (!current || blocker) return;
    onCreate({ session, exports: session.images.map(i => ({ id: i.id, dataUrl: current.get(i.id)! })) });
  };
  const footer = locked ? (
    <><span className="small muted">This is the revision from the previous attempt.</span><button type="button" className="button" onClick={onClose}>Close</button></>
  ) : (
    <>
      <span className="small muted" role={blocker ? 'alert' : undefined}>{blocker ?? (current ? `${session.images.length} ${session.images.length === 1 ? 'image' : 'images'}, ${megabytes(bytes)} to upload` : progress)}</span>
      <button type="button" className="button" onClick={onClose}>Keep editing</button>
      <button type="button" className="button primary" disabled={!current || !!blocker || busy} onClick={create}>Create issue <Icon name="right" size={16} /></button>
    </>
  );

  return (
    <Dialog title="Report preview" wide onClose={onClose} footer={footer}>
      <p className="small muted preview-boundary"><Icon name="check" size={14} /> Nothing has been uploaded. Create issue sends exactly this report to Linear as one issue.</p>
      <dl className="preview-meta">
        <dt>Destination</dt><dd>{connection ? `${connection.workspace} / ${team?.name ?? (session.teamId ? 'Unavailable team' : 'No team chosen')}` : 'Linear is not connected'}</dd>
        <dt>Priority</dt><dd>{PRIORITIES.find(p => p.value === session.priority)?.label ?? 'No priority'}</dd>
        <dt>Project</dt><dd>{named(session.projectId, options?.projects, 'None', 'Selected project')}</dd>
        <dt>Assignee</dt><dd>{named(session.assigneeId, options?.members, 'Unassigned', 'Selected member')}</dd>
        <dt>Labels</dt><dd>{labels.length ? labels.join(', ') : 'None'}</dd>
      </dl>
      <article className="preview-report" aria-label="Outgoing report">
        <h3 className="preview-title">{session.title.trim() || <span className="muted">No title</span>}</h3>
        {report.error && <p className="error small">{report.error}</p>}
        {prose.length > 0 && <p className="preview-prose">{prose.map((s, i) => 'text' in s ? <span key={i}>{s.text}</span>
          : <span key={i} className="mention-chip" title={`Links to image ${position(s.imageId)}`}>@{s.key}</span>)}</p>}
        {report.parts?.sections.map((section, i) => {
          const image = session.images[i]; const url = current?.get(section.imageId);
          return (
            <figure key={section.imageId} className="preview-image">
              <h4>{sectionHeading(section, i)}</h4>
              {url ? <img src={url} alt={`${section.alt} as it will be uploaded`} data-preview-image={i + 1} /> : <div className="preview-pending" aria-hidden="true" />}
              <figcaption className="small muted">{section.fileName} · {image.width} × {image.height}{url ? ` · ${megabytes(estimateBytes(url))}` : ''}</figcaption>
            </figure>
          );
        })}
        {renderError && <p className="error small" role="alert">{renderError}</p>}
      </article>
      {report.parts && (
        <details className="preview-markdown">
          <summary>Markdown description</summary>
          <pre>{markdown}</pre>
          <p className="small muted">Linear assigns each image address during upload.</p>
        </details>
      )}
    </Dialog>
  );
}
