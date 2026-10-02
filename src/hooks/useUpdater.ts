import { useCallback, useEffect, useState } from 'react';
import { checkUpdate, errorText, installUpdate, on, type AvailableUpdate } from '../native';
import type { Notify } from './useToasts';

interface Options {
  /** Background checks run only once the editor is ready, this build has updates, and the user left them on. */
  background: boolean;
  /** The save handshake shared with Quit; `finish` runs once the draft is saved. */
  saveThenExit: (finish: (saved: boolean) => Promise<void>) => Promise<void>;
  notify: Notify;
}

/** Signed updates: checked quietly in the background, installed only when the user asks. */
export function useUpdater({ background, saveThenExit, notify }: Options) {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  /** What the update chip says while an install is running; null otherwise. */
  const [updating, setUpdating] = useState<string | null>(null);

  const findUpdate = useCallback(async () => { const found = await checkUpdate(); setUpdate(found); return found; }, []);
  useEffect(() => {
    if (!background) return;
    const run = () => { void findUpdate().catch(() => undefined); };
    const first = window.setTimeout(run, 8000); const every = window.setInterval(run, 6 * 60 * 60 * 1000);
    return () => { window.clearTimeout(first); window.clearInterval(every); };
  }, [background, findUpdate]);
  useEffect(() => {
    const listener = on<{ percent: number | null }>('update-progress', p => setUpdating(p.percent === null ? 'Downloading…' : p.percent < 100 ? `Downloading ${p.percent}%` : 'Installing…'));
    return () => { void listener.then(unlisten => unlisten()); };
  }, []);
  const applyUpdate = useCallback(async () => {
    setUpdating('Saving your draft…');
    try {
      // Same guarantees as Quit: active edits are committed and the draft is saved before the app restarts.
      await saveThenExit(async saved => { if (saved) await installUpdate(); });
    } catch (e) {
      notify(`Update not installed: ${errorText(e)}`, 'error');
      // Checking again makes the update installable once more, so the chip stays for another try.
      void findUpdate().catch(() => setUpdate(null));
    } finally { setUpdating(null); }
  }, [saveThenExit, notify, findUpdate]);
  return { update, updating, findUpdate, applyUpdate };
}
