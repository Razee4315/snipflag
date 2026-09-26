# Screens and flows

## Main workspace

Top-aligned screenshot canvas + nearby issue composer → small image filmstrip. The draggable utility controls occupy the composer corner, leaving no empty strip above the screenshot. The first image sizes the editor to a bounded compact window; expand/compact is explicit. Save-and-hide flushes the draft before returning to the tray. Keep the screenshot dominant. Composer-corner utilities: accessible save-state indicator, New session, History, Settings, and custom window controls. No repeated title, logo or slogans. Canvas toolbar: select, arrow, rectangle, pen, text, pixelate, redact, color, thickness, undo/redo. Image controls: fit/zoom, copy, save.

Empty state: “Capture a screenshot”. Primary Capture screen; secondary Add images and Paste. No fake sample screenshot in the working app.

Filmstrip: stable image-alias numbered thumbnails, captions, selected outline, add button. Each tile has accessible move earlier/later and remove actions. The filmstrip exposes its image count and one-issue grouping to assistive technology. Selection does not mutate any other image.

Issue panel: connection/workspace, title, description, team, optional reproduction-steps scaffold and collapsed project/assignee/labels/priority, primary “Create issue”. Keep the panel disabled only when genuinely unavailable and explain why. No redirect to Linear to fill the issue form.

## Repeated capture

Save session → hide main window → capture monitor frames → region overlay → crop → close all overlays → append image to current session → restore editor. Cancel restores the same session untouched. Capture shortcut appends to the active draft; submitted sessions start a fresh draft before new capture.

## Submission

Validate form → save snapshot → flatten ordered images → show upload progress → persist upload results → create/reconcile stable issue ID → persist success → show identifier + Open issue + Copy link + New session. Keep failed state and entered text. Never automatically retry ambiguous issue mutations with a new ID.

## Other surfaces

- Settings: five sections (Connection, Capture, Appearance, Privacy, Shortcuts). Preferences remain in one draft while navigating; Save settings persists them. Connection retains OAuth setup; Privacy explains the upload boundary and solid redaction alongside retention/delete controls. Appearance shows daylight/after-hours samples; Shortcuts provides a keyboard reference.
- History: draft/submitted state, image count, timestamp, resume/open/delete.
- First connection: explanation → browser OAuth → local callback → workspace identity. Provide useful setup guidance if no OAuth client ID is configured.

## Keyboard

Default global: Ctrl/Cmd+Shift+2 (check registration failure). Editor: V select, A arrow, R rectangle, P pen, T text, B pixelate, X redact. Ctrl/Cmd+Z undo; Shift+Ctrl/Cmd+Z redo; Delete removes selected annotation; Ctrl/Cmd+Enter submits. Hold Shift while drawing to snap arrows/pen segments to 15-degree increments, or constrain rectangles to squares. Pen snapping anchors at the last freehand point when Shift is pressed; releasing Shift resumes freehand. Ignore tool shortcuts in text inputs. Escape dismisses current selection/dialog/capture without deleting a draft.

## Accessibility

Visible focus, native button semantics, labels for icon controls, keyboard-accessible image ordering, status live regions, reduced motion, no color-only success/error, modal focus containment/restoration. At narrow widths, issue panel moves below the canvas instead of clipping inputs.

Description: type @ to filter attached images by alias or caption. Up/Down navigates, Enter/Tab inserts, Escape dismisses. References keep their UUID identity through reordering and reload; missing images show an error. Submitted references become clickable Linear asset links with full images still in filmstrip order below.
