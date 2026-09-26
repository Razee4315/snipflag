# Clipsenda

**See it. Mark it. Send it.**

A focused desktop app for turning one or more screenshots into one clear Linear issue. Built with Tauri 2, Rust, React, and TypeScript for Windows, macOS, and Linux.

Capture → annotate → capture another → describe → send to Linear.

## Project state

Active implementation. See [current status](docs/STATUS.md) for verified features, open work, CI evidence, and handoff notes. This is not yet a stable release.

## Documentation

- [Product and acceptance criteria](docs/PRODUCT.md)
- [Screens and interaction flows](docs/UX.md)
- [Visual language and colors](docs/DESIGN.md)
- [Architecture and data lifecycle](docs/ARCHITECTURE.md)
- [Linear integration and setup](docs/LINEAR.md)
- [Privacy and command boundaries](docs/SECURITY.md)
- [Builds and release operations](docs/CI.md)
- [Test matrix](docs/TESTING.md)
- [Name research](docs/NAME.md)
- [Setup guide decisions](docs/REFERENCE-REVIEW.md)
- [Roadmap and continuation instructions](docs/STATUS.md)

## Builds

All compilation and packaging happen in [GitHub Actions](https://github.com/Razee4315/clipsenda/actions). The owner's machine is used for editing and git only. Workflow artifacts expire; download only the installer you intend to test. OAuth app registration and production signing credentials are separate setup requirements.

No screenshot cloud, no account required to annotate, no screenshot analytics. Linear is contacted only for connection, metadata, and explicit submission.
