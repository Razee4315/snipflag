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

The redesigned mark combines two rounded capture corners with an ivory swallowtail flag, on a deep teal squircle. A small apricot dot gives it a recognizable top-right detail. Fixed colors: tile #116D65, crop corners #BFF2DA, flag #FFF9ED, dot #F3B66B. Source of truth: `public/icon.svg`; the header loads the same vector. `docs/assets/logo.svg` is the documentation copy; `logo-mono.svg` is the single-color variant. Actions generates all native icon sizes and installer/tray assets from the vector. No raster artwork or new dependency is needed.

## Window and layout

The main editor is frameless, initially 920 x 680 logical pixels. The first image in a session requests a compact size bounded to the current monitor. Additional images retain the user's workspace size. The header provides drag, expand/compact, minimize, and save-and-hide controls. Expanded mode requests 1280 x 840 logical pixels, bounded to the monitor; it does not enter fullscreen. At widths below 760px the form moves below the image and the window scrolls. Browser previews can exercise the responsive UI but cannot prove native window behavior.

Annotation defaults and export pixels are unchanged: red #EF4444, 3px stroke at image resolution, 22px text. Solid black redaction is the privacy tool; pixelation is cosmetic. Image fit never upscales beyond original dimensions.
