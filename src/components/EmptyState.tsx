import { desktop } from '../native';
import { Icon } from './icons';

export default function EmptyState({ shortcut, onCapture, onAdd, onPaste }: { shortcut: string; onCapture: () => void; onAdd: () => void; onPaste: () => void }) {
  return (
    <div className="empty">
      <h1>A clearer issue starts here.</h1>
      <p className="muted">Capture or add screenshots, mark what matters, and send them to Linear as one issue.</p>
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
