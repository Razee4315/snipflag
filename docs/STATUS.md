# Current state / handoff

Updated: 2026-09-26. Repository: https://github.com/Razee4315/snipflag (private; renamed from `nacrelark` the same day, GitHub redirects the old URL).

## Decisions locked by user

Tauri 2 + Rust + React/TypeScript. Windows primary, macOS/Linux targets. All builds on GitHub Actions, no local builds or large dependencies. Multiple screenshots in a single reporting session → one Linear issue. Product name: **Snipflag** (evidence in [NAME.md](NAME.md)).

## Implemented

- **Native core (Rust):** SQLite drafts with atomic per-image PNG files and bounded decoding (`storage.rs`); PKCE loopback OAuth with state check, 5-minute timeout, cancel, keyring-only tokens, and refresh rotation when Linear issues refresh tokens (`auth.rs`); paginated teams/projects/members/labels, signed uploads without the bearer token, ordered Markdown, stable-UUID `issueCreate`, and reconciliation of uncertain creates that never issues a new identity (`linear.rs`); per-monitor frozen-frame overlays with Rust-side crop, Enter for full monitor, Escape/close cancels all (`capture.rs`); clipboard image read/write and save picker (`files.rs`); tray menu, global shortcut with conflict reporting, single instance, launch at login (`--minimized`), close-to-tray (`lib.rs`).
- **Frontend:** Konva editor that draws annotations with the exporter's own routine (WYSIWYG), select/move/resize, per-image undo/redo, zoom/fit/100%, Ctrl+wheel zoom; tools V/A/R/P/T/B/X; filmstrip with reorder/caption/remove; import, paste, drag-and-drop; autosave and restore of the latest unsent draft; History (open/delete); Settings (Linear client ID with setup steps, shortcut recorder, launch at login, theme, retention, delete all history); issue panel (team memory per workspace, priority, project, assignee, labels, progress, retry-with-reconcile messaging, sent state with Open/Copy link/New session).
- **Brand and project files:** Snipflag mark (abstract rounded S, `public/icon.svg`, `docs/assets/`), MIT license, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY policy, SUPPORT, CHANGELOG, issue forms, pull request template, CODEOWNERS, `.editorconfig`.
- The hard-coded Linear client ID of unknown origin was removed. The client ID comes from Settings, or from repository variable `SNIPFLAG_LINEAR_CLIENT_ID` baked into installer builds.

## Verified on CI (compilation and automated tests, not native runtime)

- Checks run [36219743240](https://github.com/Razee4315/snipflag/actions/runs/36219743240) at `a2b3074`: all jobs green.
  - frontend: strict typecheck, production build, Vitest (model, geometry, store), Playwright Chromium: 7/7 (empty state, two-image independent histories, reorder, draft restore after reload, no fake Linear success in preview, exported redaction is opaque black at original 400×300 dimensions, keyboard tool access and text tool).
  - native on windows-latest, macos-latest, ubuntu-24.04: `cargo test` 15 passed (path/UUID validation, image bounds, persistence round trip, sent-session immutability, receipt kept after delete, settings validation, PKCE, callback state, description ordering, submission plans, not-found detection, crop clamping, save-name sanitizing) and `cargo check --all-targets`.
- Development installers run [36219749995](https://github.com/Razee4315/snipflag/actions/runs/36219749995) at `a2b3074`: all four jobs green. Unsigned artifacts (7-day retention): `snipflag-development-unsigned-x86_64-pc-windows-msvc` (NSIS + MSI, 9 MB), `…-aarch64-apple-darwin` and `…-x86_64-apple-darwin` (DMG, 5 MB each), `…-x86_64-unknown-linux-gnu` (deb + AppImage, 85 MB). Packaging success is not runtime verification.

- After the logo and project-docs update at `fe9df73`: Checks [36223367657](https://github.com/Razee4315/snipflag/actions/runs/36223367657) green on all jobs, and Development installers [36223378647](https://github.com/Razee4315/snipflag/actions/runs/36223378647) green on all four targets with icons generated from the new mark. These were the pre-redesign artifacts; see the final redesign checkpoint below for current artifacts.

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

## Redesign checkpoint — 2026-09-26

Owner requested a complete UI/flow and logo redesign, with commits pushed to main and all builds on Actions. Baseline is `c9b43fa`; working tree was clean. Owner reports the existing app works, but no new OS/version acceptance evidence has been recorded.

Implemented in the upcoming UI commit: compact frameless editor (first image requests a bounded window size; explicit expand/compact, minimize, save-and-hide, drag header), teal/ivory/apricot vector identity, warm daylight and forest dark surfaces, compact evidence rail and contextual composer, reproduction-steps scaffold, settings navigation with connection/capture/appearance/privacy/keyboard reference. Existing image coordinates, export/redaction, local persistence, OAuth and stable issue identity remain the original implementation. New narrow Rust window command checks main-window identity.

Verification pending: updated Playwright coverage for compact and narrow viewports, report scaffold, settings persistence and theme; CI screenshots use synthetic images only. No local build, install, browser test or Rust compile was run. Next: push implementation, inspect Actions, fix failures, inspect captured UI screenshots, then build development installers. Native frameless dragging/resizing/tray and mixed-DPI capture still need Windows runtime checks; all platform release gates remain open.

### First remote review

UI implementation pushed as `461ca26`. Checks [36224775127](https://github.com/Razee4315/snipflag/actions/runs/36224775127) passed frontend build/unit tests and 8 of 9 browser tests; native jobs were skipped because the new compact test failed at the exact Description label lookup after inserting the template. Fixed with an explicit description label reference (no weakened assertion). Inspected the CI screenshot: compact surfaces fit at 920 x 680; refined the heading and grouped tool appearance controls to avoid a mostly empty second toolbar row. Updated DESIGN/UX/TESTING to describe the implemented flow. Next commit reruns CI and adds a synthetic checkout screenshot plus the minimum compact-size assertion; native/runtime gates remain pending.

### DPI review

Refinement commit `9a214cd` passed all frontend checks, including 9/9 browser tests, in [36224980719](https://github.com/Razee4315/snipflag/actions/runs/36224980719). Native jobs were still running at this checkpoint. Source review found the new compact sizing should convert screenshot pixels by monitor DPI and use the monitor work area rather than whole-screen bounds. Follow-up uses that conversion and centers within the work area, including negative origins, with two Rust regression tests. This is not mixed-DPI runtime verification. Next: verify the final revision on all CI targets and package unsigned development installers.

### Owner refinement — minimal chrome and standard drawing modifiers

At `1003af4`, Checks [36225078271](https://github.com/Razee4315/snipflag/actions/runs/36225078271) and Development installers [36225079417](https://github.com/Razee4315/snipflag/actions/runs/36225079417) completed green on all jobs. Those installers are superseded by the owner's subsequent visual correction, not the final deliverable.

Owner reviewed the CI screenshot and explicitly requested removal of the branded/repeated-title header, extra text, and flag logo, plus standard Shift drawing constraints. Implemented in the next commit: 38px utility strip with accessible save indicator and visible save errors; removed evidence/report slogans and redundant attachment text; abstract S icon with no flag; Shift snaps arrow/pen segments to 15-degree increments and constrains rectangles to squares. Pen snapping preserves the freehand prefix, uses one straight segment while held, and resumes freehand on release. Image-edge clipping preserves the snapped angle. Added geometry and browser persistence tests. Next: run all final checks, review refreshed screenshots and rebuild installers from this refinement. No local builds or installs; native runtime acceptance remains pending.

### Image references and top-aligned evidence

Owner requested `@` image mentions and removal of the empty strip above the screenshot. Implemented next: screenshot starts at the top; utility controls sit above the composer. Description offers a thumbnail picker with keyboard/mouse selection, search, Escape and native text undo. Persisted aliases map to UUIDs and are not recycled after deletion. Missing references are shown inline and rejected by Rust before uploads. Rust converts references into Markdown links to the uploaded flattened image; full images remain in filmstrip order below. Code, escaped tokens, emails and existing links stay literal.

Linear documentation checked: https://linear.app/docs/editor lists native mentions for people/issues/projects/dates/documents/PRs, not screenshot identities. https://linear.app/developers/how-to-upload-a-file-to-linear documents uploaded asset URLs in description Markdown. This implementation uses supported links, not an invented native Linear image-mention node. Actual rendering with an authenticated Linear workspace remains a runtime gate; no test issue was posted.

Previous refinement `9c4b61d`: Checks [36225571317](https://github.com/Razee4315/snipflag/actions/runs/36225571317) and installers [36225573328](https://github.com/Razee4315/snipflag/actions/runs/36225573328) all green. New mention changes require fresh CI and packaging. Added cross-language parsing/identity tests plus browser picker, undo, reorder, reload and deletion coverage.
