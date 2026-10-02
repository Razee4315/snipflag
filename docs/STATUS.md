# Current state / handoff

Entries before the capture-speed work (2026-09-26 to 2026-09-28) are in [STATUS-archive.md](STATUS-archive.md). Read it only when that history is needed.

## End-to-end audit (owner request) — 2026-10-02, awaiting approval

Audited `de97087` from source only; findings and a phased plan are in [AUDIT-2026-10-02.md](AUDIT-2026-10-02.md) (33 findings, no P0; missing features, cleanup and optimization lists). No application code changed, nothing built or run, no CI dispatched, nothing committed. Gains in the optimization list are estimates, not measurements. Next: the owner approves a phase (and answers the five decisions at the end of the audit) before any code is modified.

## v1.3.0 released as Latest — 2026-10-02

The owner asked for a new release and, when told the release needs every platform, confirmed all platforms ("as it is actual release so each of them"). This is the one exception so far to the Windows-only build rule.
- Since the previous entry: living theme backdrops (Paper notebook page, Blossom petals, Midnight night sky, Graphite carbon weave and sheen), Markdown rendered in the report preview (`src/markdown.ts`, `Markdown.tsx`), filmstrip thumbnails keep the previous flattened picture while re-rendering, and the title-bar save indicator was removed at the owner's request (`7526dac`, `162e295`). Theme backdrops were tuned in a static mock page with the real stylesheet (`.claude/theme-preview.html`, untracked), not in the app.
- Release source `e4575d9` (version 1.3.0 in package, lock files, Tauri, Cargo; `docs/releases/v1.3.0.md`; CHANGELOG).
- [Checks 36969844224](https://github.com/Razee4315/snipflag/actions/runs/36969844224) **passed on all platforms** (frontend; Rust tests and all-target checks on Windows, macOS, Linux): the first macOS/Linux compile since `c4d9d42`, no fixes needed. [Development installers 36970245137](https://github.com/Razee4315/snipflag/actions/runs/36970245137) **passed all four targets**. [Publish 36970754606](https://github.com/Razee4315/snipflag/actions/runs/36970754606) created [v1.3.0](https://github.com/Razee4315/snipflag/releases/tag/v1.3.0): six `unsigned-` installers, two macOS update archives, `SHA256SUMS.txt`, `latest.json`. It was then retitled "Snipflag v1.3.0" and marked Latest, as with earlier versions.
- Verified: `releases/latest` returns v1.3.0 (not draft, not prerelease, 10 assets); the updater endpoint serves `latest.json` for 1.3.0 with all ten platform keys.
- Website and README point to v1.3.0 with real sizes; three feature cards added (useful without Linear, markup kit, capture readiness); compare pages and sitemap regenerated; `check_site.py` passes on 7 pages; the 3 x 3 feature grid and download cards were checked in the built-in browser.
- **Not verified:** an in-place update from 1.2.0 to 1.3.0 (the first real updater test: the owner's 1.2.0 install should show "Update to 1.3.0"); the final build's themes and Markdown preview in WebView2; every native gate listed below and in TESTING.md; nothing new has been run on macOS or Linux. Installers remain unsigned.
- Open with the owner: keep or remove the `saveOnCapture` setting (shipped off by default). Not built: one-click window capture, pin to screen, drag-out to other apps, OCR.

## Editor overhaul: sharing beyond Linear, canvas, filmstrip, panel, history (owner request) — 2026-10-02

The owner asked for a component-by-component improvement and for Snipflag to be useful outside Linear (mark up, then send to a person or to Claude Code). Implemented in order, each with tests; all at `70e3a9c`:
- **Share (`1afae5e`):** share bar under the image (Copy image, Copy for AI, Save image). Copy for AI writes every flattened screenshot to `Pictures/Snipflag` (Rust `share_images`, names chosen in Rust) and copies title, description, paths and step notes (`src/share.ts`). Notes on numbered steps (`Annotation.note`, no undo entries) in a list floating over the canvas corner; "Add step notes" appends them to the description. The Linear panel can be hidden (remembered in localStorage) with a view transition (`src/motion.ts`). Ctrl+C copies the image, Ctrl+Shift+C copies for AI.
- **Canvas (`84a7b7e`, `3ecae24`, `542c6bc`):** crop (new image ID, marks translated, Undo crop in the toast), line tool, Ctrl+wheel zoom toward the pointer, Space/middle-button pan, arrow-key nudge, Ctrl+D duplicate, snap guides while moving marks (Alt to move freely), eased zoom buttons, auto-margin centering so zoomed images scroll to every edge. Strokes capture the pointer, so drawing continues along the edge when the pointer leaves the picture (owner-reported bug).
- **Filmstrip (`5f93868`, `b605d0d`):** pointer-based drag to reorder (HTML drag-and-drop did not start reliably from a button in CI), tiles glide, "Put back" after remove (restored under a new ID with alias and history), larger thumbnails.
- **Issue panel and title bar (`87e2d7e`):** label chips with a search-to-add combobox, title/team errors at the field, joined search+select for long lists, visible Saved indicator, maximize toggle (Rust `editor_window` action `maximize`), toolbar and share bar drag the window, rounder dialog close button.
- **History (`b605d0d`):** protected thumbnail saved with the draft (`preview`, bounded PNG data URL validated in Rust, excluded from report content), search, All/Drafts/Sent.
- **Optional `saveOnCapture` setting (`3ecae24`), off by default:** writes each raw capture to `Pictures/Snipflag`. The owner questioned the clutter; kept off by default pending their decision to keep or remove it.
- "Copy for AI" uses a terminal icon at the owner's request (the sparkle was disliked).

Verification: [Checks 36967400869](https://github.com/Razee4315/snipflag/actions/runs/36967400869) **passed** at `70e3a9c` (frontend build, unit tests, 32 browser tests; Rust tests and all-target check on **Windows only**). [Development installers 36967799586](https://github.com/Razee4315/snipflag/actions/runs/36967799586) **passed, Windows only**: [NSIS/MSI](https://github.com/Razee4315/snipflag/actions/runs/36967799586/artifacts/11210439031). Failures on the way were all in new tests (raw mouse input during the panel slide, a toast replacing Undo, an animation wait rejecting on cancel, wrong snap arithmetic, reading storage before the save) except one real change: filmstrip drag was rewritten from HTML drag-and-drop to pointer tracking.

**Not verified (no native run):** Copy for AI file writing and clipboard text, Ctrl+C shortcuts, maximize, window dragging from the toolbar, label picker interaction and field errors (need a connected workspace), pan/zoom feel with a real mouse, view transitions in WebView2, and every capture-overlay item from earlier rounds. macOS/Linux have not been compiled since `c4d9d42`.

**Not built yet (owner wants them):** capture a window with one click, pin a screenshot on screen, drag the image out to other apps (needs a native drag plugin and a regenerated lock file), OCR copy-text (needs the Windows OCR API as a new dependency). Scrolling capture and GIF recording were proposed as later work.

Next: owner tests the Windows artifact; then window capture, pin, drag-out, OCR in that order.

## Themes, capture options, Windows-only builds (owner requests) — 2026-10-02

- **Build policy (`b5811b3`):** the owner asked that builds stop running for every OS. `ci.yml` native job runs on Windows only unless dispatched with `all_platforms`; `build.yml` has `platforms` (`windows` default, `all`). Use all platforms only when the owner explicitly asks. A release still needs the four-platform installer run, so ask first. The in-progress three-OS Checks 36931783259 was cancelled at the owner's request.
- **Capture default (`c4d9d42`):** releasing the drag captures at once again. Adjusting the selection is the setting `adjustSelection`, off by default.
- **New Capture settings, all off by default, validated in Rust:** `magnifier` (13 x 13 frame pixels at 10x beside the pointer, with position), `copyOnCapture` (Rust copies the cropped pixels; the editor reports success or failure), `captureDelay` (0/3/5/10 s, applied by Rust after the editor hides). Rust reads them when a capture starts and sends adjust/magnifier to the overlay with the generation.
- **Themes (`c4d9d42`, `4bdf01d`):** Paper, Blossom, Midnight, Graphite, each a full palette with its own grain; lit top edge (`--sheen`) on titlebar, panel, toolbar and dialogs; grain on the stage and toolbar; theme cards in four columns with colors from the card; a picked theme previews at once and reverts if Settings closes unsaved. After reviewing CI screenshots, Paper and Graphite textures were made calmer, and the sticky Settings tabs now cover scrolled content (they showed it around the rounded corners once the Capture section grew).
- **Verification:** [Checks 36932626923](https://github.com/Razee4315/snipflag/actions/runs/36932626923) **passed** at `4bdf01d` (frontend build, unit tests, browser tests including the new theme/capture-options test; Rust tests and all-target check on **Windows only**). [Development installers 36933161414](https://github.com/Razee4315/snipflag/actions/runs/36933161414) **passed, Windows only**: [NSIS/MSI](https://github.com/Razee4315/snipflag/actions/runs/36933161414/artifacts/11197131918). macOS and Linux were **not** compiled or tested for `c4d9d42` onward.
- **Not verified:** everything in the overlay (default release-to-capture, adjust mode, magnifier, delay, clipboard copy) and the ghost-editor fix, on a real machine; theme appearance in WebView2; the final Paper/Graphite textures were not re-screenshotted after tuning.

Next: owner tests the Windows artifact. Before any release, run all platforms (with the owner's go-ahead) since three commits have not been compiled for macOS/Linux.

## Capture speed (owner request) — implemented, not runtime-verified, 2026-10-02

The owner reported that capture is slow next to Windows Snipping Tool and asked whether to rewrite in Qt. Decision: keep Tauri; the delay came from the capture flow. Implemented in `9dd39bf`:
- **Warm overlays:** one hidden overlay window per display is opened 1.5 s after launch and reused (hidden, not destroyed, after each capture; created on demand for a new display). Previously a WebView2 window was created for every capture.
- **Raw frames:** the overlay loads its frozen frame from the new in-memory `snipframe` protocol as an uncompressed 24-bit BMP. The PNG encode, base64 and IPC string for the preview are gone. Each capture has a generation; other windows and ended captures get 404.
- **Hide wait:** on Windows, two `DwmFlush` passes after the editor hide is applied (was a fixed 300 ms; 0 instead of 60 ms when the editor was already hidden). macOS/Linux keep 300 ms. Tray-menu captures wait 350 ms from the click.
- **After selection:** fast PNG compression (Up filter), dense encoder only if the result exceeds 20 MB.
- **Timing:** Settings → Capture shows the last capture's total and steps (save, hide, read screen, show). Durations only.
- Overlays are created unfocused and get window and webview focus when shown. The overlay waits for the frame to paint (at most 120 ms) before showing.

Verification: [Checks 36923352373](https://github.com/Razee4315/snipflag/actions/runs/36923352373) **passed** at `9dd39bf` (frontend build, unit and browser tests; Rust tests and all-target checks on Windows, macOS, Linux). [Development installers 36924611540](https://github.com/Razee4315/snipflag/actions/runs/36924611540) **passed all four targets** at `9dd39bf`, version 1.2.0, 7-day retention: [Windows NSIS/MSI](https://github.com/Razee4315/snipflag/actions/runs/36924611540/artifacts/11193562887). No local build or install.

**Not verified:** no capture has been run with this build, so the speed gain is unmeasured. Open native gates are in TESTING.md "Capture speed": measured times, no editor in the frame, no stale or black flash on a reused overlay, keyboard focus (Escape/Enter, and no focus theft at warm-up), tray capture, display changes, idle memory, and the `snipframe` image on macOS/Linux webviews. No release, tag or version change.

### Owner test of `9dd39bf` and follow-up — 2026-10-02

Owner installed the Windows build (Windows 10 19045): capture with the editor in the tray is good; with the editor open it is faster but **a half-faded editor appeared in the screenshot** (Windows fades a hiding window for about 200 ms; two compositor passes were not enough). No timing numbers were reported.
- `d6f850f`: during a capture the editor hides with `DWMWA_TRANSITIONS_FORCEDISABLED` and content protection (excluded from capture), both removed when the editor returns; settle margin 40 ms after the two `DwmFlush` passes (300 ms if DWM does not flush). Windows only.
- `907ba7e` (owner chose "adjust before confirm"): the selection stays after the drag with eight handles, move, arrow/Shift+arrow nudges; Enter, double-click or Capture confirms; Escape clears the selection, then cancels. Drag-and-release no longer captures at once. `adjustRect` in `model.ts` with a unit test.
- [Checks 36928897037](https://github.com/Razee4315/snipflag/actions/runs/36928897037) **passed** at `907ba7e`. Checks 36928677816 for `d6f850f` was cancelled by the newer push, not failed. [Development installers 36929504653](https://github.com/Razee4315/snipflag/actions/runs/36929504653) **passed all four targets** at `907ba7e`: [Windows NSIS/MSI](https://github.com/Razee4315/snipflag/actions/runs/36929504653/artifacts/11195422879).
- **Not verified:** whether the ghost is gone, and the adjustable selection in WebView2 (pointer capture, double-click, focus). Both need the owner's test of this build.

Next: the owner installs the Windows artifact, captures a few times, and reports the Settings → Capture timing line. If the "save" or "show" step dominates, tune that step; a native (non-webview) selection overlay is the fallback if this is still too slow.

## Decisions locked by user

Tauri 2 + Rust + React/TypeScript. Windows primary, macOS/Linux targets. All builds on GitHub Actions, no local builds or large dependencies. Multiple screenshots in a single reporting session → one Linear issue. Product name: **Snipflag** (evidence in [NAME.md](NAME.md)).

## Resume procedure

1. Read this file and AGENTS.md. Inspect git status and current Actions results.
2. Fix failing remote checks before new features. Never run local builds.
3. Work against PRODUCT acceptance criteria; preserve multi-image semantics.
4. Update this file with implementation truth, exact verification evidence, open gaps, and next action before ending work.
