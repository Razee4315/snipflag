import { imageLabel, LIMITS } from '../model';
import { isLocked, useStore } from '../store';
import { Icon } from './icons';
import { imageReference } from '../mentions';

export default function Filmstrip({ onCapture, onAdd, canCapture }: { onCapture: () => void; onAdd: () => void; canCapture: boolean }) {
  const images = useStore(s => s.session.images); const activeId = useStore(s => s.activeId); const locked = useStore(isLocked);
  const references = useStore(s => s.session.imageReferences);
  const { select, moveImage, removeImage } = useStore.getState();
  const full = images.length >= LIMITS.images;
  return (
    <nav className="filmstrip" aria-label={`${images.length} ${images.length === 1 ? 'image' : 'images'} · one issue`}>
      <ol>
        {images.map((image, index) => {
          const label = imageLabel(image, index); const marks = image.annotations.length;
          return (
            <li key={image.id} className={image.id === activeId ? 'tile active' : 'tile'} data-testid="tile">
              <button type="button" className="tile-select" aria-current={image.id === activeId ? 'true' : undefined}
                aria-label={`Screenshot ${index + 1}: ${label}, ${marks} ${marks === 1 ? 'mark' : 'marks'}`} onClick={() => select(image.id)}>
                <span className="tile-number" aria-hidden="true" title={`@${imageReference(image.id, references ?? {}) ?? `image${index + 1}`}`}>{(imageReference(image.id, references ?? {}) ?? `image${index + 1}`).slice(5)}</span>
                <img src={image.dataUrl} alt="" draggable={false} />
                <span className="tile-caption" aria-hidden="true">{label}</span>
                {marks > 0 && <span className="tile-marks" aria-hidden="true">{marks}</span>}
              </button>
              <div className="tile-actions">
                <button type="button" className="mini" aria-label={`Move screenshot ${index + 1} earlier`} title="Move earlier" disabled={locked || index === 0} onClick={() => moveImage(index, index - 1)}><Icon name="left" size={14} /></button>
                <button type="button" className="mini" aria-label={`Move screenshot ${index + 1} later`} title="Move later" disabled={locked || index === images.length - 1} onClick={() => moveImage(index, index + 1)}><Icon name="right" size={14} /></button>
                <button type="button" className="mini danger" aria-label={`Remove screenshot ${index + 1}`} title="Remove" disabled={locked} onClick={() => removeImage(image.id)}><Icon name="trash" size={14} /></button>
              </div>
            </li>
          );
        })}
        <li className="tile add">
          {canCapture && <button type="button" className="add-button" disabled={full || locked} onClick={onCapture} title={full ? 'This session is full' : 'Capture another screenshot'}><Icon name="camera" /> <span>Capture</span></button>}
          <button type="button" className="add-button" disabled={full || locked} onClick={onAdd} title={full ? 'This session is full' : 'Add images from files'}><Icon name="image" /> <span>Add images</span></button>
        </li>
      </ol>
    </nav>
  );
}
