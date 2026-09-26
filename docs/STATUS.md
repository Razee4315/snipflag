# Current state / handoff

Updated: 2026-09-26. Repository: https://github.com/Razee4315/snipflag (private; renamed from `nacrelark` the same day, GitHub redirects the old URL).

## Decisions locked by user

Tauri 2 + Rust + React/TypeScript. Windows primary, macOS/Linux targets. All builds on GitHub Actions, no local builds or large dependencies. Multiple screenshots in a single reporting session → one Linear issue. Product name: **Snipflag** (evidence in [NAME.md](NAME.md)).

## Implemented

- **Native core (Rust):** SQLite drafts with atomic per-image PNG files and bounded decoding (`storage.rs`); PKCE loopback OAuth with state check, 5-minute timeout, cancel, keyring-only tokens, and refresh rotation when Linear issues refresh tokens (`auth.rs`); paginated teams/projects/members/labels, signed uploads without the bearer token, ordered Markdown, stable-UUID `issueCreate`, and reconciliation of uncertain creates that never issues a new identity (`linear.rs`); per-monitor frozen-frame overlays with Rust-side crop, Enter for full monitor, Escape/close cancels all (`capture.rs`); clipboard image read/write and save picker (`files.rs`); tray menu, global shortcut with conflict reporting, single instance, launch at login (`--minimized`), close-to-tray (`lib.rs`).
- **Frontend:** Konva editor that draws annotations with the exporter's own routine (WYSIWYG), select/move/resize, per-image undo/redo, zoom/fit/100%, Ctrl+wheel zoom; tools V/A/R/P/T/B/X; filmstrip with reorder/caption/remove; import, paste, drag-and-drop; autosave and restore of the latest unsent draft; History (open/delete); Settings (Linear client ID with setup steps, shortcut recorder, launch at login, theme, retention, delete all history); issue panel (team memory per workspace, priority, project, assignee, labels, progress, retry-with-reconcile messaging, sent state with Open/Copy link/New session).
- The hard-coded Linear client ID of unknown origin was removed. The client ID comes from Settings, or from repository variable `SNIPFLAG_LINEAR_CLIENT_ID` baked into installer builds.

## Verified on CI (compilation and automated tests, not native runtime)

- Checks run [36219743240](https://github.com/Razee4315/snipflag/actions/runs/36219743240) at `a2b3074`: all jobs green.
  - frontend: strict typecheck, production build, Vitest (model, geometry, store), Playwright Chromium: 7/7 (empty state, two-image independent histories, reorder, draft restore after reload, no fake Linear success in preview, exported redaction is opaque black at original 400×300 dimensions, keyboard tool access and text tool).
  - native on windows-latest, macos-latest, ubuntu-24.04: `cargo test` 15 passed (path/UUID validation, image bounds, persistence round trip, sent-session immutability, receipt kept after delete, settings validation, PKCE, callback state, description ordering, submission plans, not-found detection, crop clamping, save-name sanitizing) and `cargo check --all-targets`.
- Development installers run [36219749995](https://github.com/Razee4315/snipflag/actions/runs/36219749995) at `a2b3074`: all four jobs green. Unsigned artifacts (7-day retention): `snipflag-development-unsigned-x86_64-pc-windows-msvc` (NSIS + MSI, 9 MB), `…-aarch64-apple-darwin` and `…-x86_64-apple-darwin` (DMG, 5 MB each), `…-x86_64-unknown-linux-gnu` (deb + AppImage, 85 MB). Packaging success is not runtime verification.

## Failures fixed during this session

- Bootstrap run 36210728328 failed: missing `lib.rs`. Fixed by adding the native core; lockfiles came from bootstrap run 36218767872 and were committed.
- Checks 36218818120: the Playwright text-tool test failed because the text box opened on pointer down and was immediately blurred. Fixed in `bcd8e1b` (opens on pointer up, commits once).
- Checks 36218962979: Linux link error `unable to find library -lgbm` (xcap Wayland backend). Fixed in `a2b3074` by installing `libgbm-dev libdrm-dev` in both workflows.

## Not yet verified (manual gates from TESTING.md)

Nothing below has been run on a real machine yet. CI compilation does not prove any of it.
- Native capture on Windows at 100/125/150/200% scaling, mixed-DPI and negative-origin monitors; macOS Screen Recording permission flow; Linux X11/GNOME Wayland/KDE Wayland behavior.
- Tray, global shortcut registration/conflict, single instance, launch at login on each OS.
- Real Linear OAuth (needs an OAuth app and client ID), token refresh, revoked token, multi-image issue creation, reconciliation after a lost response, rate limiting.
- Clipboard copy/paste and the save picker on each OS.

## External setup

- Create a Linear OAuth application with callback `http://127.0.0.1:47839/callback` and paste its client ID in Settings (or set the `SNIPFLAG_LINEAR_CLIENT_ID` repository variable before building installers).
- Production Windows/macOS signing, notarization, and updater keys are not configured. Installers are unsigned development builds; Windows SmartScreen and macOS Gatekeeper will warn.

## Next steps

1. Install the Windows artifact and run the Windows manual gates, then record the OS version and results here.
2. Register the Linear OAuth app and run a real two-image submission with a clearly named test issue (only with explicit owner approval to post test content).
3. Repeat on macOS and Linux; record compositor-specific limits honestly.
4. Configure signing before any public release. Do not publish a stable release until the acceptance matrix is satisfied.

## Resume procedure

1. Read this file and AGENTS.md. Inspect git status and current Actions results.
2. Fix failing remote checks before new features. Never run local builds.
3. Work against PRODUCT acceptance criteria; preserve multi-image semantics.
4. Update this file with implementation truth, exact verification evidence, open gaps, and next action before ending work.
