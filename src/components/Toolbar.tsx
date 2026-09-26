import type { CSSProperties } from 'react';
import type { Tool } from '../model';
import { activeImage, canRedo, canUndo, isLocked, useStore } from '../store';
import { Icon, type IconName } from './icons';

export const TOOLS: { tool: Tool; label: string; key: string; icon: IconName }[] = [
  { tool: 'select', label: 'Select', key: 'V', icon: 'select' },
  { tool: 'arrow', label: 'Arrow', key: 'A', icon: 'arrow' },
  { tool: 'rectangle', label: 'Rectangle', key: 'R', icon: 'rectangle' },
  { tool: 'pen', label: 'Pen', key: 'P', icon: 'pen' },
  { tool: 'text', label: 'Text', key: 'T', icon: 'text' },
  { tool: 'pixelate', label: 'Pixelate (cosmetic)', key: 'B', icon: 'pixelate' },
  { tool: 'redact', label: 'Redact (solid black)', key: 'X', icon: 'redact' },
];
const COLORS = [
  { value: '#EF4444', name: 'Red' }, { value: '#F59E0B', name: 'Amber' }, { value: '#22C55E', name: 'Green' },
  { value: '#3B82F6', name: 'Blue' }, { value: '#A855F7', name: 'Purple' }, { value: '#111827', name: 'Black' }, { value: '#FFFFFF', name: 'White' },
];
const STROKES = [2, 3, 5, 8, 12];
const SIZES = [14, 18, 22, 28, 36, 48, 64];

export default function Toolbar() {
  const tool = useStore(s => s.tool); const color = useStore(s => s.color); const stroke = useStore(s => s.stroke); const fontSize = useStore(s => s.fontSize);
  const locked = useStore(isLocked); const undoable = useStore(canUndo); const redoable = useStore(canRedo);
  const selected = useStore(s => activeImage(s)?.annotations.find(a => a.id === s.selection));
  const { setTool, setStyle, undo, redo, updateAnnotation, removeAnnotation } = useStore.getState();
  // Style changes apply to the selected annotation as well as future ones.
  const style = (patch: { color?: string; stroke?: number; fontSize?: number }) => {
    setStyle(patch);
    if (selected && selected.kind !== 'redact' && selected.kind !== 'pixelate') {
      const next = { ...patch };
      if (selected.kind === 'text' && patch.fontSize) {
        const ratio = patch.fontSize / selected.fontSize;
        updateAnnotation(selected.id, { ...next, width: selected.width * ratio, height: selected.height * ratio });
      } else updateAnnotation(selected.id, next);
    }
  };
  const activeColor = selected && selected.kind !== 'redact' && selected.kind !== 'pixelate' ? selected.color : color;
  const showText = tool === 'text' || selected?.kind === 'text';
  return (
    <div className="toolbar" role="toolbar" aria-label="Annotation tools">
      <div className="tool-group">
        {TOOLS.map(t => (
          <button key={t.tool} type="button" className={tool === t.tool ? 'tool active' : 'tool'} aria-pressed={tool === t.tool} disabled={locked}
            aria-label={`${t.label} (${t.key})`} title={`${t.label} (${t.key})`} onClick={() => setTool(t.tool)}>
            <Icon name={t.icon} />
          </button>
        ))}
      </div>
      <div className="tool-options">
      <div className="tool-group" role="radiogroup" aria-label="Color">
        {COLORS.map(c => (
          <button key={c.value} type="button" role="radio" aria-checked={activeColor.toUpperCase() === c.value} aria-label={c.name} title={c.name}
            className="swatch" style={{ '--swatch': c.value } as CSSProperties} disabled={locked} onClick={() => style({ color: c.value })} />
        ))}
      </div>
      <label className="compact-field">
        <span>Width</span>
        <select value={selected && selected.kind !== 'text' ? selected.stroke : stroke} disabled={locked} onChange={e => style({ stroke: Number(e.target.value) })}>
          {STROKES.map(s => <option key={s} value={s}>{s}px</option>)}
        </select>
      </label>
      {showText && (
        <label className="compact-field">
          <span>Text</span>
          <select value={selected?.kind === 'text' ? selected.fontSize : fontSize} disabled={locked} onChange={e => style({ fontSize: Number(e.target.value) })}>
            {[...new Set([...SIZES, selected?.kind === 'text' ? selected.fontSize : fontSize])].sort((a, b) => a - b).map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
        </label>
      )}
      </div>
      <div className="tool-group push">
        {selected && (
          <button type="button" className="tool" aria-label="Delete selected annotation (Delete)" title="Delete selected (Delete)" disabled={locked} onClick={() => removeAnnotation(selected.id)}>
            <Icon name="trash" />
          </button>
        )}
        <button type="button" className="tool" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!undoable} onClick={undo}><Icon name="undo" /></button>
        <button type="button" className="tool" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!redoable} onClick={redo}><Icon name="redo" /></button>
      </div>
    </div>
  );
}
