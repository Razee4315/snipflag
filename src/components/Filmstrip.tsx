import { useState, type CSSProperties } from 'react';
import { imageLabel, LIMITS } from '../model';
import { smooth } from '../motion';
import { isLocked, useStore } from '../store';
import { Icon } from './icons';
import { imageReference } from '../mentions';
import ProtectedThumbnail from './ProtectedThumbnail';

interface Props { onCapture: () => void; onAdd: () => void; onRemove: (id: string) => void; canCapture: boolean }

/**
 * The session's screenshots in upload order. Drag a tile to reorder (the arrow buttons do the same from the
 * keyboard); tiles glide to their new place. `over` is the slot a dragged tile would be inserted at.
 */
export default function Filmstrip({ onCapture, onAdd, onRemove, canCapture }: Props) {
  const images = useStore(s => s.session.images); const activeId = useStore(s => s.activeId); const locked = useStore(isLocked);
  const references = useStore(s => s.session.imageReferences);
  const { select, moveImage } = useStore.getState();
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);
  const full = images.length >= LIMITS.images;
  const move = (from: number, to: number) => { if (to !== from && to >= 0 && to < images.length) smooth(() => moveImage(from, to)); };
  const drop = () => {
    if (drag && drag.over !== null) move(drag.from, drag.over > drag.from ? drag.over - 1 : drag.over);
    setDrag(null);
  };
  return (
    <nav className="filmstrip" aria-label={`${images.length} ${images.length === 1 ? 'image' : 'images'} · one issue`}>
      <ol>
        {images.map((image, index) => {
          const label = imageLabel(image, index); const marks = image.annotations.length;
          const classes = ['tile', image.id === activeId && 'active', drag?.from === index && 'dragging',
            drag && drag.over === index && 'drop-before', drag && drag.over === images.length && index === images.length - 1 && 'drop-after'].filter(Boolean).join(' ');
          return (
            <li key={image.id} className={classes} data-testid="tile" style={{ viewTransitionName: `tile-${image.id}` } as CSSProperties}
              onDragOver={e => {
                if (!drag) return;
                e.preventDefault(); e.dataTransfer.dropEffect = 'move';
                const box = e.currentTarget.getBoundingClientRect();
                const over = e.clientX > box.left + box.width / 2 ? index + 1 : index;
                if (drag.over !== over) setDrag({ ...drag, over });
              }}
              onDrop={e => { if (drag) { e.preventDefault(); e.stopPropagation(); drop(); } }}>
              <button type="button" className="tile-select" aria-current={image.id === activeId ? 'true' : undefined} draggable={!locked && images.length > 1}
                aria-label={`Screenshot ${index + 1}: ${label}, ${marks} ${marks === 1 ? 'mark' : 'marks'}`} onClick={() => select(image.id)}
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', label); setDrag({ from: index, over: null }); }}
                onDragEnd={() => setDrag(null)}>
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
          {canCapture && <button type="button" className="add-button" disabled={full || locked} onClick={onCapture} title={full ? 'This session is full' : undefined}><Icon name="camera" /> <span>Capture</span></button>}
          <button type="button" className="add-button" disabled={full || locked} onClick={onAdd} title={full ? 'This session is full' : undefined}><Icon name="image" /> <span>Add images</span></button>
        </li>
      </ol>
    </nav>
  );
}
