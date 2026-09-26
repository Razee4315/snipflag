# Screens and flows

## Main workspace

Full-height screenshot stage + issue composer → small image filmstrip. Launch and every capture open the full workspace size (no expand/compact control). A draggable utility bar above the composer holds the Snipflag mark, History, Settings and window controls; it is in layout flow, so the scrolling composer never slides under it. Save state is announced to assistive technology; only save failures are shown visually. New session is a labeled button in the composer footer next to Create issue. Save-and-hide flushes the draft before returning to the tray. Keep the screenshot dominant. No repeated title or slogans. Canvas toolbar: select, arrow, rectangle, ellipse, pen, highlighter, text, numbered step, pixelate, color (marker inks for the highlighter) with a custom color picker, size shown as circles, undo/redo. Pen and highlighter replace the crosshair with a circle showing the real brush size. Image controls: fit/zoom, copy, save.

Empty state: the floating brand mark in a marching selection frame, “Capture a screenshot”, a one-line shortcut/drop hint, primary Capture screen and secondary Add images and Paste. The empty area also drags the window. No fake sample screenshot in the working app.

Filmstrip: stable image-alias numbered thumbnails, captions, selected outline, add button. Each tile has accessible move earlier/later and remove actions. The filmstrip exposes its image count and one-issue grouping to assistive technology. Selection does not mutate any other image.

Issue panel: workspace chip (initial, workspace, account, refresh), title, description, team, optional reproduction-steps scaffold and collapsed project/assignee/labels/priority, primary “Create issue”. Keep the panel disabled only when genuinely unavailable and explain why. No redirect to Linear to fill the issue form.

## Repeated capture

Save session → hide main window → capture monitor frames → region overlay → crop → close all overlays → append image to current session → restore editor. Cancel restores the same session untouched. Capture shortcut appends to the active draft; submitted sessions start a fresh draft before new capture.

## Submission

Validate form → save snapshot → flatten ordered images → show upload progress → persist upload results → create/reconcile stable issue ID → persist success → show identifier + Open issue + Copy link + New session. Keep failed state and entered text. Never automatically retry ambiguous issue mutations with a new ID.

## Other surfaces

- Settings: six sections (Connection, Capture, Appearance, Privacy, Shortcuts, About) in a fixed-size dialog with a sliding tab indicator. Appearance also holds Play sound effects (with Preview sound) and Interface animations. Preferences remain in one draft while navigating; Save settings persists them. Connection retains OAuth setup; Privacy explains the upload boundary and pixelation alongside retention/delete controls. Appearance chooses the theme with three clickable preview cards (Match system, Light, Dark); Shortcuts provides a keyboard reference.
- History: draft/submitted state, image count, timestamp, resume/open/delete.
- First connection: explanation → browser OAuth → local callback → workspace identity. Provide useful setup guidance if no OAuth client ID is configured.

## Keyboard

Default global: Ctrl/Cmd+Shift+2 (check registration failure). Editor: V select, A arrow, R rectangle, E ellipse, P pen, H highlighter, T text, N numbered step, B pixelate. Ctrl/Cmd+Z undo; Shift+Ctrl/Cmd+Z redo; Delete removes selected annotation; Ctrl/Cmd+Enter submits. Hold Shift while drawing to snap arrows/pen segments to 15-degree increments, or constrain rectangles to squares. Pen snapping anchors at the last freehand point when Shift is pressed; releasing Shift resumes freehand. Ignore tool shortcuts in text inputs. Escape dismisses current selection/dialog/capture without deleting a draft.

## Desktop behavior

The webview must feel native: no browser context menu outside text fields (fields keep cut/copy/paste), no browser shortcuts (downloads, print, find, reload, history, devtools, page zoom, tab/window commands, F-keys), no mouse back/forward or middle-click autoscroll, no file-drop navigation, no image dragging, and no selectable interface chrome. Editing keys in fields and the app's own shortcuts keep working. Tooltips appear only on icon-only controls.

## Accessibility

Visible focus, native button semantics, labels for icon controls, keyboard-accessible image ordering, status live regions, reduced motion, no color-only success/error, modal focus containment/restoration. At narrow widths, issue panel moves below the canvas instead of clipping inputs.

Description: type @ to filter attached images by alias or caption. Up/Down navigates, Enter/Tab inserts, Escape dismisses. References keep their UUID identity through reordering and reload; missing images show an error. Submitted references become clickable Linear asset links with full images still in filmstrip order below.
