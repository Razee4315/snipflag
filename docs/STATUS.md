# Current state / handoff

## Independent studio launch film — 2026-09-27

First full-render attempt at `267543a`, [36312544787](https://github.com/Razee4315/snipflag/actions/runs/36312544787), failed before proof capture: renderer expected Chromium headless shell 1208 but the implicit parent-package installation installed a different browser. Added an isolated film package and invoke that package's exact Playwright CLI. Source extraction, font download, score synthesis and syntax checks passed. Next: rerun proofs and final render; no finished video claimed yet.

Source inspection at `1569dfd` passed [Studio launch film 36312253810](https://github.com/Razee4315/snipflag/actions/runs/36312253810). Inspected the downloaded source contact sheet: existing public demo is 32.6 seconds, 1280×680, 30 fps, and contains the actual editor and Linear result. New timeline, original synthesized score, four-part 1080p60 renderer, proof frames and encoded-stream checks are now authored; first full render remains pending. Existing privacy masking is retained; no new Linear requests are made. Next: inspect proof frames, correct visual defects, then download and verify the completed film.

Owner requested a fresh launch video, ignoring the earlier film. Work starts from `6a54595` on `codex/launch-film`; `video/launch/` remains untouched. Direction and isolated Actions source-inspection workflow are in `video/studio/` and `.github/workflows/studio-film.yml`. Intended delivery is a 42-second 1080p60 film with actual product UI, the existing owner demo and original motion/sound. Not rendered or verified yet. Next: inspect source contact sheet, implement timeline, render remotely and visually review output. No local builds/installations or release changes.

## Launch video (owner request) — branch `launch-video`, 2026-09-27

- `video/launch/` is a 57 s, 1920×1080, 60 fps launch film built as a deterministic HTML timeline (`film.js` `seek(t)`), with the Snipflag editor rebuilt in HTML/CSS from `src/style.css` tokens and `src/components/icons.tsx`, and the same synthetic Acme fixtures the website hero uses. Story: "You found a bug" → the old way in six steps (PrtSc, paint-style scribble, Save As, open Linear, type the description, attach the file) → "Now do that twelve times" → brand reveal → capture with Ctrl+Shift+2 → annotate (box, pixelation, arrow, step) → multiple images and @image references → Create issue → resulting issue → feature grid → outro.
- Soundtrack is synthesized with OfflineAudioContext in `audio.js` (120 BPM music plus the app's own shutter, pop and success cues from `src/sound.ts`), sample-locked to the picture.
- `.github/workflows/launch-video.yml` renders it on Actions (Playwright frame capture, ffmpeg H.264 + AAC) on pushes to `launch-video`; nothing was rendered or installed locally. The Linear issue shown is a mock-up of the result, not a captured Linear page.

### Render review checkpoint — 2026-09-27

- Baseline `b5cb480`: [Launch video 36311487293](https://github.com/Razee4315/snipflag/actions/runs/36311487293) still rendering at this checkpoint; setup passed. No success claimed yet.
- Realistic old-way screens are committed in `6a54595`, awaiting push after the baseline run completes.
- Local preview/source review found duplicate `c2`/`c3`/`c4` IDs: old-way cursors intercepted the feature-card animation selectors. Renamed the cursor IDs; the renderer now rejects duplicate IDs before capture. Aligned the old-way shutter cue to its 2.16 s flash, corrected noise filter routing, and moved the poster to the complete 55.2 s end card.
- Added Actions-only extraction of timestamped contact sheets and key full-resolution frames from the encoded MP4. Final encoded visual/audio review remains pending. No local dependency installation, build, encoding or frame extraction.
- Next: finish baseline inspection, push corrected realistic film, inspect its Actions results/artifacts, polish any remaining faults, and deliver the MP4.

## Website: "Try it" section removed (owner request) — 2026-09-27

- Removed the in-browser "Try it" editor section from `site/index.html`, `site/assets/js/editor.js`, and its CSS.
- Removed the "Try it" header and footer links on every page. The hero and compare CTA ghost buttons now say "See how it works" and link to `#how`. `site/tools/build_pages.py` matches.
- `site/assets/img/sample.webp` is now unused, but the Website screenshots workflow still produces it.

## v1.2.0 released as Latest — 2026-09-26

The owner explicitly approved publishing all Add next work and the updater as **v1.2.0** marked Latest; this replaces the earlier "keep 1.1.0" instruction. Version bump and notes in `61f807e` (package, package-lock, Tauri, Cargo, Cargo.lock; `docs/releases/v1.2.0.md`; CHANGELOG).
- [Checks 36260585537](https://github.com/Razee4315/snipflag/actions/runs/36260585537) and signed [Development installers 36260586278](https://github.com/Razee4315/snipflag/actions/runs/36260586278) **passed** at `61f807e`. [Publish 36261003234](https://github.com/Razee4315/snipflag/actions/runs/36261003234) verified both runs against that commit and created [v1.2.0](https://github.com/Razee4315/snipflag/releases/tag/v1.2.0) with six `unsigned-` installers, two macOS update archives, `SHA256SUMS.txt` and `latest.json`. It was then edited to a regular release titled "Snipflag v1.2.0" and marked Latest, as v1.1.0 was.
- Verified: `releases/latest` returns v1.2.0 (not draft, not prerelease), and the updater endpoint serves `latest.json` for version 1.2.0 with all ten platform keys. README and website links now point to v1.2.0 with real sizes; every asset link returns 200.
- Still true: installers are not Authenticode/Apple-signed (update packages carry Snipflag's updater signature). v1.1.0 installs have no updater and need a manual upgrade. A real in-place update can only be tested once a later version exists. Native runtime gates in TESTING.md remain open. The updater key files stay in `%USERPROFILE%\.snipflag\`; the owner has backed them up and asked that they be kept.

## Auto-updater (owner request) — implemented, key pending, 2026-09-26

The owner asked for an auto-updater after the Add next work. Implemented in `251c416`, with test fix `81a8abb`:
- Rust `update.rs` uses `tauri-plugin-updater` 2.12.0 through two main-window commands. No JS plugin or webview permission was added. The fixed endpoint is `https://github.com/Razee4315/snipflag/releases/latest/download/latest.json`. The public key comes from build-time `SNIPFLAG_UPDATER_PUBKEY` (format checked in `build.rs`). **Without it, builds cannot check or install updates; there is no placeholder key.**
- The UI checks 8 s after launch and every 6 h, with an About switch (`autoUpdate`, Rust-validated) and a manual check. A found update appears as a titlebar "Update to X" action. Install reuses the quit handshake: it commits active edits, saves, and refuses while busy. Rust also refuses during a Linear operation. It then downloads, verifies the signature, installs and restarts. Nothing installs without the user choosing it.
- Development installers: the preflight requires both the public-key variable and the private-key secret, or neither. The secret reaches only the build step. With both, builds produce signed updater artifacts (macOS bundles now `app,dmg`). The publish workflow adds `latest.json` (NSIS default, MSI, macOS per-arch `.app.tar.gz`, AppImage, deb when signed) and fails if a platform is missing.
- `Cargo.lock` was generated on Actions by the new minimal bootstrap mode ([Bootstrap 36248003915](https://github.com/Razee4315/snipflag/actions/runs/36248003915), temporary branch `updater-lock`, since deleted). It only adds new entries; no existing versions changed. package-lock unchanged.
- [Checks 36248085850](https://github.com/Razee4315/snipflag/actions/runs/36248085850) **failed** the typecheck: `src/onboarding.test.ts` rendered SettingsDialog without the new callbacks. Fixed in `81a8abb`; no assertions changed. [Checks 36248164071](https://github.com/Razee4315/snipflag/actions/runs/36248164071) **passed**: 40 unit tests, 26 browser tests, 32 Rust tests on each of Windows/macOS/Linux, all-target checks. [Development installers 36248474143](https://github.com/Razee4315/snipflag/actions/runs/36248474143) **passed all four targets** at `81a8abb` without a key, so these builds have updates off. Signed updater artifacts are not yet proven.

**Key configured (owner-approved, 2026-09-26).** At the owner's explicit request, an updater key pair was generated locally with the Tauri CLI (`npx @tauri-apps/cli@2.11.5 signer generate`, no project install). The files are outside the repository in `%USERPROFILE%\.snipflag\`. Secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` and variable `SNIPFLAG_UPDATER_PUBKEY` were stored via `gh` without printing values. **The owner must back up the private key and password and delete the plain-text password file**; losing either breaks future updates.

[Development installers 36251667883](https://github.com/Razee4315/snipflag/actions/runs/36251667883) **failed** on all targets: the bundler validates the signing key against `plugins.updater.pubkey`, which is empty in the checked-in config. Fixed in `1d3ec5c`: the workflow generates the updater config (createUpdaterArtifacts plus the public key) at build time and removes the static file. [Development installers 36252106685](https://github.com/Razee4315/snipflag/actions/runs/36252106685) **passed all four targets** at `1d3ec5c` with signed updater artifacts: NSIS, MSI, both macOS `.app.tar.gz`, AppImage and deb each have a `.sig`. A local dry run of the publish script's manifest logic on these artifacts (release calls stubbed) produced `latest.json` with every required platform and URLs matching asset names. No release was published. Runtime update installation is still unverified; it needs two published versions, see TESTING.md.

Phase 3 installers: [Development installers 36247716961](https://github.com/Razee4315/snipflag/actions/runs/36247716961) **passed all four targets** at `e5ec113` (unsigned, 7-day retention).

## Add next Phases 2 and 3 — implemented and remotely checked, 2026-09-26

Started from `9bbd76f`: Phase 1 (built-in public Linear client) was already implemented and verified (see below); remote main matched and only unrelated `.claude/` was untracked.

**Phase 2, report preview: `5ed9a13`.** Eye button beside Create issue opens *Report preview*: destination workspace/team, priority, project, assignee, labels, title, prose with `@image` chips, ordered section headings, flattened images at original size (file name, dimensions, size) and the exact Markdown with upload placeholders. It states that nothing has been uploaded; Create issue from the preview is disabled with the reason until the report is valid and connected. Rust `compose_description` is now the single description builder for submission; `src/report.ts` mirrors it and both run `src/report.fixtures.json` (aliases, reorder, legacy drafts, literal code, Unicode, escaping, 200-character captions). Create from the preview reuses the reviewed pixels only if the session object is unchanged after the pre-send save; otherwise it flattens again. Tool/paste shortcuts are ignored while any modal dialog is open. Preview is optional; Create issue stays one click. [Checks 36246997530](https://github.com/Razee4315/snipflag/actions/runs/36246997530) **passed**: build, 37 unit tests, 25 browser tests, Rust tests and all-target checks on Windows/macOS/Linux.

**Phase 3, templates and team defaults: `e5ec113`.** Built-in templates (Bug report, Visual defect, Regression, Design feedback) are shown only under an empty description and are editable in Settings → Templates (add/remove/rename/restore; `null` keeps built-ins so future improvements reach unedited installs). After a confirmed create (or successful reconciliation) the project, assignee, labels and priority are remembered per team (max 100 teams). They fill only empty fields when a draft's team changes and only with IDs the team currently offers; drafts restored with a team are untouched. The remembered workspace team now applies once per draft, including new sessions (previously only at startup). Disconnect and Settings → Forget clear remembered details. Team/project/assignee get a search field above eight items; team metadata failures show Retry. Rust validates all new settings. The existing composer test now uses the Bug report template (assertions unchanged); the settings size test includes the new tab. [Checks 36247399641](https://github.com/Razee4315/snipflag/actions/runs/36247399641) **passed**: build, 40 unit tests, 26 browser tests, 30 Rust tests on each of Windows/macOS/Linux, all-target checks. [Development installers 36247716961](https://github.com/Razee4315/snipflag/actions/runs/36247716961) **passed all four targets** at `e5ec113`.

Not verified: anything needing a real Linear workspace or installed app. That includes comparing preview to a created issue, filling remembered details from live metadata, search with long real lists, and WebView2 rendering of the new dialog and templates. See TESTING.md; no real Linear issues or uploads were made. Version 1.1.0; no release, tag or asset changes; no local builds.

Next: record the installer result, then the owner-requested auto-updater. It needs an owner-generated updater signing key; see the updater entry once added.

## Add next Phase 1 — implementation remotely verified, 2026-09-26

Pushed implementation `504df63` and test correction `562c613bd1939139528e7cb0bfd40ec008b849c9`. Owner-provided public client ID is configured in repository variable `SNIPFLAG_LINEAR_CLIENT_ID`. Configured installers offer Connect Linear directly, with custom-client setup under Advanced. Saved empty IDs now use the built-in default; existing custom IDs and credential refresh identities are preserved. Loopback receipt copy no longer claims connection before token exchange. Build configuration is validated, and missing built-in IDs fail packaging unless custom-client-only mode is explicitly selected.

- [Checks 36242565989](https://github.com/Razee4315/snipflag/actions/runs/36242565989) **passed** at `562c613`: strict TypeScript/production frontend build, 31 frontend unit tests, 24 Chromium tests, 29 Rust tests on each of Windows/macOS/Linux, and all-target native checks.
- [Development installers 36242368649](https://github.com/Razee4315/snipflag/actions/runs/36242368649) **passed all four targets** at `504df63`, including the configured-client preflight. The only changes from that source to the checked `562c613` are the browser test correction and STATUS documentation; application/build source is identical. Version **1.1.0**, unsigned, 7-day retention: [Windows NSIS/MSI](https://github.com/Razee4315/snipflag/actions/runs/36242368649/artifacts/10906821752), [macOS Intel](https://github.com/Razee4315/snipflag/actions/runs/36242368649/artifacts/10906481261), [macOS Apple Silicon](https://github.com/Razee4315/snipflag/actions/runs/36242368649/artifacts/10906361573), [Linux deb/AppImage](https://github.com/Razee4315/snipflag/actions/runs/36242368649/artifacts/10905893507).
- Earlier [Checks 36242360013](https://github.com/Razee4315/snipflag/actions/runs/36242360013) failed one browser test because it tried to edit the now-collapsed Advanced field. `562c613` opens the section first; all original assertions remain and the final suite passes.
- No local builds/dependency installs, release/tag/version changes, published-asset replacements, or real Linear uploads/issues. Unrelated `.claude/` content remains untouched and untracked.

Open runtime gates: verify this owner's OAuth application's callback/distribution with a fresh Windows profile and an intended second workspace; cancellation, keyring failure, refresh, custom-client fallback and restart. CI does not prove real login, capture, signing, or Linear submission/recovery. Retain `read,write` until an explicitly authorized synthetic test proves `read,issues:create` supports metadata, `fileUpload`, optional fields and reconciliation; source/documentation evaluation is in LINEAR.md. All earlier native gates still apply. Phase 2 complete report preview is the next implementation checkpoint, followed by Phase 3 templates/team defaults; neither is implemented here.

## Add next: Linear onboarding implementation — 2026-09-26

Implementation `504df63`: [Checks 36242360013](https://github.com/Razee4315/snipflag/actions/runs/36242360013) passed typecheck/build and 31 unit tests, but one of 24 browser tests timed out trying to fill the now-collapsed advanced client field; native jobs were skipped. Corrected that existing test to open Advanced before editing (no assertion removed). [Development installers 36242368649](https://github.com/Razee4315/snipflag/actions/runs/36242368649) still running at this checkpoint; all four configuration preflights passed. Next: rerun Checks with the test correction and record final packaging evidence.

Started from `19a41d1477cbb01993d28586456cf3baeb8a3e37`; remote main matched, prior final checks/installers were green, only unrelated `.claude/` content was untracked. Owner supplied the public OAuth client ID; repository variable `SNIPFLAG_LINEAR_CLIENT_ID` is now configured. No secret requested or stored.

Implemented in this checkpoint, remote verification pending: direct Connect Linear with a built-in public client; custom IDs under collapsed Advanced settings; empty saved IDs resolve to the current build default without overwriting existing custom IDs; explicit return to built-in connection; truthful loopback receipt copy; build-time ID validation and installer preflight with an explicit custom-client-only option. Added Rust selection/upgrade and frontend availability/persistence regressions. Version remains 1.1.0; no release/tag/assets changed, local builds/installs, or real Linear uploads/issues.

Scope review: retain `read,write` pending authorized runtime verification of `read,issues:create`, especially `fileUpload`; current official docs and operation inventory are recorded in LINEAR.md. Next: push this focused checkpoint, run Checks and unsigned development packaging, fix any failures, then record exact commit/run links. Native login, registration/distribution, refresh and all previous runtime gates remain open. Phase 2 preview and Phase 3 templates/defaults are not implemented by this checkpoint.

## Fix-first completed and remotely verified — 2026-09-26

Final source: `72560a85fa542f5b1e05ad026d9e42f23b9c081f` (`72560a8`). Focused implementation commits, all pushed: `466bdc0` privacy rendering/thumbnails; `ae51c04` empty drafts, durable undo and retryable deletion; `776cc31` immutable submissions and quit handshake; `2de9867` cleanup/capture/quit hardening; `72560a8` defensive save-error preservation.

- [Checks 36241550474](https://github.com/Razee4315/snipflag/actions/runs/36241550474) passed every job at the final source: strict typecheck/production frontend build, 28 frontend unit tests, 24 Chromium browser tests, and 28 Rust tests plus all-target checks on Windows/macOS/Linux.
- [Development installers 36241561955](https://github.com/Razee4315/snipflag/actions/runs/36241561955) passed all four targets at the same source, version **1.1.0**, unsigned, 7-day artifact retention. [Windows NSIS/MSI](https://github.com/Razee4315/snipflag/actions/runs/36241561955/artifacts/10906875238), [macOS Intel](https://github.com/Razee4315/snipflag/actions/runs/36241561955/artifacts/10906770556), [macOS Apple Silicon](https://github.com/Razee4315/snipflag/actions/runs/36241561955/artifacts/10906296232), [Linux](https://github.com/Razee4315/snipflag/actions/runs/36241561955/artifacts/10906125672).
- No test/build failures in this workstream. Intermediate Checks 36241384370 passed frontend but was superseded/cancelled by the final push; final verification above covers all changes.
- No local builds, dependency installs, browser installs or Rust compilation. No release workflow, tag, version bump, release-asset replacement, or real Linear test issue. Existing published 1.1.0 remains unchanged. Unrelated `.claude/` content remains untracked and untouched.

All six fix-first categories are implemented: persisted removal/emptying, safe app-initiated quit, exact uncertain-submission recovery, protected thumbnails, durable bounded per-image undo/redo, and visible/retryable deletion plus pixelation edge handling. Privacy exports still retain original dimensions, use at least 12px true block averages, and render legacy redactions last. Old drafts remain readable; history predating this change cannot be reconstructed. Old uncertain attempts without snapshots stop for explicit review rather than guessing their submitted content.

Next: test the Windows development artifact against the native scenarios in TESTING.md, especially immediate tray Quit, locked-file deletion and real authorized Linear response-loss recovery. Compilation, automated browser tests and packaging do not constitute native runtime verification. Forced termination/power loss and guaranteed anonymization are not claimed. Later feature backlog remains unimplemented by design. This final checkpoint is documentation only.

### Fix-first defensive save follow-up — 2026-09-26

`2de9867` [Checks 36241384370](https://github.com/Razee4315/snipflag/actions/runs/36241384370) passed frontend including expanded privacy regressions; native jobs were still running at this checkpoint. Final two defensive changes: an uncertain status must not convert an existing draft-save error into successful Quit, and failed orphan cleanup during autosave is retained in native cleanup status. These changes require their own final remote check. No test failures observed so far in this workstream. Version and release assets unchanged.

### Fix-first final hardening — 2026-09-26

Recovery commit `776cc31`: [Checks 36240959516](https://github.com/Razee4315/snipflag/actions/runs/36240959516) passed all jobs. Final refinements pending CI: keep mutations frozen after quit acknowledgment, mark capture busy through completion so Quit cannot discard an in-flight capture, serialize thumbnail rendering to limit concurrent full-size canvases, preserve saving state for emptied drafts, surface retention cleanup failures, and cover fractional/transparent/legacy privacy boundaries. Updated SECURITY, TESTING and ARCHITECTURE to match the new behavior. Next: verify the final refinement on all remote checks and record exact evidence. Version 1.1.0 and published release remain unchanged.

### Fix-first submission and quit checkpoint — 2026-09-26

Persistence commit `ae51c04`: [Checks 36240649340](https://github.com/Razee4315/snipflag/actions/runs/36240649340) passed all jobs. Implemented next, verification pending: submission state and immutable report snapshot commit together before issueCreate; unknown outcomes lock the report across restart; explicit Check previous attempt reconciles only, and confirmed absence unlocks without creating/uploading again. Rust rejects edits against a locked snapshot; success reloads the actual stored submitted revision. Old unknown submissions without a snapshot stop with an explicit review message rather than inventing a revision. Deleting local history removes content snapshots but retains minimal deduplication receipts.

Quit now requests a renderer save acknowledgment, commits active text/drawing, and waits for durability; busy/save-failure/timeout paths keep the app open. OS-forced termination remains outside this guarantee. Added lifecycle unit tests, renderer text-commit/pending-lock browser tests, and Rust restart/snapshot/retention regressions. Next: remote CI, fix failures, review edge cases and update TESTING/SECURITY. No release/version changes or real Linear posts.

### Fix-first persistence checkpoint — 2026-09-26

Privacy commit `466bdc0`: [Checks 36240353339](https://github.com/Razee4315/snipflag/actions/runs/36240353339) passed frontend and all three native platforms. Implemented next (verification pending): intentional empty sessions persist, bounded per-image undo/redo survives restart, startup selects the first eligible unsent session, deletion failures keep a retryable History entry, deletion tombstones reject stale saves, and clear-history includes orphan files from failed saves. Save/delete operations are serialized in Rust, and frontend deletion drains pending saves. Retention excludes uploading/uncertain submissions. Added browser restart regressions and Rust deletion/orphan/history tests. Next: CI verification, immutable submission reconciliation and save-before-quit handshake. Version remains 1.1.0; no release workflow invoked.

## Fix-first implementation — privacy checkpoint, 2026-09-26

Owner authorized all six fix-first items, focused commits, remote checks, and no new release/version. Baseline now `c028dd1`; another workstream published 1.1.0 before this task. This task keeps 1.1.0 and will not publish or replace release assets.

Implemented in this checkpoint (verification pending): pixelation clears the original covered pixels before drawing averaged pixels, uses outward-rounded coverage, and is rendered after ordinary marks; legacy redactions remain last. Filmstrip and mention previews now use bounded flattened thumbnails with no original-image fallback. Added a patterned translucent export/thumbnail/reload browser regression. Audit document retained as the historical assessment. Next: remote CI, then durable empty-draft/undo, deletion, quit, and uncertain-submit fixes. No local builds or installs.

## Product and engineering audit — 2026-09-26

Owner requested a detailed audit and roadmap. Audited checkout `9f4dd38`; findings and proposed work are recorded in [AUDIT-2026-09-26.md](AUDIT-2026-09-26.md). Application code was not changed; no new implementation, commit, publication, native runtime test, or local build/install was performed. Audit documents are local and uncommitted.

Remote evidence rechecked: [Checks 36235494635](https://github.com/Razee4315/snipflag/actions/runs/36235494635) at `4127d3d5631daff50d5ceca1bace1112a33d855e` succeeded (23 frontend unit tests, 18 Chromium tests, 22 Rust tests on each native platform, build/typecheck/all-target checks). No diff from that checked revision to the audit checkout under src, src-tauri, tests, package.json or package-lock.json. [Development installers 36234286219](https://github.com/Razee4315/snipflag/actions/runs/36234286219) at `e0f97ba248697e21375573be6c51251bce95a717` remain the latest inspected successful installer run. Published latest remains 1.0.0; source/installers are 1.1.0. Repository metadata is now public, superseding the historical private label below. No fresh CI run was dispatched for this documentation-only audit.

Priority findings, not fixed: empty-session persistence can retain removed content; uncertain-create recovery can associate later edits with an earlier remote issue; tray Quit bypasses pending autosave; image deletion errors are ignored; translucent pixelation needs a source-over compositing regression test/correction; filmstrip and mention thumbnails show original images. The audit also records undo/history/retention gaps, non-resumable partial uploads, onboarding friction, resource/performance risks, keyboard limitations, release-note version hardcoding, and stale security documentation. Source-confirmed behavior is distinguished from unverified runtime risks. Existing green tests do not cover all these scenarios.

Next: implement the prioritized correctness tickets with remote regression checks, then improve OAuth onboarding and report workflow; record Windows-first native acceptance and signing evidence before future stable releases. The audit did not authorize a new release or posting test content to Linear. Unrelated untracked `.claude/` content was left untouched.

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

## UI polish request — 2026-09-26

Owner tested the Windows build and requested a full UI/UX pass, all items required. `d4020ea` (local, then pushed with the follow-up): black-and-white arrow logo from `aabea2e`, NSIS `installerIcon`, green dots removed, themed scrollbars, fixed-size dialogs.

Follow-up commit implements the rest:
- **Window (Rust `lib.rs`, `capture.rs`):** `editor_window` actions are now hide/minimize/drag/workspace/reveal. Launch sizes the hidden editor to the full workspace (84% × 88% of the work area, limited to 1440 × 920 logical pixels) and reveals it after the frontend's first paint (4 s fallback; `--minimized` stays hidden). Capture `finish` grows a smaller editor to the workspace before showing it; larger or maximized windows are kept. The expand/compact control is removed.
- **Performance:** capture overlays lazy-load a separate chunk without the editor/Konva; overlay PNG previews for all monitors are encoded in parallel right after the grab (`tokio::sync::OnceCell` per frame, awaited by `capture_frame`); startup reads run in parallel; thumbnails decode async.
- **UI:** single-pass stylesheet rewrite; utility bar in grid flow above the composer (fixes overlap on scroll); composer body scrolls with a fixed footer holding labeled New session + Create issue; workspace chip without status dot; theme-aware empty-state hero from the new mark; themed `appearance: base-select` pickers with native fallback; switches; sliding settings tab indicator; grain texture, glows, motion and micro-interactions; animated sent state; capture flash; styled window controls.
- **Sound and motion settings:** `src/sound.ts` Web Audio cues (capture, add, success, error). New settings keys `sounds` and `motion` (default true) validated in Rust `normalize_settings` with a unit test.
- **Tests:** updated workspace test (no expand/compact, bar above composer, dark priority-picker screenshot); new tests for sound/animation persistence and constant Settings dialog size.

No local build, install or browser run.

### Verification — 2026-09-26

- Implementation `256c127`: [Checks 36230044151](https://github.com/Razee4315/snipflag/actions/runs/36230044151) green on all jobs, but the mention test passed only on retry. Its failure exposed a real bug: the save status still said "Saved on this computer" during the 400 ms debounce after a new edit, so a reload could lose the latest text while the UI claimed durability. CI screenshots also showed the open themed picker invisible (fade transition) and the Add images tile wrapping. Installer run 36230071027 for that revision was cancelled as superseded.
- Fix `0853e98`: pending edits switch the status to saving immediately, and it returns to saved only after the change is written. Picker transition removed; tile kept on one line; empty-state screenshots added. [Checks 36230307120](https://github.com/Razee4315/snipflag/actions/runs/36230307120): strict build, 19 unit tests, **13/13 browser tests with no retries**, 20 Rust tests plus all-target check on Windows, macOS and Linux. [Development installers 36230325150](https://github.com/Razee4315/snipflag/actions/runs/36230325150) at `0853e98`: all four targets green (Windows NSIS + MSI 10 MB, macOS Apple Silicon and Intel DMG, Linux deb + AppImage). Unsigned, 7-day retention.
- Visual review of CI screenshots (synthetic images only): daylight/dark workspace, both empty states, open dark priority picker (themed list with checkmark), mention picker, appearance settings with sound/motion switches. README gallery refreshed from these renders.

Still manual gates, not proven by CI: WebView2 rendering of `base-select` pickers, audible sounds and the autoplay unlock, reveal-after-paint and launch/capture window sizing at each DPI, frameless drag from the utility bar and empty state, parallel preview encoding on multi-monitor setups, and the NSIS installer icon. Next: install the Windows artifact and run these checks; then decide on a v1.1.0 release with the owner.

## Owner feedback round 2 — 2026-09-26

Owner reviewed the installed build and requested: centered Fit to window icon, a nicer title-bar logo and a visible drag area, a better light-theme empty state with no logo animation, no workspace avatar, a clearer theme control, native desktop behavior (no browser context menu or Ctrl+J downloads and similar), no long hover label on Create issue, an 8 px default stroke, a real highlighter, removal of the redact tool, better pixelation, and brush-size circle cursors with smoother pen movement.

Implemented (frontend only; Rust unchanged):
- Root cause of off-center icons: default browser `button` padding squeezed 28px tool buttons; global `padding: 0` for buttons.
- `src/desktop.ts` guards installed for the editor and capture overlays, with unit tests for the shortcut classifier and a browser test.
- Highlighter kind `highlight` (multiply at 70%, painted first); pen/highlighter smoothing via coalesced pointer events and midpoint quadratic curves; brush cursor; size circles.
- Pixelate uses alpha-weighted block averages on a grid (at least 12 px). Redact removed from the toolbar and shortcuts; `redact` stays a renderable legacy kind. AGENTS.md privacy line updated to reflect the owner's decision.
- Tests: pixelation burn-in export test replaces the redaction test; new highlighter layering/export test; theme radio cards; desktop-behavior test.

Verification: `6b96365` failed the strict typecheck (`isFreehand` called with a Tool) in Checks 36231986950; fixed in `5b4d7ae`. [Checks 36232028660](https://github.com/Razee4315/snipflag/actions/runs/36232028660) at `5b4d7ae`: 21 unit tests, 15/15 browser tests with no retries, 20 Rust tests plus all-target check on Windows, macOS and Linux. CI screenshots reviewed: light/dark empty state with the static line mark, title-bar drag card, size circles, theme cards (the Match system preview was then simplified to a straight split).

Owner follow-up in the same round: screenshots too large for the workspace maximize the editor. Rust `needs_full_screen` (image logical size + 400 × 250 chrome vs. workspace) with a unit test; `editor_window` `workspace` accepts optional image dimensions and the frontend sends the largest added image. Verification for this follow-up is recorded below.

Follow-up verification at `b965c54`: [Checks 36232390614](https://github.com/Razee4315/snipflag/actions/runs/36232390614) all green (15/15 browser tests, no retries; 21 Rust tests on Windows, macOS and Linux including the full-screen sizing test). [Development installers 36232401808](https://github.com/Razee4315/snipflag/actions/runs/36232401808) green on all four targets (unsigned, 7-day retention). Native gates still open: maximize behavior for large captures at each DPI, desktop guards in WebView2 (Ctrl+J, context menu, F5), brush cursor and highlighter feel with a real pointer, and the earlier window/sound/picker checks.

## Final polish for 1.1.0 — 2026-09-26

Owner confirmed round two works and requested: better sounds, custom colors with a themed picker, creator credit (GitHub Razee4315, LinkedIn saqlainrazee), improved tool icons, any genuinely useful new tools, a transparent text entry box, and no hover movement.

Implemented: Web Audio bus with compressor and synthesized convolver room; layered shutter/pop/bell/knock cues. `src/color.ts` (hex/HSV, per-device custom colors, unit tests) and `ColorPicker` popover. Tools added: ellipse (E) and numbered steps (N); both render through the shared exporter. Redrawn tool icons with filled accents. Settings → About with creator links; Rust `open_about_link` only opens four fixed URLs (unit test). Text entry box transparent and content-sized. All hover transforms removed. Version 1.1.0 in package, lockfiles, Tauri and Cargo.

Owner mid-round requests also done: transparent, content-sized text entry box; no hover movement anywhere.

Verification: `696d5d9` browser test for steps failed (clicks assumed 100% zoom); investigating the screenshot exposed a real layout jump (tool hint text wrapped the toolbar and moved the canvas), fixed in `1f2dc9f` by removing hint text and asserting the canvas does not move on tool change; the assertion then needed to wait for the canvas fade-in. **Process error:** `git add -A` in `696d5d9` (and `-a` in `664f204`, `1f2dc9f`) committed the separate website agent's in-progress `site/` files. `e0f97ba` untracks `site/` again without touching the files on disk; that workstream should commit its own files. From now on only explicit paths are staged.

Final: [Checks 36234071860](https://github.com/Razee4315/snipflag/actions/runs/36234071860) at `e0f97ba` all green: 23 unit tests, 18/18 browser tests without retries, 22 Rust tests plus all-target check on Windows, macOS and Linux. [Development installers 36234286219](https://github.com/Razee4315/snipflag/actions/runs/36234286219) at `e0f97ba`: all four targets green, version 1.1.0, unsigned. CI screenshots reviewed: custom color picker, About section, redrawn toolbar icons in dark theme. Not published as a release; that needs explicit owner approval. Native gates: sound quality in WebView2, picker drag feel, step/ellipse with a real pointer.

## Marketing website — 2026-09-26

The owner asked for a product website with a comparison page and strong SEO, and approved direction "Capture HUD" (forest, ivory, apricot; Bricolage Grotesque, Instrument Sans, JetBrains Mono). It is a static site in `site/` with no build step, deployed by `.github/workflows/pages.yml` to `https://razee4315.github.io/snipflag/`. Specs are in `site/docs/02-art-direction.md` and `site/docs/14-steal-list.md`.

- Pages: home (hero with a self-capture signature animation, the problem, a pinned scrubbed session sequence, a tool marquee, an in-browser annotation demo with true 14 px block pixelation, features, the privacy boundary, a compare teaser, FAQ, and a curtain download footer with OS detection); `/compare/` hub; `/compare/{screenpresso,jam,bugshot,sharex-greenshot-flameshot}/`; 404. SEO: unique titles and descriptions, canonicals, OG and Twitter cards with a 1200×630 `og.png`, SoftwareApplication, FAQPage, BreadcrumbList and ItemList JSON-LD, sitemap, robots, manifest.
- Competitor facts were checked 2026-09-26 against vendor pages (Screenpresso pricing, Jam pricing, Linear integration pages, BugShot README, Greenshot FAQ). Unverified cells say "Not documented".
- `ci.yml` now ignores `site/**`, so website-only commits do not run the app pipeline.
- Local verification (Python static server plus the built-in browser): GSAP 3.13, ScrollTrigger, SplitText and Lenis 1.3.11 load from jsDelivr; no console errors on home or compare pages; the pinned sequence, marquee, reveals, editor (pixelate and arrow drawn) and OS-specific download label were observed working; no horizontal overflow at 375 px; `check_site.py` passes on 7 pages. Not measured: real frame rate (the preview pane throttled rAF to about 2 fps), Lighthouse or Core Web Vitals, OS-level reduced motion, and deployed Pages behavior.
- Deployed: `db30a4b` pushed. Pages had been enabled in legacy branch mode (main, `/`), which served the app's dev `index.html` and overwrote the first Actions deploy. Pages source was switched to GitHub Actions and [Website 36235003991](https://github.com/Razee4315/snipflag/actions/runs/36235003991) redeployed. Live checks: `/`, all five compare pages, assets, sitemap, robots and manifest return 200, and unknown paths return the custom 404. In the browser, every request loads with no broken images.
- Revision (owner request): a minimal, readable redesign using Geist, much less copy, and no decorative motion. The new hero is captured from the real UI by the `Website screenshots` workflow ([36235719906](https://github.com/Razee4315/snipflag/actions/runs/36235719906)). Local check: fonts, hero and editor load; no overflow at 375 px; `check_site.py` passes.
- Hero now uses the owner's real demo recording (capture, annotate, issue, open in Linear). The browser tab strip is blurred after 23 s to hide an email address in a tab title. The video autoplays muted, has a pause button, and respects reduced motion. Local check: autoplays, pause works, no overflow at 375 px, `check_site.py` passes.

## v1.1.0 release published — 2026-09-26

The owner asked to publish the latest build for everyone. Release notes are in `docs/releases/v1.1.0.md`. `publish-preview.yml` now reads `docs/releases/<tag>.md` and no longer always uses the v1.0.0 notes.
- Source `5f66c3a`. [Checks 36239748080](https://github.com/Razee4315/snipflag/actions/runs/36239748080) and [Development installers 36239763769](https://github.com/Razee4315/snipflag/actions/runs/36239763769) were green at that exact commit. [Publish run 36240110526](https://github.com/Razee4315/snipflag/actions/runs/36240110526) created [v1.1.0](https://github.com/Razee4315/snipflag/releases/tag/v1.1.0) with six `unsigned-` installers and `SHA256SUMS.txt`. At the owner's request it was then marked the Latest regular release (not a prerelease), as was done for v1.0.0.
- The website (buttons, download cards, schema `softwareVersion`, compare pages) and the README now point to v1.1.0 assets.
- Still true: the installers are unsigned, and the native runtime acceptance gates listed above remain open. Automated checks and packaging do not prove native behavior.

