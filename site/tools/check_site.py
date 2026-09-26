"""Static checks for the published site directory. Standard library only.

    python site/tools/check_site.py _site

Fails on: broken local href/src, missing <title>/description/canonical/h1, duplicate titles or
descriptions, titles over 60 or descriptions over 160 characters, invalid JSON-LD, and images
without width/height/alt.
"""
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

BASE_PATH = "/snipflag/"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.imgs, self.ld, self.meta, self.ids = [], [], [], {}, set()
        self.title, self.h1, self._in_title, self._in_ld, self._buf = "", 0, False, False, ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "title":
            self._in_title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "script" and a.get("type") == "application/ld+json":
            self._in_ld, self._buf = True, ""
        if tag == "meta" and a.get("name") in ("description", "robots"):
            self.meta[a["name"]] = a.get("content", "")
        if tag == "link" and a.get("rel") == "canonical":
            self.meta["canonical"] = a.get("href", "")
        for key in ("href", "src"):
            if key in a and tag not in ("meta",):
                self.links.append(a[key])
        if tag == "img":
            self.imgs.append(a)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag == "script" and self._in_ld:
            self._in_ld = False
            self.ld.append(self._buf)

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._in_ld:
            self._buf += data


def main(root):
    root = Path(root)
    errors, titles, descs = [], {}, {}
    pages = sorted(root.rglob("*.html"))
    parsed = {}
    for f in pages:
        p = Page()
        p.feed(f.read_text(encoding="utf-8"))
        parsed[f] = p
    for f, p in parsed.items():
        rel = f.relative_to(root).as_posix()
        noindex = "noindex" in p.meta.get("robots", "")
        if not p.title.strip():
            errors.append(f"{rel}: missing <title>")
        if len(p.title) > 60:
            errors.append(f"{rel}: title is {len(p.title)} chars (>60)")
        d = p.meta.get("description", "")
        if not d:
            errors.append(f"{rel}: missing meta description")
        if len(d) > 160:
            errors.append(f"{rel}: description is {len(d)} chars (>160)")
        if not noindex and not p.meta.get("canonical"):
            errors.append(f"{rel}: missing canonical")
        if p.h1 != 1:
            errors.append(f"{rel}: has {p.h1} h1 elements")
        if not noindex:
            titles.setdefault(p.title, []).append(rel)
            descs.setdefault(d, []).append(rel)
        for block in p.ld:
            try:
                json.loads(block)
            except ValueError as e:
                errors.append(f"{rel}: invalid JSON-LD ({e})")
        for img in p.imgs:
            for attr in ("width", "height", "alt"):
                if attr not in img:
                    errors.append(f"{rel}: <img src={img.get('src')}> missing {attr}")
        for link in p.links:
            u = urlparse(link)
            if u.scheme in ("http", "https", "mailto", "data", "blob") or link.startswith("//"):
                continue
            path, frag = unquote(u.path), u.fragment
            if not path:
                if frag and frag not in p.ids:
                    errors.append(f"{rel}: anchor #{frag} not found")
                continue
            if path.startswith(BASE_PATH):
                target = root / path[len(BASE_PATH):]
            elif path.startswith("/"):
                errors.append(f"{rel}: absolute path {link} outside {BASE_PATH}")
                continue
            else:
                target = (f.parent / path)
            if path.endswith("/") or target.is_dir():
                target = target / "index.html"
            if not target.resolve().exists():
                errors.append(f"{rel}: broken link {link}")
            elif frag and target.suffix == ".html":
                tp = parsed.get(target.resolve()) or parsed.get(target)
                if tp is None:
                    for k, v in parsed.items():
                        if k.resolve() == target.resolve():
                            tp = v
                if tp is not None and frag not in tp.ids:
                    errors.append(f"{rel}: anchor {link} not found")
    for kind, seen in (("title", titles), ("description", descs)):
        for value, where in seen.items():
            if len(where) > 1:
                errors.append(f"duplicate {kind} on {', '.join(where)}")
    for req in ("robots.txt", "sitemap.xml", "site.webmanifest", "og.png", "favicon.svg", "404.html"):
        if not (root / req).exists():
            errors.append(f"missing {req}")
    print(f"checked {len(pages)} pages")
    for e in errors:
        print("ERROR", e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "site"))
