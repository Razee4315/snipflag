import { useEffect, useId, useRef, useState } from 'react';
import { imageReference, mentionQuery, missingImageReferences, type ImageReferences } from '../mentions';
import type { CaptureImage } from '../model';
import ProtectedThumbnail from './ProtectedThumbnail';

interface Props { value: string; images: CaptureImage[]; references: ImageReferences; disabled: boolean; onChange: (value: string) => void }

export default function DescriptionEditor({ value, images, references, disabled, onChange }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const [query, setQuery] = useState<ReturnType<typeof mentionQuery>>(null);
  const [active, setActive] = useState(0);
  const [composing, setComposing] = useState(false);
  const choices = images.map(image => ({ image, key: imageReference(image.id, references) ?? '' }))
    .filter(({ image, key }) => key && (!query?.query || key.includes(query.query) || image.name.toLowerCase().includes(query.query)));
  const selected = Math.min(active, Math.max(0, choices.length - 1));
  const missing = missingImageReferences(value, images, references);
  useEffect(() => {
    if (query) document.getElementById(`${id}-image-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, selected, query]);
  const update = () => {
    const el = input.current;
    setQuery(el && el.selectionStart === el.selectionEnd && !composing ? mentionQuery(el.value, el.selectionStart) : null);
    setActive(0);
  };
  const choose = (key: string) => {
    const el = input.current; if (!el || !query) return;
    el.focus(); el.setSelectionRange(query.start, query.end);
    const text = `@${key} `;
    // Native insertText keeps insertion in the textarea's undo history on desktop webviews.
    if (!document.execCommand('insertText', false, text)) {
      const next = el.value.slice(0, query.start) + text + el.value.slice(query.end);
      onChange(next);
      requestAnimationFrame(() => el.setSelectionRange(query.start + text.length, query.start + text.length));
    }
    setQuery(null);
  };
  return <div className="description-editor">
    <label className="field" htmlFor={id}><span>Description</span></label>
    <textarea id={id} ref={input} value={value} disabled={disabled} rows={5}
      placeholder="Describe the issue… @ to reference an image"
      aria-autocomplete="list" aria-controls={query ? `${id}-images` : undefined}
      aria-activedescendant={query && choices.length ? `${id}-image-${selected}` : undefined}
      aria-describedby={missing.length ? `${id}-error` : undefined}
      onChange={e => { onChange(e.target.value); update(); }} onClick={update}
      onCompositionStart={() => { setComposing(true); setQuery(null); }} onCompositionEnd={() => { setComposing(false); }}
      onBlur={() => setQuery(null)}
      onKeyUp={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) update(); }}
      onKeyDown={e => {
        if (!query || composing || e.nativeEvent.isComposing) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQuery(null); }
        if (choices.length && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault(); e.stopPropagation(); setActive((selected + (e.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length);
        }
        if (choices.length && (e.key === 'Enter' || e.key === 'Tab') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault(); e.stopPropagation(); choose(choices[selected].key);
        }
      }} />
    {query && !disabled && <div className="mention-menu" id={`${id}-images`} role="listbox" aria-label="Mention an image">
      {choices.map(({ image, key }, index) => <button key={image.id} id={`${id}-image-${index}`} type="button" role="option" aria-selected={selected === index}
        className={selected === index ? 'active' : ''} onMouseDown={e => e.preventDefault()} onClick={() => choose(key)}>
        <ProtectedThumbnail image={image} /><span><strong>@{key}</strong>{image.name && <small>{image.name}</small>}</span>
      </button>)}
      {!choices.length && <span className="muted small">{images.length ? 'No matching images.' : 'Add an image first.'}</span>}
    </div>}
    {missing.length > 0 && <p id={`${id}-error`} className="small error" role="alert">{missing.map(key => `@${key}`).join(', ')} {missing.length === 1 ? 'is' : 'are'} not attached. Remove the reference or choose another image.</p>}
  </div>;
}
