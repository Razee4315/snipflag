# Privacy and security

- Screenshots stay in the user's app-data directory until explicit submission. OS backups may include this directory; local draft storage is not claimed to be encrypted.
- OAuth tokens are stored in the OS credential store and never returned to the webview. Public client IDs are not secrets.
- Strict production CSP: packaged assets, local image data/blob URLs, Tauri IPC. No arbitrary remote web content.
- Rust commands verify calling window roles. Capture overlays cannot read credentials or submit issues.
- Asset IDs are UUIDs; resolve paths from app-controlled roots. Import/export uses a native picker or bounded image bytes; no general frontend filesystem/shell permission.
- Validate image formats, dimensions, encoded size, session count, and total data before persistence. Decode with allocation limits. Reject malformed drafts.
- Network endpoints are fixed for OAuth/GraphQL; upload targets originate only from authenticated Linear API responses and must be HTTPS. Do not forward bearer tokens to storage.
- Use opaque redaction for secrets. Export flattens redaction pixels last. Pixelation is not a guarantee against recovery. Original local drafts retain original pixels until deleted.
- No screenshot analytics, crash screenshot capture, remote fonts, or automatic upload queue.
- Delete session removes its image files and submission records. No promise of forensic secure deletion from SSDs/backups.
- Release signing and signed updater verification are separate from HTTPS. Do not enable an updater with a placeholder key.

Review release capabilities against actual permission IDs, not their comments. Tests must cover path containment, window roles, malformed input, duplicate sends, and exported redaction.
