import { flushSync } from 'react-dom';

/**
 * Applies a layout-changing update inside a view transition, so panels and tiles glide to their new place instead
 * of jumping. Falls back to a plain update when animations are off or the webview has no view transitions.
 */
export function smooth(update: () => void) {
  const page = document as unknown as { startViewTransition?: (callback: () => void) => unknown };
  const still = document.documentElement.dataset.motion === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still || typeof page.startViewTransition !== 'function') { update(); return; }
  page.startViewTransition(() => flushSync(update));
}
