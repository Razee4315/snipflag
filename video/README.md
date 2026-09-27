# Snipflag demo videos

Every demo is an HTML page that draws each frame from a time value. GitHub Actions opens that page in a headless browser, captures every frame, adds the soundtrack and encodes an MP4. **Nothing is rendered on your laptop.** Your laptop only shows a light preview.

```
video/
  README.md        ← this file
  render.mjs       ← shared renderer (runs on Actions)
  package.json     ← renderer dependency (Playwright), installed on Actions only
  shared/
    player.js      ← preview controls, Lite mode, render hook, WAV export
    player.css
  _template/       ← copy this to start a new demo (never rendered by itself)
  launch/          ← the launch film
  <your-demo>/     ← one folder per demo
```

## Make a new demo

1. **Copy `_template/`** to a new folder. Use lowercase letters, digits and dashes, e.g. `video/multi-image/`.
2. **Edit `film.js`:**
   - `DUR` is the length in seconds and `FPS` is the frame rate (60 is smooth, 30 renders twice as fast).
   - `SCENES` lists each scene id with its `[start, end)` time.
   - Each function in `FN` gets the time and sets styles. The helper `P(t, a, b, ease)` gives 0 → 1 progress between times `a` and `b`.
   - `Player.mount({...})` settings:
     - `checks`: times the renderer uses to test that frames repeat exactly
     - `away`: a later time it jumps to between those checks
     - `poster`: the time used for the poster image
     - `review`: times saved as still images
3. **Edit `index.html` and `film.css`** for the layout. The stage is always 1920×1080 pixels, so design in those units.
4. **Sound (optional):** put cues in `audio.js`, using the same seconds as `film.js`. For a silent video, delete `audio.js` and its `<script>` tag.

### The one rule

`seek(t)` must set **every** moving property from `t` alone. Don't use:

- CSS `transition` or `animation`
- `setTimeout` or `setInterval`
- `Math.random()`. For random-looking values, use a seeded generator like the one in `launch/audio.js`.
- values left over from the previous frame

Following this rule is what lets Actions render frames in any order across 4 parallel browsers. The renderer checks it. If a frame looks different after seeking away and back, the render fails with `Non-deterministic seek at …`.

## Preview on the laptop (low power)

Start a tiny local file server from the repo root. It's Python's built-in server, so there's nothing to install:

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory video
```

Then open `http://127.0.0.1:8765/<demo>/`, for example `http://127.0.0.1:8765/launch/`.

| Control | What it does |
|---|---|
| **Space** | Play / pause |
| **← / →** | Step one frame back / forward (hold Shift to step 1 second) |
| **Scrubber** | Jump to any time. You always see the exact final frame. |
| **Lite: on** (default) | While playing: 30 fps, no blur or backdrop filters, no per-letter GPU layers. Pausing brings back the exact frame. |
| **Lite: off** | Full-quality playback. Uses much more power. |
| `?t=26` in the URL | Open at 26 s |
| `?full` in the URL | Start with Lite off |

Tips to save battery:

- Scrub to the moment you're working on instead of replaying the whole film.
- The preview stops by itself when you switch tabs.
- Watch full-speed playback in the MP4 from Actions. Your laptop plays video with its hardware decoder, which uses far less power than the live HTML preview.
- Stop the server (Ctrl+C) when you're done.

## Render on GitHub Actions

The workflow is `.github/workflows/demo-videos.yml` ("Demo videos").

**Automatic renders on push.** Pushing to the `launch-video` branch, or any branch named `video/…`, renders only the demos whose folders changed. A change to `shared/`, `render.mjs`, `package.json` or the workflow re-renders every demo. Folders that start with `_` are skipped.

- Pushes render at **final** quality: 1920×1080, the demo's FPS, a slow high-quality encode. The 57 s launch film took about 35 min.
- To get a **draft** instead, put `[draft]` anywhere in the commit message. Drafts are 1280×720 at 30 fps with a fast encode, and take roughly a third of the time.

```bash
git commit -m "video: tweak multi-image timing [draft]"
```

**Manual renders.** In GitHub, open Actions → Demo videos → Run workflow. You choose:

- `demo`: a folder name, or `all`
- `quality`: `draft` or `final`
- `seconds`: render only the first N seconds, for a quick check of the opening

GitHub only shows the Run workflow button once this workflow file exists on the default branch (`main`). Until then, use pushes.

**Downloading.** Open the finished run and download the `video-<demo>-<quality>` artifact. Artifacts are kept for 14 days. The artifact contains:

- `<demo>-1080p60.mp4` (or `<demo>-draft-720p30.mp4`): the video
- `poster.png`: a thumbnail frame
- `soundtrack.wav`: the audio, if the demo has any
- `review/contact-*.jpg`: sheets of one frame per second with timestamps, to skim the whole video fast
- `review/frame-*.png`: the still frames chosen in `review`

## Suggested workflow

1. Build a scene while scrubbing the preview in Lite mode.
2. Push with `[draft]` and check the contact sheets for timing.
3. When it looks right, push without `[draft]` to get the final 1080p file.
