import { desktop } from '../native';
import { Icon } from './icons';

export default function EmptyState({ shortcut, onCapture, onAdd, onPaste }: { shortcut: string; onCapture: () => void; onAdd: () => void; onPaste: () => void }) {
  return (
    <div className="empty">
      <div className="capture-illustration" aria-hidden="true"><span className="illustration-window"><i /><i /><i /><span className="illustration-line" /><span className="illustration-line short" /><span className="illustration-target" /></span><span className="illustration-flag"><Icon name="arrow" size={26} /></span></div>
      <h1>Capture a screenshot</h1>
      <div className="empty-actions">
        <button type="button" className="button primary large" onClick={onCapture} disabled={!desktop} title={desktop ? `Capture screen (${shortcut})` : 'Available in the desktop app'}>
          <Icon name="camera" /> Capture screen
        </button>
        <button type="button" className="button large" onClick={onAdd}><Icon name="image" /> Add images</button>
        <button type="button" className="button large" onClick={onPaste}><Icon name="paste" /> Paste</button>
      </div>
    </div>
  );
}
