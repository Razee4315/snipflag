# Getting help

## Before asking

- Read the [README](README.md) for setup, including how to connect Linear.
- Check [docs/STATUS.md](docs/STATUS.md) for known limitations and what has been verified on each platform.
- Search [existing issues](https://github.com/Razee4315/snipflag/issues) to see whether your question has already been answered.

## Common questions

**Connect Linear is disabled or fails.** Snipflag needs the public client ID of a Linear OAuth application. Create one in Linear under Settings, API, OAuth applications, add the callback `http://127.0.0.1:47839/callback`, and paste the client ID into Snipflag Settings. A client secret is never needed.

**"Login callback port 47839 is in use."** Another sign-in attempt is still waiting. Close it or wait a few minutes, then try again.

**Screen capture does not work on macOS.** Allow Screen Recording for Snipflag in System Settings, Privacy and Security, then restart Snipflag.

**Screen capture does not work on Linux Wayland.** Some compositors do not allow direct capture. Use Add images or paste a screenshot taken with your desktop's own tool.

**The capture shortcut does nothing.** Another app may already use it. Snipflag shows a warning when registration fails; choose a different shortcut in Settings.

**Windows or macOS warns that the app is unrecognized.** Development builds are not code-signed yet. Only install builds downloaded from this repository's Actions or Releases.

## Opening an issue

- **Bug:** use the bug report template and include your OS version, display scaling, and steps to reproduce.
- **Idea:** use the feature request template and describe the problem before the solution.
- **Security:** do not open an issue. Follow [SECURITY.md](SECURITY.md).

Do not attach screenshots or logs that contain private information or tokens.
