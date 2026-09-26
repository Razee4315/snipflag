# Visual system

Direction: quiet precision. Warm near-white workspace, dark ink, restrained violet accent, subtle borders, generous canvas space. Follow OS theme with an explicit override. Avoid decorative gradients, glass panels, excessive shadows, fake dashboard metrics, and large marketing headings in the editor.

| Token | Light | Dark |
|---|---|---|
| Background | #F6F6F8 | #121216 |
| Surface | #FFFFFF | #1B1B22 |
| Canvas surround | #ECECF1 | #0E0E12 |
| Text | #20202A | #F4F4F7 |
| Muted text | #686875 | #ADADBB |
| Border | #DDDDE5 | #33333E |
| Primary | #6356DF | #A398FF |
| Primary foreground | #FFFFFF | #17132F |
| Danger | #B52E43 | #FF8799 |
| Success | #15734C | #76D5A8 |

Fonts: system UI (Segoe UI on Windows); no remote font fetch. Main body 13–14 px, controls 13 px, titles 18–22 px. Spacing scale 4/8/12/16/24/32. Control radius 7–9 px; panel radius 12 px. Border 1 px. Standard target 36 px; compact icon target no smaller than 32 px with label/tooltip.

Annotation defaults: bright red #EF4444, 3 px stroke at image resolution, 22 px text; arrows with readable head size. Redaction uses opaque black. Pixelation is visual obscuring and must not be described as secure removal.

Logo: two crop corners (the snip) framing a swallowtail flag on a pole (the issue being flagged). The notch in the flag doubles as a "snipped" edge. White corners and pole, amber flag `#FFD166`, on a rounded violet tile with a subtle vertical gradient `#7569F0` to `#5243D4`. The flag is the only use of amber in the product; it is a brand color, not a UI token. The source is `public/icon.svg` (copied to `docs/assets/logo.svg`); platform icons, installers, and the tray icon are generated from it on CI with `tauri icon`. A single-color variant for print or template use is `docs/assets/logo-mono.svg`. Keep clear space of at least one eighth of the tile size around the mark, do not recolor the flag, and do not place the mark on busy imagery. Verified legible at 16, 32, 64, and 192 px on light and dark backgrounds. The in-app header uses the same mark at 22 px next to the product name in semibold system UI type.

Motion: 120–160 ms feedback only; disable under prefers-reduced-motion. Avoid animating large screenshot canvases. Maintain focus visibility on every surface.
