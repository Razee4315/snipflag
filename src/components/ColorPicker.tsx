import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '../color';

interface Props { value: string; label: string; onPick: (hex: string) => void; onClose: () => void }

/** Compact themed color picker: saturation/brightness field, hue slider and hex entry. Nothing applies until Use color. */
export default function ColorPicker({ value, label, onPick, onClose }: Props) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? { h: 0, s: 1, v: 1 });
  const hex = hsvToHex(hsv);
  const [text, setText] = useState(hex);
  const root = useRef<HTMLDivElement>(null); const field = useRef<HTMLDivElement>(null);
  // Field and slider changes rewrite the hex text; a hex the user is typing is left exactly as typed.
  const typed = useRef(false);
  useEffect(() => { if (typed.current) typed.current = false; else setText(hex); }, [hex]);
  useEffect(() => {
    field.current?.focus();
    const outside = (e: globalThis.PointerEvent) => { if (!root.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('.color-add')) onClose(); };
    window.addEventListener('pointerdown', outside, true);
    return () => window.removeEventListener('pointerdown', outside, true);
  }, [onClose]);

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHsv(c => ({ ...c, s: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), v: Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) }));
  };
  const nudge = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const d = moves[e.key];
    if (!d) return;
    e.preventDefault();
    setHsv(c => ({ ...c, s: Math.max(0, Math.min(1, c.s + d[0])), v: Math.max(0, Math.min(1, c.v + d[1])) }));
  };
  // A typed hex is used exactly; otherwise the color from the field and hue slider.
  const commit = () => onPick(normalizeHex(text) ?? hex);

  return (
    <div className="color-popover" ref={root} role="dialog" aria-label={label}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
      <div ref={field} className="color-field" tabIndex={0} role="slider" aria-label="Saturation and brightness"
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`} aria-valuenow={Math.round(hsv.s * 100)}
        style={{ '--hue': `hsl(${hsv.h} 100% 50%)` } as CSSProperties}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
        onPointerMove={e => { if (e.buttons & 1) fromPointer(e); }} onKeyDown={nudge}>
        <span className="color-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <input className="hue-slider" type="range" min={0} max={359} value={Math.round(hsv.h)} aria-label="Hue"
        style={{ '--thumb': `hsl(${hsv.h} 100% 50%)` } as CSSProperties} onChange={e => setHsv(c => ({ ...c, h: Number(e.target.value) }))} />
      <div className="color-row">
        <span className="color-preview" style={{ background: hex }} aria-hidden="true" />
        <input className="hex-input" value={text} maxLength={7} spellCheck={false} autoComplete="off" aria-label="Hex color"
          onChange={e => { setText(e.target.value); const parsed = hexToHsv(e.target.value); if (parsed) { typed.current = hsvToHex(parsed) !== hex; setHsv(parsed); } }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
        <button type="button" className="button primary small-button" onClick={commit}>Use color</button>
      </div>
    </div>
  );
}
