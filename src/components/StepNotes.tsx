import { useState } from 'react';
import type { CaptureImage } from '../model';
import { contrastText } from '../render';
import { isLocked, useStore } from '../store';
import { Icon } from './icons';

/**
 * A note for every numbered step on the image. It floats over the corner of the canvas, so placing a step never
 * moves the picture. Notes travel with "Copy for AI" and can be added to the issue description.
 */
export default function StepNotes({ image }: { image: CaptureImage }) {
  const locked = useStore(isLocked);
  const [open, setOpen] = useState(false);
  const steps = image.annotations.filter(a => a.kind === 'step').sort((a, b) => (Number(a.text) || 0) - (Number(b.text) || 0));
  if (!steps.length) return null;
  const written = steps.filter(s => s.note?.trim()).length;
  const { noteAnnotation, setSelection, setTool } = useStore.getState();
  return (
    <div className={open ? 'step-notes open' : 'step-notes'}>
      {open && (
        <div className="step-list" role="group" aria-label="Step notes">
          {steps.map(step => (
            <label key={step.id} className="step-note">
              <span className="step-dot" style={{ background: step.color, color: contrastText(step.color) }} aria-hidden="true">{step.text}</span>
              <input value={step.note ?? ''} maxLength={300} disabled={locked} autoComplete="off" aria-label={`Note for step ${step.text}`}
                placeholder={`What happens at step ${step.text}?`}
                onFocus={() => { setTool('select'); setSelection(step.id); }}
                onChange={e => noteAnnotation(step.id, e.target.value)} />
            </label>
          ))}
        </div>
      )}
      <button type="button" className="step-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <Icon name="note" size={15} /> Step notes <span className="step-count">{written}/{steps.length}</span>
      </button>
    </div>
  );
}
