import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { addToast, type Toast, type ToastAction } from '../toasts';

export type Notify = (text: string, kind?: 'error' | 'info', action?: ToastAction, undoKey?: string) => void;

/** The messages at the bottom of the editor: `notify` adds one, `dismiss` removes it. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastId = useRef(0);
  const notify = useCallback<Notify>((text, kind = 'info', action, undoKey) => {
    const id = ++lastId.current;
    setToasts(list => addToast(list, { id, kind, text, action, undoKey }));
  }, []);
  const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), []);
  // An offer to undo leaves once Undo (or anything else) has already taken that change back.
  const structure = useStore(s => s.structure);
  useEffect(() => {
    const offered = (t: Toast) => !t.undoKey || structure.some(change => change.key === t.undoKey);
    setToasts(list => list.every(offered) ? list : list.filter(offered));
  }, [structure]);
  return { toasts, notify, dismiss };
}
