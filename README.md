# Snipflag

**Snip it. Mark it. Flag it.**

A focused desktop app that turns one or more screenshots into one clear Linear issue. Built with Tauri 2, Rust, React, and TypeScript for Windows (primary), macOS, and Linux.

Capture → annotate → capture another → describe → create one Linear issue.

## What it does

- Tray app with a global capture shortcut (default `Ctrl/Cmd+Shift+2`). Freezes every monitor, you drag a region, Escape cancels.
- Up to 10 screenshots per session, each with its own annotations and undo/redo: arrow, rectangle, pen, text, pixelate (cosmetic), and solid redaction.
- Add screenshots by capture, file import (PNG/JPEG/WebP), drag and drop, or paste. Reorder, caption, remove, copy, or save each one.
- Drafts are saved on your computer automatically and restored after a restart. History lets you reopen or delete past sessions.
- Linear connection uses OAuth with PKCE. Tokens stay in the OS credential store. Choose team, project, assignee, labels, and priority.
- **Create issue** uploads the flattened screenshots and creates one issue with ordered image sections. The issue ID is stable, so a retry after an uncertain network failure checks Linear first and never creates a duplicate.

## Project state

Development build (0.1.0, unsigned). See [current status](docs/STATUS.md) for what is verified, CI evidence, and what still needs manual testing on real machines. Not a stable release.

## Setting up Linear

Create an OAuth application in Linear (Settings → API → OAuth applications) with callback `http://127.0.0.1:47839/callback`. Paste its public **client ID** into Snipflag → Settings, then choose Connect Linear. No client secret is needed or accepted. Details: [docs/LINEAR.md](docs/LINEAR.md).

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
- [Status and continuation instructions](docs/STATUS.md)

## Builds

All compilation and packaging happen in [GitHub Actions](https://github.com/Razee4315/snipflag/actions): **Checks** runs on every push, and **Development installers** is started manually and produces unsigned Windows, macOS, and Linux installers. The owner's machine is used only for editing and git. Workflow artifacts expire after 7 days.

No screenshot cloud, no account required to annotate, no analytics. Linear is contacted only to connect, load teams and fields, and when you choose Create issue.
