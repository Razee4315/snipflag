import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';

/** Native modal dialog: focus containment and Escape come from the platform; focus is restored on close. */
export default function Dialog({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { dialog?.close(); previous?.focus?.(); };
  }, []);
  return (
    <dialog ref={ref} className={wide ? 'dialog wide' : 'dialog'} aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); onClose(); }}
      // The webview closes a dialog itself when Escape is pressed again right after a declined close; follow it.
      // A dialog that is open again by the time the event arrives was only re-shown, not dismissed.
      onClose={() => { if (!ref.current?.open) onClose(); }}
      onMouseDown={e => { if (e.target === ref.current) onClose(); }}>
      <div className="dialog-inner">
        <header className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
