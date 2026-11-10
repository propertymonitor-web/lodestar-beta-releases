#!/usr/bin/env python3
"""Builds dashboard/matrix-range.html = the standard Matrix dashboard (dashboard/matrix.html) + the optional range-estimate tile.
It is a SECOND, OPTIONAL dashboard. It never changes dashboard/matrix.html.
   python3 project-matrix/tools/build_range_dashboard.py          writes dashboard/matrix-range.html
   python3 project-matrix/tools/build_range_dashboard.py --check  fails if matrix-range.html is out of date or an anchor is missing
The range copy has its own dashboard id ("matrix-range") so its Updates button only ever offers a newer range copy, never the standard one."""
import hashlib, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); DASH = os.path.join(HERE, "..", "dashboard")
VERSION = "1.2.0-range1"
rd = lambda *p: open(os.path.join(DASH, *p), encoding="utf-8").read()

def build():
    h = rd("matrix.html")
    def sub(old, new):
        nonlocal h
        if h.count(old) != 1: sys.exit("anchor not found exactly once: " + old[:70])
        h = h.replace(old, new)
    sub('<div class="mxt wide" id="mxAlerts">', rd("range", "range_tile.html") + '    <div class="mxt wide" id="mxAlerts">')
    sub('<style id="matrix-css">\n', '<style id="matrix-css">\n' + rd("range", "range_tile.css") + "\n")
    sub('  });\n})();\n</script>\n<script id="replay-js">', '  });\n' + rd("range", "range_model.js") + "\n" + rd("range", "range_ui.js") + '})();\n</script>\n<script id="replay-js">')
    sub("<title>PROJECT MATRIX</title>", "<title>PROJECT MATRIX (with range estimate)</title>")
    # own id for the Updates screen; everything that treats this page as "the Matrix dashboard" must keep doing so
    m = re.search(r'const DASH_ID = "matrix", DASH_VERSION = "[^"]*";', h)
    if not m: sys.exit("DASH_ID line not found")
    h = h.replace(m.group(0), 'const DASH_ID = "matrix-range", DASH_VERSION = "%s";' % VERSION, 1)
    n = h.count('DASH_ID === "matrix"')
    if n != 2: sys.exit('expected 2 places that test DASH_ID === "matrix", found %d: update this script' % n)
    h = h.replace('DASH_ID === "matrix"', '(DASH_ID === "matrix" || DASH_ID === "matrix-range")')
    return h

def main():
    out, path = build(), os.path.join(DASH, "matrix-range.html")
    if "--check" in sys.argv:
        cur = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        if cur != out: sys.exit("dashboard/matrix-range.html is out of date: run python3 project-matrix/tools/build_range_dashboard.py")
        for need in ("mxRange", "RM = (function", 'DASH_ID = "matrix-range"', "ESTIMATES ONLY", "mxDeck"):
            if need not in out: sys.exit("missing from the range dashboard: " + need)
        print("matrix-range.html ok", len(out), hashlib.sha256(out.encode()).hexdigest()[:12])
    else:
        open(path, "w", encoding="utf-8").write(out); print("wrote dashboard/matrix-range.html", len(out))
main()
