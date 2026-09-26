# Test and release gates

## Automated on GitHub Actions

- TypeScript strict typecheck and production frontend build.
- Unit tests: independent image edit histories, reorder/remove semantics, send validation, caption escaping, crop coordinate conversion, immutable submitted sessions.
- Browser tests: empty state, importing two images, switching/annotating/reordering, undo/redo, draft restore, controls accessible by name, settings, no fake connection success.
- Pixel checks: exported dimensions, opaque redaction over source pixels, consistent ordering and annotation export.
- Rust tests: UUID/path validation, bounds, session persistence, submission state/reconciliation decisions.
- Native compile on all platforms and development packaging.

## Manual native gates

Windows: 100/125/150/200% scaling; mixed-DPI dual monitors; monitor left of origin; portrait display; HDR appearance; escape; global shortcut collision; tray close/reopen; restart draft recovery; offline edit; clipboard PNG; export picker; real multi-image Linear submission.

macOS: Apple Silicon + Intel, permission grant/deny/revoke, Retina, menu bar, Cmd shortcuts, notarized launch.

Linux: GNOME Wayland, KDE Wayland, X11; portals; global shortcut availability; tray presence; locked/unavailable secret service; AppImage/deb launch. Record compositor-specific limits honestly.

Linear: OAuth state mismatch, timeout, refresh, revoked access, empty teams, pagination, team switch clearing optional fields, partial upload, 429, expired upload URL, response lost after issue creation, restart reconciliation, repeated submit.

No platform is “fully working” until its native runtime tests are recorded with OS version and results. CI green alone is insufficient.

## Compact redesign gates

Automated browser coverage includes the 920 x 680 compact workspace, 640 x 480 stacked layout without horizontal overflow, optional reproduction-steps scaffold, expand/compact preserving form and images, theme switching, and settings draft/persistence across sections. CI records synthetic-image screenshots for visual inspection. Browser expand/compact exercises UI state only; native window sizing is a separate gate.

Native follow-up: verify header dragging, edge resizing, minimize, compact/expand on each display, first-capture sizing, second-capture retention of chosen size, save-and-hide/reopen, and Alt+F4 behavior on Windows. Repeat at 100/125/150/200% and mixed DPI. Verify macOS/Linux frameless window controls and tray restoration. Check logo at taskbar/tray sizes and installer branding. These additions do not replace the capture, Linear, and export acceptance matrix above.

Shift drawing regression coverage: 15-degree snapping in every quadrant, image-edge clipping that preserves angle, modifier changes without pointer movement, straight pen despite a curved pointer path, Shift rectangles, and persisted constraints after reload. Native follow-up should include modifier press/release while drawing with the Windows pointer stack.

Description image references: picker keyboard/mouse selection, native undo/redo, caption filtering, reorder/reload identity, deleted-reference errors and no alias recycling. Rust tests cover reference resolution, missing uploads and literal-code/email/URL exclusions. Final manual Linear gate: two-image report with repeated references, reordered images and annotations/redaction; confirm each link opens the correct final image and full images remain ordered.
