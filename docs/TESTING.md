# Test and release gates

## Canvas tools

Automated coverage: unit tests for line bounds, duplicate placement, crop rounding and which marks survive a crop, and image replacement in the store; browser test for line export pixels, Shift+Arrow nudge, Ctrl+D, crop dimensions and mark positions, crop Undo, and persistence.

Native gates: Ctrl+wheel keeps the point under the pointer at several zoom levels; Space-drag and middle-drag pan with a real mouse and a touchpad; Space no longer presses a focused toolbar button; every edge of a zoomed-in image is reachable; cropping a 4K capture; crop then Create issue uploads the cropped image and `@image` mentions still resolve.

## Sharing outside Linear

Automated coverage: unit tests for the share text and step-note ordering; Rust test for shared file names; browser test for the share bar, hiding and restoring the issue panel across reload, step notes without layout shift or undo entries, adding notes to the description, and note persistence.

Native gates: Copy for AI writes one PNG per screenshot to Pictures/Snipflag with annotations and pixelation burned in, and the clipboard text pastes into a terminal with working paths (spaces in the user name, non-ASCII user names, OneDrive-redirected Pictures); Ctrl+C and Ctrl+Shift+C in the editor but not while typing; the panel slide animation in WebView2 and with animations off; full disk and read-only Pictures folder errors.

## Capture speed (warm overlays, raw frames)

Automated coverage: Rust tests for the BMP frame layout (bottom-up BGR, padded rows), overlay slot parsing, and crop clamping; strict typecheck of the overlay. CI cannot run a capture.

Native gates (Windows first): Settings → Capture shows the last capture's time and steps; record it for shortcut captures with the editor open and in the tray, at 1080p and 4K, and compare with the previous build. The editor must never appear in the frozen frame (hide now waits two compositor passes, not 300 ms). A reused overlay must not flash the previous screenshot or a black frame. Escape and Enter work without clicking the overlay first. Creating hidden overlays 1.5 s after launch must not take keyboard focus from the editor. Capture from the tray menu has no menu remnant. Plug in or remove a display between captures; mixed-DPI and negative-origin displays still align. Cancel then capture again at once. Large selections return to the editor quickly and still save and upload. Idle memory with the warm overlays. Capture options (settings validation and persistence are tested; overlay behavior is not): with every option off, releasing the drag captures at once and Escape cancels; magnifier follows the pointer, shows the right pixel and position at 100/150/200%, and flips at screen edges; copy puts the unmarked capture on the clipboard and reports a failure; the 3/5/10 s delay freezes the screen after the wait with menus still open. Themes Paper, Blossom, Midnight and Graphite: contrast, textures and themed pickers in WebView2, with a light and a dark system setting. Adjustable selection, when turned on (unit-tested geometry only): all eight handles, move, arrow and Shift+arrow nudges, flipping past an edge, Enter/double-click/Capture confirm the adjusted area exactly, Escape clears then cancels, click outside clears, action bar stays on screen near the bottom edge, selections on two monitors at once. macOS/Linux: overlays reuse correctly and the `snipframe` image loads in WKWebView/WebKitGTK.

## Signed updates

Automated coverage: fixed HTTPS release endpoint, bounded release notes, `autoUpdate` settings validation, build-time public key format check, workflow preflight requiring both or neither key halves, browser About section without updates. CI cannot prove an update installs.

Native gates, with a configured key pair and two published test versions: Windows NSIS and MSI installs update in place and restart with the draft intact (including an active text edit); the update is refused while capture/submission/login is busy; a tampered or wrongly signed `latest.json`/installer is rejected and the app is unchanged; offline and GitHub errors show a message only on manual checks; the switch stops background checks; macOS Apple Silicon/Intel `.app.tar.gz` and Linux AppImage update; `.deb` installs are not offered AppImage updates.

## Templates and remembered team details

Automated coverage: Rust settings validation for templates (trimmed names, ID and length limits, null keeps built-ins) and remembered details (UUIDs, priority range); unit tests for built-in/edited templates, tidy names, filling only empty fields with IDs the team still offers, and a bounded per-team memory; browser test for template chips, edit/remove/add/restore in Settings, persistence across reload, and templates hidden once text exists. The updated composer test uses the Bug report template.

Native gates (need a connected workspace; no issue creation is required except where stated): remembered team applies to a new session and to a draft sent-then-recaptured, not to a restored draft that already has a team, and not again after choosing no team; after an explicitly authorized synthetic create, a new draft for that team fills project/assignee/labels/priority only where empty; removed Linear projects/labels/members are skipped; Forget and Disconnect clear the memory; search fields with more than eight teams/projects/members; Retry after a metadata failure.

## Report preview

Automated coverage: shared Rust/TypeScript description fixtures (aliases, reordered images, legacy drafts without aliases, literal code, Unicode prose, escaped captions, 200-character captions); browser test for destination/field blockers, title, mention chips, ordered section headings, exact Markdown with upload placeholders, flattened pixels at original size with pixelation burned in, tool shortcuts blocked behind the dialog, and a refreshed preview after a caption change. The browser suite cannot create an issue.

Native gates: with a connected workspace and explicitly authorized synthetic content, compare the preview with the created Linear issue (title, destination, fields, prose links, section order and images); edit after previewing and confirm the new revision is sent; preview a locked uncertain attempt; check large multi-image preview memory and time on Windows.

## Built-in Linear onboarding

Automated coverage: built-in/custom/missing client selection, empty saved settings after upgrade, Settings connection availability and collapsed advanced setup, browser-only refusal, custom ID persistence. Installer builds fail early when the public client variable is missing unless custom-client-only mode is explicitly selected. These checks do not contact Linear.

Native gates: fresh profile Connect Linear without setup; existing empty settings upgrade; custom ID preserved; clear custom ID and connect using built-in client; cancel/deny/timeout/port conflict; callback receipt must not claim success before token exchange/keyring persistence; locked keyring; restart and refresh; disconnect/reconnect. Verify owner app distribution from a second intended workspace. Before narrowing scopes, authorize synthetic test content and verify metadata, flattened upload, optional fields, stable issue UUID/reconciliation and refresh with `read,issues:create`.

## Fix-first regressions (1.1.0 source update, no new release)

Remote suites now cover persisted empty image/text drafts, independent undo/redo across restart, legacy drafts without histories, bounded history, retryable failed deletion, orphan cleanup, stale-save rejection after delete, immutable submission snapshots across restart, retention protection, renderer pending-report locks, and quit acknowledgment ordering/failure. Privacy fixtures include alternating patterned semitransparent pixels, protected bounded thumbnails after reload, fractional region boundaries, fully transparent regions, marks added after masks, and legacy redactions drawn last.

Native follow-up: type into an active annotation and immediately choose tray Quit; repeat with ordinary form edits, failed disk writes, slow saves, busy submission and repeated Quit. Verify the app remains open on failure and the last edit returns after a successful quit/relaunch. Forced process termination/power loss is not covered by the quit handshake. With explicitly authorized synthetic Linear content, lose the response after create, restart, verify the report is locked, and use Check previous attempt to restore the exact submitted content without duplicate upload/create. A confirmed missing issue must unlock for a separate user-requested send. Old uncertain submissions without snapshots must fail visibly. Exercise locked-file deletion and retry on Windows; verify no success indication before cleanup finishes.

History is bounded to 100 undo/redo snapshots and approximately 512 KiB of serialized history per image (character count); older history can be evicted. Current annotations and original dimensions remain intact. Existing v1 drafts without history remain readable, with undo available for new edits.

## Automated on GitHub Actions

- TypeScript strict typecheck and production frontend build.
- Unit tests: independent image edit histories, reorder/remove semantics, send validation, caption escaping, crop coordinate conversion, immutable submitted sessions.
- Browser tests: empty state, importing two images, switching/annotating/reordering, undo/redo, draft restore, controls accessible by name, settings, no fake connection success.
- Pixel checks: exported dimensions, pixelation burned in over marks beneath it, highlighter tinting under the pen, consistent ordering and annotation export.
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

Description image references: picker keyboard/mouse selection, native undo/redo, caption filtering, reorder/reload identity, deleted-reference errors and no alias recycling. Rust tests cover reference resolution, missing uploads and literal-code/email/URL exclusions. Final manual Linear gate: two-image report with repeated references, reordered images and annotations/pixelation; confirm each link opens the correct final image and full images remain ordered.
