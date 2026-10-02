import type { KeyboardEvent } from 'react';

/**
 * Keyboard movement inside a radio group or tab list: arrow keys go to the neighbor and choose it, Home and End
 * jump to the ends. With `rovingTabIndex` on the items, the whole group is one Tab stop.
 */
export function rovingKeys(e: KeyboardEvent<HTMLElement>) {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number | undefined>)[e.key];
  if (step === undefined && e.key !== 'Home' && e.key !== 'End') return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"], [role="tab"]')].filter(item => !item.hasAttribute('disabled'));
  const at = items.findIndex(item => item === document.activeElement);
  if (at < 0) return;
  // The arrows belong to this group: they must not also nudge a selected mark or scroll.
  e.preventDefault(); e.stopPropagation();
  const next = items[e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (at + (step ?? 0) + items.length) % items.length];
  next.focus(); next.click();
}
/** The chosen item is the group's Tab stop; when nothing is chosen, the first item is. */
export const rovingTabIndex = (chosen: boolean, index: number, anyChosen: boolean) => chosen || (!anyChosen && index === 0) ? 0 : -1;
