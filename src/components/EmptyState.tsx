import { desktop } from '../native';
import { Icon } from './icons';

export default function EmptyState({ shortcut, onCapture, onAdd, onPaste }: { shortcut: string; onCapture: () => void; onAdd: () => void; onPaste: () => void }) {
  return (
    <div className="empty">
      <div className="capture-illustration" aria-hidden="true"><span className="illustration-window"><i /><i /><i /><span className="illustration-line" /><span className="illustration-line short" /><span className="illustration-target" /></span><span className="illustration-flag"><Icon name="arrow" size={26} /></span></div>
      <span className="eyebrow">LESS EXPLAINING. MORE SHOWING.</span>
      <h1>A clearer issue starts here.</h1>
      <p className="muted">A quick snip. A few marks. One clear Linear issue.<br />Capture just the part that tells the story.</p>
      <div className="empty-actions">
        <button type="button" className="button primary large" onClick={onCapture} disabled={!desktop} title={desktop ? `Capture screen (${shortcut})` : 'Available in the desktop app'}>
          <Icon name="camera" /> Capture screen
        </button>
        <button type="button" className="button large" onClick={onAdd}><Icon name="image" /> Add images</button>
        <button type="button" className="button large" onClick={onPaste}><Icon name="paste" /> Paste</button>
      </div>
      <p className="small muted">
        {desktop ? <>Press <kbd>{shortcut}</kbd> anywhere to capture, or paste with <kbd>Ctrl+V</kbd>. You can also drop image files here.</>
          : <>Browser preview: add, paste, or drop images. Screen capture and Linear work in the desktop app.</>}
      </p>
    </div>
  );
}
