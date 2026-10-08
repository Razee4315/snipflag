import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { imageLabel, LIMITS } from '../model';
import { smooth } from '../motion';
import { isLocked, useStore } from '../store';
import { Icon } from './icons';
import { imageReference } from '../mentions';
import ProtectedThumbnail from './ProtectedThumbnail';

interface Props { onCapture: () => void; onAdd: () => void; onRemove: (id: string) => void; canCapture: boolean }
/** Pointer travel, in pixels, before a press on a tile becomes a drag instead of a click. */
const DRAG_START = 6;

/**
 * The session's screenshots in upload order. Drag a tile sideways to reorder (the arrow buttons do the same from
 * the keyboard): the tile follows the pointer, a marker shows where it will land, and tiles glide into place.
 * `to` is the dragged tile's index once it is dropped.
 */
export default function Filmstrip({ onCapture, onAdd, onRemove, canCapture }: Props) {
  const images = useStore(s => s.session.images); const activeId = useStore(s => s.activeId); const locked = useStore(isLocked);
  const references = useStore(s => s.session.imageReferences); const limit = useStore(s => s.imageLimit);
  const { select, moveImage } = useStore.getState();
  const strip = useRef<HTMLOListElement>(null); const scroller = useRef<HTMLElement>(null);
  /** Set when a drag ends on a tile, so the click that follows the release does not also select it. */
  const dragged = useRef(false);
  const [drag, setDrag] = useState<{ from: number; to: number; dx: number } | null>(null);
  const full = images.length >= limit;
  const fullTitle = full ? `This session is full${limit < LIMITS.maxImages ? '. Raise the limit in Settings → Capture' : ''}` : undefined;
  // The chosen screenshot is always in view: a new capture at the end of a long strip, or one picked with the keyboard.
  useEffect(() => {
    const view = scroller.current; const tile = view?.querySelector<HTMLElement>('.tile.active');
    if (!view || !tile) return;
    const edge = view.getBoundingClientRect(); const box = tile.getBoundingClientRect();
    // The Capture and Add buttons stay over the right end of the strip.
    const end = edge.right - (view.querySelector<HTMLElement>('.tile.add')?.getBoundingClientRect().width ?? 0) - 10;
    if (box.left < edge.left + 10) view.scrollLeft -= edge.left + 10 - box.left;
    else if (box.right > end) view.scrollLeft += box.right - end;
  }, [activeId, images.length]);
  /** A mouse wheel moves along the strip; it has nowhere to go up or down. */
  const wheel = (e: ReactWheelEvent) => { if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY; };
  const move = (from: number, to: number) => { if (to !== from && to >= 0 && to < images.length) smooth(() => moveImage(from, to)); };

  const press = (from: number) => (e: ReactPointerEvent) => {
    if (e.button !== 0 || locked || images.length < 2) return;
    const startX = e.clientX; let to: number | null = null;
    const follow = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (to === null && Math.abs(dx) < DRAG_START) return;
      // Where the tile lands: after every other tile whose middle is left of the pointer.
      const tiles = [...(strip.current?.querySelectorAll<HTMLElement>('[data-testid="tile"]') ?? [])];
      to = tiles.filter((tile, i) => { const box = tile.getBoundingClientRect(); return i !== from && box.left + box.width / 2 < ev.clientX; }).length;
      setDrag({ from, to, dx });
    };
    const finish = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', follow); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish);
      setDrag(null);
      if (to === null) return;
      dragged.current = true; window.setTimeout(() => { dragged.current = false; }, 0);
      if (ev.type === 'pointerup') move(from, to);
    };
    window.addEventListener('pointermove', follow); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish);
  };
  /** The marker sits before the tile that will follow the dragged one, or after the last tile. */
  const marker = (index: number) => {
    if (!drag || drag.to === drag.from || index === drag.from) return '';
    const among = index < drag.from ? index : index - 1;
    if (among === drag.to) return 'drop-before';
    return drag.to === images.length - 1 && among === images.length - 2 ? 'drop-after' : '';
  };
  return (
    <nav className="filmstrip" ref={scroller} onWheel={wheel} aria-label={`${images.length} ${images.length === 1 ? 'image' : 'images'} · one issue`}>
      <ol ref={strip}>
        {images.map((image, index) => {
          const label = imageLabel(image, index); const marks = image.annotations.length;
          const moving = drag && drag.from === index ? drag : null;
          const classes = ['tile', image.id === activeId && 'active', moving && 'dragging', marker(index)].filter(Boolean).join(' ');
          const style = { viewTransitionName: `tile-${image.id}`, ...(moving ? { transform: `translateX(${moving.dx}px)` } : {}) } as CSSProperties;
          return (
            <li key={image.id} className={classes} data-testid="tile" style={style}>
              <button type="button" className="tile-select" aria-current={image.id === activeId ? 'true' : undefined}
                aria-label={`Screenshot ${index + 1}: ${label}, ${marks} ${marks === 1 ? 'mark' : 'marks'}`}
                onPointerDown={press(index)} onClick={() => { if (!dragged.current) select(image.id); }}>
                <span className="tile-number" aria-hidden="true" title={`@${imageReference(image.id, references ?? {}) ?? `image${index + 1}`}`}>{(imageReference(image.id, references ?? {}) ?? `image${index + 1}`).slice(5)}</span>
                <ProtectedThumbnail image={image} />
                <span className="tile-caption" aria-hidden="true">{label}</span>
                {marks > 0 && <span className="tile-marks" aria-hidden="true">{marks}</span>}
              </button>
              <div className="tile-actions">
                <button type="button" className="mini" aria-label={`Move screenshot ${index + 1} earlier`} title="Move earlier" disabled={locked || index === 0} onClick={() => move(index, index - 1)}><Icon name="left" size={14} /></button>
                <button type="button" className="mini" aria-label={`Move screenshot ${index + 1} later`} title="Move later" disabled={locked || index === images.length - 1} onClick={() => move(index, index + 1)}><Icon name="right" size={14} /></button>
                <button type="button" className="mini danger" aria-label={`Remove screenshot ${index + 1}`} title="Remove" disabled={locked} onClick={() => onRemove(image.id)}><Icon name="trash" size={14} /></button>
              </div>
            </li>
          );
        })}
        <li className="tile add">
          {canCapture && <button type="button" className="add-button" disabled={full || locked} onClick={onCapture} title={fullTitle}><Icon name="camera" /> <span>Capture</span></button>}
          <button type="button" className="add-button" disabled={full || locked} onClick={onAdd} title={fullTitle}><Icon name="image" /> <span>Add images</span></button>
          <span className="tile-count" title="Screenshots in this session, and the most it holds">{images.length} of {Math.max(limit, images.length)}</span>
        </li>
      </ol>
    </nav>
  );
}
