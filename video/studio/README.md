# Snipflag — Make it clear

An independent launch film. No source from `video/launch/` is reused.

Direction: editorial typography, architectural crop marks, forest / mint / ivory,
real interface imagery, and the owner's existing public demonstration recording.
42 seconds, 1920 × 1080, 60 fps. Render and dependency installation only on Actions.

Source recording: `site/assets/video/demo.mp4`; product UI: `site/assets/img/hero-dark.webp`;
identity: `public/icon.svg`. Existing recording privacy treatment must be preserved.
The synthetic Acme screenshot is a browser-preview capture, not a live Linear connection.

The workflow produces an MP4, poster, visual contact sheet and verification metadata.
This is a marketing artifact, not evidence of native platform acceptance.

## Edit and delivery

| Time | Picture | Purpose |
| --- | --- | --- |
| 00–04 | Billing discrepancy, isolated by a crop frame | Recognizable visual problem |
| 04–07 | Large mint typography and a drawn arrow | The promise: make it impossible to miss |
| 07–10 | Product identity assembled inside crop brackets | Brand reveal |
| 10–22 | Actual recorded product workflow, edited for pace | Capture, annotate, create in Linear |
| 22–27 | Three illustrative image cards converge | Multiple images belong to one issue |
| 27–31 | A synthetic email is pixelated | Deliberate privacy boundary |
| 31–35 | The real dark editor screenshot | Product beauty shot |
| 35–42 | Wordmark, promise and download URL | Readable closing card |

The recorded sequence uses source seconds 0–6, 9–16, 18–22 and 26–30;
it is edited and accelerated, not a claim that these operations take 12 seconds.
Synthetic billing cards illustrate the product story; they are not a new app UI.

`film.js` is a deterministic canvas timeline. `seek(seconds)` draws any frame.
`score.py` composes the original stereo instrumental and transition sounds using
additive synthesis and seeded noise; no stock recording, sampled song, or generated
voice is used. Manrope is downloaded on Actions under the SIL Open Font License,
included with the delivered artifacts. The product mark and public demo stay unchanged.

`render.mjs` captures four exact frame ranges, encodes H.264 and AAC, checks the final
duration, frame count, dimensions, rate and audio stream, and produces a contact sheet.
Rendering requires Playwright and ffmpeg; run it through **Studio launch film** on
GitHub Actions. Do not install or render on the owner's machine.
