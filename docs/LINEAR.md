# Linear integration

## Owner setup

Register an owner-managed Linear OAuth application with redirect URI `http://127.0.0.1:47839/callback` and distribution/access suitable for the intended workspaces. Set repository variable `SNIPFLAG_LINEAR_CLIENT_ID` to its PUBLIC client ID. The owner supplied this ID and the variable was configured on 2026-09-26. Registration, distribution and callback acceptance still require native verification. Never supply or embed a client secret.

The development installer workflow requires this variable by default. Its explicit `custom_client_only` option permits advanced self-build installers without a built-in connection. Rust validates build configuration and resolves an empty saved client ID to the current embedded default, including upgrades from old empty settings. Existing nonempty custom IDs are preserved. Settings exposes these under Advanced; clearing the override returns to the built-in client. Existing keyring tokens keep their original client ID for refresh until explicitly disconnected/reconnected. No token migration is attempted.

Normal onboarding is Connect Linear → browser consent → return to the app. The loopback page acknowledges authorization receipt only; token exchange and keyring storage must finish before the app reports connection. Use user actor, authorization-code flow, S256 PKCE.

### Scope evaluation (2026-09-26)

Current requested scopes remain `read,write`. Linear's [OAuth documentation](https://linear.app/developers/oauth-2-0-authentication) documents `read` and targeted `issues:create` for new issues/attachments. Source inspection finds only metadata/reconciliation queries plus `fileUpload` and `issueCreate` mutations. `read,issues:create` is therefore the candidate minimum; no comment scope is needed. The [upload guide](https://linear.app/developers/how-to-upload-a-file-to-linear) documents `fileUpload` but does not explicitly state its scope requirement. Do not narrow production scopes until an authorized test confirms metadata, signed upload, optional issue fields, UUID reconciliation and refresh with the candidate grant. No real test issue/upload was authorized or performed in this checkpoint.

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
