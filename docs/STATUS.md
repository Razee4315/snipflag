# Current state / handoff

Updated: 2026-09-26. Repository: https://github.com/Razee4315/snipflag (private; renamed from `nacrelark` the same day).

## Decisions locked by user

Tauri 2 + Rust + React/TypeScript. Windows primary, macOS/Linux targets. All builds on GitHub Actions, no local builds or large dependencies. Multiple screenshots in a single reporting session → one Linear issue. Product name: **Snipflag** (see [NAME.md](NAME.md)).

## Implemented in source (compile/test verification pending on CI)

- Rust core: storage (SQLite + atomic image files, limits, retention, settings validation, submission receipts), PKCE OAuth with loopback callback/cancel/timeout and keyring storage, Linear GraphQL (paginated teams/projects/members/labels, uploads, idempotent `issueCreate` with stable session UUID and reconciliation), per-monitor capture overlays with Rust-side crop, clipboard/save export, tray, global shortcut, single instance, launch at login, close-to-tray.
- Frontend: workspace with Konva editor (arrow, rectangle, pen, text, pixelate, redact, select/move/resize, per-image undo/redo, zoom/fit), filmstrip (reorder, caption, remove), import/paste/drop, autosave + restore, history, settings, issue panel with connection state and submission progress, capture overlay.
- Tests: Rust unit tests (paths, image bounds, persistence round trip, immutability of sent sessions, receipts, settings, PKCE/callback state, description ordering, submission plans, crop clamping, save names), Vitest (model, geometry, store histories/locks), Playwright (empty state, two-image independent histories, reorder, draft restore, no fake Linear in preview, pixel check of opaque redaction export, keyboard tool access).

## In progress

- Bootstrap lockfiles on CI, commit them, then get Checks green on all platforms.

## External setup

- A Linear OAuth app/client ID is owner configuration (Settings → Linear, or repository variable `SNIPFLAG_LINEAR_CLIENT_ID` for installer builds). The previously hard-coded client ID of unknown origin was removed.
- Production Windows/macOS signing and updater keys are not configured.
- Native runtime tests need installed artifacts on each OS.

## Resume procedure

1. Read this file and AGENTS.md. Inspect git status and current Actions results.
2. Fix failing remote checks before new features. Never run local builds.
3. Work against PRODUCT acceptance criteria; preserve multi-image semantics.
4. Update this file with implementation truth, exact verification evidence, open gaps, and next action before ending work.
