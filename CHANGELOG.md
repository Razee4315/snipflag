# Changelog

All notable changes to Snipflag are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-26

First v1 preview. Published as an unsigned prerelease; runtime acceptance and signing remain pending.

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
