/** A failed or busy quit never acknowledges permission to exit. */
export async function saveBeforeQuit(actions: {
  isBusy: () => boolean; commit: () => void; lock: (value: boolean) => void;
  save: () => Promise<void>; finish: (saved: boolean) => Promise<void>;
}) {
  if (actions.isBusy()) { await actions.finish(false); throw new Error('Wait for the current operation to finish before quitting.'); }
  actions.commit(); actions.lock(true);
  try { await actions.save(); await actions.finish(true); }
  catch (error) { await actions.finish(false).catch(() => undefined); actions.lock(false); throw error; }
  // Keep mutations frozen after acknowledgment until the native process actually exits.
}
