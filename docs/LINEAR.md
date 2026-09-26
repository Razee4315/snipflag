# Linear integration

## Owner setup

Create a Linear OAuth application in the workspace's API settings. Configure redirect URI `http://127.0.0.1:47839/callback`. Enter its public client ID in Snipflag Settings (or configure the repository build variable later). Use user actor, authorization-code flow, S256 PKCE. Never paste a client secret into the app or repository. Request read/write for metadata, uploads, and issue creation; narrow scopes after verifying schema needs.

The callback port is fixed for registration; report a port conflict with retry instructions. Validate state, impose a timeout, bind loopback only, and discard the verifier after completion. Browser cancellation must leave the draft untouched. Persist access/refresh tokens only in the platform credential store. Refresh before expiry; disconnect clears local tokens and workspace selections.

## API operations

- `viewer` / organization: identity after connection.
- Paginate teams; fetch projects, labels, and members in the selected team context.
- Validate team-dependent selections when team changes; clear stale IDs.
- `fileUpload(contentType: "image/png", filename, size)`: retrieve signed URL, asset URL, and required headers.
- PUT flattened PNG using returned headers; no OAuth header to the storage host.
- Build Markdown with ordered screenshot headings/captions and asset URLs.
- `issueCreate(input: {id, title, description, teamId, ...})`: session's stable UUID used for deduplication/reconciliation.
- `issue(id: ...)`: reconcile ambiguous previous sends before attempting another create.

Use GraphQL variables, not string interpolation for user text. Keep API request timeout bounded. Handle HTTP 401/429 and GraphQL errors separately; no automatic replay of ambiguous creates with a new identity.

## Multiple images

Upload all final images before creating the issue. Partial upload failure preserves the local draft. At minimum retries may reupload images; resumable per-revision upload caching is an optimization, never reuse stale edits. Ordering in Markdown must match filmstrip order. Linear-hosted assets do not require a public image hosting service.

## Verification still requiring a connected workspace

OAuth registration acceptance for loopback redirect; token refresh and reconnect; paginated private-team visibility; selected optional fields; actual upload headers; issueCreate stable UUID support against live schema; two-image issue; revoked tokens; rate limit; timeout after successful create. Use a clearly named test issue only with explicit user authorization to submit test content.

Sources checked 2026-09-26: https://linear.app/developers/oauth-2-0-authentication ; https://linear.app/developers/graphql ; https://linear.app/developers/how-to-upload-a-file-to-linear ; https://linear.app/developers/file-storage-authentication .

## Image references

Type @ in Description to choose a local screenshot by thumbnail, stable alias or caption. Aliases (@image1, @image2) map to image UUIDs, survive reorder/reload, and are never recycled after removal. New drafts record the mapping; older unsent drafts initialize it in existing filmstrip order. Submitted drafts are not migrated. Missing references block submission before network work. Literal code, escaped text, email/URL text and existing Markdown links are excluded.

During explicit submission, Rust resolves each alias to the uploaded flattened image asset and emits a Markdown link at that point in the prose. All full images are still embedded once below in filmstrip order with their aliases in the headings. This uses Linear's documented Markdown support; Linear's native @ picker does not document screenshot mentions. Verify clickable references in a real issue as a separate authorized runtime gate.
