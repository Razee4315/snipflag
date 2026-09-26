import type { CSSProperties } from 'react';
import type { Tool } from '../model';
import { activeImage, canRedo, canUndo, isLocked, useStore } from '../store';
import { Icon, type IconName } from './icons';

export const TOOLS: { tool: Tool; label: string; key: string; icon: IconName }[] = [
  { tool: 'select', label: 'Select', key: 'V', icon: 'select' },
  { tool: 'arrow', label: 'Arrow', key: 'A', icon: 'arrow' },
  { tool: 'rectangle', label: 'Rectangle', key: 'R', icon: 'rectangle' },
  { tool: 'pen', label: 'Pen', key: 'P', icon: 'pen' },
  { tool: 'highlight', label: 'Highlighter', key: 'H', icon: 'highlight' },
  { tool: 'text', label: 'Text', key: 'T', icon: 'text' },
  { tool: 'pixelate', label: 'Pixelate', key: 'B', icon: 'pixelate' },
];
const COLORS = [
  { value: '#EF4444', name: 'Red' }, { value: '#F59E0B', name: 'Amber' }, { value: '#22C55E', name: 'Green' },
  { value: '#3B82F6', name: 'Blue' }, { value: '#A855F7', name: 'Purple' }, { value: '#111827', name: 'Black' }, { value: '#FFFFFF', name: 'White' },
];
/** Marker inks: light, saturated tones that stay readable when multiplied over text. */
const HIGHLIGHTS = [
  { value: '#FDE047', name: 'Yellow' }, { value: '#86EFAC', name: 'Green' }, { value: '#F9A8D4', name: 'Pink' },
  { value: '#93C5FD', name: 'Blue' }, { value: '#FDBA74', name: 'Orange' },
];
const STROKES = [2, 4, 8, 12, 16];
const HIGHLIGHT_SIZES = [12, 18, 24, 32, 48];
const SIZES = [14, 18, 22, 28, 36, 48, 64];

export default function Toolbar() {
  const tool = useStore(s => s.tool); const color = useStore(s => s.color); const stroke = useStore(s => s.stroke); const fontSize = useStore(s => s.fontSize);
  const highlightColor = useStore(s => s.highlightColor); const highlightSize = useStore(s => s.highlightSize);
  const locked = useStore(isLocked); const undoable = useStore(canUndo); const redoable = useStore(canRedo);
  const selected = useStore(s => activeImage(s)?.annotations.find(a => a.id === s.selection));
  const { setTool, setStyle, undo, redo, updateAnnotation, removeAnnotation } = useStore.getState();
  const styled = selected && selected.kind !== 'redact' && selected.kind !== 'pixelate' ? selected : undefined;
  const marker = tool === 'highlight' || styled?.kind === 'highlight';
  // Style changes apply to the selected annotation as well as future ones.
  const style = (patch: { color?: string; stroke?: number; fontSize?: number }) => {
    setStyle(marker ? { ...(patch.color ? { highlightColor: patch.color } : {}), ...(patch.stroke ? { highlightSize: patch.stroke } : {}) } : patch);
    if (!styled || (styled.kind === 'highlight') !== marker) return;
    if (styled.kind === 'text' && patch.fontSize) {
      const ratio = patch.fontSize / styled.fontSize;
      updateAnnotation(styled.id, { ...patch, width: styled.width * ratio, height: styled.height * ratio });
    } else updateAnnotation(styled.id, patch);
  };
  const palette = marker ? HIGHLIGHTS : COLORS;
  const activeColor = (styled && (styled.kind === 'highlight') === marker ? styled.color : marker ? highlightColor : color).toUpperCase();
  const widths = marker ? HIGHLIGHT_SIZES : STROKES;
  const activeWidth = styled && styled.kind !== 'text' && (styled.kind === 'highlight') === marker ? styled.stroke : marker ? highlightSize : stroke;
  const showText = tool === 'text' || styled?.kind === 'text';
  const showWidth = !showText && tool !== 'pixelate';
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
        {tool !== 'pixelate' && (
          <div className="tool-group" role="radiogroup" aria-label={marker ? 'Highlighter color' : 'Color'}>
            {palette.map(c => (
              <button key={c.value} type="button" role="radio" aria-checked={activeColor === c.value} aria-label={c.name} title={c.name}
                className={marker ? 'swatch marker' : 'swatch'} style={{ '--swatch': c.value } as CSSProperties} disabled={locked} onClick={() => style({ color: c.value })} />
            ))}
          </div>
        )}
        {showWidth && (
          <div className="tool-group sizes" role="radiogroup" aria-label={marker ? 'Highlighter size' : 'Width'}>
            {widths.map((w, i) => (
              <button key={w} type="button" role="radio" aria-checked={activeWidth === w} aria-label={`${w} px`} title={`${w} px`} className="size" disabled={locked}
                onClick={() => style({ stroke: w })}>
                <i style={{ width: 4 + i * 3, height: 4 + i * 3, background: marker ? (styled?.kind === 'highlight' ? styled.color : highlightColor) : 'currentColor' }} />
              </button>
            ))}
          </div>
        )}
        {showText && (
          <label className="compact-field">
            <span>Text</span>
            <select value={styled?.kind === 'text' ? styled.fontSize : fontSize} disabled={locked} onChange={e => style({ fontSize: Number(e.target.value) })}>
              {[...new Set([...SIZES, styled?.kind === 'text' ? styled.fontSize : fontSize])].sort((a, b) => a - b).map(s => <option key={s} value={s}>{s}px</option>)}
            </select>
          </label>
        )}
        {tool === 'pixelate' && <span className="tool-hint">Drag over anything private. Pixels are burned into the exported image.</span>}
      </div>
      <div className="tool-group push">
        {selected && (
          <button type="button" className="tool" aria-label="Delete selected annotation (Delete)" title="Delete (Del)" disabled={locked} onClick={() => removeAnnotation(selected.id)}>
            <Icon name="trash" />
          </button>
        )}
        <button type="button" className="tool" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!undoable} onClick={undo}><Icon name="undo" /></button>
        <button type="button" className="tool" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!redoable} onClick={redo}><Icon name="redo" /></button>
      </div>
    </div>
  );
}
