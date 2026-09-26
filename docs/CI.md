# Remote builds and releases

User requirement: no builds on the owner's PC. No local node_modules, Rust target directory, browser binaries, Android SDKs, or generated installers. Edit files locally, commit/push, inspect Actions.

CI stages: frontend typecheck/unit tests/browser smoke tests; Rust compile/test on Windows, macOS, Linux; development installer artifacts on manual dispatch. Use caches on GitHub runners and short artifact retention. Bootstrap lockfiles on CI, download only small lockfiles, commit them, then use locked installs.

Linux packages include WebKitGTK 4.1, appindicator, librsvg, patchelf, XCB/RandR, DBus, PipeWire, Wayland, EGL, GBM/DRM, and clang for XCap.

Release policy differs from the sample guide: no automatic stable release or patch bump on every main push. Publish development artifacts first. Tagged releases use matching package/Tauri/Cargo versions and require tests for that exact commit. Keep unsigned artifacts explicitly labeled. Windows signing certificate and Apple Developer signing/notarization are needed for a polished public distribution. Tauri updater signing needs a separately generated secret key/public key; keep private material in GitHub Secrets, never commit it.

Build matrix: Windows x64 first; macOS Apple Silicon and Intel; Linux x64. Runtime test matrix is distinct from compilation. Version 1.0.0 was promoted from prerelease to the latest regular release at the explicit request of the owner after they confirmed the app is working well. Installers remain unsigned, and the detailed runtime acceptance matrix is still incomplete. The Publish unsigned prerelease workflow verifies that the supplied Checks and installer runs succeeded at its exact commit, attaches six installers and SHA256 checksums, then publishes with prerelease status. It never marks a stable/latest release.

Commands allowed locally: git, gh run list/view, gh run download with a named small artifact, source validation scripts without dependency installation. All npm/cargo tests and builds belong in workflow steps.
