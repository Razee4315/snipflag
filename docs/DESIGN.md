# Visual system

Direction: a calm but lively desktop companion. Warm ivory and sage in daylight; layered forest greens after hours. Teal denotes the primary action and selection. Apricot is a small accent (celebration particles, background glow). The brand mark is strictly black and white. System UI fonts keep Windows native text rendering without remote font requests.

| Token | Daylight | After hours |
|---|---|---|
| Background | #EFEEE8 | #111C1A |
| Surface | #FCFBF8 | #1A2A27 |
| Field surface | #F3F2EC | #14221F |
| Canvas surround | #E6E9E2 | #132120 |
| Text | #1E3531 | #EBF3EE |
| Muted text | #5F726C | #97ADA5 |
| Border | #DBE0D7 | #2A3F3A |
| Primary | #0F6B62 | #8CDCC1 |
| Primary foreground | #FBFAF7 | #0C2E27 |

Cards use 18px corners; controls use 10px corners. Texture comes from two soft radial glows on the app background and an inline SVG grain (no network requests; allowed by the `data:` image CSP) on the background, composer and dialogs. The grain never covers the screenshot canvas. The canvas sits on a quiet dot grid with a soft image shadow; the toolbar floats with a blurred translucent surface.

Controls: primary buttons use a subtle gradient, inner highlight and colored glow; all buttons lift on hover and compress on press. Selects use Chromium's customizable select (`appearance: base-select`) for themed pickers with a checkmark and open/close animation; engines without it (macOS/Linux WebKit) get a clean native select with a themed chevron. Toggles are switches. Scrollbars are thin, rounded and themed everywhere. Visible focus, named icon buttons, native form semantics and modal focus containment remain required.

## Motion and sound

Motion is short and purposeful: surfaces rise in on launch, dialogs spring in over a blurred backdrop, settings tabs slide a shared indicator, tool icons pop when chosen, new filmstrip tiles spring in, the canvas fades when switching images, a soft white flash marks a finished capture, and a drawn check with a small particle burst confirms an issue. The empty state floats the brand mark inside a marching selection frame. `prefers-reduced-motion` always wins; Settings → Appearance → Interface animations turns motion off entirely (spinners stay for feedback).

Sounds are synthesized with Web Audio (no audio files): a soft two-part shutter when a capture lands, a light pop when images are added, a three-note chime when Linear confirms an issue or a connection, and a low two-note cue for failures. Settings → Appearance → Play sound effects turns them off, and Preview sound plays the chime. Webviews start audio suspended, so sound unlocks on the first click or key press.

## Logo

The mark is the original Snipflag capture symbol: three rounded corner brackets and a diagonal arrow that completes the fourth corner, white (#FFFFFF) on a near-black (#0A0A0A) rounded tile. Source of truth: `public/icon.svg`; `docs/assets/logo.svg` is its documentation copy; `logo-mono.svg` is the single-color variant. Actions generates native icons from it, and the Windows NSIS installer uses the generated `icons/icon.ico` as its installer icon. In the app, the mark appears in the utility bar, in the empty state and in Settings.

## Window and layout

The main editor is frameless and stays hidden until its first paint (with a four-second fallback), so it never flashes an empty frame. At launch and whenever a capture finishes, it opens at the full workspace size: 84% × 88% of the monitor work area, limited to 1440 × 920 logical pixels and kept inside the work area. It never goes fullscreen. A capture only grows a smaller window; a larger size or a maximized window chosen by the user is kept. There is no expand/compact control.

The screenshot stage spans the full height on the left. On the right, a 46px utility bar (mark, drag space, History, Settings, minimize, save-and-hide) sits in normal layout flow above the composer card, so scrolling the composer can never overlap it. The composer scrolls its fields while a fixed footer keeps New session (labeled) and Create issue visible. At widths below 760px the utility bar, stage and composer stack and the window scrolls. Settings and History dialogs keep one fixed size; their content scrolls inside while tabs and footer stay put. Browser previews can exercise the responsive UI but cannot prove native window behavior.

Annotation defaults and export pixels are unchanged: red #EF4444, 3px stroke at image resolution, 22px text. Solid black redaction is the privacy tool; pixelation is cosmetic. Image fit never upscales beyond original dimensions.
