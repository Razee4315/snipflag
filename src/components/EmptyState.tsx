import type { MouseEvent } from 'react';
import { desktop } from '../native';
import { Icon, Mark } from './icons';

interface Props { shortcut: string; onCapture: () => void; onAdd: () => void; onPaste: () => void; onDragWindow: (e: MouseEvent) => void }

export default function EmptyState({ shortcut, onCapture, onAdd, onPaste, onDragWindow }: Props) {
  return (
    <div className="empty" onMouseDown={onDragWindow}>
      {/* The Snipflag mark on a theme-colored tile inside a quiet selection frame; static by design. */}
      <div className="hero" aria-hidden="true">
        <span className="hero-frame" />
        <span className="hero-tile"><Mark size={46} className="hero-mark" /></span>
      </div>
      <h1>Capture a screenshot</h1>
      <p className="empty-hint">{desktop ? <>Press <kbd>{shortcut}</kbd> from anywhere, or drop images here.</> : 'Drop images here, or add them from your files.'}</p>
      <div className="empty-actions">
        <button type="button" className="button primary large" onClick={onCapture} disabled={!desktop}>
          <Icon name="camera" /> Capture screen
        </button>
        <button type="button" className="button large" onClick={onAdd}><Icon name="image" /> Add images</button>
        <button type="button" className="button large" onClick={onPaste}><Icon name="paste" /> Paste</button>
      </div>
    </div>
  );
}
