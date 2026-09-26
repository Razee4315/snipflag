import type { MouseEvent } from 'react';
import { desktop } from '../native';
import { Icon } from './icons';

interface Props { shortcut: string; onCapture: () => void; onAdd: () => void; onPaste: () => void; onDragWindow: (e: MouseEvent) => void }

export default function EmptyState({ shortcut, onCapture, onAdd, onPaste, onDragWindow }: Props) {
  return (
    <div className="empty" onMouseDown={onDragWindow}>
      {/* The Snipflag mark with a living selection frame. Colors come from theme tokens, so it reads well on light and dark. */}
      <div className="hero" aria-hidden="true">
        <span className="hero-glow" />
        <svg className="hero-selection" viewBox="0 0 200 160"><rect x="6" y="6" width="188" height="148" rx="22" /></svg>
        <svg className="hero-mark" viewBox="0 0 512 512">
          <rect className="hero-tile" width="512" height="512" rx="112" />
          <g className="hero-lines" fill="none" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round">
            <path className="hero-corners" d="M204 135h-69v69m173 173h69v-69M135 308v69h69" />
            <path className="hero-arrow" d="M235 277l139-139m-89 0h89v89" />
          </g>
        </svg>
      </div>
      <h1>Capture a screenshot</h1>
      <p className="empty-hint">{desktop ? <>Press <kbd>{shortcut}</kbd> from anywhere, or drop images here.</> : 'Drop images here, or add them from your files.'}</p>
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
