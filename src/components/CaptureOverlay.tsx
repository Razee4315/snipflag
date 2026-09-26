import { useEffect, useRef, useState } from 'react';
import { normalizeRect, toFramePixels } from '../model';
import { errorText, native } from '../native';

interface Frame { dataUrl: string; width: number; height: number }

/** Full-screen frozen frame for one monitor. Drag selects; Enter takes the whole monitor; Escape cancels every overlay. */
export default function CaptureOverlay() {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const done = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add('capture-mode');
    native<Frame>('capture_frame').then(setFrame).catch(e => { setError(errorText(e)); void native('capture_ready').catch(() => undefined); });
  }, []);
  const cancel = () => { if (!done.current) { done.current = true; void native('capture_cancel').catch(() => undefined); } };
  const select = (rect: { x: number; y: number; width: number; height: number }) => {
    if (!frame || done.current) return;
    done.current = true;
    const px = toFramePixels(rect, { width: window.innerWidth, height: window.innerHeight }, frame);
    native('capture_select', px).catch(e => { done.current = false; setError(errorText(e)); });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      if (e.key === 'Enter' && frame) { e.preventDefault(); select({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const rect = drag ? normalizeRect(drag.x0, drag.y0, drag.x1, drag.y1) : null;
  return (
    <div className="capture" role="application" aria-label="Select an area to capture"
      onPointerDown={e => { if (e.button === 0 && frame) { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY }); } else if (e.button === 2) cancel(); }}
      onPointerMove={e => { if (drag) setDrag({ ...drag, x1: e.clientX, y1: e.clientY }); }}
      onPointerUp={() => { if (rect && rect.width >= 4 && rect.height >= 4) select(rect); setDrag(null); }}
      onContextMenu={e => e.preventDefault()}>
      {frame && <img className="capture-frame" src={frame.dataUrl} alt="" draggable={false} onLoad={() => { void native('capture_ready').catch(() => undefined); }} />}
      {rect ? (
        <div className="capture-selection" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
          <span className="capture-size">{toFramePixels(rect, { width: window.innerWidth, height: window.innerHeight }, frame ?? { width: 1, height: 1 }).width} × {toFramePixels(rect, { width: window.innerWidth, height: window.innerHeight }, frame ?? { width: 1, height: 1 }).height}</span>
        </div>
      ) : <div className="capture-dim" />}
      <div className="capture-hint" role="status">
        {error ? <>{error} <button type="button" onClick={cancel}>Close</button></> : 'Drag to capture · Enter for the whole screen · Esc to cancel'}
      </div>
    </div>
  );
}
