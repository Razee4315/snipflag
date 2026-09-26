# Security Policy

Snipflag handles screenshots that may contain sensitive information, and it stores a Linear OAuth token on your computer. Security reports are taken seriously.

## Supported versions

Snipflag is in development and has no stable release yet. Security fixes are made on the `main` branch and included in the next development build.

| Version | Supported |
|---|---|
| `main` / latest development build | Yes |
| Older development builds | No, please update |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

- If private vulnerability reporting is enabled for the repository, open the **Security** tab and choose **Report a vulnerability**.
- Otherwise, contact the maintainer privately using the contact details on the maintainer's GitHub profile ([@Razee4315](https://github.com/Razee4315)) and ask for a private channel before sharing details.

Please include:

- The affected version or commit, and your operating system and version.
- A description of the issue and its impact.
- Steps to reproduce, or a proof of concept.
- Any logs, with tokens, signed URLs, and personal data removed.

Never include real access tokens or screenshots containing private data. Use test accounts and test content.

## What to expect

The maintainer aims to acknowledge reports within five business days, keep you informed while the issue is investigated, and credit you in the release notes when the fix ships, unless you prefer to stay anonymous. Please allow a reasonable period for a fix before disclosing publicly.

## Scope

Examples of issues in scope:

- Exposure of the Linear access or refresh token, including to the webview, logs, or disk outside the OS credential store.
- Screenshots or drafts leaving the computer without an explicit Create issue action.
- Redaction that does not fully remove the covered pixels from exported or uploaded images.
- Bypassing the command role checks, for example a capture overlay performing editor actions.
- Path traversal or writes outside the app data directory or a location chosen in the save dialog.
- Weaknesses in the OAuth flow, such as missing state validation or PKCE problems.
- Sending the OAuth token to any host other than Linear's API.

Out of scope:

- Pixelation being reversible. Pixelation is documented as cosmetic; use Redact for sensitive content.
- Local drafts being readable by other software running as the same user. Drafts are stored unencrypted in the app data folder, as documented.
- Warnings caused by the development builds being unsigned.
- Issues in Linear's own service, which should be reported to Linear.

## Design documentation

The privacy model and command boundaries are described in [docs/SECURITY.md](docs/SECURITY.md).
