import { useEffect, useState } from 'react';
import { toastLife, type Toast } from '../toasts';
import { Icon } from './icons';

interface Props { toasts: Toast[]; onDismiss: (id: number) => void }

/** One toast. Its timer waits while the pointer or the keyboard is on it, so an Undo is never lost mid-reach. */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toastLife(toast));
    return () => window.clearTimeout(timer);
  }, [held, toast, onDismiss]);
  return (
    <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      <Icon name={toast.kind === 'error' ? 'alert' : 'check'} size={16} />
      <span>{toast.text}</span>
      {toast.action && <button type="button" className="toast-action" onClick={() => { toast.action?.run(); onDismiss(toast.id); }}>{toast.action.label}</button>}
      <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}><Icon name="close" size={14} /></button>
    </div>
  );
}

/** The stack of current messages, newest at the bottom. */
export default function Toasts({ toasts, onDismiss }: Props) {
  return <div className="toast-region">{toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />)}</div>;
}
