# Architecture

## Stack

Tauri 2 / Rust desktop core; React + TypeScript + Vite UI; Konva/react-konva annotation scene; Zustand session state; CSS design tokens (Radix primitives where complex controls require them); SQLite session metadata; native keyring credentials; reqwest/rustls Linear requests; XCap capture adapter. Start with native semantic controls rather than pulling a large component kit into a small utility.

## Modules

- `src/model.ts`: session/asset/annotation types, limits, and pure helpers (reorder, validation, rect clamping, overlay→frame pixel mapping, shortcut parsing).
- `src/geometry.ts`: annotation bounds, move, resize, duplicate and intersection in image coordinates. Crop (`cropImage` in `render.ts`) cuts the original pixels and returns an image with a **new ID** (saved images are immutable per ID); `replaceImage` in the store remaps `@image` aliases and resets that image's undo history, and the Undo toast restores the uncropped pixels under another new ID with the old history.
- `src/store.ts`: Zustand editing state, independent per-image undo histories, selection, busy/sent locks, persisted-image tracking. `structure` remembers removals, crops and reorders for this run (not saved): `undo()` reverses the newest of them first while no mark has changed since (`edits` counts mark changes), otherwise the active image's last mark edit. Tool colors and sizes are remembered in `localStorage`.
- `src/render.ts`: import/conversion to PNG, pixelation, `drawAnnotation`, and the authoritative flattened PNG export with redaction painted last. The editor draws every annotation with the same `drawAnnotation`, so the canvas matches the export.
- `src/report.ts`: the outgoing issue description (resolved `@image` prose plus one ordered section per image) with upload addresses left open. It mirrors Rust `compose_description`; both run `src/report.fixtures.json`.
- `src/components/ReportPreview.tsx`: local preview of destination, fields, title, description and flattened images in upload order. Creating from it reuses the reviewed pixels only when the session object is unchanged.
- `src/share.ts`: text for sharing outside Linear (`sharePrompt`: title, description, each saved screenshot path with its step notes) and step notes for the description. `src/motion.ts`: `smooth()` wraps layout changes in a view transition. `src/components/StepNotes.tsx`: per-step notes (`Annotation.note`, saved without undo entries) floating over the canvas.
- `src/templates.ts`: built-in description templates, template tidying, and per-team remembered details (`rememberDetails`, `detailsToFill`). Rust `normalize_settings` validates `templates` (null = built-in) and `teamDefaults`.
- `src/native.ts`: narrow IPC facade; browser preview uses IndexedDB and refuses Linear/capture actions with an explicit message.
- `src/hooks/*`: `useAutosave` (save chain, `flush`, `settle`), `useToasts` (message stack; `src/toasts.ts` holds the stacking rules), `useLinearConnection` (connection, `unreachable` state, sign-in), `useUpdater` (checks, download progress, install handshake). `src/roving.ts`: arrow-key movement for radio groups and tabs.
- `src/App.tsx` and `src/components/*`: workspace, toolbar, Konva editor, filmstrip, issue panel, settings/history dialogs, and the per-monitor capture overlay (`index.html?capture=N`).
- `src-tauri/src/storage.rs`: SQLite schema, atomic image writes by validated UUID, bounded decoding, retention, settings validation, submission receipts.
- `src-tauri/src/capture.rs`: XCap frames for all monitors (off the UI thread), reusable hidden overlay windows per monitor, the in-memory `snipframe` frame protocol, crop in Rust, cancel/close handling, capture timing.
- `src-tauri/src/linear.rs`: GraphQL metadata with pagination, uploads, ordered Markdown, idempotent issue creation with reconciliation.
- `src-tauri/src/auth.rs`: PKCE loopback flow with state check, timeout and cancel; keyring credential storage and refresh.
- `src-tauri/src/files.rs`: clipboard image read/write (arboard), native save picker export, and `share_images` (flattened PNGs to `Pictures/Snipflag`, names chosen in Rust).
- `src-tauri/src/update.rs`: signed updates through `tauri-plugin-updater` with the build-time public key and a fixed Latest-release manifest; `check_update` keeps the found update in Rust and `install_update` downloads, verifies, installs and restarts after the renderer's save handshake.
- `src-tauri/src/lib.rs`: plugin wiring (single instance first), tray, global shortcut, close-to-tray, command registration.

## Data

Session: schemaVersion, id (UUID), createdAt, updatedAt, title, description, teamId, projectId, assigneeId, labelIds, priority, ordered images, issueId/identifier/url, submission status. Optional annotationHistories stores bounded per-image undo/redo; old v1 drafts remain readable. Image: UUID, name/caption, native width/height, original PNG data, annotation list. Current hydration loads all session images; thumbnails are bounded flattened revisions. Annotations use IMAGE coordinates, never viewport coordinates.

Persist image files by validated UUID inside app data and store JSON metadata in SQLite. PNGs that arrive from the editor (`decode_png`) are checked by signature, encoded size and header dimensions only; they were just encoded by the editor's canvas, and decoding them again blocked the native main thread. Imported and clipboard images still go through the bounded full decode. A save reads the image folder for orphans only when an image left the draft, on the draft's first save, after a failed save, or while an earlier cleanup is unfinished. Do not persist tokens in the database or source images in logs. Hydration restores the JSON plus image data. Cache bounded thumbnails in UI; never create files at arbitrary frontend-supplied paths.

## Network and submission

Rust is the only production network client. Capture/edit work offline. Metadata requests require connection, submissions require explicit intent. A session UUID is the requested Linear issue UUID. Persist the exact submitting snapshot before sending. Freeze editing during submission. Before retrying, query this ID to reconcile a previous request. Upload each flattened image, preserving order; create issue only after all uploads succeed. Record state in SQLite to survive process restarts.

Two locks (`auth.rs`): `NetworkLock` admits one exclusive operation (sign-in, submit, reconcile, disconnect, update install; `try_lock`, so a second one is refused), and `TokenLock` guards only reading and renewing the credential. Metadata reads (teams, team details) take just the token lock, so they never block or fail a submission. All requests share one `reqwest` client. Screenshots upload three at a time, results kept in filmstrip order; team projects, members and labels load concurrently. If `issueCreate` answers with GraphQL errors, the same call looks the issue up by ID: found means sent, confirmed absent sets `retryable` (report stays editable), and only an unconfirmed outcome keeps the `creating` lock.

No private client secret in distributed apps. OAuth is a public client using S256 PKCE and state, with a loopback callback bound only to 127.0.0.1. Client ID is public configuration. Desktop keyring has to be available; no fallback to plaintext tokens.

Rust resolves the saved custom client ID first, then the build's `SNIPFLAG_LINEAR_CLIENT_ID`. Empty settings remain empty on disk so upgrades pick up the current build default. The renderer receives only a built-in-availability flag through app status; advanced custom setup remains optional. Refresh uses the client ID stored alongside its keyring credential. Installer CI requires public client configuration unless explicitly building custom-client-only artifacts.

## Capture

Native monitor frame acquisition runs off the UI thread. Hide editor before acquisition. Overlay per monitor uses physical bounds and maps pointer positions to image pixels; crop original frame in Rust. Restrict region to one monitor. Close/cancel all overlays together.

Speed path (2026-10-02): one hidden overlay window per display is opened about 1.5 s after launch and reused; ending a capture hides overlays instead of destroying them, and a missing one (new display) is created on demand. Each capture has a generation number. Rust emits `capture-begin` with it; the overlay loads `snipframe://…/<generation>`, which Rust answers from memory as an uncompressed 24-bit BMP of that window's own monitor frame (no PNG, base64 or IPC string), then calls `capture_ready` once the frame is painted. Stale generations get 404 and cannot show a window. On Windows the editor is hidden without the DWM fade (`DWMWA_TRANSITIONS_FORCEDISABLED`) and excluded from capture (content protection) for the duration of a capture, then the wait is two `DwmFlush` composition passes plus 40 ms instead of a fixed 300 ms (fixed wait kept on macOS/Linux); a tray-menu capture waits 350 ms from the click for the menu to fade. The selected crop is PNG-encoded with fast compression, falling back to the dense encoder only above 20 MB. Rust keeps the last capture's step durations (no content) for Settings → Capture. Capture options (`adjustSelection`, `magnifier`, `copyOnCapture`, `captureDelay`; all off by default, validated in `normalize_settings`) are read by Rust when a capture starts: the overlay gets adjust/magnifier with the generation, Rust applies the delay before reading the screen and copies the cropped pixels to the clipboard itself.

XCap is behind our adapter; Wayland failures show a useful import/paste fallback and remain a platform acceptance item.

## Error model

Before issueCreate, the exact report metadata snapshot and creating state commit in one SQLite transaction. Unknown outcomes lock editing across restart; reconciliation reads that snapshot, never the caller's later edits. A confirmed absence unlocks for a separate explicit submission. Deletion removes content snapshots but retains minimal receipts and tombstones. App-initiated quit waits for a renderer save acknowledgment; errors/timeouts keep the process open.

Actionable user messages, no raw tokens or upload URLs. Save errors remain visible and prevent workflows that rely on durability. Upload failure retains session. Unknown create outcome is a separate state from confirmed failure. No success display until confirmed server response/reconciliation.
