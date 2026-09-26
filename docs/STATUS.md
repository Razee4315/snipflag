# Current state / handoff

Updated: 2026-09-26. Repository: https://github.com/Razee4315/clipsenda (private).

## Decisions locked by user

Tauri 2 + Rust + React/TypeScript. Windows primary, macOS/Linux targets. All builds on GitHub Actions, no local builds or large dependencies. Multiple screenshots in a single reporting session → one Linear issue. Documentation and durable handoff before implementation.

## Completed

- Product brief and setup reference review.
- Name collision checks; selected Clipsenda; private GitHub repository created.
- Product, UX, design, architecture, Linear, privacy, CI, test, and reference-review specifications.

## In progress

- Implement native core, session editor, OAuth, and remote CI.

## External setup

- Real Linear OAuth app/client ID and callback registration remain owner configuration.
- Production Windows/macOS signing and updater keys not configured.
- Actual native runtime tests need installed artifacts on respective OSes.

## Resume procedure

1. Read this file and AGENTS.md. Inspect git status and current Actions results.
2. Fix failing remote checks before new features. Never run local builds.
3. Work against PRODUCT acceptance criteria; preserve multi-image semantics.
4. Update this file with implementation truth, exact verification evidence, open gaps, and next action before ending work.
