import { useId, useRef, useState, type CSSProperties } from 'react';
import type { Named } from '../model';
import { Icon } from './icons';

/** Labels offered for what was typed: unselected ones containing it, names that start with it first. */
export function labelMatches(labels: Named[], selected: string[], query: string) {
  const q = query.trim().toLowerCase();
  return labels
    .filter(l => !selected.includes(l.id) && l.name.toLowerCase().includes(q))
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)));
}

interface Props {
  /** Null while the team's labels are loading or no team is chosen; `hint` says which. */
  labels: Named[] | null; selected: string[]; disabled: boolean; hint: string; onChange: (ids: string[]) => void;
}

/**
 * Chosen labels are colored chips; typing searches the rest. Arrow keys move through the matches, Enter adds one,
 * and Backspace in the empty field removes the last chip.
 */
export default function LabelPicker({ labels, selected, disabled, hint, onChange }: Props) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false); const [active, setActive] = useState(0);
  const chosen = (labels ?? []).filter(l => selected.includes(l.id));
  const matches = labels ? labelMatches(labels, selected, query) : [];
  const current = Math.min(active, Math.max(0, matches.length - 1));
  const add = (id: string) => { onChange([...selected, id]); setQuery(''); setActive(0); };
  const remove = (id: string) => onChange(selected.filter(x => x !== id));
  return (
    <fieldset className="field labels" disabled={disabled}>
      <legend>Labels{selected.length ? ` (${selected.length})` : ''}</legend>
      {labels && (labels.length ? (
        <>
          <div className="chip-box" onMouseDown={e => { if (e.target === e.currentTarget) { e.preventDefault(); input.current?.focus(); } }}>
            {chosen.map(l => (
              <span key={l.id} className="chip" style={{ '--chip': l.color || 'var(--muted)' } as CSSProperties}>
                <i className="label-dot" aria-hidden="true" />{l.name}
                <button type="button" aria-label={`Remove label ${l.name}`} title="Remove" onClick={() => remove(l.id)}><Icon name="close" size={12} /></button>
              </span>
            ))}
            <input ref={input} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-label="Add a label" autoComplete="off"
              placeholder={chosen.length ? 'Add another' : 'Add a label'} value={query}
              onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); }}
              onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(Math.max(0, Math.min(current + 1, matches.length - 1))); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(current - 1, 0)); }
                // Enter never submits the issue from here.
                else if (e.key === 'Enter') { e.preventDefault(); if (open && matches[current]) add(matches[current].id); }
                else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
                else if (e.key === 'Backspace' && !query && chosen.length) remove(chosen[chosen.length - 1].id);
              }} />
          </div>
          {open && (
            <ul id={listId} role="listbox" aria-label="Labels to add" className="chip-menu">
              {matches.map((l, i) => (
                // Mouse down keeps focus in the field, so several labels can be added in a row.
                <li key={l.id} role="option" aria-selected={i === current} className={i === current ? 'active' : undefined}
                  onMouseDown={e => { e.preventDefault(); add(l.id); }} onMouseEnter={() => setActive(i)}>
                  <i className="label-dot" style={{ background: l.color || 'var(--muted)' }} aria-hidden="true" />{l.name}
                </li>
              ))}
              {!matches.length && <li className="muted small" aria-disabled="true">{query.trim() ? 'No label matches.' : 'Every label is added.'}</li>}
            </ul>
          )}
        </>
      ) : <span className="muted small">No labels in this team.</span>)}
      {!labels && <span className="muted small">{hint}</span>}
    </fieldset>
  );
}
