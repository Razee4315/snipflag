# Screens and flows

## Main workspace

Native title bar → compact app header → screenshot canvas + right issue panel → bottom image filmstrip. Keep the screenshot dominant. Header: session name, local save state, New session, History, Settings. Canvas toolbar: select, arrow, rectangle, pen, text, pixelate, redact, color, thickness, undo/redo. Image controls: fit/zoom, copy, save.

Empty state: “A clearer issue starts here.” Primary Capture screen; secondary Add images; paste hint. No fake sample screenshot in the working app.

Filmstrip: numbered thumbnails, captions, selected outline, add button. Each tile has accessible move earlier/later and remove actions. Header count “3 images · one issue”. Selection does not mutate any other image.

Issue panel: connection/workspace, title, description, team, collapsed optional project/assignee/labels/priority, attachment count, primary “Create issue”. Keep the panel disabled only when genuinely unavailable and explain why. No redirect to Linear to fill the issue form.

## Repeated capture

Save session → hide main window → capture monitor frames → region overlay → crop → close all overlays → append image to current session → restore editor. Cancel restores the same session untouched. Capture shortcut appends to the active draft; submitted sessions start a fresh draft before new capture.

## Submission

Validate form → save snapshot → flatten ordered images → show upload progress → persist upload results → create/reconcile stable issue ID → persist success → show identifier + Open issue + Copy link + New session. Keep failed state and entered text. Never automatically retry ambiguous issue mutations with a new ID.

## Other surfaces

- Settings: connection/OAuth client ID, capture shortcut, theme, history retention, delete local history, optional metadata.
- History: draft/submitted state, image count, timestamp, resume/open/delete.
- First connection: explanation → browser OAuth → local callback → workspace identity. Provide useful setup guidance if no OAuth client ID is configured.

## Keyboard

Default global: Ctrl/Cmd+Shift+2 (check registration failure). Editor: V select, A arrow, R rectangle, P pen, T text, B pixelate, X redact. Ctrl/Cmd+Z undo; Shift+Ctrl/Cmd+Z redo; Delete removes selected annotation; Ctrl/Cmd+Enter submits. Ignore tool shortcuts in text inputs. Escape dismisses current selection/dialog/capture without deleting a draft.

## Accessibility

Visible focus, native button semantics, labels for icon controls, keyboard-accessible image ordering, status live regions, reduced motion, no color-only success/error, modal focus containment/restoration. At narrow widths, issue panel moves below the canvas instead of clipping inputs.
