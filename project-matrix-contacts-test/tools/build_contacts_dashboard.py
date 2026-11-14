#!/usr/bin/env python3
"""Builds dashboard/matrix-contacts.html = the standard Matrix dashboard + the optional Contacts backup tile (TEST BUILD).
   python3 tools/build_contacts_dashboard.py [--base path/to/dashboard/matrix.html]
The base dashboard file is only read, never changed. The result has its own dashboard id ("matrix-contacts")."""
import os, re, sys, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); DASH = os.path.join(HERE, "..", "dashboard")
BASE = os.path.join(HERE, "..", "..", "project-matrix", "dashboard", "matrix.html")
VERSION = "1.2.0-contacts1"
if "--base" in sys.argv: BASE = sys.argv[sys.argv.index("--base") + 1]
rd = lambda p: open(p, encoding="utf-8").read()
h = rd(BASE)
def sub(old, new):
    global h
    if h.count(old) != 1: sys.exit("anchor not found exactly once: " + old[:70])
    h = h.replace(old, new)
sub('<div class="mxt wide" id="mxAlerts">', rd(os.path.join(DASH, "contacts_tile.html")) + '    <div class="mxt wide" id="mxAlerts">')
sub('<style id="matrix-css">\n', '<style id="matrix-css">\n' + rd(os.path.join(DASH, "contacts_tile.css")) + "\n")
sub('  });\n})();\n</script>\n<script id="replay-js">', '  });\n' + rd(os.path.join(DASH, "contacts_model.js")).replace('if (typeof module !== "undefined") module.exports = CM;\n', "") + "\n" + rd(os.path.join(DASH, "contacts_ui.js")) + '})();\n</script>\n<script id="replay-js">')
sub("if (o.found) onFound(o.found); else onFrame(o);", "if (o.found) onFound(o.found); else if (o.contact || o.contacts_end !== undefined || o.contact_ack) { if (window.mxContactsFrame) window.mxContactsFrame(o); } else onFrame(o);")
sub("<title>PROJECT MATRIX</title>", "<title>PROJECT MATRIX (with contacts backup, TEST)</title>")
m = re.search(r'const DASH_ID = "matrix", DASH_VERSION = "[^"]*";', h)
if not m: sys.exit("DASH_ID line not found")
h = h.replace(m.group(0), 'const DASH_ID = "matrix-contacts", DASH_VERSION = "%s";' % VERSION, 1)
n = h.count('DASH_ID === "matrix"')
if n != 2: sys.exit('expected 2 places that test DASH_ID === "matrix", found %d' % n)
h = h.replace('DASH_ID === "matrix"', '(DASH_ID === "matrix" || DASH_ID === "matrix-contacts")')
out = os.path.join(DASH, "matrix-contacts.html"); open(out, "w", encoding="utf-8").write(h)
print("wrote", out, len(h), hashlib.sha256(h.encode()).hexdigest()[:12])
