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

### Mention visual review

`5525090` frontend build, unit tests and 11/11 browser tests passed in [36226364465](https://github.com/Razee4315/snipflag/actions/runs/36226364465); native jobs still running at review time. Inspected CI daylight/dark screenshots and the mention picker: the blank strip above the evidence is gone and the thumbnail menu fits under Description. Follow-up ensures keyboard selection scrolls within long mention lists and extends coverage to caption filtering/Tab and email/code exclusions. Packaging [36226442537](https://github.com/Razee4315/snipflag/actions/runs/36226442537) started for this checkpoint; final artifacts must match the follow-up revision.

### Test selector correction

Follow-up `6041c74` run [36226489524](https://github.com/Razee4315/snipflag/actions/runs/36226489524) passed build/unit tests and 10/11 browser tests. The caption-filter assertion incorrectly counted every option on the page (including tool width/team dropdowns): expected 1, received 14. Scoped it to the image mention listbox, retaining the expected single match. This changes only test code; production source is unchanged from `6041c74`. Installer run [36226490343](https://github.com/Razee4315/snipflag/actions/runs/36226490343) packages that production revision. Next: verify corrected browser test and all native checks; then record final artifact evidence.

## Final redesign + mentions checkpoint — 2026-09-26

Production source: `6041c74` (includes UI redesign, owner's clutter removal, abstract S logo, top-aligned canvas, Shift drawing, and stable image mentions). Corrected test revision: `fa1c0e4`; it differs only in a scoped browser assertion and STATUS. Earlier implementation commits: `461ca26`, `9a214cd`, `1003af4`, `9c4b61d`, `5525090`. All pushed to main.

- **Checks:** [36226587665](https://github.com/Razee4315/snipflag/actions/runs/36226587665), at `fa1c0e4`, all green. Strict TypeScript/production build; 19 frontend unit tests; 11 Chromium browser tests; 20 Rust tests plus all-target cargo check on Windows, macOS and Linux.
- **Installers:** [36226490343](https://github.com/Razee4315/snipflag/actions/runs/36226490343), at `6041c74`, all four targets green. Production source is identical to the checked revision; subsequent changes are tests/docs only. Unsigned development artifacts retained 7 days: [Windows NSIS + MSI](https://github.com/Razee4315/snipflag/actions/runs/36226490343/artifacts/10900878040), [macOS Apple Silicon](https://github.com/Razee4315/snipflag/actions/runs/36226490343/artifacts/10900124362), [macOS Intel](https://github.com/Razee4315/snipflag/actions/runs/36226490343/artifacts/10900288637), [Linux deb + AppImage](https://github.com/Razee4315/snipflag/actions/runs/36226490343/artifacts/10901301434).
- **Visual review:** inspected CI-rendered daylight/dark compact editor, settings and image mention picker using synthetic evidence. Screenshot workspace starts at the top; utilities sit in the composer corner. No user-provided screenshot was uploaded to CI or Linear.
- **Resolved failures:** exact Description label lookup in 36224775127 and overly broad option-count selector in 36226489524. Both fixed and covered by the final green run. Superseded 36226442537 packaging was cancelled to free runner capacity; earlier intermediate checks were superseded by pushes.
- **Local constraints:** no local build, dependency installation, Rust compilation, browser installation or packaging. Only source/git work, CI inspection and downloaded CI screenshots.

Next: install the Windows development artifact and verify frameless drag/resize/compact/expand/tray, DPI capture, Shift interactions and @ picker in WebView2. With explicit approval for a real test issue, verify repeated image-reference links resolve to the correct final annotated/redacted images after reorder. Actual Linear rendering, native window/capture behavior, macOS/Linux runtime and signing are still manual gates. No stable release published.

## v1 release preparation — 2026-09-26

Owner requested v1 on GitHub Releases and screenshots in README. Prepared matching 1.0.0 package/Tauri/Cargo versions and root lockfile metadata, README gallery from verified synthetic CI screenshots, and release notes. Release remains explicitly unsigned/prerelease under the existing acceptance gate; no runtime/signing claims changed. New publication workflow requires successful checks and four-platform installer runs at its exact SHA, publishes six installers with SHA256 checksums, and never marks stable/latest. Next: push release preparation, run CI and packaging, publish only after both succeed, then record the release URL. No local build or installation.

## v1 release published — 2026-09-26

- Release source and tag: `59017516274199f6b8461c3306f737777496bdb4` (`5901751`), version `1.0.0`, pushed to main.
- [v1.0.0 release](https://github.com/Razee4315/snipflag/releases/tag/v1.0.0) is published (`isDraft=false`, `isPrerelease=true`), titled **Snipflag v1.0.0 — unsigned preview**. Verified all seven assets: Windows NSIS/MSI, macOS Apple Silicon/Intel DMG, Linux deb/AppImage, and SHA256SUMS.txt. All six installers carry an `unsigned-` filename prefix.
- [Checks 36227110895](https://github.com/Razee4315/snipflag/actions/runs/36227110895): frontend and Windows/macOS/Linux native jobs all passed at the release source.
- [Development installers 36227111618](https://github.com/Razee4315/snipflag/actions/runs/36227111618): all four platform jobs passed at the same source.
- [Publication 36227461740](https://github.com/Razee4315/snipflag/actions/runs/36227461740): succeeded after validating both successful run SHAs. Installers were downloaded, checksummed, and uploaded entirely on GitHub Actions. No release build or dependency installation ran locally. No failures in these release runs.
- README now embeds four verified synthetic UI previews: daylight, dark theme, image mentions, and settings. The gallery explicitly identifies browser/CI previews rather than native runtime evidence.

Next: run and record the documented Windows-first native acceptance matrix, real Linear rendering with authorized test content, and macOS/Linux runtime checks; configure signing before promoting to stable. Publication does not close any of those gates. This checkpoint changes documentation only.

## Latest release promotion - 2026-09-26

Owner explicitly requested that v1 appear in the repository Releases sidebar and confirmed that the app is working great. This overrides the earlier prerelease gate for this release; it is owner-reported working behavior, not a completed platform acceptance matrix.

Promoted the existing v1.0.0 release to a regular release and marked it latest, titled Snipflag v1.0.0. Verified GitHub's releases/latest endpoint returns v1.0.0 with draft=false, prerelease=false and seven assets. Source/tag remains 59017516274199f6b8461c3306f737777496bdb4; installers and checksums were not rebuilt or replaced. Checks 36227110895, installer run 36227111618, and publication run 36227461740 remain the green release evidence linked above. README, CHANGELOG, CI policy context and release notes now reflect the promotion. Unsigned filenames and signing/runtime limitations remain explicit.

A first local metadata-edit command had a PowerShell parse error caused by a typographic apostrophe; no mutation occurred. Corrected the quoting and successfully updated the release. No build, dependency install or runtime test was performed locally. Next: complete the detailed platform acceptance records and signing setup. Future prerelease workflow behavior is unchanged.

## UI polish request — 2026-09-26 (partial, not pushed, no CI run yet)

Owner asked for a broad UI overhaul. Done in this commit only: restored the original arrow-and-corners logo (from `aabea2e`) in black and white (`public/icon.svg`, docs copies); NSIS `installerIcon` set to the generated `icons/icon.ico`; visual green save dot and connection dot removed (save state stays as a screen-reader status); themed thin scrollbars; Settings/History dialogs use a fixed height with an inner scroll and a sticky section nav.

Still to do: open the editor at the full workspace size and remove expand/compact (Rust `editor_window` + tests); move utility controls into layout flow so the scrolling composer no longer overlaps them; labeled "New session" button near Create issue; theme-aware empty-state illustration using the new logo; styled dropdowns (`appearance: base-select`); texture, motion and a motion toggle; Web Audio sound effects for capture/issue created with a Settings toggle (needs `sounds`/`motion` keys in Rust `normalize_settings`); styled window controls; performance work (lazy-load App vs the capture overlay, pre-encode capture frames in parallel, reveal the window after first paint). Push, then verify Checks and installers before claiming success.
