/**
 * Makes the webview behave like a native desktop app instead of a browser tab: no browser context menu, downloads
 * panel, print, find bar, reload, history navigation, devtools shortcuts, autoscroll, or file-drop navigation.
 * Text fields keep their normal editing keys and cut/copy/paste menu.
 */
/** Whether the keyboard is busy in a form control, so single-key and editing shortcuts must leave it alone. */
export const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
/** Narrower than `isTyping`: only controls that hold text, which keep their editing keys and context menu. */
const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(t.type)));

/** Keys that still do something useful with Ctrl/Cmd held. Everything else is a browser command. */
const EDITING = new Set(['c', 'v', 'x', 'z', 'y', 'a', 'enter', 'backspace', 'delete', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'home', 'end']);
const NAVIGATION = new Set(['BrowserBack', 'BrowserForward', 'BrowserRefresh', 'BrowserSearch', 'BrowserFavorites', 'BrowserHome', 'BrowserStop']);

/** Whether a key press would trigger a browser feature rather than the app. Exported for tests. */
export function isBrowserShortcut(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, typing: boolean) {
  const key = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
  if (NAVIGATION.has(e.key)) return true;
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(key)) return true; // F5 reload, F3 find, F7 caret browsing, F11, F12 devtools…
  if (e.altKey && !mod && ['arrowleft', 'arrowright', 'home'].includes(key)) return true; // history navigation
  if (!mod) return false;
  if (e.shiftKey) return !(key === 'z' || (typing && (key === 'v' || key.startsWith('arrow') || key === 'home' || key === 'end')));
  if (key === 'a') return !typing; // select-all of the whole interface
  return !EDITING.has(key);
}

export function installDesktopGuards() {
  window.addEventListener('keydown', e => { if (isBrowserShortcut(e, editable(e.target))) e.preventDefault(); }, { capture: true });
  window.addEventListener('contextmenu', e => { if (!editable(e.target)) e.preventDefault(); }, { capture: true });
  // Middle-click autoscroll and mouse back/forward buttons.
  window.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); }, { capture: true });
  window.addEventListener('mouseup', e => { if (e.button === 3 || e.button === 4) e.preventDefault(); }, { capture: true });
  window.addEventListener('auxclick', e => e.preventDefault(), { capture: true });
  // Page zoom (Ctrl+wheel / pinch) never applies to the interface; the canvas handles its own zoom.
  window.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
  // Dropping a file anywhere the app does not handle would navigate the webview to it.
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());
  // Interface images and links are not draggable like web content.
  window.addEventListener('dragstart', e => { if (!editable(e.target)) e.preventDefault(); });
}
