# Current state / handoff

Entries before the capture-speed work (2026-09-26 to 2026-09-28) are in [STATUS-archive.md](STATUS-archive.md). Read it only when that history is needed.

## macOS bundle signed ad hoc — 2026-10-09 (no release)

The owner asked for both observations from the first Mac run to be acted on. No version, tag or release changed.

- **Signature:** `bundle.macOS.signingIdentity` is `"-"` (`5403a45`, merged in pull request #2), so the whole app bundle is signed ad hoc under `io.github.razee4315.snipflag`, with sealed resources. Development installers now fails a macOS build whose bundle is not signed that way.
- **Fresh clone:** CONTRIBUTING says to build the frontend once before the Rust tests.
- **Verification:** [Development installers 37942239067](https://github.com/Razee4315/snipflag/actions/runs/37942239067) **passed all four targets** at `5403a45` with `platforms=all`, the signature check included on both macOS targets. Artifacts kept until 2026-10-16: [macOS Apple Silicon](https://github.com/Razee4315/snipflag/actions/runs/37942239067/artifacts/11622821042), [macOS Intel](https://github.com/Razee4315/snipflag/actions/runs/37942239067/artifacts/11622911389). [Checks 37942285943](https://github.com/Razee4315/snipflag/actions/runs/37942285943) **passed** on the pull request (frontend; Rust on **Windows only**).

**Not verified:** nothing with this signature has been opened on a Mac: launch, the Screen Recording prompt, capture, and whether the grant survives a rebuild are all open. An ad hoc signature has no stable identity across builds, so macOS may still ask again after each update. The bundler also turned on the hardened runtime (`flags=0x10002(adhoc,runtime)`), which the linker-signed build did not have; nothing has been run under it. Not a Developer ID signature and not notarized. Use these artifacts, not the ones in the entry below, for the Mac walk-through.

## All-platform checks and installers at `18a8570`, for a walk-through on a Mac — 2026-10-09 (no release)

The owner asked for all platforms, to get a Mac build with the built-in Linear connection. No code, version, tag or release changed; `18a8570` is `81a7786` plus the documentation entry below.

- [Checks 37939902853](https://github.com/Razee4315/snipflag/actions/runs/37939902853) **passed on all platforms** with `all_platforms` (frontend; Rust tests and all-target checks on Windows, macOS, Linux).
- [Development installers 37939908796](https://github.com/Razee4315/snipflag/actions/runs/37939908796) **passed all four targets** with `platforms=all`, version 1.4.0, artifacts kept until 2026-10-16: [macOS Apple Silicon](https://github.com/Razee4315/snipflag/actions/runs/37939908796/artifacts/11621672127), [macOS Intel](https://github.com/Razee4315/snipflag/actions/runs/37939908796/artifacts/11621522892), [Windows](https://github.com/Razee4315/snipflag/actions/runs/37939908796/artifacts/11621542456), [Linux](https://github.com/Razee4315/snipflag/actions/runs/37939908796/artifacts/11620683038).
- The owner said the same day that the Mac run recorded below was himself, at the contributor's Mac.

**Not verified:** nothing from these runs has been opened on a Mac. They show that 1.4.0 compiles and packages for macOS with the Linear connection built in, not that it works there. Linear sign-in and submission, the updater, and every open item of the macOS line in TESTING.md "Manual native gates" are still open. There is no Intel Mac to run the Intel build on. The two observations below (`cargo test` in a fresh clone, the linker-only signature) are unchanged.

Next: the Apple Silicon artifact is walked through on the Mac against the macOS line in TESTING.md, and the result recorded there with the OS version. macOS and Linux downloads stay on v1.3.0 until a newer Mac build is published.

## 1.4.0 compiled and run on a Mac for the first time — 2026-10-09 (contributor, no release)

A contributor with a Mac (AleenaTahir1) built `main` at `81a7786` **locally** and ran it. This is outside the Actions-only rule, which is about the owner's computer; CONTRIBUTING allows contributors to run the tooling on their own machine. No code, version, tag, release or workflow changed: this entry and a matching one in TESTING.md are the whole change.

Machine: MacBook Pro (MacBookPro18,3, Apple M1 Pro), macOS 26.5.1 (25F80), built-in Retina display, 1512 × 982 points at 2x. Rust 1.99.0, Node 24.21.0.

- **First macOS compile of 1.4.0.** `npm ci`, `npm test` (64 passed), `npm run tauri -- icon public/icon.svg`, `cargo test --locked` (38 passed), `npm run tauri -- build --bundles app -- --locked`: all succeeded for `aarch64-apple-darwin`, no source fixes needed. The audit branch had not been compiled for macOS before (see below). Intel was not built.
- **The build has no built-in Linear connection and no updater key** (`SNIPFLAG_LINEAR_CLIENT_ID` and `SNIPFLAG_UPDATER_PUBKEY` are repository variables a fork cannot read), so it is the custom-client-only kind.
- **Launch:** the app started and stayed up, with no output on stderr; the main window was on screen at 1271 × 756 points; `snipflag.sqlite` and the `images` folder were created in Application Support.
- **Capture:** the contributor, at the Mac, reports taking a screenshot with it and that the app works. That is the first native capture on macOS on record. No detail was recorded with it: which permission prompts appeared, what the overlay looked like, the tray, the shortcut, or whether the picture was annotated or sent.

**Not verified:** every item of the macOS line in TESTING.md "Manual native gates" except a first launch and one capture on Apple Silicon and a Retina display. In particular permission deny and revoke, the menu bar item, Cmd shortcuts, the frameless window's controls, Linear sign-in and submission (not possible with this build), the updater, Intel, and a notarized launch.

Two things seen on the way, neither changed:
- `cargo test` fails with "proc macro panicked" in a fresh clone until the frontend has been built once, because `frontendDist` (`../dist`) does not exist yet. CI builds the frontend first, so it never sees this.
- The local bundle carries only the linker's ad hoc signature: `codesign` reports no sealed resources and an identifier of the form `snipflag-<hash>`. macOS ties the Screen Recording grant to the signature, so a rebuilt copy may ask again. Whether the published `.dmg` should be signed ad hoc as a whole bundle (`bundle.macOS.signingIdentity: "-"`) is an owner decision and would need its own runtime check; nothing was changed.

Next, if the owner wants macOS back in a release: run Checks with `all_platforms` and Development installers with `platforms=all` at the release commit (that gives a build with the Linear connection), and have the Mac gates in TESTING.md walked through on it.

## v1.4.0 released as Latest, Windows only — 2026-10-02

The owner asked for a release of the audit work, approved merging the branch, chose **Windows only** ("just for windows") and Latest. This is the first release without macOS/Linux builds.
- `main` fast-forwarded to the audit branch (`4eaa712`); `655bc61` adds a `platforms` input to the publish workflow (Windows only: two installers and only the Windows updater keys required); release source `8c7ae74` (1.4.0 in package, lock files, Tauri, Cargo; `docs/releases/v1.4.0.md`; CHANGELOG).
- [Checks 37016251148](https://github.com/Razee4315/snipflag/actions/runs/37016251148) and [Development installers 37016277064](https://github.com/Razee4315/snipflag/actions/runs/37016277064) **passed on Windows** at `8c7ae74`. [Publish 37017295596](https://github.com/Razee4315/snipflag/actions/runs/37017295596) created [v1.4.0](https://github.com/Razee4315/snipflag/releases/tag/v1.4.0): `.exe`, `.msi`, `SHA256SUMS.txt`, `latest.json`; then retitled "Snipflag v1.4.0" and marked Latest.
- Verified: `releases/latest` is v1.4.0 (not draft, not prerelease, 4 assets); `latest.json` serves 1.4.0 with signed `windows-x86_64`, `-nsis` and `-msi` entries; the three download URLs return 200.
- **macOS and Linux stay on 1.3.0.** Their in-app update check now reads a manifest without their platform, so a manual check reports that it could not check (background checks stay silent). Website and README link Windows to v1.4.0 and macOS/Linux to v1.3.0.
- **Not verified:** nothing in 1.4.0 has run in the installed app; the in-place update from 1.3.0 (and 1.2.0) to 1.4.0 has not been exercised. All native gates in TESTING.md "Audit changes" remain open. Installers are unsigned.

## Audit implemented on a branch (owner request) — 2026-10-02, merged and released as 1.4.0

The owner approved the audit ([AUDIT-2026-10-02.md](AUDIT-2026-10-02.md), made from `de97087`) and asked for it on branch **`audit/core-flow-improvements`**: one commit per finding with its ID, never on main, no force-push, no PR or merge without approval. `main` is unchanged at `de97087`. Version stays 1.3.0; no release, tag or asset change.

**Done** (IDs are the audit's; details in CHANGELOG "Unreleased"):
- Core flows: F-01 to F-12, F-14 to F-31, F-33.
- Missing features: M-02 (one Undo for removals, crops, reorders), M-05 (text plate), M-08 (progress bar), M-11 (tray hint); M-03, M-04, M-06 and M-09 are F-02, F-22, F-16 and F-24.
- Cleanup: C-01 to C-08, C-10 (clippy only), C-11, C-12.
- Optimization: O-03, O-05, O-06, O-09, O-10; O-02, O-04, O-07 and O-08 in part.
- Found while verifying: a new screenshot is now saved at once instead of after the 400 ms typing pause; the three dialogs load on first use.

**Not done, with reasons:**
- Owner decisions still open: F-32 (capture timing line in Settings) and C-13 (`saveOnCapture`). Left as they are.
- F-13 (delay countdown), M-01 (window capture), M-12 (drag-out): native features that CI cannot exercise; M-12 also needs a new dependency and lock file.
- M-07 (resume uploads) and M-10 (add to an existing issue): need a real Linear workspace to design and verify.
- O-01 (canvas layers): the highlighter multiplies into the screenshot and pixelation clears it, so both must stay on the screenshot's layer; splitting layers changes what is drawn. Needs a design the owner can look at.
- C-09 (typed Rust models), O-12 (binary IPC), O-11 (separate overlay stylesheet), the rest of O-02/O-04/O-07/O-08 (thumbnail without a full flatten, raw clipboard pixels, history in its own column, History summary columns): larger or schema-changing; not started.
- C-10 ESLint: needs new dev dependencies and a regenerated lock file, and will report many existing patterns. C-14 and C-15: local or optional.

**Verification (Windows only, per the build rule):** [Checks 37014449208](https://github.com/Razee4315/snipflag/actions/runs/37014449208) **passed** at `a8d34bc`: strict typecheck and production frontend build, 64 unit tests, 33 browser tests; on Windows 38 Rust tests, the all-target check and `cargo clippy -D warnings`. [Development installers 37014454074](https://github.com/Razee4315/snipflag/actions/runs/37014454074) **passed, Windows only**, at the same commit: [NSIS/MSI](https://github.com/Razee4315/snipflag/actions/runs/37014454074/artifacts/11229227713), version 1.3.0, 7-day retention. Later commits on the branch change documentation only. Earlier runs on the branch: 37009588189 (Phase 1, green), 37010808748, 37011246338, 37011496158 and 37012554160 (failures described below), 37013407771 (green).

Failures on the way, all fixed at the root: a CSS rule broken by a scripted edit (production build failed); two new browser tests that acted before the reloaded app was ready or before the draft was saved; six clippy findings in existing code (`is_none_or`, `as_chunks`, a test module moved to the end of `lib.rs`).

**Not verified:** nothing here has run in the installed app. Every native gate under "Audit changes" in TESTING.md is open, in particular: the capture refusal from the tray, the offline state, batched uploads and the refused-create path against real Linear, update download progress, the no-tray fallback (Linux), ink hit-testing and Tab stepping with a real pointer and keyboard, and every performance claim (none was measured). macOS and Linux were not compiled for this branch (`as_chunks` needs a current stable Rust).

Build output, `main` → branch: editor chunk 443.84 → 422.42 kB (dialogs moved to their own chunks), all JavaScript 680.50 → 693.57 kB, CSS 64.61 → 64.84 kB. Tests: 58 → 64 unit, 31 → 33 browser, 36 → 38 Rust.

Next: the owner reviews the branch and tests the Windows artifact against the checklist in the final report, then decides on merging and on the open items above.

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
