import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { adjustRect, normalizeRect, toFramePixels, type RectHandle } from '../model';
import { errorText, native, on } from '../native';

interface Frame { width: number; height: number }
interface Rect { x: number; y: number; width: number; height: number }
/** A capture in progress and the selection preferences read from Settings when it started. */
interface Capture { generation: number; adjust: boolean; magnifier: boolean }
const IDLE: Capture = { generation: 0, adjust: false, magnifier: false };
const HANDLES: RectHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const MIN = 4;
/** The magnifier shows LENS_CELLS x LENS_CELLS frame pixels, each drawn LENS_ZOOM screen pixels wide. */
const LENS_CELLS = 13; const LENS_ZOOM = 10; const LENS = LENS_CELLS * LENS_ZOOM;
const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

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
 * Full-screen frozen frame for one monitor. Releasing a drag captures that area; Enter takes the whole monitor and
 * Escape cancels every overlay. With "Adjust the selection" on, the selection stays adjustable (move, eight handles,
 * arrow keys) until Enter, a double-click or the Capture button confirms it, and Escape first clears it.
 * The window is opened hidden ahead of time and reused: each capture has a generation, and the frame for it is read
 * straight from memory through the `snipframe` protocol.
 */
export default function CaptureOverlay() {
  const [capture, setCapture] = useState<Capture>(IDLE);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [error, setError] = useState('');
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const done = useRef(false);
  const current = useRef(0);
  const guides = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  /** The pointer gesture in progress: a new selection from a point, or a move/resize of `from`. */
  const gesture = useRef<{ handle: RectHandle | 'new'; x: number; y: number; from: Rect | null } | null>(null);
  const { generation, adjust } = capture;

  useEffect(() => {
    document.documentElement.classList.add('capture-mode');
    const show = (next: Capture) => { current.current = next.generation; done.current = false; gesture.current = null; setFrame(null); setRect(null); setDragging(false); setError(''); setCapture(next); };
    const begin = (next: Capture | null) => { if (next?.generation && next.generation !== current.current) show({ ...IDLE, ...next }); };
    const subs = [on<Capture>('capture-begin', begin), on('capture-end', () => show(IDLE))];
    // An overlay created for this capture missed the event; ask once it is listening.
    void Promise.all(subs).then(() => native<Capture | null>('capture_state')).then(begin).catch(() => undefined);
    return () => { subs.forEach(p => p.then(u => u())); };
  }, []);
  const ready = (shown: number) => { if (shown === current.current) void native('capture_ready', { generation: shown }).catch(() => undefined); };
  const cancel = () => { if (!done.current) { done.current = true; void native('capture_cancel').catch(() => undefined); } };
  const select = (area: Rect) => {
    if (!frame || done.current) return;
    done.current = true;
    native('capture_select', toFramePixels(area, viewport(), frame)).catch(e => { done.current = false; setError(errorText(e)); });
  };
  const usable = (area: Rect | null): area is Rect => !!area && area.width >= MIN && area.height >= MIN;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (adjust && rect) setRect(null); else cancel(); }
      if (e.key === 'Enter' && frame) { e.preventDefault(); select(usable(rect) ? rect : { x: 0, y: 0, ...viewport() }); }
      const step = e.shiftKey ? 10 : 1;
      const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const move = nudge[e.key];
      if (adjust && rect && move) { e.preventDefault(); setRect(adjustRect(rect, 'move', move[0], move[1], viewport())); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  /** Redraws the magnifier around the pointer straight from the frozen frame, without a React render. */
  const magnify = (x: number, y: number) => {
    const box = lens.current; const image = picture.current; const canvas = box?.querySelector('canvas');
    if (!box || !image || !canvas || !frame) return;
    const view = viewport();
    const fx = Math.min(frame.width - 1, Math.max(0, Math.floor(x * frame.width / view.width)));
    const fy = Math.min(frame.height - 1, Math.max(0, Math.floor(y * frame.height / view.height)));
    const context = canvas.getContext('2d');
    if (context) {
      const half = (LENS_CELLS - 1) / 2;
      context.imageSmoothingEnabled = false;
      context.fillStyle = '#000'; context.fillRect(0, 0, LENS, LENS);
      context.drawImage(image, fx - half, fy - half, LENS_CELLS, LENS_CELLS, 0, 0, LENS, LENS);
    }
    const label = box.querySelector('span'); if (label) label.textContent = `${fx}, ${fy}`;
    // Beside the pointer, flipped to stay on screen.
    const left = x + 24 + LENS > view.width ? x - 24 - LENS : x + 24;
    const top = y + 24 + LENS + 26 > view.height ? y - 24 - LENS - 26 : y + 24;
    box.style.transform = `translate(${left}px, ${top}px)`; box.style.opacity = '1';
  };

  const size = rect && frame ? toFramePixels(rect, viewport(), frame) : null;
  const adjustable = adjust && usable(rect) && !dragging;
  return (
    <div className="capture" role="application" aria-label="Select an area to capture"
      onPointerDown={e => {
        if (e.button === 2) { cancel(); return; }
        if (e.button !== 0 || !frame) return;
        const handle = (e.target as HTMLElement).dataset.handle as RectHandle | undefined;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        gesture.current = { handle: handle && rect ? handle : 'new', x: e.clientX, y: e.clientY, from: rect };
      }}
      onPointerMove={e => {
        // Guides and the magnifier follow the pointer without re-rendering the frozen frame.
        guides.current?.style.setProperty('--x', `${e.clientX}px`); guides.current?.style.setProperty('--y', `${e.clientY}px`);
        magnify(e.clientX, e.clientY);
        const g = gesture.current; if (!g) return;
        if (g.handle === 'new') {
          // A click without movement is not a new selection.
          if (!dragging && Math.abs(e.clientX - g.x) < 2 && Math.abs(e.clientY - g.y) < 2) return;
          setDragging(true); setRect(normalizeRect(g.x, g.y, e.clientX, e.clientY));
        } else if (g.from) setRect(adjustRect(g.from, g.handle, e.clientX - g.x, e.clientY - g.y, viewport()));
      }}
      onPointerUp={() => {
        const g = gesture.current; gesture.current = null; setDragging(false);
        if (!g) return;
        // Without adjusting, releasing the drag is the capture.
        if (!adjust) { if (usable(rect)) select(rect); setRect(null); return; }
        // A click outside the selection clears it; a selection too small to capture is dropped.
        if ((g.handle === 'new' && !dragging) || !usable(rect)) setRect(null);
      }}
      onDoubleClick={e => { if (adjust && usable(rect) && e.clientX >= rect.x && e.clientX <= rect.x + rect.width && e.clientY >= rect.y && e.clientY <= rect.y + rect.height) select(rect); }}
      onContextMenu={e => e.preventDefault()}>
      {generation > 0 && <img key={generation} ref={picture} className="capture-frame" src={convertFileSrc(String(generation), 'snipframe')} alt="" draggable={false}
        onLoad={e => {
          const image = e.currentTarget;
          setFrame({ width: image.naturalWidth, height: image.naturalHeight });
          void painted(image).then(() => ready(generation));
        }}
        onError={() => { setError('Could not show the capture.'); ready(generation); }} />}
      {rect ? (
        <div className={`capture-selection${adjustable ? ' adjust' : ''}`} data-handle="move" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
          {size && <span className="capture-size">{size.width} × {size.height}</span>}
          {adjustable && HANDLES.map(h => <span key={h} className="capture-handle" data-handle={h} />)}
          {adjustable && (
            <div className={`capture-actions${rect.y + rect.height + 48 > window.innerHeight ? ' inside' : ''}`} onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => setRect(null)}>Reselect</button>
              <button type="button" className="confirm" onClick={() => select(rect)}>Capture</button>
            </div>
          )}
        </div>
      ) : <div className="capture-dim" />}
      {frame && !rect && <div className="capture-guides" ref={guides} aria-hidden="true" />}
      {capture.magnifier && frame && !adjustable && (
        <div className="capture-lens" ref={lens} aria-hidden="true"><canvas width={LENS} height={LENS} /><span /></div>
      )}
      <div className="capture-hint" role="status">
        {error ? <>{error} <button type="button" onClick={cancel}>Close</button></>
          : adjustable ? 'Drag to adjust · Enter or double-click to capture · Esc to reselect'
          : 'Drag to capture · Enter for the whole screen · Esc to cancel'}
      </div>
    </div>
  );
}
