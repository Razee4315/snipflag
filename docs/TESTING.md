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
