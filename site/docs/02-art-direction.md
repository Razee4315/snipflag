# Snipflag website: art direction, tokens, pages, decisions

On 2026-09-26 the owner approved Direction 1, "Capture HUD", and waived the remaining stop gates ("just do it"). This file combines the brief, art direction, tokens, motion spec, page specs and decision log into one document so it stays decision-complete without fifteen stub files. The steal list is in `14-steal-list.md`.

## Brief
- **Job:** a Linear user who files visual bugs should understand in five seconds that Snipflag turns several annotated screenshots into one Linear issue from the desktop, and should download it.
- **Primary action:** download the v1.0.0 preview. The OS is detected, and the site says plainly that the build is unsigned.
- **Audience:** developers, QA, designers and PMs on Linear, mostly on Windows desktops.
- **Non-goals:** pricing, accounts, a newsletter, analytics, fake social proof, mobile-app marketing.
- **Tier:** Showpiece (owner confirmed).

## Direction: Capture HUD
The site looks like it lives inside the capture tool. Warm forest dark, ivory type, one apricot accent, mono HUD labels, sharp selection-handle corners.

| Decision | Value | Source |
|---|---|---|
| Palette | `--forest #0B1F1B` page · `--forest-2 #12302A` · `--forest-3 #1A3D36` surfaces · `--ivory #F4EFE3` ink · `--ivory-dim #A9B8B0` muted · `--apricot #FFB25B` the only accent · `--mint #8CDCC1` app-primary, used only in app contexts | steal #2 plus app DESIGN.md |
| Tool inks | `#EF4444` arrow, `#FDE047` highlighter. Used only on screenshots and demo marks | steal #6 |
| Display | Bricolage Grotesque 700/800, opsz 96, tracking -0.045em | original |
| Text | Instrument Sans 400/500/600, 17px/1.6 | original |
| Mono | JetBrains Mono 400/500, 12px, +0.08em uppercase for labels | steal #9 |
| Scale | Display `clamp(3.4rem, 10.5vw, 10.5rem)` against a 17px body, a ratio of about 10x | anti-slop |
| Grid | 12 columns, `clamp(16px, 2vw, 24px)` gutter, 1320px max, `clamp(6rem, 14vw, 11rem)` section padding | |
| Corners | 2px everywhere (selection handles). Buttons 2px as well. | original |
| Borders | None on cards. Apricot dashed or solid outlines only where they mean "selection". | steal #2 |
| Texture | SVG grain 4% plus a 24px dot grid at 6% (app canvas echo) | app DESIGN.md |
| Easing | `--ease-out: cubic-bezier(0.16,1,0.3,1)` (expo.out) default; `--ease-io: cubic-bezier(0.77,0,0.175,1)`; `--ease-in: cubic-bezier(0.5,0,0.75,0)` exits | motion-system |

**Signature: the page captures itself.** On load, a crosshair drags an apricot selection rectangle across the hero headline with a live `W × H` readout, flashes, and an arrow strokes itself toward the Download button. After that, the desktop cursor is a crosshair with live coordinates. The "Try it" section has a real canvas editor on a sample screenshot, with arrow, pen, highlighter and pixelate. Pixelate uses true 14px block averages, the same approach as the app.

**Anti-list:** white page, Inter, indigo or violet, gradient text, three icon cards, soft floating shadows, emoji icons, fake counts or testimonials, "Get Started".

## Motion inventory (Showpiece floor: 13)
1. Scroll reveals with expo.out and stagger (`[data-reveal]`)
2. Hover transforms on all interactive elements
3. Button press `scale(.97)`
4. Link underlines that wipe with `scaleX` from the left
5. Lenis driven by the GSAP ticker, disabled on touch and under reduced motion
6. SplitText masked line reveal on every page h1, after `document.fonts.ready`, with `aria-label`
7. Pinned scrubbed "one session" sequence: images stack, number, reorder, and collapse into one issue card
8. Hero screenshot parallax plus exit scale and fade
9. Choreographed hero load: HUD labels, h1 lines, subhead, CTA, screenshot clip reveal (under 1.2s, overlapping)
10. Signature capture sequence plus the live try-it canvas
11. Preloader: a "capture flash" shutter tied to `document.fonts.ready` and hero image decode, capped at 1.4s
12. Custom crosshair cursor with a coordinate readout (fine pointers only)
13. Second signature-grade effect: a velocity-driven tool marquee plus a curtain-reveal footer

Reduced motion: no Lenis, no preloader, no pin (the sequence renders as a static stacked diagram), no cursor. Reveals are instant.

## Pages and SEO
Base URL: `https://razee4315.github.io/snipflag/`. Every page has a unique title under 60 characters, a meta description under 160, a canonical link, OG and Twitter tags, and JSON-LD.
- `/` home: SoftwareApplication, FAQPage and Organization schema
- `/compare/`: hub with the full matrix (ItemList plus BreadcrumbList)
- `/compare/screenpresso/`, `/compare/jam/`, `/compare/bugshot/`, `/compare/sharex-greenshot-flameshot/`: "X alternative for Linear" pages (BreadcrumbList plus FAQPage)
- `/404.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, `og.png` (1200×630)

Home section order: hero, problem ("the screenshot shuffle"), pinned one-session sequence, tool marquee, try-it canvas, feature chapters (capture / annotate / report / keep), privacy boundary, comparison teaser, FAQ, curtain footer CTA.

## Content rules
Every competitor claim was checked on 2026-09-26 against the vendor's own page and is dated on the page. Competitors' strengths are stated honestly (video, console logs, Mac polish, maturity). Snipflag's limits are stated too: unsigned preview, it needs your own Linear OAuth client ID, no video, and Wayland capture limits.

## Decision log
- ADR-1: Plain static HTML, CSS and JS in `/site`, with GSAP and Lenis from jsDelivr pinned versions. Reason: the owner forbids local npm and builds, and GitHub Pages serves it as-is. Rejected: Astro or Next static export, which need a build step (CI could do it, but it adds moving parts for 7 pages).
- ADR-2: Site docs live in `site/docs/`, not the app's `docs/`, to keep the app documentation clean.
- ADR-3: Google Fonts CSS with `display=swap` plus preconnect. Rejected: self-hosting, which needs binary downloads the owner did not approve.
- ADR-4: The hero uses the real CI screenshot `after-hours.png` (synthetic content, real UI), converted to WebP.
- ADR-5: Deploy via a GitHub Actions Pages workflow on changes under `site/**`.
- ADR-6: A separate page per competitor for "alternative" search intent, plus one hub.
- ADR-7: `/compare/*`, `404.html` and `sitemap.xml` are generated by `site/tools/build_pages.py` (standard-library Python) and committed. `site/tools/check_site.py` validates links, anchors, titles, descriptions, canonicals, JSON-LD and image dimensions. The Website workflow runs both, fails if the generated pages are stale, and deploys `site/` without `docs/` and `tools/` to GitHub Pages.

## Maintenance
- Edit the home page in `site/index.html`. Edit the comparison pages only through `site/tools/build_pages.py`, then run `python site/tools/build_pages.py`.
- When competitor facts change, update the data and `CHECKED` together. A claim without a vendor source becomes "Not documented".
- Preview locally with `python -m http.server 4173 --directory site`. The 404 page uses `/snipflag/` absolute paths, so it only renders correctly on Pages.
