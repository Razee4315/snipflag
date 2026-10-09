# Contributing to Snipflag

Thank you for helping improve Snipflag. This guide explains how the project is organized, how changes are verified, and what a good pull request looks like.

Snipflag is a small, focused tool: capture one or more screenshots, annotate them, and send them to Linear as one issue. Contributions that make that flow faster, more reliable, more private, or more accessible are the most welcome. Before proposing a new capability, read the non-goals in [docs/PRODUCT.md](docs/PRODUCT.md).

## Before you start

- For anything beyond a small fix, open an issue first and describe the problem you want to solve. Agreeing on the approach early saves rework.
- Search existing issues to avoid duplicates.
- Security problems must not be reported in public issues. Follow [SECURITY.md](SECURITY.md).
- Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Required reading

| Document | Why it matters |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | What is implemented, what is verified, and what is open |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Scope, limits, and acceptance criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module boundaries and data lifecycle |
| [docs/SECURITY.md](docs/SECURITY.md) | Privacy rules and command boundaries |
| [docs/TESTING.md](docs/TESTING.md) | Automated checks and manual release gates |
| [AGENTS.md](AGENTS.md) | Working rules that apply to every change, including automated agents |

## How builds are verified

GitHub Actions is the source of truth. Every push and pull request runs the **Checks** workflow:

- Frontend: strict TypeScript typecheck, production build, Vitest unit tests, Playwright browser tests.
- Native: `cargo test` and `cargo check --all-targets` on Windows, macOS, and Linux.

The **Development installers** workflow is started manually and produces unsigned installers for all platforms.

The maintainer does not build on their own computer; all compilation and packaging happens in CI. You are free to run the tooling on your own machine, but a pull request is only ready when Checks is green.

### Running locally (optional)

Prerequisites: Node.js 24, the stable Rust toolchain, and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS. On Linux, install the same system packages listed in `.github/workflows/ci.yml`.

```bash
npm ci                      # install locked dependencies
npm run dev                 # browser preview at http://127.0.0.1:1420 (no capture or Linear)
npm test                    # unit tests
npx playwright install chromium && npm run test:e2e   # browser tests
npm run tauri -- icon public/icon.svg                  # generate platform icons once
npm run build               # once before the Rust tests: they need the built frontend (dist/) to exist
cargo test --manifest-path src-tauri/Cargo.toml        # Rust tests
npm run tauri dev           # full desktop app
```

The browser preview stores drafts in IndexedDB and deliberately refuses capture and Linear actions. Use the desktop app to exercise native behavior.

## Project layout

```
src/                 React + TypeScript UI
  components/        Editor, toolbar, filmstrip, issue panel, dialogs, capture overlay
  model.ts           Types, limits, pure helpers
  geometry.ts        Annotation bounds and transforms
  render.ts          Import, pixelation, flattening (the export path)
  store.ts           Session state and per-image undo histories
  native.ts          The only place the UI talks to Rust
src-tauri/src/       Rust core
  storage.rs         Drafts, images, settings, submission receipts
  auth.rs            Linear OAuth (PKCE) and credential storage
  linear.rs          Linear API, uploads, issue creation and reconciliation
  capture.rs         Screen capture and overlay windows
  files.rs           Clipboard and save dialog
  lib.rs             App wiring, tray, shortcut, command registration
tests/               Playwright browser tests
docs/                Product, architecture, security, and status documents
```

## Engineering rules

These are enforced in review.

- **Rust owns privileged work.** Credentials, network access, disk access, and native capture live in Rust. The UI calls narrow commands through `src/native.ts`. Commands check the calling window's role.
- **No broad permissions.** Do not add unrestricted shell, filesystem, or HTTP plugin grants, and do not weaken the Content Security Policy.
- **No secrets in the frontend.** Tokens never reach the webview. The Linear client ID is public configuration; a client secret must never be added.
- **Never log sensitive data.** No tokens, screenshot content, or signed upload URLs in logs or error messages.
- **Drafts first.** Persist the draft before any network work. Keep failed submissions recoverable.
- **Never duplicate issues.** Issue creation uses the session's stable UUID. An uncertain result must be reconciled with Linear before retrying.
- **Pixels are exact.** Keep original image dimensions. Flatten before export and upload. Solid redaction is the privacy tool and is painted last; pixelation is cosmetic and must never be described as secure.
- **No fake success.** Do not mock production integrations or show success before Linear confirms it.
- **Keep it accessible.** Every control needs an accessible name, keyboard access, and a visible focus state.

## Tests

- Add or update tests with every behavior change. Pure logic belongs in Vitest (`src/*.test.ts`) or Rust unit tests; user flows belong in Playwright (`tests/*.e2e.ts`).
- Tests must not contact Linear or any external service.
- If a change affects native behavior that CI cannot exercise (capture, tray, shortcut, OAuth), describe how you verified it manually, including OS version and display scaling.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) with an optional scope:

```
feat(editor): add arrow head size option
fix(capture): cancel all overlays when one window closes
docs(status): record Windows 150% scaling results
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, `chore`. Keep the subject under about 72 characters and explain the reason for the change in the body when it is not obvious.

## Pull requests

1. Branch from `main` and keep each pull request focused on one change.
2. Fill in the pull request template, including how you tested.
3. Make sure Checks is green. Fix failures rather than disabling tests.
4. Update documentation when behavior changes. Update [docs/STATUS.md](docs/STATUS.md) with what is now verified or still open, and add an entry under "Unreleased" in [CHANGELOG.md](CHANGELOG.md).
5. For UI changes, include before and after screenshots. Use test content only; never share screenshots that contain private data.

## Releases

Version numbers in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` must match. No stable release is published until the acceptance matrix in [docs/TESTING.md](docs/TESTING.md) is satisfied on real hardware. Development builds stay clearly labeled as unsigned.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) that covers this project.
