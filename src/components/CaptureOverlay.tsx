import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { normalizeRect, toFramePixels } from '../model';
import { errorText, native, on } from '../native';

interface Frame { width: number; height: number }

/** Resolves once the frame is on screen-ready pixels, so the window never appears before its picture. */
function painted(image: HTMLImageElement) {
  // A page that reports itself hidden gets no animation frames; show at once and let it paint.
  if (document.visibilityState !== 'visible') return Promise.resolve();
  return new Promise<void>(resolve => {
    const timer = window.setTimeout(resolve, 120);
    const done = () => requestAnimationFrame(() => requestAnimationFrame(() => { window.clearTimeout(timer); resolve(); }));
    image.decode().then(done, done);
  });
}

/**
 * Full-screen frozen frame for one monitor. Drag selects; Enter takes the whole monitor; Escape cancels every overlay.
 * The window is opened hidden ahead of time and reused: each capture has a generation, and the frame for it is read
 * straight from memory through the `snipframe` protocol.
 */
export default function CaptureOverlay() {
  const [generation, setGeneration] = useState(0);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const done = useRef(false);
  const current = useRef(0);
  const guides = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('capture-mode');
    const show = (next: number) => { current.current = next; done.current = false; setFrame(null); setDrag(null); setError(''); setGeneration(next); };
    const begin = (next: number | null) => { if (next && next !== current.current) show(next); };
    const subs = [on<number>('capture-begin', begin), on('capture-end', () => show(0))];
    // An overlay created for this capture missed the event; ask once it is listening.
    void Promise.all(subs).then(() => native<number | null>('capture_state')).then(begin).catch(() => undefined);
    return () => { subs.forEach(p => p.then(u => u())); };
  }, []);
  const ready = (shown: number) => { if (shown === current.current) void native('capture_ready', { generation: shown }).catch(() => undefined); };
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
      onPointerMove={e => {
        // Guides follow the pointer without re-rendering the frozen frame.
        guides.current?.style.setProperty('--x', `${e.clientX}px`); guides.current?.style.setProperty('--y', `${e.clientY}px`);
        if (drag) setDrag({ ...drag, x1: e.clientX, y1: e.clientY });
      }}
      onPointerUp={() => { if (rect && rect.width >= 4 && rect.height >= 4) select(rect); setDrag(null); }}
      onContextMenu={e => e.preventDefault()}>
      {generation > 0 && <img key={generation} className="capture-frame" src={convertFileSrc(String(generation), 'snipframe')} alt="" draggable={false}
        onLoad={e => {
          const image = e.currentTarget;
          setFrame({ width: image.naturalWidth, height: image.naturalHeight });
          void painted(image).then(() => ready(generation));
        }}
        onError={() => { setError('Could not show the capture.'); ready(generation); }} />}
      {rect ? (
        <div className="capture-selection" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
          <span className="capture-size">{toFramePixels(rect, { width: window.innerWidth, height: window.innerHeight }, frame ?? { width: 1, height: 1 }).width} × {toFramePixels(rect, { width: window.innerWidth, height: window.innerHeight }, frame ?? { width: 1, height: 1 }).height}</span>
        </div>
      ) : <div className="capture-dim" />}
      {frame && !rect && <div className="capture-guides" ref={guides} aria-hidden="true" />}
      <div className="capture-hint" role="status">
        {error ? <>{error} <button type="button" onClick={cancel}>Close</button></> : 'Drag to capture · Enter for the whole screen · Esc to cancel'}
      </div>
    </div>
  );
}
