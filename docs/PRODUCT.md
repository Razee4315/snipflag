# Product specification

## Promise

Turn a visual problem into an actionable Linear issue in seconds. A minimal desktop utility with excellent defaults, dependable drafts, and a transparent upload boundary. Primary platform: Windows. Additional desktop platforms: macOS and Linux. Android/iOS are out of scope.

## Session, not single screenshot

A reporting session contains an ordered list of up to 10 images, one issue form, a stable submission UUID, and optional resulting issue ID/URL. Each image owns its annotations and undo/redo history. Capture/import/paste another image without clearing the form or existing images. Users can switch images, rename/caption, reorder, remove, copy, or save each. Multiple images become ordered image sections in ONE issue description; never one issue per image.

Practical limits: 10 images/session; 20 MiB encoded input/image; 40 megapixels decoded/image; 100 MiB total encoded image input/session. Surface validation before mutation. These are Snipflag limits, not claims about Linear's maximums.

## Required functionality

1. Tray presence, show/quit, configurable global capture shortcut, duplicate instance handling.
2. Freeze screen, drag region, Escape cancels, per-monitor capture respecting scaling and negative coordinates. Cross-monitor spanning selection is a later enhancement; users can capture each monitor into the same session.
3. Arrow, rectangle, pen, text, pixelation, solid redaction; select/move/resize, color, width, text size, delete, per-image undo/redo, zoom/fit.
4. Add screenshots repeatedly, import PNG/JPEG/WebP, paste images, reorder and caption.
5. PNG clipboard/save and final flattened export at original pixel dimensions.
6. Linear OAuth with PKCE; reconnect/disconnect; teams/projects/labels/assignees; title, description, team, priority; remember valid selections per workspace/team.
7. Upload final annotated images only after explicit Create issue. Preserve drafts and partial progress on failures; reconcile ambiguous creates to prevent duplicates.
8. Recent local sessions, resume, delete, submitted issue link. Explicit retention controls; no automatic screenshot analytics.
9. Clear errors for missing permissions, shortcut conflicts, unavailable keyring, expired login, no teams, rate limits, failed uploads, disk failures, and unsupported compositor behavior.

## Acceptance

- Capture A, annotate it, capture B, annotate it, return to A: its content and edits are intact.
- Reordering images affects both the filmstrip and resulting issue description.
- Editing a screenshot after a failed submission invalidates its previous uploaded revision.
- App restart restores the draft and pending submission identity.
- Failed upload does not create a screenshot-less issue. Repeated click cannot send concurrently.
- An ambiguous issue response never silently causes a second issue.
- Export contains actual redacted pixels, not an editable overlay or hidden source.
- Every primary action works by keyboard and has a visible accessible name.
- No external upload before explicit submission; connection metadata requests are clearly separate.

## Non-goals

Video recording, OCR/AI cloud analysis, full Linear client, screenshot social feed, a Photoshop replacement, organization billing, and a custom screenshot hosting service.
