# Changelog

All notable changes to Snipflag are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
