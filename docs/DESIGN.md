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

Logo: two crop corners enclosing a small outgoing diagonal arrow. Use a simple vector asset as the source; generate platform icons on CI. Product name in text stays legible at tray/editor sizes.

Motion: 120–160 ms feedback only; disable under prefers-reduced-motion. Avoid animating large screenshot canvases. Maintain focus visibility on every surface.
