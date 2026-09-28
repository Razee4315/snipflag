"""Generates the /compare/ pages, 404.html and sitemap.xml for the Snipflag site.

Plain Python 3 standard library, no dependencies. Run from the repo root:
    python site/tools/build_pages.py
The generated HTML is committed; GitHub Pages serves it as-is. Home page (site/index.html) is hand-written.
Competitor facts were checked on 2026-09-26 against the sources listed per page. Update CHECKED and facts together.
"""
import json
from pathlib import Path
from html import escape

SITE = Path(__file__).resolve().parent.parent
BASE = "https://razee4315.github.io/snipflag/"
CHECKED = "26 September 2026"
CHECKED_ISO = "2026-09-26"
REL = "https://github.com/Razee4315/snipflag/releases/download/v1.2.0/"

FONTS = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap"
CSP = ("default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; base-uri 'self'; form-action 'none'")

ARROW = '<svg class="nudge-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>'
DL = '<svg class="nudge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12m0 0-5-5m5 5 5-5M5 20h14"/></svg>'


def head(p, title, desc, path, jsonld, noindex=False):
    url = BASE + path
    robots = "noindex, follow" if noindex else "index, follow, max-image-preview:large"
    return f"""<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{escape(title)}</title>
<meta name="description" content="{escape(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#0C1F1B">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Snipflag">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="{escape(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escape(title)}">
<meta name="twitter:description" content="{escape(desc)}">
<meta name="twitter:image" content="{BASE}og.png">
<link rel="icon" href="{p}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{p}apple-touch-icon.png">
<link rel="manifest" href="{p}site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="{p}assets/css/site.css">
<script src="{p}assets/js/boot.js"></script>
<script type="application/ld+json">
{json.dumps(jsonld, indent=2, ensure_ascii=False)}
</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
"""


def header(p, current=""):
    cur = ' aria-current="page"' if current == "compare" else ""
    return f"""<header class="site-header">
  <div class="wrap">
    <a class="brand" href="{p}" aria-label="Snipflag home"><img src="{p}favicon.svg" width="28" height="28" alt="">Snipflag</a>
    <nav class="nav" id="nav" aria-label="Main">
      <a class="wipe" href="{p}#how">How it works</a>
      <a class="wipe" href="{p}compare/"{cur}>Compare</a>
      <a class="wipe" href="{p}#faq">FAQ</a>
      <a class="wipe" href="https://github.com/Razee4315/snipflag">GitHub</a>
    </nav>
    <a class="btn btn-primary btn-sm nav-cta" href="{p}#download">Download</a>
    <button class="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>
  </div>
</header>
"""


def footer(p):
    return f"""<footer class="site-footer">
  <div class="wrap">
    <div class="fine"><a class="brand" href="{p}"><img src="{p}favicon.svg" width="28" height="28" alt="">Snipflag</a><p class="tagline">Snip it. Mark it. Flag it.</p><p>© 2026 Snipflag contributors. Not affiliated with Linear or any product compared here. Product names belong to their owners.</p></div>
    <nav aria-label="Product"><h2>Product</h2><a href="{p}#how">How it works</a><a href="{p}#download">Download</a></nav>
    <nav aria-label="Compare"><h2>Compare</h2><a href="{p}compare/">All tools</a><a href="{p}compare/screenpresso/">Screenpresso</a><a href="{p}compare/jam/">Jam</a><a href="{p}compare/bugshot/">BugShot</a><a href="{p}compare/sharex-greenshot-flameshot/">ShareX and others</a></nav>
    <nav aria-label="Project"><h2>Project</h2><a href="https://github.com/Razee4315/snipflag">GitHub</a><a href="https://github.com/Razee4315/snipflag/releases">Releases</a><a href="https://github.com/Razee4315/snipflag/blob/main/LICENSE">MIT License</a></nav>
  </div>
</footer>
"""


SCRIPTS = """<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.3.11/dist/lenis.min.js" defer></script>
<script src="{p}assets/js/site.js" defer></script>
</body>
</html>
"""


def crumbs(p, items):
    lis = "".join(
        f'<li><a class="wipe" href="{href}">{escape(name)}</a></li>' if href else f'<li aria-current="page">{escape(name)}</li>'
        for name, href in items
    )
    return f'<nav class="crumbs mono" aria-label="Breadcrumb"><ol>{lis}</ol></nav>'


def breadcrumb_ld(items):
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name, "item": BASE + path}
            for i, (name, path) in enumerate(items)
        ],
    }


def cell(v):
    """'y:text' -> yes marker, 'n:text' -> no, 'p:text' -> partial, else plain."""
    if len(v) > 1 and v[1] == ":" and v[0] in "ynp":
        cls = {"y": "yes", "n": "no", "p": "part"}[v[0]]
        return f'<span class="{cls}">{escape(v[2:])}</span>'
    return escape(v)


def table(cols, rows, caption):
    th = "".join(f'<th scope="col"{" class=\"us\"" if i == 1 else ""}>{escape(c)}</th>' for i, c in enumerate(cols))
    body = ""
    for r in rows:
        tds = "".join(f'<td{" class=\"us\"" if i == 0 else ""}>{cell(v)}</td>' for i, v in enumerate(r[1:]))
        body += f'<tr><th scope="row">{escape(r[0])}</th>{tds}</tr>\n'
    return f"""<div class="table-scroll" data-reveal><table class="matrix">
<caption>{caption}</caption>
<thead><tr>{th}</tr></thead>
<tbody>
{body}</tbody></table></div>"""


def faq_html(qas):
    return "\n".join(f'<details class="qa"><summary>{escape(q)}</summary><div class="a"><p>{a}</p></div></details>' for q, a in qas)


def faq_ld(qas):
    import re
    strip = lambda s: re.sub(r"<[^>]+>", "", s)
    return {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for q, a in qas]}


def cta(p, text):
    return f"""<section class="section" aria-label="Download Snipflag"><div class="wrap">
<div class="cta-band" data-reveal><h2>{text}</h2>
<div class="hero-actions"><a class="btn btn-primary" data-download href="{p}#download">{DL}<span data-dl-label>Download free</span> <small data-dl-meta></small></a>
<a class="btn btn-ghost" href="{p}#how">See how it works</a></div></div>
</div></section>"""


# ---------------------------------------------------------------- data
COMPETITORS = {
    "screenpresso": {
        "name": "Screenpresso",
        "title": "Snipflag vs Screenpresso for Linear bug reports",
        "desc": "Snipflag vs Screenpresso: both capture your desktop and create Linear issues. Compare platforms, price, video, open source and privacy.",
        "h1": "Snipflag vs Screenpresso",
        "short": "Both are desktop capture apps that can publish to Linear. Screenpresso is a mature Windows capture suite with video and a big editor. Snipflag is a small, free, open-source app built only for turning several screenshots into one Linear issue, on Windows, macOS and Linux.",
        "us": ["You want one Linear issue with several annotated screenshots, in order", "You also work on macOS or Linux", "You want MIT open source with no paid tier", "You want nothing uploaded until you click Create issue"],
        "them": ["You need HD or 4K video capture, OCR or a document generator", "You want a mature, full-featured Windows editor", "You share captures to many places, not just Linear", "An unsigned preview app is not acceptable at your company"],
        "rows": [
            ("Platforms", "Windows, macOS, Linux", "Windows 11 or Windows Server 2022 (x64 or ARM64)"),
            ("Creates Linear issues", "y:Yes, OAuth with PKCE", "y:Yes, Linear integration"),
            ("Several screenshots in one issue", "y:Up to 10, ordered, with @image references", "Captures embedded in the issue; multi-image flow not documented"),
            ("Video capture", "n:No", "y:Yes; HD and 4K in Pro"),
            ("Hide private details", "Pixelate, burned into the exported pixels", "Blur, including automatic blur in Pro"),
            ("Open source", "y:MIT", "n:No"),
            ("Price", "Free", "Free version; Pro and Enterprise are one-time licenses"),
            ("Maturity", "New: v1.2.0 unsigned preview", "Established; vendor says 1,000,000+ active users"),
        ],
        "diff": ["Screenpresso is a general capture suite: images, video, OCR, a full editor, and many sharing options, one of which is Linear. That breadth is its strength if you want one tool for all captures on Windows.",
                 "Snipflag does one job. A session collects up to ten screenshots, each with its own annotations and undo history, and sends them as one ordered Linear issue. Drafts survive restarts, and each session has a stable ID, so a retry after a network error never creates a duplicate issue."],
        "faq": [("Does Screenpresso work with Linear?", "Yes. Linear lists a Screenpresso integration that creates issues with captures embedded. See the <a href=\"https://linear.app/integrations/screenpresso\">Linear integration page</a>."),
                ("Is Snipflag a free alternative to Screenpresso?", "For the screenshot-to-Linear workflow, yes. Snipflag is free and MIT licensed. It does not replace Screenpresso's video capture, OCR or document generator."),
                ("Does Snipflag record video?", "No. Snipflag is screenshots only. If you need video with your Linear issues, Screenpresso or <a href=\"../jam/\">Jam</a> is a better fit.")],
        "sources": [("Screenpresso pricing and requirements", "https://www.screenpresso.com/pricing/"), ("Linear: Screenpresso integration", "https://linear.app/integrations/screenpresso")],
    },
    "jam": {
        "name": "Jam",
        "title": "Snipflag vs Jam: desktop screenshots vs browser capture",
        "desc": "Snipflag vs Jam for Linear: a free desktop screenshot app versus a browser recorder with console and network logs. See which fits your bugs.",
        "h1": "Snipflag vs Jam",
        "short": "Jam is excellent for web app bugs: it records the browser with console logs, network requests and user actions, and files it to Linear. Snipflag is for visual problems anywhere on your desktop, including native apps, and sends several annotated screenshots to one Linear issue without an account or a cloud.",
        "us": ["The bug is in a desktop app, a design file, or anything outside Chrome", "You want several annotated screenshots in one issue, in order", "You want no account, no cloud copy and no usage limits", "You want free, MIT-licensed software"],
        "them": ["You debug web apps and need console and network logs", "You need screen recordings with instant replay", "Your team shares bug links outside the issue tracker", "You want AI summaries and an MCP server"],
        "rows": [
            ("Where it runs", "Desktop app: Windows, macOS, Linux", "Chrome extension, Jam for Mac, iOS app"),
            ("Captures native desktop apps", "y:Yes, any screen region", "p:Jam for Mac records screen, window or area"),
            ("Creates Linear issues", "y:Yes, OAuth with PKCE", "y:Yes, on the Free plan too"),
            ("Console and network logs", "n:No", "y:Yes"),
            ("Video recording", "n:No", "y:Yes, 5 min on Free, 15 min on Team (extension)"),
            ("Account required", "n:No account to capture or annotate", "y:Jam account"),
            ("Where captures live", "Your computer, then only the issue you create", "In Jam, shared as Jam links"),
            ("Open source", "y:MIT", "n:No"),
            ("Price", "Free, no limits", "Free: 30 Jams a month. Team: $14 per creator a month, billed yearly"),
        ],
        "diff": ["Jam's strength is technical context for web bugs. A Jam captures what happened in the browser, including logs and network calls, so engineers can reproduce it quickly.",
                 "Snipflag's strength is visual clarity from anywhere on the desktop. You capture, pixelate private details, mark each screenshot, and send one ordered issue straight to Linear. Nothing is stored anywhere else, and there is no quota."],
        "faq": [("Can I use Snipflag and Jam together?", "Yes. Many teams use a browser recorder for web bugs and a screenshot tool for design reviews and desktop apps. They do different jobs."),
                ("Does Jam have a free plan with Linear?", "Yes. Jam's pricing page lists Linear and other issue trackers on the Free plan, which covers 30 Jams a month."),
                ("Does Snipflag capture console logs?", "No. Snipflag is screenshots only. For console and network logs, use Jam or an open-source option such as <a href=\"../bugshot/\">BugShot</a>.")],
        "sources": [("Jam pricing and plan limits", "https://jam.dev/pricing"), ("Linear: Jam integration", "https://linear.app/integrations/jam")],
    },
    "bugshot": {
        "name": "BugShot",
        "title": "Snipflag vs BugShot: desktop app vs Chrome side panel",
        "desc": "Snipflag vs BugShot: two open-source, MIT-licensed tools that file Linear issues with OAuth. One runs on your desktop, one in Chrome.",
        "h1": "Snipflag vs BugShot",
        "short": "BugShot is the closest open-source relative: MIT licensed, Linear OAuth with PKCE, annotated screenshots. The difference is where they live. BugShot is a Chrome side panel for web bugs, with logs and recordings. Snipflag is a desktop app that captures anything on your screen.",
        "us": ["The problem is outside the browser: native apps, desktop tools, other windows", "You want a global shortcut from the system tray", "You want drafts that survive restarts and duplicate-safe retries", "Your team works in Linear only"],
        "them": ["Every bug you report is in a web page", "You want console, network logs and recordings attached", "You file to several trackers: Jira, GitHub, GitLab, Notion and more", "You prefer a browser extension to a desktop install"],
        "rows": [
            ("Where it runs", "Desktop app: Windows, macOS, Linux", "Chrome side panel"),
            ("Captures", "y:Any screen region, every monitor", "p:Browser tabs"),
            ("Linear sign-in", "y:OAuth with PKCE", "y:OAuth with PKCE, or API key"),
            ("Other trackers", "n:Linear only", "y:Jira, GitHub, GitLab, Notion, Asana, ClickUp, Slack"),
            ("Console and network logs", "n:No", "y:Yes"),
            ("Recordings", "n:No", "y:Yes"),
            ("Several screenshots in one issue", "y:Up to 10, ordered, with @image references", "y:Multiple annotated captures in the report"),
            ("Open source", "y:MIT", "y:MIT"),
            ("Price", "Free", "Free"),
        ],
        "diff": ["BugShot turns a browser bug into a full report, with logs, recordings and even CSS diffs, and sends it to the tracker of your choice. For web teams on several trackers, that is hard to beat.",
                 "Snipflag lives outside the browser, in your system tray. It freezes every monitor, lets you capture any app, keeps each screenshot's annotations and history separate, and sends one ordered Linear issue. It is the better fit when the bug is not in a web page."],
        "faq": [("Are Snipflag and BugShot both open source?", "Yes. Both are MIT licensed and hosted on GitHub."),
                ("Can BugShot capture desktop apps?", "BugShot is a Chrome side panel, so it captures browser content. For native apps and other windows, use a desktop tool such as Snipflag."),
                ("Which one is better for Linear?", "Both sign in to Linear with OAuth and PKCE. Pick by where your bugs live: web pages favor BugShot, everything else favors Snipflag.")],
        "sources": [("BugShot repository and README", "https://github.com/SinhyeokKang/bugshot-2")],
    },
    "sharex-greenshot-flameshot": {
        "name": "ShareX, Greenshot and Flameshot",
        "title": "Snipflag vs ShareX, Greenshot and Flameshot for Linear",
        "desc": "ShareX, Greenshot and Flameshot are great free screenshot tools, but none files Linear issues. See when Snipflag is the better fit.",
        "h1": "Snipflag vs ShareX, Greenshot and Flameshot",
        "short": "ShareX, Greenshot and Flameshot are excellent free, open-source screenshot tools. None of them creates Linear issues. You can script an upload, but you lose drafts, ordering and duplicate protection. Snipflag is built for exactly that last step.",
        "us": ["Your screenshots end up in Linear issues", "You want several screenshots in one issue, in order, with captions", "You want to sign in to Linear once and pick team, project, labels and priority in the app", "You want drafts that come back after a restart"],
        "them": ["You want a general screenshot and screen recording tool (ShareX)", "You upload to image hosts or Jira (Greenshot has a Jira plugin)", "You need workflows, OCR, scrolling capture or GIFs (ShareX)", "You want a very light capture tool on Linux (Flameshot)"],
        "rows": [
            ("Platforms", "Windows, macOS, Linux", "ShareX: Windows. Greenshot: Windows and Mac. Flameshot: Windows, macOS, Linux"),
            ("Creates Linear issues", "y:Yes, OAuth with PKCE", "n:No built-in Linear support"),
            ("Several screenshots in one issue", "y:Up to 10, ordered", "n:Not applicable"),
            ("Annotation", "Arrow, rectangle, pen, highlighter, text, pixelate", "y:Rich annotation in all three"),
            ("Video or GIF", "n:No", "p:ShareX only"),
            ("Drafts and history", "y:Auto-saved sessions, History, retention", "p:Local files and capture history"),
            ("Open source", "y:MIT", "y:GPL-3.0"),
            ("Price", "Free", "Free"),
        ],
        "diff": ["These three tools are the best general-purpose free screenshot apps around, and they are mature. If you just need images on disk or on an image host, keep using them.",
                 "Snipflag starts where they stop: the issue. It keeps a session of screenshots together, lets you order and caption them, reference them with @image in the description, and creates one Linear issue with every image in place. A retry after a failure never creates a duplicate."],
        "faq": [("Can ShareX upload to Linear?", "Not out of the box. ShareX supports custom uploaders, so you could script something against Linear's API, but you would build ordering, drafts and duplicate protection yourself."),
                ("Does Greenshot integrate with Linear?", "Greenshot can upload to Jira. Linear is not a built-in destination."),
                ("Is Flameshot or Snipflag better on Linux?", "Flameshot is a mature, light capture tool. Snipflag runs on Linux too (AppImage and .deb), and adds Linear issues. On some Wayland compositors direct capture is blocked for Snipflag, but importing and pasting images still works.")],
        "sources": [("ShareX", "https://getsharex.com/"), ("Greenshot FAQ (GPL, Jira upload)", "https://getgreenshot.org/faq/"), ("Flameshot upload script discussion", "https://github.com/flameshot-org/flameshot/issues/4623")],
    },
}

HUB_ROWS = [
    ("Where it runs", "Desktop: Windows, macOS, Linux", "Desktop: Windows 11", "Chrome extension, Mac app", "Chrome side panel", "Desktop (Flameshot on all three OSes)"),
    ("Captures any desktop app", "y:Yes", "y:Yes", "p:Mac app only", "n:Browser tabs", "y:Yes"),
    ("Creates Linear issues", "y:Yes, OAuth PKCE", "y:Yes", "y:Yes", "y:Yes, OAuth PKCE", "n:No"),
    ("Several screenshots in one issue", "y:Up to 10, ordered", "Not documented", "Not documented", "y:Yes", "n:No"),
    ("Hide private details", "y:Pixelate, burned in", "y:Blur (auto in Pro)", "y:Video blurring", "Not documented", "y:Pixelate or blur"),
    ("Video recording", "n:No", "y:Yes", "y:Yes", "y:Yes", "p:ShareX only"),
    ("Console and network logs", "n:No", "n:No", "y:Yes", "y:Yes", "n:No"),
    ("Other trackers", "n:Linear only", "Not documented", "y:Jira, Linear and more", "y:Jira, GitHub, GitLab, Notion and more", "p:Greenshot: Jira"),
    ("Account or cloud", "None; straight to Linear", "Not documented", "Jam account, Jam links", "None; straight to tracker", "None"),
    ("Open source", "y:MIT", "n:No", "n:No", "y:MIT", "y:GPL-3.0"),
    ("Price", "Free", "Free, paid Pro", "Free tier; Team $14/creator/mo", "Free", "Free"),
    ("Maturity", "New: v1.2.0 unsigned preview", "Established", "Established", "Young project", "Mature"),
]


def hub():
    p = "../"
    path = "compare/"
    title = "Snipflag alternatives compared: Screenpresso, Jam, BugShot"
    desc = "An honest comparison of Snipflag, Screenpresso, Jam, BugShot, ShareX, Greenshot and Flameshot for sending screenshots to Linear."
    items = [("Home", ""), ("Compare", path)]
    ld = {"@context": "https://schema.org", "@graph": [
        breadcrumb_ld(items),
        {"@type": "ItemList", "name": "Snipflag comparisons", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "url": f"{BASE}compare/{slug}/", "name": f"Snipflag vs {c['name']}"}
            for i, (slug, c) in enumerate(COMPETITORS.items())]},
        {"@type": "WebPage", "name": title, "url": BASE + path, "dateModified": CHECKED_ISO, "description": desc}]}
    cards = "".join(
        f'<a class="compare-card" href="{slug}/" data-reveal><span class="mono muted">vs</span><span class="h3">{escape(c["name"])}</span><p>{escape(c["short"].split(". ")[0])}.</p><span class="go mono">Read comparison →</span></a>'
        for slug, c in COMPETITORS.items())
    srcs = []
    for c in COMPETITORS.values():
        srcs += c["sources"]
    src_html = " · ".join(f'<a href="{u}">{escape(n)}</a>' for n, u in dict((n, u) for n, u in srcs).items())
    html = head(p, title, desc, path, ld) + header(p, "compare") + f"""<main id="main">
<section class="page-hero"><div class="wrap">
{crumbs(p, [("Home", p), ("Compare", None)])}
<h1 data-split>Snipflag vs the alternatives.</h1>
<p class="lede">Which tool should you use to get screenshots into Linear? Here is an honest comparison, including where other tools are the better pick.</p>
<p class="checked mono">Last checked {CHECKED} against each vendor's own pages</p>
</div></section>

<section class="section pt0" aria-labelledby="matrix-title"><div class="wrap">
<h2 id="matrix-title" class="sr-only">Feature comparison table</h2>
{table(["Feature", "Snipflag", "Screenpresso", "Jam", "BugShot", "ShareX · Greenshot · Flameshot"], HUB_ROWS, "“Not documented” means we could not find it on the vendor's own pages. Found a mistake? <a class=\"inline-link\" href=\"https://github.com/Razee4315/snipflag/issues\">Tell us on GitHub</a>.")}
</div></section>

<section class="section" aria-labelledby="pick-title"><div class="wrap">
<div class="head"><p class="eyebrow">Quick answer</p><h2 id="pick-title" data-split>Pick by where your bugs live.</h2><p>No tool wins everything. This is the short version.</p></div>
<div class="verdict">
<div class="pick us" data-reveal><p class="label">Choose Snipflag if</p><h2>The bug is on your screen, and it belongs in Linear.</h2><ul>
<li>You need several annotated screenshots in one Linear issue, in order</li>
<li>The problem is in any app, not only a web page</li>
<li>You want free, MIT open source with no account and no cloud copy</li>
<li>You are fine with a new v1.2.0 preview that is not code-signed yet</li></ul></div>
<div class="pick" data-reveal><p class="label">Choose something else if</p><h2>You need video, logs or other trackers.</h2><ul>
<li><a class="inline-link" href="jam/">Jam</a> or <a class="inline-link" href="bugshot/">BugShot</a> for web bugs with console and network logs</li>
<li><a class="inline-link" href="screenpresso/">Screenpresso</a> for a full Windows capture suite with video</li>
<li><a class="inline-link" href="sharex-greenshot-flameshot/">ShareX, Greenshot or Flameshot</a> for general screenshots without Linear</li>
<li>BugShot or Jam if you file to Jira or GitHub, not Linear</li></ul></div>
</div>
</div></section>

<section class="section" aria-labelledby="detail-title"><div class="wrap">
<div class="head"><p class="eyebrow">Detailed comparisons</p><h2 id="detail-title" data-split>One page per tool.</h2><p>Side-by-side tables, when to pick each, and sources.</p></div>
<div class="compare-links">{cards}</div>
<p class="sources mt2">Sources: {src_html}</p>
</div></section>
{cta(p, "Try the Linear-first option.")}
</main>
""" + footer(p) + SCRIPTS.format(p=p)
    return path, html


def page(slug, c):
    p = "../../"
    path = f"compare/{slug}/"
    items = [("Home", ""), ("Compare", "compare/"), (f"vs {c['name']}", path)]
    ld = {"@context": "https://schema.org", "@graph": [
        breadcrumb_ld(items), faq_ld(c["faq"]),
        {"@type": "WebPage", "name": c["title"], "url": BASE + path, "dateModified": CHECKED_ISO, "description": c["desc"],
         "about": [{"@id": BASE + "#app"}, {"@type": "SoftwareApplication", "name": c["name"].split(",")[0].split(" and ")[0]}]}]}
    us = "".join(f"<li>{escape(x)}</li>" for x in c["us"])
    them = "".join(f"<li>{escape(x)}</li>" for x in c["them"])
    diff = "".join(f"<p>{escape(x)}</p>" for x in c["diff"])
    src = " · ".join(f'<a href="{u}">{escape(n)}</a>' for n, u in c["sources"])
    html = head(p, c["title"], c["desc"], path, ld) + header(p, "compare") + f"""<main id="main">
<section class="page-hero"><div class="wrap">
{crumbs(p, [("Home", p), ("Compare", "../"), (f"vs {c['name']}", None)])}
<h1 data-split>{escape(c['h1'])}</h1>
<p class="lede">{escape(c['short'])}</p>
<p class="checked mono">Last checked {CHECKED}</p>
</div></section>

<section class="section pt0" aria-labelledby="verdict-title"><div class="wrap">
<h2 id="verdict-title" class="sr-only">Which should you choose?</h2>
<div class="verdict">
<div class="pick us" data-reveal><p class="label">Choose Snipflag if</p><ul>{us}</ul></div>
<div class="pick" data-reveal><p class="label">Choose {escape(c['name'])} if</p><ul>{them}</ul></div>
</div>
</div></section>

<section class="section pt0" aria-labelledby="table-title"><div class="wrap">
<div class="head"><p class="eyebrow">Side by side</p><h2 id="table-title" data-split>The details.</h2><p>From each product's own pages. “Not documented” means we could not confirm it.</p></div>
{table(["Feature", "Snipflag", c['name']], c['rows'], "Found a mistake? <a class=\"inline-link\" href=\"https://github.com/Razee4315/snipflag/issues\">Tell us on GitHub</a> and we will fix it.")}
</div></section>

<section class="section" aria-labelledby="diff-title"><div class="wrap two-col">
<div><p class="label">The main difference</p><h2 id="diff-title" class="diff-title">Different jobs, honestly.</h2></div>
<div class="prose muted" data-reveal>{diff}</div>
</div></section>

<section class="section" aria-labelledby="faq-title"><div class="wrap faq">
<div class="head-col"><p class="label">FAQ</p><h2 id="faq-title" data-split>Questions.</h2></div>
<div class="list">{faq_html(c['faq'])}</div>
</div></section>

<section class="section pt0"><div class="wrap"><p class="sources">Sources: {src}. See also <a href="../">all comparisons</a>.</p></div></section>
{cta(p, "Screenshots in. One Linear issue out.")}
</main>
""" + footer(p) + SCRIPTS.format(p=p)
    return path, html


def not_found():
    p = "/snipflag/"
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Page not found"}
    html = head(p, "Page not found · Snipflag", "This page does not exist. Go back to Snipflag.", "404.html", ld, noindex=True) + header(p) + f"""<main id="main">
<section class="hero" aria-labelledby="nf-title"><div class="wrap">
<p class="eyebrow">404</p>
<h1 id="nf-title" data-split>Nothing to capture here.</h1>
<p class="lede" data-hero-fade>This page does not exist, or it moved.</p>
<div class="hero-actions" data-hero-fade><a class="btn btn-primary" href="{p}">Back to Snipflag</a><a class="btn btn-ghost" href="{p}compare/">Compare alternatives</a></div>
</div></section>
</main>
""" + footer(p) + SCRIPTS.format(p=p)
    return "404.html", html


def main():
    pages = [hub()] + [page(s, c) for s, c in COMPETITORS.items()] + [not_found()]
    for path, html in pages:
        out = SITE / (path + "index.html" if path.endswith("/") else path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8", newline="\n")
        print("wrote", out.relative_to(SITE))
    urls = [("", "1.0"), ("compare/", "0.8")] + [(f"compare/{s}/", "0.7") for s in COMPETITORS]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sm += "".join(f"  <url><loc>{BASE}{u}</loc><lastmod>{CHECKED_ISO}</lastmod><priority>{pr}</priority></url>\n" for u, pr in urls)
    sm += "</urlset>\n"
    (SITE / "sitemap.xml").write_text(sm, encoding="utf-8", newline="\n")
    print("wrote sitemap.xml")


if __name__ == "__main__":
    main()
