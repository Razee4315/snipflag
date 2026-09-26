# Visual system

Direction: a small, calm desktop companion. Warm ivory and sage in daylight; layered forest greens after hours. Teal denotes the primary action and selection. Apricot is reserved for the brand detail and the empty-state illustration. System UI fonts keep Windows native text rendering without remote font requests.

| Token | Daylight | After hours |
|---|---|---|
| Background | #F2F1EC | #172825 |
| Surface | #FBFAF7 | #203530 |
| Canvas surround | #E7EAE4 | #1A2E2A |
| Text | #253D39 | #EDF3EA |
| Muted text | #657772 | #A6BCB2 |
| Border | #D9DFD7 | #385048 |
| Primary | #116D65 | #8CDCC1 |
| Primary foreground | #FBFAF7 | #10392F |

Main surfaces use 16px corners; controls use 10px corners. The canvas sits on a quiet dot grid; the floating toolbar and image have restrained shadows. A compact image rail retains explicit reorder/remove controls. The composer uses title, description, remembered team and collapsed optional issue details, plus an optional reproduction scaffold. Visible focus, named icon buttons, native form semantics, modal focus containment and reduced-motion support remain required.

## Logo

The final mark is an abstract rounded S: two continuous mint/ivory curves on a deep teal squircle, with a small apricot terminal dot. It contains no flag. Fixed colors: tile #116D65, upper curve #BFF2DA, lower curve #FFF9ED, dot #F3B66B. Source of truth: public/icon.svg; docs/assets/logo.svg is its documentation copy; logo-mono.svg is the single-color variant. Actions generates native icons and installer/tray assets. The editing workspace deliberately omits branding to save space.

## Window and layout

The main editor is frameless, initially 920 x 680 logical pixels. The first image in a session requests a compact size bounded to the current monitor. Additional images retain the user's workspace size. A 38px-high utility area above the composer provides drag, expand/compact, minimize, and save-and-hide controls. It contains no logo, repeated title, slogan, or section headings; an accessible save dot exposes state on hover and failures remain visible. Expanded mode requests 1280 x 840 logical pixels, bounded to the monitor; it does not enter fullscreen. The screenshot area starts at the top edge. At widths below 760px the form moves below the image, controls occupy a slim top row, and the window scrolls. Browser previews can exercise the responsive UI but cannot prove native window behavior.

Annotation defaults and export pixels are unchanged: red #EF4444, 3px stroke at image resolution, 22px text. Solid black redaction is the privacy tool; pixelation is cosmetic. Image fit never upscales beyond original dimensions.
