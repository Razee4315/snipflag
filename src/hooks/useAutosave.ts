import { useCallback, useEffect, useRef } from 'react';
import { errorText, saveSession } from '../native';
import { thumbnail } from '../render';
import { useStore } from '../store';

/**
 * Durable drafts: a new screenshot is saved at once and every other change shortly after it happens. `flush` saves
 * now (before capture, network work or leaving the session); `settle` cancels the pending save and waits for the
 * ones already running.
 */
export function useAutosave(ready: boolean) {
  const session = useStore(s => s.session);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<number | undefined>(undefined);
  const attempts = useRef(new Set<string>());

  const saveNow = useCallback(() => {
    const run = async () => {
      const { session: s, persisted, durable, submissionLocked, setSaveState, markPersisted } = useStore.getState();
      if (submissionLocked) {
        // A failed status read must not turn a failed draft save into permission to exit.
        if (useStore.getState().saveState === 'error') throw new Error(useStore.getState().saveError || 'The draft has not been saved.');
        setSaveState('saved'); return; // The durable attempted revision is immutable until reconciliation.
      }
      if (!durable && !attempts.current.has(s.id) && !s.images.length && !s.title.trim() && !s.description.trim()) { setSaveState('idle'); return; }
      attempts.current.add(s.id); // A failed save can have committed metadata before cleanup failed.
      setSaveState('saving');
      try {
        // History shows this protected thumbnail; a failed render only leaves the entry without a picture.
        const preview = s.images[0] ? await thumbnail(s.images[0]).catch(() => '') : '';
        await saveSession({ ...s, preview }, persisted); markPersisted(s.id, s.images.map(i => i.id));
        if (useStore.getState().session.id === s.id) setSaveState(useStore.getState().session === s ? 'saved' : 'saving');
      } catch (e) { if (useStore.getState().session.id === s.id) setSaveState('error', errorText(e)); throw e; }
    };
    const next = chain.current.then(run, run); chain.current = next.catch(() => undefined); return next;
  }, []);
  const flush = useCallback(() => { window.clearTimeout(timer.current); return saveNow(); }, [saveNow]);
  const settle = useCallback(() => { window.clearTimeout(timer.current); return chain.current; }, []);
  useEffect(() => {
    if (!ready) return;
    // Pending edits are never reported as saved: the status only returns to "saved" after this change is durable.
    const { session: s, durable, persisted, saveState: current, setSaveState } = useStore.getState();
    if (current === 'saved' && (durable || s.images.length || s.title.trim() || s.description.trim())) setSaveState('saving');
    window.clearTimeout(timer.current);
    // A new screenshot is saved at once: its pixels exist nowhere else. Typing and drawing wait for a short pause,
    // and so do retries after a failed save.
    const newPixels = current !== 'error' && s.images.some(i => !persisted.includes(i.id));
    timer.current = window.setTimeout(() => { saveNow().catch(() => undefined); }, newPixels ? 0 : 400);
    return () => window.clearTimeout(timer.current);
  }, [session, ready, saveNow]);
  return { flush, settle };
}
