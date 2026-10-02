/** A short message at the bottom of the editor; `action` offers one follow-up such as Undo while it is on screen. */
export interface ToastAction { label: string; run: () => void }
export interface Toast {
  id: number; kind: 'error' | 'info'; text: string; action?: ToastAction;
  /** The undoable change this toast offers to take back. The toast leaves once that change is no longer undoable. */
  undoKey?: string;
}

export const MAX_TOASTS = 3;
/** How long a toast stays without the pointer on it: errors longest, then offers to undo, then plain confirmations. */
export const toastLife = (toast: Pick<Toast, 'kind' | 'action'>) => toast.kind === 'error' ? 12000 : toast.action ? 8000 : 3500;

/**
 * Adds a toast to the stack, newest last. A message already on screen is replaced instead of repeated. When the
 * stack is full the oldest plain message leaves first, so an offer to undo is not pushed out by confirmations.
 */
export function addToast(list: Toast[], toast: Toast): Toast[] {
  const next = [...list.filter(t => t.text !== toast.text), toast];
  while (next.length > MAX_TOASTS) {
    const plain = next.findIndex((t, i) => !t.action && i < next.length - 1);
    next.splice(plain >= 0 ? plain : 0, 1);
  }
  return next;
}
