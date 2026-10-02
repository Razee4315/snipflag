# Changelog

All notable changes to Snipflag are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Work from the 2026-10-02 audit ([docs/AUDIT-2026-10-02.md](docs/AUDIT-2026-10-02.md)), on branch `audit/core-flow-improvements`. Not released.

### Added

- Undo (Ctrl+Z and the toolbar button) takes back a removed screenshot, a crop or a reorder when that is the newest change.
- Up to three messages stack at the bottom; an offer to undo is not pushed out by confirmations, and a message waits while the pointer is on it.
- Optional plate behind text marks so they stay readable on busy screenshots.
- The last color, width, text size and text plate are remembered between launches.
- A progress bar while a report is prepared, uploaded and created; download progress while an update installs.
- With the Select tool, Tab on the screenshot steps through the marks. Color, width and filter groups and the Settings sections are single Tab stops with arrow keys.
- A first-run note that closing the window keeps Snipflag in the tray.

### Changed

- Launch restores only the session that was open last, and only if it is unsent. Starting a new session says when a draft stays in History; emptied drafts are removed instead of listed.
- Settings asks before closing with unsaved changes.
- Create issue checks the Linear connection before field validation, and Ctrl+Enter opens a hidden issue panel instead of sending from it.
- A create that Linear refuses is confirmed at once and leaves the report editable; it no longer locks it for a manual check.
- Lines, arrows and strokes are selected by their ink, not their whole bounding box.
- Screenshots upload three at a time; team projects, members and labels load together; one HTTP client is reused.
- Copy for AI reuses the saved file of an unchanged screenshot.
- Retention wording: sessions (drafts and sent) are removed, as the code always did.

### Fixed

- The capture shortcut did nothing visible from the tray when the session was full or locked.
- Being offline showed the "Connect Linear" card and "reconnect" errors instead of a Retry.
- Delete, arrow keys and Ctrl+D edited the selected mark behind an open dialog.
- Space did not press buttons outside the canvas area.
- Loading team details could make Create issue fail with "another operation is in progress".
- One invalid stored setting reset every setting; a failed settings save could leave the shortcut or login item changed.
- Remembered team details came back after Disconnect when Settings was saved afterwards.
- Without a tray, closing the window hid it with no way back; it now minimizes.
- A failed update install removed the update offer until the next background check.


### Added

- Share bar under the screenshot: Copy image, Copy for AI and Save image. Copy for AI saves every marked-up screenshot to Pictures/Snipflag and copies their paths with the title, description and step notes, ready to paste into an assistant such as Claude Code. Ctrl+C copies the image; Ctrl+Shift+C copies for AI.
- Crop tool (C) with an Undo in the confirmation toast, and a plain Line tool (L).
- Canvas: Ctrl+wheel zooms toward the pointer; hold Space and drag, or drag with the middle button, to pan; arrow keys move the selected mark (Shift: 10 px); Ctrl+D duplicates it.
- Filmstrip: drag a screenshot sideways to reorder it (it follows the pointer and the others glide into place), thumbnails are larger, and removing a screenshot offers Put back.
- Issue panel: labels are colored chips with a search-to-add field; a missing title or team is reported at that field; long team, project and assignee lists show their search joined to the list.
- Title bar: a visible Saved indicator, a maximize button (or double-click the bar), and the toolbar and share bar also drag the window.
- History shows a thumbnail of each session's first screenshot (the flattened one, so pixelated areas stay hidden), with search and All / Drafts / Sent filters.
- Marks snap to the image's edges and middle and to other marks while you move them, with guide lines (hold Alt to move freely); zoom buttons glide to the new scale.
- Optional setting: save every capture to Pictures/Snipflag.
- Drawing no longer stops when the pointer leaves the picture: the stroke follows the edge until the button is released.
- Themes feel like their names: Paper is a ruled notebook page with pulp grain and drifting daylight, Blossom has falling petals, Midnight a twinkling night sky over an aurora, Graphite a carbon weave with light sliding over brushed metal. The motion stops when animations are off.
- The report preview renders the description's Markdown (headings, lists, tasks, quotes, code, emphasis) instead of showing raw characters.
- Notes on numbered steps, written in a list that floats over the canvas; they can be added to the description.
- The Linear issue panel can be hidden for quick mark-up and sharing; the choice is remembered.
- Four more themes, each with its own texture: Paper, Blossom, Midnight and Graphite. A picked theme previews at once.
- Capture options in Settings, all off by default: adjust the selection before capturing (handles, move, arrow keys, then Enter, a double-click or Capture), a magnifier at the pointer, copy every capture to the clipboard, and a 3, 5 or 10 second delay.

### Changed

- Faster capture: overlay windows are opened ahead of time and reused, the frozen frame goes to the overlay uncompressed from memory, the wait after hiding the editor follows the Windows compositor instead of a fixed 300 ms, and the selection is encoded with fast compression. Settings → Capture shows how long the last capture took.

## [1.2.0] - 2026-09-26

### Added

- Report preview showing the destination, fields, title, description, image references, flattened screenshots in upload order and the exact Markdown before anything is uploaded. Rust and the preview share one description format, tested against the same fixtures.
- Editable description templates (Bug report, Visual defect, Regression, Design feedback), offered only under an empty description.
- Per-team remembered project, assignee, labels and priority, filling only empty fields with values the team still offers.
- Signed automatic updates through the Tauri updater, with background checks, a manual check, and installs only after the draft is saved.
- Built-in public Linear OAuth client; custom client IDs moved to Advanced settings.

### Changed

- The remembered team applies to new sessions; long pickers are searchable; team metadata failures can be retried.
- Durability: emptied drafts persist, Quit waits for a saved draft, undo history survives restart, failed deletions are retryable.
- Uncertain submissions lock to an immutable report snapshot and reconcile before any new send.
- Pixelation replaces covered pixels; thumbnails and mention previews use protected flattened images.

## [1.1.0] - 2026-09-26

### Changed

- Richer synthesized sounds: a soft shared room reverb, a layered mechanical shutter, a bell arpeggio for created issues, a rounder pop and gentler error knocks.
- Redrawn annotation tool icons on one grid with small filled accents.
- Transparent, content-sized text entry box with a dashed border.
- Nothing moves on hover anymore; buttons respond with color and a subtle press instead.

- Brand: restored the original capture mark (corner brackets and arrow) in black and white across the app, tray, taskbar and installers. The Windows installer now uses the Snipflag icon.
- The editor opens at the full workspace size at launch and after every capture; the expand/compact control is gone. It reveals after its first paint instead of flashing an empty window.
- Redesigned the utility bar (in layout flow, so the composer never scrolls under it), the composer footer with a labeled New session button, the workspace chip, and the empty state for light and dark themes.
- Themed dropdown pickers, switches and scrollbars; fixed-size Settings and History dialogs; removed the green status dots.
- Texture, motion and micro-interactions throughout, with an Interface animations switch that respects reduced motion.
- Faster: capture overlays load a small separate bundle, overlay previews for all monitors are encoded in parallel right after the grab, and startup reads run together.

- Editing: 8 px default stroke; stroke and marker sizes shown as circles; pen and highlighter show a brush-size circle cursor and draw smoother, more natural strokes from every pointer sample.
- Pixelate now averages real color blocks (at least 12 px) and is the privacy tool; the solid redaction tool was removed at the owner's request (older drafts still render their redactions).
- The utility bar is a visible drag card with a theme-colored line mark; the empty-state mark is static and theme-aware; the workspace chip shows names only; the theme is chosen with three preview cards.
- Desktop behavior: browser context menus and shortcuts (downloads, print, find, reload, devtools, history, page zoom), autoscroll, file-drop navigation and interface text selection are blocked. Long hover labels on labeled buttons were removed.
- Fixed icon buttons whose default browser padding pushed their icons off center (for example Fit to window).

### Added

- Ellipse tool (E); Shift draws a circle.
- Numbered step badges (N) that count up per screenshot, sized by the width setting and readable on any color.
- Custom color picker (field, hue slider, hex entry) for pens and highlighter inks, with the last five custom colors remembered.
- Settings → About with the creator's GitHub and LinkedIn, the source code and the license (links open through a fixed allowlist).
- Highlighter tool (H) with marker inks and sizes, painted beneath other marks.
- Synthesized sound effects for captures, added images, created issues and failures, with a Play sound effects switch and preview.

## [1.0.0] - 2026-09-26

First v1 release. Promoted to the latest regular release at the explicit request of the owner after they confirmed the app is working well. Installers remain unsigned; the detailed runtime acceptance matrix and signing remain pending.

### Added

- Capture: tray app with a global capture shortcut (default Ctrl/Cmd+Shift+2), frozen per-monitor overlays, drag to select, Enter for the whole screen, Escape to cancel.
- Sessions of up to 10 screenshots that become one Linear issue, each image with independent annotations and undo/redo.
- Annotation tools: arrow, rectangle, pen, text, pixelate (cosmetic), and solid redaction; select, move, resize, color, width, text size; zoom, fit, and 100%.
- Import PNG, JPEG, and WebP files; paste images; drag and drop; reorder, caption, and remove screenshots.
- Copy an annotated image to the clipboard or save it as PNG at its original dimensions.
- Automatic local drafts with restore on launch, history with open and delete, and configurable retention.
- Linear connection with OAuth and PKCE, tokens stored in the OS credential store, and team, project, assignee, label, and priority selection with per-workspace team memory.
- Issue creation with ordered screenshot sections, a stable issue ID, and reconciliation so a retry after an uncertain failure never creates a duplicate.
- Settings for the Linear client ID, capture shortcut, launch at login, theme, and history.
- Brand identity: a rounded abstract S mark in teal, mint and ivory used for the app, installers, and tray.
- Project documentation: README, contributing guide, code of conduct, security policy, support guide, and issue and pull request templates.

- Shift drawing: 15-degree angle snapping for arrows and straight pen segments, plus square rectangles.
- Optional reproduction-steps scaffold and keyboard shortcut reference.

### Changed

- Product renamed from Nacrelark to Snipflag.

- Compact frameless workspace with image-aware sizing, custom window controls, and minimal utility chrome.
- Warm daylight and forest dark themes; compact image rail and simplified issue composer.
- Settings organized into Connection, Capture, Appearance, Privacy, and Shortcuts.

- Description @image references with a thumbnail picker, caption search, stable identity and clickable links in Linear; missing references block submission.
- Screenshot workspace aligned to the top, with utilities in the composer corner.
