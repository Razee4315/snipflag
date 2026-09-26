import Konva from 'konva';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Image as KonvaImage, Layer, Shape, Stage, Transformer } from 'react-konva';
import { bounds, isMeaningful, snapAngle, transform, translate, type Point } from '../geometry';
import { clampRect, isFreehand, isOutline, nextStep, normalizeRect, stepSize, type Annotation, type CaptureImage } from '../model';
import { drawAnnotation, FONT_FAMILY, LINE_HEIGHT, paintOrder, pixelate } from '../render';
import { isLocked, useStore } from '../store';

export type Zoom = number | 'fit';
interface Props { image: CaptureImage; zoom: Zoom; onZoom: (zoom: Zoom) => void; onScale: (scale: number) => void }
interface TextEdit { id: string | null; x: number; y: number; value: string; fontSize: number; color: string }

function useImageElement(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let live = true; const el = new Image();
    el.onload = () => { if (live) setImg(el); }; el.src = src;
    return () => { live = false; };
  }, [src]);
  return img && img.src === src ? img : null;
}
function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 800, height: 600 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update(); const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
let measureCtx: CanvasRenderingContext2D | null = null;
export function measureText(text: string, fontSize: number) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  const lines = text.split('\n');
  if (!measureCtx) return { width: fontSize * 8, height: lines.length * fontSize * LINE_HEIGHT };
  measureCtx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
  return { width: Math.max(4, ...lines.map(l => measureCtx!.measureText(l).width)), height: lines.length * fontSize * LINE_HEIGHT };
}
function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export default function Editor({ image, zoom, onZoom, onScale }: Props) {
  const tool = useStore(s => s.tool); const color = useStore(s => s.color); const stroke = useStore(s => s.stroke); const fontSize = useStore(s => s.fontSize);
  const highlightColor = useStore(s => s.highlightColor); const highlightSize = useStore(s => s.highlightSize);
  const brush = useRef<HTMLDivElement>(null);
  const selection = useStore(s => s.selection); const locked = useStore(isLocked);
  const { edit, setSelection, removeAnnotation } = useStore.getState();
  const source = useImageElement(image.dataUrl);
  const wrap = useRef<HTMLDivElement>(null); const size = useSize(wrap);
  const layer = useRef<Konva.Layer>(null); const transformer = useRef<Konva.Transformer>(null);
  const [draft, setDraftState] = useState<Annotation | null>(null);
  const draftRef = useRef<Annotation | null>(null);
  const setDraft = (value: Annotation | null) => { draftRef.current = value; setDraftState(value); };
  const penSegment = useRef<{ origin: Point; prefix: number[] } | null>(null);
  const updateDrawing = useRef<(shift: boolean, samples?: Point[]) => void>(() => undefined);
  const [textEdit, setTextEditState] = useState<TextEdit | null>(null);
  // Mirrors textEdit so blur and pointer handlers commit the same edit at most once.
  const textRef = useRef<TextEdit | null>(null);
  const setTextEdit = (t: TextEdit | null) => { textRef.current = t; setTextEditState(t); };
  const start = useRef<{ x: number; y: number } | null>(null);
  const textStart = useRef<{ x: number; y: number } | null>(null);
  const pixelCache = useRef(new Map<string, HTMLCanvasElement>());

  const fit = Math.min((size.width - 48) / image.width, (size.height - 48) / image.height, 1);
  const scale = zoom === 'fit' ? Math.max(0.02, fit) : zoom;
  useEffect(() => onScale(scale), [scale, onScale]);
  useEffect(() => { setDraft(null); setTextEdit(null); pixelCache.current.clear(); }, [image.id]);

  const ordered = useMemo(() => paintOrder(image.annotations), [image.annotations]);
  const selected = image.annotations.find(a => a.id === selection);

  useEffect(() => {
    const tr = transformer.current; if (!tr) return;
    const node = selection && tool === 'select' && !locked ? layer.current?.findOne((n: Konva.Node) => n.id() === selection) : undefined;
    tr.nodes(node ? [node] : []); tr.getLayer()?.batchDraw();
  }, [selection, tool, locked, image.annotations]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || textEdit) return;
      if (e.key === 'Shift') updateDrawing.current(true);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection && !locked) { e.preventDefault(); removeAnnotation(selection); }
      if (e.key === 'Escape') { setDraft(null); start.current = null; setSelection(null); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') updateDrawing.current(false); };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [selection, locked, textEdit, removeAnnotation, setSelection]);

  const pointer = () => {
    const p = layer.current?.getStage()?.getPointerPosition(); if (!p) return null;
    return { x: Math.max(0, Math.min(image.width, p.x / scale)), y: Math.max(0, Math.min(image.height, p.y / scale)) };
  };
  const base = (): Omit<Annotation, 'kind'> => ({ id: crypto.randomUUID(), x: 0, y: 0, width: 0, height: 0, points: [], color, stroke, text: '', fontSize });

  const commitText = () => {
    const t = textRef.current; if (!t) return;
    setTextEdit(null);
    const text = t.value.replace(/\s+$/, '');
    const existing = t.id ? image.annotations.find(a => a.id === t.id) : undefined;
    if (!text.trim()) { if (existing) removeAnnotation(existing.id); return; }
    const m = measureText(text, t.fontSize);
    if (existing) edit(image.annotations.map(a => a.id === existing.id ? { ...a, text, width: m.width, height: m.height } : a));
    else edit([...image.annotations, { ...base(), kind: 'text', x: t.x, y: t.y, text, fontSize: t.fontSize, color: t.color, width: m.width, height: m.height }]);
  };

  const onDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (locked || e.evt.button !== 0) return;
    const p = pointer(); if (!p) return;
    if (tool === 'select') {
      const target = e.target;
      if (target.getParent()?.getClassName() === 'Transformer') return;
      const id = target.id();
      setSelection(id && target !== target.getStage() && image.annotations.some(a => a.id === id) ? id : null);
      return;
    }
    setSelection(null);
    if (tool === 'text') {
      // Open the editor on pointer up: the browser moves focus on pointer down, which would blur it at once.
      if (textRef.current) commitText(); else textStart.current = p;
      return;
    }
    if (tool === 'step') {
      // A click places the next numbered badge centered on the pointer.
      const side = stepSize(stroke);
      const x = Math.max(0, Math.min(image.width - side, p.x - side / 2)); const y = Math.max(0, Math.min(image.height - side, p.y - side / 2));
      edit([...image.annotations, { ...base(), kind: 'step', x, y, width: side, height: side, text: String(nextStep(image.annotations)) }]);
      return;
    }
    start.current = p;
    penSegment.current = null;
    setDraft({
      ...base(), kind: tool, x: p.x, y: p.y, points: isFreehand(tool) ? [0, 0] : tool === 'arrow' ? [0, 0, 0, 0] : [],
      ...(tool === 'highlight' ? { color: highlightColor, stroke: highlightSize } : {}),
    });
  };
  updateDrawing.current = (shift: boolean, samples?: Point[]) => {
    const s = start.current; const draft = draftRef.current; if (!s || !draft) return;
    const p = pointer(); if (!p) return;
    if (isFreehand(draft.kind)) {
      const n = draft.points.length; const lx = draft.points[n - 2], ly = draft.points[n - 1];
      if (shift) {
        penSegment.current ??= { origin: { x: s.x + lx, y: s.y + ly }, prefix: [...draft.points] };
        const segment = penSegment.current;
        const end = snapAngle(segment.origin, p, image);
        setDraft({ ...draft, points: [...segment.prefix, end.x - s.x, end.y - s.y] });
        return;
      }
      penSegment.current = null;
      // Every coalesced pointer sample between frames keeps fast strokes smooth and natural.
      const points = [...draft.points]; let x = lx, y = ly;
      for (const q of samples?.length ? samples : [p]) {
        if (Math.hypot(q.x - s.x - x, q.y - s.y - y) * scale < 1.5) continue;
        x = q.x - s.x; y = q.y - s.y; points.push(x, y);
      }
      if (points.length !== draft.points.length) setDraft({ ...draft, points });
    } else if (draft.kind === 'arrow') {
      const end = shift ? snapAngle(s, p, image) : p;
      setDraft({ ...draft, points: [0, 0, end.x - s.x, end.y - s.y] });
    } else {
      let end = p;
      if (shift && isOutline(draft.kind)) {
        const side = Math.min(Math.max(Math.abs(p.x - s.x), Math.abs(p.y - s.y)), p.x < s.x ? s.x : image.width - s.x, p.y < s.y ? s.y : image.height - s.y);
        end = { x: s.x + (p.x < s.x ? -side : side), y: s.y + (p.y < s.y ? -side : side) };
      }
      const r = normalizeRect(s.x, s.y, end.x, end.y);
      setDraft({ ...draft, ...(isOutline(draft.kind) ? r : clampRect(r, image.width, image.height)) });
    }
  };
  const onUp = () => {
    const t = textStart.current; textStart.current = null;
    if (t && tool === 'text') { setTextEdit({ id: null, x: t.x, y: t.y - fontSize * LINE_HEIGHT / 2, value: '', fontSize, color }); return; }
    const d = draftRef.current; start.current = null; penSegment.current = null; setDraft(null);
    if (!d || !isMeaningful(d)) return;
    edit([...image.annotations, d]);
    if (d.kind === 'redact' || d.kind === 'pixelate' || isOutline(d.kind)) setSelection(null);
  };
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (!e.evt.ctrlKey && !e.evt.metaKey) return;
    e.evt.preventDefault();
    onZoom(Math.max(0.1, Math.min(8, scale * (e.evt.deltaY < 0 ? 1.15 : 1 / 1.15))));
  };

  const renderShape = (a: Annotation, interactive: boolean) => {
    if (textEdit?.id === a.id) return null;
    const box = bounds(a);
    return (
      <Shape key={a.id} id={a.id} x={box.x} y={box.y} width={Math.max(1, box.width)} height={Math.max(1, box.height)}
        fill="#000" listening={interactive} draggable={interactive && tool === 'select' && !locked}
        sceneFunc={(ctx) => {
          const native = ctx._context; native.save(); native.translate(-box.x, -box.y);
          if (a.kind === 'pixelate' && source) {
            const key = `${a.id}:${a.x}:${a.y}:${a.width}:${a.height}`;
            let cached = pixelCache.current.get(key);
            if (!cached) {
              if (pixelCache.current.size > 40) pixelCache.current.clear();
              cached = pixelate(source, a); pixelCache.current.set(key, cached);
            }
            native.drawImage(cached, Math.round(a.x), Math.round(a.y));
          } else if (source) drawAnnotation(native, source, a);
          native.restore();
        }}
        hitFunc={(ctx, shape) => { ctx.beginPath(); ctx.rect(0, 0, shape.width(), shape.height()); ctx.closePath(); ctx.fillStrokeShape(shape); }}
        onDblClick={() => { if (a.kind === 'text' && tool === 'select' && !locked) setTextEdit({ id: a.id, x: a.x, y: a.y, value: a.text, fontSize: a.fontSize, color: a.color }); }}
        onDragStart={() => setSelection(a.id)}
        onDragEnd={(e) => { const n = e.target; edit(image.annotations.map(x => x.id === a.id ? translate(x, n.x() - box.x, n.y() - box.y) : x)); }}
        onTransformEnd={(e) => {
          const n = e.target; const sx = n.scaleX(), sy = n.scaleY(); n.scale({ x: 1, y: 1 });
          const next = transform(a, { x: n.x(), y: n.y(), width: box.width * sx, height: box.height * sy }, sx, sy);
          edit(image.annotations.map(x => x.id === a.id ? next : x));
        }}
      />
    );
  };

  const stageWidth = Math.max(1, Math.round(image.width * scale)); const stageHeight = Math.max(1, Math.round(image.height * scale));
  const brushTool = !locked && isFreehand(tool);
  const brushSize = Math.max(6, (tool === 'highlight' ? highlightSize : stroke) * scale);
  const cursor = locked ? 'default' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : brushTool ? 'none' : 'crosshair';
  /** Pointer samples in image pixels, including the coalesced ones the browser batched since the last event. */
  const samples = (e: PointerEvent): Point[] => {
    const rect = layer.current?.getStage()?.container().getBoundingClientRect(); if (!rect) return [];
    const events = e.getCoalescedEvents?.() ?? [];
    return (events.length ? events : [e]).map(ev => ({
      x: Math.max(0, Math.min(image.width, (ev.clientX - rect.left) / scale)), y: Math.max(0, Math.min(image.height, (ev.clientY - rect.top) / scale)),
    }));
  };
  const moveBrush = (e: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const el = brush.current; if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.style.transform = `translate(${e.clientX - rect.left - brushSize / 2}px, ${e.clientY - rect.top - brushSize / 2}px)`;
    el.style.opacity = '1';
  };
  const textStyle: CSSProperties | undefined = textEdit ? {
    left: textEdit.x * scale, top: textEdit.y * scale, fontSize: textEdit.fontSize * scale, color: textEdit.color, fontFamily: FONT_FAMILY, lineHeight: LINE_HEIGHT,
  } : undefined;

  return (
    <div className="canvas-scroll" ref={wrap}>
      <div key={image.id} className="canvas-frame" style={{ width: stageWidth, height: stageHeight, cursor }} data-testid="canvas"
        onPointerMove={brushTool ? moveBrush : undefined} onPointerLeave={() => { if (brush.current) brush.current.style.opacity = '0'; }}>
        <Stage width={stageWidth} height={stageHeight} scaleX={scale} scaleY={scale}
          onPointerDown={onDown} onPointerMove={e => updateDrawing.current(e.evt.shiftKey, samples(e.evt))} onPointerUp={onUp} onPointerLeave={() => { textStart.current = null; if (draftRef.current) onUp(); }} onWheel={onWheel}>
          <Layer ref={layer}>
            {source && <KonvaImage image={source} width={image.width} height={image.height} listening={false} />}
            {ordered.map(a => renderShape(a, true))}
            {draft && renderShape(draft, false)}
            <Transformer ref={transformer} rotateEnabled={false} flipEnabled={false} ignoreStroke keepRatio={selected?.kind === 'text' || selected?.kind === 'step'}
              enabledAnchors={selected?.kind === 'text' || selected?.kind === 'step' ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'] : undefined}
              anchorSize={9} anchorCornerRadius={3} borderStroke="#14B8A6" anchorStroke="#0F766E" anchorFill="#FFFFFF"
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4 ? oldBox : newBox)} />
          </Layer>
        </Stage>
        {brushTool && <div ref={brush} className={tool === 'highlight' ? 'brush-cursor highlight' : 'brush-cursor'} aria-hidden="true"
          style={{ width: brushSize, height: brushSize, '--brush': tool === 'highlight' ? highlightColor : color } as CSSProperties} />}
        {textEdit && (
          <textarea className="text-editor" style={textStyle} autoFocus aria-label="Annotation text" value={textEdit.value} rows={Math.max(1, textEdit.value.split('\n').length)}
            onChange={e => setTextEdit({ ...textEdit, value: e.target.value })}
            onBlur={commitText}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Escape') { e.preventDefault(); setTextEdit(null); }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
            }} />
        )}
      </div>
    </div>
  );
}
