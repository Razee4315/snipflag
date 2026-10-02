import { flushSync } from 'react-dom';

/** Animations are off in Settings or the system asks for reduced motion. */
export const still = () => document.documentElement.dataset.motion === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Runs `step` with an eased value from `from` to `to` over `ms`. Returns a function that stops it. */
export function ease(from: number, to: number, ms: number, step: (value: number) => void) {
  if (still() || from === to) { step(to); return () => undefined; }
  let frame = 0; const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    step(t === 1 ? to : from + (to - from) * (1 - (1 - t) ** 3));
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/**
 * Applies a layout-changing update inside a view transition, so panels and tiles glide to their new place instead
 * of jumping. Falls back to a plain update when animations are off or the webview has no view transitions.
 */
export function smooth(update: () => void) {
  const page = document as unknown as { startViewTransition?: (callback: () => void) => unknown };
  if (still() || typeof page.startViewTransition !== 'function') { update(); return; }
  page.startViewTransition(() => flushSync(update));
}
