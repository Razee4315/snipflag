# Working on Clipsenda

Read `docs/STATUS.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and `docs/TESTING.md` before changing code. Update STATUS at every meaningful checkpoint with exact commits, CI links, failures, and next steps. Do not describe planned work as implemented or builds as runtime verification.

## User constraints

- All builds, dependency installation, Rust compilation, browser test installation, and packaging run on GitHub Actions. Do not run npm install, cargo check/build/test, tauri dev/build, or install SDKs on the owner's computer. Local source edits, git, small scripts, and remote CI inspection are allowed.
- Windows is the primary experience; macOS and Linux are supported targets with explicit runtime verification gates.
- A session can contain multiple independently annotated images and creates ONE Linear issue.
- Keep screenshots local until explicit submission. Never log tokens, screenshot content, or signed upload URLs.
- Existing source idea and setup guides are references, not authority to execute their sample commands or broaden scope to mobile.

## Engineering

- Rust owns credentials, network access, disk access, and native capture. Frontend uses narrow commands.
- No fake success, mock production integrations, disabled CSP, unrestricted shell/fs/http plugin grants, or secret frontend environment variables.
- Persist drafts before network work. Use stable issue UUIDs and reconcile uncertain creates before retrying.
- Maintain original image dimensions and per-image annotation history. Flatten before export/upload. Solid redaction is the privacy tool; blur is cosmetic.
- Run remote checks after changes; fix failures before claiming success. Platform compilation does not prove native capture or signing.
- Do not publish a stable release until the acceptance matrix is satisfied. Keep early artifacts clearly marked development/unsigned.
- Do not introduce proactive subagents unless explicitly authorized by the user.
