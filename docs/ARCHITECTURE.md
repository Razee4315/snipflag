# Architecture

## Stack

Tauri 2 / Rust desktop core; React + TypeScript + Vite UI; Konva/react-konva annotation scene; Zustand session state; CSS design tokens (Radix primitives where complex controls require them); SQLite session metadata; native keyring credentials; reqwest/rustls Linear requests; XCap capture adapter. Start with native semantic controls rather than pulling a large component kit into a small utility.

## Modules

- `src/model.ts`: session/asset/annotation types and pure state operations.
- `src/store.ts`: editing state, independent undo histories, hydration.
- `src/components/Editor.tsx`: canvas editing and transforms.
- `src/render.ts`: authoritative flattened PNG export with redaction last.
- `src/native.ts`: narrow IPC facade; explicit browser-preview limitations.
- `src-tauri/src/storage.rs`: schema, atomic draft persistence, bounded assets, retention.
- `src-tauri/src/capture.rs`: frames, overlays, crop, cancellation, shortcut integration.
- `src-tauri/src/linear.rs`: metadata, validation, uploads, issue creation/reconciliation.
- `src-tauri/src/auth.rs`: PKCE loopback flow and credential storage/refresh.
- `src-tauri/src/lib.rs`: application wiring, tray, single instance, command registration.

## Data

Session: schemaVersion, id (UUID), createdAt, updatedAt, title, description, teamId, projectId, assigneeId, labelIds, priority, ordered images, issueId/identifier/url, submission status. Image: UUID, name/caption, native width/height, original PNG data loaded on demand, annotation list. Annotations use IMAGE coordinates, never viewport coordinates.

Persist image files by validated UUID inside app data and store JSON metadata in SQLite. Do not persist tokens in the database or source images in logs. Hydration restores the JSON plus image data. Cache bounded thumbnails in UI; never create files at arbitrary frontend-supplied paths.

## Network and submission

Rust is the only production network client. Capture/edit work offline. Metadata requests require connection, submissions require explicit intent. A session UUID is the requested Linear issue UUID. Persist the exact submitting snapshot before sending. Freeze editing during submission. Before retrying, query this ID to reconcile a previous request. Upload each flattened image, preserving order; create issue only after all uploads succeed. Record state in SQLite to survive process restarts.

No private client secret in distributed apps. OAuth is a public client using S256 PKCE and state, with a loopback callback bound only to 127.0.0.1. Client ID is public configuration. Desktop keyring has to be available; no fallback to plaintext tokens.

## Capture

Native monitor frame acquisition runs off the UI thread. Hide editor before acquisition. Overlay per monitor uses physical bounds and maps pointer positions to image pixels; crop original frame in Rust. Restrict region to one monitor. Close/cancel all overlays together. XCap is behind our adapter; Wayland failures show a useful import/paste fallback and remain a platform acceptance item.

## Error model

Actionable user messages, no raw tokens or upload URLs. Save errors remain visible and prevent workflows that rely on durability. Upload failure retains session. Unknown create outcome is a separate state from confirmed failure. No success display until confirmed server response/reconciliation.
