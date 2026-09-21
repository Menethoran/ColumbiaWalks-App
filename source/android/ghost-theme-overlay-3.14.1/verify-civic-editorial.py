#!/usr/bin/env python3
"""Static checks for the ColumbiaWalks homepage civic editorial overlay."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "index.hbs"
PARTIAL = ROOT / "partials" / "civic-editorial.hbs"
CSS = ROOT / "assets" / "css" / "civic-editorial.css"
SCRIPT = ROOT / "assets" / "js" / "civic-editorial.js"

checks = 0


def require(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        raise AssertionError(message)


def main() -> int:
    for path in (INDEX, PARTIAL, CSS, SCRIPT):
        require(path.is_file(), f"missing required file: {path}")

    index = INDEX.read_text(encoding="utf-8")
    partial = PARTIAL.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    script = SCRIPT.read_text(encoding="utf-8")

    require(index.count('{{> "civic-editorial"}}') == 1, "partial must be included once")
    require(index.count("css/civic-editorial.css") == 1, "stylesheet must be included once")
    require(index.count("js/civic-editorial.js") == 1, "script must be included once")
    require(
        index.index('class="stat-strip"')
        < index.index('{{> "civic-editorial"}}')
        < index.index('class="section press-feature"'),
        "editorial must follow the hero statistic strip and precede the news feature",
    )

    required_links = (
        "https://ecode360.com/7742902",
        "https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/75/00.033.032.000..HTM",
        "https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/75/00.035.042.000..HTM",
        "https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/75/00.031.012.000..HTM",
        "https://www.pa.gov/agencies/penndot/traveling-in-pa/walking",
        "https://www.columbiapa.net/government/borough_council/index.php",
        "https://www.palegis.us/find-my-legislator",
    )
    for url in required_links:
        require(url in partial, f"missing official source link: {url}")

    require("2026-09-11" in partial, "source-review date must be machine-readable")
    require("Plain-language summary, not legal advice" in partial, "legal summary notice missing")
    require("Edit it so it reflects your own experience and views" in partial, "edit-before-send guidance missing")
    require("does not send or store it" in partial, "email privacy boundary missing")
    require("Nothing is sent until you review and send it" in partial, "email send boundary missing")
    require("call 911" in partial, "emergency boundary missing")

    ids = re.findall(r'\bid="([^"]+)"', partial)
    require(len(ids) == len(set(ids)), "HTML ids must be unique")
    for labelled_by in re.findall(r'\baria-labelledby="([^"]+)"', partial):
        require(labelled_by in ids, f"aria-labelledby target is missing: {labelled_by}")

    external_links = re.findall(r'<a\b[^>]*target="_blank"[^>]*>', partial)
    require(bool(external_links), "expected official links that open in a new tab")
    for link in external_links:
        require('rel="noopener noreferrer"' in link, "new-tab link lacks noopener/noreferrer")

    require("position: absolute" not in css, "new section must remain in normal document flow")
    require("grid-template-columns: 1fr" in css, "responsive single-column rule missing")
    require("overflow-wrap: anywhere" in css, "long-link wrapping rule missing")
    require("focus-visible" in css, "keyboard focus treatment missing")
    require("prefers-reduced-motion" in css, "reduced-motion override missing")
    require("navigator.clipboard" in script, "clipboard enhancement missing")
    require("window.isSecureContext" in script, "secure clipboard gate missing")
    require("mailto:" in script, "generated email draft missing")

    forbidden_claims = (
        "works with the government",
        "works with government",
        "government partner",
        "government-affiliated",
        "government affiliated",
        "shares reports with the government",
    )
    combined = "\n".join((index, partial, css, script)).casefold()
    for claim in forbidden_claims:
        require(claim not in combined, f"prohibited association claim found: {claim}")

    print(f"Civic editorial verification passed ({checks} checks).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
