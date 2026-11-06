#!/usr/bin/env python3
"""Builds dashboard/matrix.html = the OTR 1.4.0 dashboard (dashboard/base-otr.html) + the Matrix add-on files.
   python3 tools/build_dashboard.py          writes dashboard/matrix.html
   python3 tools/build_dashboard.py --check  fails if matrix.html is out of date or an anchor is missing"""
import os, sys, re, hashlib
here = os.path.dirname(os.path.abspath(__file__)); pm = os.path.dirname(here)
d = lambda *p: os.path.join(pm, "dashboard", *p)
rd = lambda p: open(p, encoding="utf-8").read()
VERSION = "1.1.1-beta1"


MXBOARD = '''function mxBoardProduct() { let b = ""; try { b = localStorage.getItem("mx-board") || ""; } catch (e) { /* none */ } return b === "r8" ? "matrix_r8" : b === "v3" ? "matrix_v3" : "matrix"; }
  async function firmwareCheck() {
    show("work"); reset();
    if (DASH_ID === "matrix" && !window.mxBoardAsked) {
      const pick = (b) => { try { localStorage.setItem("mx-board", b); } catch (e) { /* ignore */ } window.mxBoardAsked = true; firmwareCheck(); };
      setMsg('<span class="big">Which radio is this?</span>Pick the board printed on your radio so the right update file is used. Your choice is remembered.<p>Only the Heltec V4 R2 build is meant for general use; the R8 and V3 builds have not been run on a radio.</p>');
      setActions([{ label: "Heltec V4 R2", primary: true, run: () => pick("r2") }, { label: "Heltec V4 R8", run: () => pick("r8") }, { label: "Heltec V3", run: () => pick("v3") }, { label: "Back", run: () => show("home") }]);
      return;
    }'''

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
    sub('<span class="spacer"></span>\n    <button id="btnConnect"', '<span class="spacer"></span>\n    <span id="mxOpTag" class="status" style="gap:6px">operator <b id="mxOpName">?</b></span><button id="mxAliasBtn" type="button">Alias</button>\n    <button id="btnConnect"')
    # the Matrix firmware reports edition "matrix": treat it as an ORION-class radio, and never offer it another product's firmware
    sub('if (f.ed === "orion" && !S.orion) {', 'if (f.ed === "matrix" && !S.orion) S.orion = true;\n  if (f.ed === "orion" && !S.orion) {')
    sub('if (S.frame && S.frame.ed !== "orion") msg =', 'if (S.frame && S.frame.ed !== "orion" && S.frame.ed !== "matrix") msg =')
    sub('const product = (DASH_ID === "otr" || DASH_ID === "cairn") ? DASH_ID :', 'const product = (DASH_ID === "otr" || DASH_ID === "cairn" || DASH_ID === "matrix") ? DASH_ID :')
    # firmware updates: Matrix has one product per board; the radio cannot tell the page which board it is, so the user picks once (remembered)
    sub('const product = (DASH_ID === "otr" || DASH_ID === "cairn" || DASH_ID === "matrix") ? DASH_ID :', 'const product = DASH_ID === "matrix" ? mxBoardProduct() : (DASH_ID === "otr" || DASH_ID === "cairn") ? DASH_ID :')
    sub('async function firmwareCheck() {\n    show("work"); reset();', MXBOARD)
    # radar ping: a hook where the sweep lights a contact, and the tick box at the top of the radar
    sub('if (!reduce && crossed) R.lit.set(k, t);', 'if (!reduce && crossed) { R.lit.set(k, t); if (window.mxPing) window.mxPing(c); }')
    sub('<div class="radargrid">', '<div class="row2 mxpingrow" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:2px 0 8px"><label class="tog" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="mxPingOn"> RADAR PING</label><span class="note" id="mxPingNote" style="color:var(--muted)">a ping each time the sweep passes a heard node, only while the radar is on screen</span></div>\n  <div class="radargrid">')
    # lets a phone put the dashboard on its home screen as an app (the manifest and icons live next to the hosted copy)
    sub("</head>", '<link rel="manifest" href="matrix.webmanifest">\n<meta name="theme-color" content="#060e08">\n<link rel="icon" href="matrix-icon-192.png">\n</head>')
    # trace replay (1.1.0): a button in the map bar and a full-screen player
    sub('<button id="btnFit">Show everything</button>', '<button id="btnFit">Show everything</button>\n          <button id="btnReplay" title="Full-screen replay of the last trip: the route, the stops and the nodes heard along the way">Replay last trace</button>')
    # heading-up radar: while Follow me is on, the radar turns so the direction of travel is at the top
    sub('idx: 0, size: 0 };', 'idx: 0, size: 0, rot: 0, hdg: 0, hdgOn: false };')
    sub('<input type="checkbox" id="radarMapOn" checked> Show map under radar</label>', '<input type="checkbox" id="radarMapOn" checked> Show map under radar</label>\n        <label class="note" style="color:var(--muted);display:flex;gap:6px;align-items:center" title="While Follow me is on, the radar turns so the way you are travelling is at the top. It uses the GPS course, which only updates while you are moving."><input type="checkbox" id="radarHdgUp" checked> Turn radar with my direction (Follow me)</label>\n        <label class="note" style="color:var(--muted);display:flex;gap:6px;align-items:center" title="Uses the compass in the phone or tablet showing this page, so the radar turns as soon as you turn, even standing still. It shows the direction the phone is facing. Needs a device with a compass; on an iPhone it asks permission."><input type="checkbox" id="radarCmp"> Use this device\'s compass (turns when standing still)</label>')
    sub('  const root = document.documentElement, isTac = () => root.classList.contains("tac");', """  /* heading-up: R.rot (radians) is how far the radar is turned. It follows the GPS course only while Follow me is on and the radio is moving; when it stops it holds the last heading. */
  let hdgPref = true; try { if (localStorage.getItem("orion-radarhdg") === "0") hdgPref = false; } catch (e) { /* default on */ }
  let cmpPref = false, cmpHdg = null, cmpAt = 0; try { cmpPref = localStorage.getItem("orion-radarcmp") === "1"; } catch (e) { /* default off */ }
  function cmpEvt(e) {
    let h = null; if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading; else if (e.absolute && typeof e.alpha === "number") h = 360 - e.alpha;
    if (h == null || !isFinite(h)) return; const sa = (screen.orientation && screen.orientation.angle) || 0; cmpHdg = ((h + sa) % 360 + 360) % 360; cmpAt = Date.now();
  }
  let cmpOn = false;
  function cmpStart() {
    if (cmpOn) return; const add = () => { cmpOn = true; window.addEventListener("deviceorientationabsolute", cmpEvt, true); window.addEventListener("deviceorientation", cmpEvt, true); };
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") DeviceOrientationEvent.requestPermission().then((r) => { if (r === "granted") add(); }).catch(() => {}); else add();
  }
  function hdgUpdate() {
    const gp = S.frame && S.frame.gps, cmpOk = cmpPref && cmpHdg != null && Date.now() - cmpAt < 5000, on = hdgPref && !!S.follow && (cmpOk || (!!gp && !!gp.fix)); R.hdgOn = on; R.hdgSrc = cmpOk ? "compass" : "gps";
    if (on && cmpOk) R.hdg = cmpHdg; else if (on && gp.mov && gp.course != null && isFinite(+gp.course)) R.hdg = ((+gp.course % 360) + 360) % 360;
    const target = on ? R.hdg * rad : 0; let dlt = ((target - R.rot + Math.PI) % TAU + TAU) % TAU - Math.PI;
    R.rot = reduce ? target : R.rot + dlt * 0.12; if (Math.abs(dlt) < 0.002) R.rot = target;
    const md = $("radarMapDiv"); if (md) md.style.transform = R.rot ? "rotate(" + (-R.rot * 180 / Math.PI).toFixed(2) + "deg)" : "";
  }
  const root = document.documentElement, isTac = () => root.classList.contains("tac");""")
    sub('    mnaScan();\n    const w = fit(), g = R.g,', '    mnaScan(); hdgUpdate();\n    const w = fit(), g = R.g,')
    sub('for (let a = 0; a < 360; a += 30) { const r = a * rad;', 'for (let a = 0; a < 360; a += 30) { const r = a * rad - R.rot;')
    sub('for (let a = 0; a < 360; a += 5) { const r = a * rad, l = a % 10 ? 4 : 8;', 'for (let a = 0; a < 360; a += 5) { const r = a * rad - R.rot, l = a % 10 ? 4 : 8;')
    sub('forEach((d) => { const r = d[1] * rad;', 'forEach((d) => { const r = d[1] * rad - R.rot;')
    sub('let a = c.ang % TAU; if (a < 0) a += TAU;', 'const ca = c.ang - R.rot; let a = ca % TAU; if (a < 0) a += TAU;')
    sub('const x = cx + Math.sin(c.ang) * c.frac * rd, y = cy - Math.cos(c.ang) * c.frac * rd,', 'const x = cx + Math.sin(ca) * c.frac * rd, y = cy - Math.cos(ca) * c.frac * rd,')
    sub('g.fillText("RNG " + fmtD(R.range), w - 6, 4);', 'g.fillText("RNG " + fmtD(R.range), w - 6, 4); if (R.hdgOn) { g.textBaseline = "bottom"; g.fillText("HDG UP " + Math.round(R.hdg) + "\\u00b0" + (R.hdgSrc === "compass" ? " (compass)" : ""), w - 6, w - 4); g.textBaseline = "top"; }')
    sub('R.cv = $("radarCv"); const sel = $("radarWin");', 'R.cv = $("radarCv"); const hc = $("radarCmp"); if (hc) { hc.checked = cmpPref; if (cmpPref) cmpStart(); hc.addEventListener("change", () => { cmpPref = hc.checked; try { localStorage.setItem("orion-radarcmp", cmpPref ? "1" : "0"); } catch (e) { /* ok */ } if (cmpPref) cmpStart(); }); }\n    const hu = $("radarHdgUp"); if (hu) { hu.checked = hdgPref; hu.addEventListener("change", () => { hdgPref = hu.checked; try { localStorage.setItem("orion-radarhdg", hdgPref ? "1" : "0"); } catch (e) { /* ok */ } }); }\n    const sel = $("radarWin");')
    sub("<!--TAC-HTML-END-->", rd(d("addon", "deck.html")) + "\n<!--TAC-HTML-END-->")
    i = h.rindex("</body>")
    h = h[:i] + "<script id=\"matrix-js\">\n" + rd(d("addon", "matrix.js")) + "</script>\n<script id=\"replay-js\">\n" + rd(d("addon", "replay.js")) + "</script>\n" + h[i:]
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
