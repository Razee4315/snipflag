# Steal list: Snipflag website

Phase 1 artifact. Examined 2026-09-26 in the built-in browser, using computed styles, DOM structure and screenshots. On Jam, Shottr and Teenage Engineering the screenshot timed out, so those teardowns use DOM and CSS only. I did not watch motion frame by frame. Motion notes below come from DOM evidence, such as duplicated split headings or repeated headings for marquees, and are labelled as such.

## Sites examined

| # | Site | Stack | Type | Palette | Memorable thing |
|---|---|---|---|---|---|
| 1 | cleanshot.com (direct competitor, Mac capture) | Custom bundle (single hashed JS) | Google Sans Flex 600, h1 42px, -2% tracking; body 16px (ratio 2.6x, timid) | White page, black ink, one blue accent (`#1f5eff`-ish) on the word "apps." | The h1 is a comparative put-down: "There are average capture apps. And there's CleanShot." A real number ("250,000+ users") sits under it. |
| 2 | linear.app (the ecosystem Snipflag lives in) | Next.js | Inter Variable 510, h1 56px, -1.23px; Berkeley Mono accents | `#08090A` page, `#0F1011` / `#23252A` raised surfaces, `#F7F8F8` ink, white 1–8% overlays | The h1 text appears twice in the DOM (a split-reveal layer plus an accessible copy). Near-black surfaces separated only by 1–2% white steps, with no borders. |
| 3 | raycast.com (desktop utility, keyboard-first) | Next.js | Inter 600, h1 64px; body 16px (4x) | `#07080A` page, white ink, a deep red glow `#452324` behind the hero | Headline is the keyboard metaphor ("Your shortcut to everything.") and the closing h2 repeats it ("Take the short way."). Section h2s are one-line claims. |
| 4 | jam.dev (direct competitor, bug reporting) | Framer | Onsite Standard Medium 500, 64px, -2.56px (-0.04em) | White base, ink `#1F201C`, four candy pairs: lime `#9FF065`/`#D2FFB2`, sky `#73ADFF`/`#CEE3FF`, lemon `#F7FC68`/`#FAFFAF`, violet `#BF73FA` | Each feature gets its own bright color pair. Headings repeat 4x in the DOM, which means stacked or marquee text animation. |
| 5 | shottr.cc (indie screenshot annotator) | Hand-built static | MuseoSlab 500 h1 48px, Avenir body; ink `#3E413D` | Warm light page, soft green-grey ink | Honest, indie, feature-by-feature list (14 h2s), ending with "What feature should I build next?" A person built it, and the site sounds like one. |
| 6 | teenage.engineering (adjacent vertical: hardware product design) | Custom | Proprietary `te-20` everywhere, 16px, black on pure white | `#FFFFFF` / `#000000` plus product color | Product objects as the only imagery, with tiny technical type. The product is treated as a precise instrument. |

## Moves to steal

| # | Move | From | Category | How it adapts here |
|---|---|---|---|---|
| 1 | Comparative h1 that names the category's failure | site 1 | copy | The problem is scattered screenshots, not average apps. The h1 names that pain in under 8 words, and the comparison page makes it concrete. |
| 2 | Near-black surfaces separated by tiny luminance steps, no card borders | site 2 | color/layout | Moved into the app's forest palette: `#0B1F1B` → `#12302A` → `#1A3D36`. Separation comes from surface steps, never 1px grey borders. |
| 3 | Split h1 with accessible duplicate (masked line reveal) | site 2 (DOM evidence) | motion | GSAP SplitText `mask:"lines"` with `aria-label` on the parent, the same accessibility pattern Linear uses. |
| 4 | A colored glow behind the hero product | site 3 | color | An apricot `#FFB25B` glow behind the hero screenshot, echoing the app's own background glow described in DESIGN.md. |
| 5 | Closing line that echoes the hero line | site 3 | copy/structure | The footer CTA answers the hero: from "Twelve screenshots. Zero context." to "One issue. Full story." |
| 6 | One strong color pair per feature | site 4 | color | Swapped for Snipflag's real annotation colors (red `#EF4444` arrow, yellow `#FDE047` highlighter, teal selection). Each feature chapter is "inked" in the tool color it demonstrates. |
| 7 | Repeated or stacked heading animation, marquee style | site 4 (DOM evidence) | motion | A scroll-velocity marquee of the tool names (ARROW · RECTANGLE · PEN · HIGHLIGHTER · TEXT · PIXELATE) in mono, used as a divider band. |
| 8 | Indie honesty: a named maker, an open question to users | site 5 | content | "Built in the open", a link to the GitHub issues, and "unsigned preview" said plainly, not hidden. |
| 9 | Tiny precise technical labels on a product-as-instrument | site 6 | type | Mono coordinate labels (`1920×1080 · img 02/04 · @2x`) around the hero screenshot, like a capture HUD. This is the site's texture. |
| 10 | A real number under the h1 | site 1 | content | No fake user counts. Use true product facts: "10 screenshots · 1 issue · 0 uploads until you click Create." |
| 11 | Pinned scroll sequence showing the workflow step by step | sites 2 and 4 (feature-section structure) | motion | Pinned "session" section: capture A, annotate, capture B, reorder, and one issue appears, scrubbed by scroll. |

## Table stakes (every competitor has these; required, earns no credit)
- A real product screenshot in the hero (sites 1, 2, 3)
- A download or trial CTA above the fold, with the OS named (sites 1, 3)
- One claim per section heading (all)
- Pricing or "free" clarity (site 1 has pricing; Snipflag is free and MIT, so say it)

## Deliberate deviations
- **No white SaaS page.** Sites 1, 4 and 5 are white, and sites 2 and 3 are neutral black. Snipflag uses a colored dark (deep forest teal), so no competitor shares its color.
- **No Inter.** Sites 2 and 3 both use it.
- **No fake social proof.** Site 1 has "250,000+ users". Snipflag has 0 stars today and will not pretend otherwise.
- **An honest comparison page** that names where competitors win (browser logs, video, Mac polish). None of the examined sites does this.

## Rejected
- Jam's four candy pairs as-is: too playful, and it would read as a Jam clone. Kept only the idea of color per feature, mapped to real tool colors.
- Linear's pure neutral black: that is Linear's identity, and copying it would make Snipflag look like a Linear page.
- Shottr's 14-feature laundry list: it is honest but flat. Replaced by a curated set of features grouped into chapters.
- Screenshot-free type-only hero (site 6 style): the SaaS archetype needs the product visible.
