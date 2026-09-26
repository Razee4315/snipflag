# User reference review

Read the provided product brief and inspected the supplied Tauri quick setup, Android lessons, and CI/CD guide. They inform implementation; the user's current request controls scope.

Adopt: single-repository structure, small main.rs / lib.rs shell, explicit plugin registration, typed IPC, design tokens, platform CI matrix, caching, aligned version files, reading actual error logs, narrow capability audits, direct tokio feature declarations, strict IPC-compatible CSP, native credential storage.

Adjust: current compatible dependencies instead of React 18 with React 19 types; one CSS token system rather than overlapping styled-components/Tailwind styles; no generic HTTP/shell/filesystem grants; no null CSP; no automatic release/version commit on every push; committed lockfiles and reproducible CI after bootstrap.

Do not apply: local npm/Rust builds, SDK installation, Android/Gradle generation, mobile permissions/layout hacks, LLM inference dependencies, sample project branding, broad network grants, sample destructive tag deletion. Mobile content is useful as engineering lessons, not requested scope.

Sources (local references, not copied into the product repository): `TAURI_QUICK_SETUP.md`, `tauri-android-lessons.md`, `tauri-cicd-pipeline.md` in the owner's tool-skills/guides/tauri-boilerplate directory. No third-party guide text is republished wholesale.
