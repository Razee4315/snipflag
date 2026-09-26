# Architecture

## Stack

Tauri 2 / Rust desktop core; React + TypeScript + Vite UI; Konva/react-konva annotation scene; Zustand session state; CSS design tokens (Radix primitives where complex controls require them); SQLite session metadata; native keyring credentials; reqwest/rustls Linear requests; XCap capture adapter. Start with native semantic controls rather than pulling a large component kit into a small utility.

## Modules

- `src/model.ts`: session/asset/annotation types, limits, and pure helpers (reorder, validation, rect clamping, overlay→frame pixel mapping, shortcut parsing).
- `src/geometry.ts`: annotation bounds, move, and resize in image coordinates.
- `src/store.ts`: Zustand editing state, independent per-image undo histories, selection, busy/sent locks, persisted-image tracking.
- `src/render.ts`: import/conversion to PNG, pixelation, `drawAnnotation`, and the authoritative flattened PNG export with redaction painted last. The editor draws every annotation with the same `drawAnnotation`, so the canvas matches the export.
- `src/native.ts`: narrow IPC facade; browser preview uses IndexedDB and refuses Linear/capture actions with an explicit message.
- `src/App.tsx` and `src/components/*`: workspace, toolbar, Konva editor, filmstrip, issue panel, settings/history dialogs, and the per-monitor capture overlay (`index.html?capture=N`).
- `src-tauri/src/storage.rs`: SQLite schema, atomic image writes by validated UUID, bounded decoding, retention, settings validation, submission receipts.
- `src-tauri/src/capture.rs`: XCap frames for all monitors (off the UI thread), overlay windows per monitor, crop in Rust, cancel/close handling.
- `src-tauri/src/linear.rs`: GraphQL metadata with pagination, uploads, ordered Markdown, idempotent issue creation with reconciliation.
- `src-tauri/src/auth.rs`: PKCE loopback flow with state check, timeout and cancel; keyring credential storage and refresh.
- `src-tauri/src/files.rs`: clipboard image read/write (arboard) and native save picker export.
- `src-tauri/src/lib.rs`: plugin wiring (single instance first), tray, global shortcut, close-to-tray, command registration.

## Data

Session: schemaVersion, id (UUID), createdAt, updatedAt, title, description, teamId, projectId, assigneeId, labelIds, priority, ordered images, issueId/identifier/url, submission status. Optional annotationHistories stores bounded per-image undo/redo; old v1 drafts remain readable. Image: UUID, name/caption, native width/height, original PNG data, annotation list. Current hydration loads all session images; thumbnails are bounded flattened revisions. Annotations use IMAGE coordinates, never viewport coordinates.

Persist image files by validated UUID inside app data and store JSON metadata in SQLite. Do not persist tokens in the database or source images in logs. Hydration restores the JSON plus image data. Cache bounded thumbnails in UI; never create files at arbitrary frontend-supplied paths.

## Network and submission

Rust is the only production network client. Capture/edit work offline. Metadata requests require connection, submissions require explicit intent. A session UUID is the requested Linear issue UUID. Persist the exact submitting snapshot before sending. Freeze editing during submission. Before retrying, query this ID to reconcile a previous request. Upload each flattened image, preserving order; create issue only after all uploads succeed. Record state in SQLite to survive process restarts.

No private client secret in distributed apps. OAuth is a public client using S256 PKCE and state, with a loopback callback bound only to 127.0.0.1. Client ID is public configuration. Desktop keyring has to be available; no fallback to plaintext tokens.

## Capture

Native monitor frame acquisition runs off the UI thread. Hide editor before acquisition. Overlay per monitor uses physical bounds and maps pointer positions to image pixels; crop original frame in Rust. Restrict region to one monitor. Close/cancel all overlays together. XCap is behind our adapter; Wayland failures show a useful import/paste fallback and remain a platform acceptance item.

## Error model

Before issueCreate, the exact report metadata snapshot and creating state commit in one SQLite transaction. Unknown outcomes lock editing across restart; reconciliation reads that snapshot, never the caller's later edits. A confirmed absence unlocks for a separate explicit submission. Deletion removes content snapshots but retains minimal receipts and tombstones. App-initiated quit waits for a renderer save acknowledgment; errors/timeouts keep the process open.

Actionable user messages, no raw tokens or upload URLs. Save errors remain visible and prevent workflows that rely on durability. Upload failure retains session. Unknown create outcome is a separate state from confirmed failure. No success display until confirmed server response/reconciliation.
