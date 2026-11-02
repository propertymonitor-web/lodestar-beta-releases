#!/usr/bin/env python3
"""Builds dashboard/matrix.html = the OTR 1.4.0 dashboard (dashboard/base-otr.html) + the Matrix add-on files.
   python3 tools/build_dashboard.py          writes dashboard/matrix.html
   python3 tools/build_dashboard.py --check  fails if matrix.html is out of date or an anchor is missing"""
import os, sys, re, hashlib
here = os.path.dirname(os.path.abspath(__file__)); pm = os.path.dirname(here)
d = lambda *p: os.path.join(pm, "dashboard", *p)
rd = lambda p: open(p, encoding="utf-8").read()
VERSION = "1.0.0-beta1"

def build():
    h = rd(d("base-otr.html"))
    def sub(old, new, count=1):
        nonlocal h
        if h.count(old) < 1: sys.exit("anchor missing: " + old[:70])
        h = h.replace(old, new, count)
    sub('<html lang="en" class="tac otr">', '<html lang="en" class="tac otr matrix mxmap">')
    sub("ORION TACTICAL RADIO<small>OTR by LODESTAR</small>", "PROJECT MATRIX<small>By: Aries Thorne &middot; For: Matrix Comm. Systems</small>")
    sub('"OTR - Orion Tactical Radio"', '"PROJECT MATRIX"')
    sub('<title>OTR - Orion Tactical Radio</title>', '<title>PROJECT MATRIX</title>')
    h = re.sub(r'(<meta name="description" content=")[^"]*"', r'\1PROJECT MATRIX: live dashboard for a Matrix companion radio, read over USB. By Aries Thorne for Matrix Comm. Systems."', h, 1)
    sub('<h1 class="brand">LODESTAR NOVA<small>companion dashboard</small></h1>', '<h1 class="brand">PROJECT MATRIX<small>By: Aries Thorne &middot; For: Matrix Comm. Systems</small></h1>')
    sub('const DASH_ID = "otr", DASH_VERSION = "1.4.0";', 'const DASH_ID = "matrix", DASH_VERSION = "%s";' % VERSION)
    sub("</head>", "<style id=\"matrix-css\">\n" + rd(d("addon", "matrix.css")) + "</style>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap\">\n</head>")
    sub("<body>\n", "<body>\n" + rd(d("addon", "matrix.html")))
    sub("<!--TAC-HTML-END-->", rd(d("addon", "deck.html")) + "\n<!--TAC-HTML-END-->")
    i = h.rindex("</body>")
    h = h[:i] + "<script id=\"matrix-js\">\n" + rd(d("addon", "matrix.js")) + "</script>\n" + h[i:]
    return h

out = build()
if "--check" in sys.argv:
    cur = rd(d("matrix.html")) if os.path.exists(d("matrix.html")) else ""
    if cur != out: sys.exit("dashboard/matrix.html is out of date: run python3 project-matrix/tools/build_dashboard.py")
    for need in ("mxSplash", "mxDeck", "matrix-js", 'DASH_ID = "matrix"', "PROJECT MATRIX", "Aries Thorne", "Matrix Comm. Systems"):
        if need not in out: sys.exit("missing: " + need)
    print("matrix.html ok", len(out), hashlib.sha256(out.encode()).hexdigest()[:12])
else:
    open(d("matrix.html"), "w", encoding="utf-8").write(out); print("wrote dashboard/matrix.html", len(out))
