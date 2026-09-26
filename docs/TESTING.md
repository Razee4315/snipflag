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

Automated browser coverage includes the 920 x 680 workspace, 640 x 480 stacked layout without horizontal overflow, utility bar never overlapping the composer, absence of expand/compact controls, optional reproduction-steps scaffold, theme switching, settings draft/persistence across sections, a constant Settings dialog size across sections, and persisted sound/animation switches (animations off sets `data-motion="off"`). CI records synthetic-image screenshots, including an open themed picker, for visual inspection. Browser tests cannot hear sounds or prove native window sizing.

Native follow-up: verify no blank flash at launch (reveal after paint, 4 s fallback, `--minimized` stays hidden), utility-bar and empty-state dragging, edge resizing, minimize, full-workspace size at launch and after capture on each display, a larger or maximized window kept after capture, parallel overlay preview encoding on multi-monitor setups, capture/success/error sounds in WebView2 and the sound switch, themed select pickers in WebView2 (native fallback on macOS/Linux), NSIS installer icon, save-and-hide/reopen, and Alt+F4 behavior on Windows. Repeat at 100/125/150/200% and mixed DPI. Verify macOS/Linux frameless window controls and tray restoration. Check logo at taskbar/tray sizes and installer branding. These additions do not replace the capture, Linear, and export acceptance matrix above.

Shift drawing regression coverage: 15-degree snapping in every quadrant, image-edge clipping that preserves angle, modifier changes without pointer movement, straight pen despite a curved pointer path, Shift rectangles, and persisted constraints after reload. Native follow-up should include modifier press/release while drawing with the Windows pointer stack.

Description image references: picker keyboard/mouse selection, native undo/redo, caption filtering, reorder/reload identity, deleted-reference errors and no alias recycling. Rust tests cover reference resolution, missing uploads and literal-code/email/URL exclusions. Final manual Linear gate: two-image report with repeated references, reordered images and annotations/redaction; confirm each link opens the correct final image and full images remain ordered.
