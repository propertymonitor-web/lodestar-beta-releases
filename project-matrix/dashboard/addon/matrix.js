/* ============================================================ PROJECT MATRIX add-on (display only). By: Aries Thorne, For: Matrix Comm. Systems.
   Reads S, S.found, MESH and the {"mx":...} line. It never sends anything to the radio. */
(function () {
  "use strict";
  const root = document.documentElement, MX = { d: null, hist: [], air: [], seenRec: new WeakSet(), alerts: [], lastHeard: Date.now(), cool: {}, nfSeen: new Set() };
  const TH = { rgb: "0,255,65", hi: "#d8ffe4" };
  const G = "#00ff41", G2 = "#7fe79b", DIM = "#0f4a22", Y = "#ffe44d", R = "#ff3b3b", C = "#4dffd2";
  const opt = (k, d) => { try { const v = localStorage.getItem("mx-" + k); return v === null ? d : v === "1"; } catch (e) { return d; } };
  const setOpt = (k, v) => { try { localStorage.setItem("mx-" + k, v ? "1" : "0"); } catch (e) { /* none */ } };
  root.dataset.theme = "dark";
  const fmt = (n, d) => (Number.isFinite(n) ? n.toFixed(d == null ? 0 : d) : "--");
  const hhmmss = (t) => { const d = new Date(t), p = (v) => String(v).padStart(2, "0"); return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); };
  const kvset = (id, rows) => { $(id).innerHTML = rows.map((r) => "<span>" + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b>").join(""); };
  const kind = (r) => (r.type === 4 ? "adv" : (r.type === 2 || r.type === 5 || r.type === 6) ? "msg" : "");

  /* ---------- falling code ---------- */
  const GL = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:.=*+-<>|";
  function rain(cv, opts) {
    const g = cv.getContext("2d"), gap = opts.gap || 45, sc = opts.scale || 1; let cols = [], fs = 16, w = 0, h = 0, run = true, last = 0;
    function size() { w = Math.max(1, Math.round(cv.clientWidth * sc)); h = Math.max(1, Math.round(cv.clientHeight * sc)); cv.width = w; cv.height = h; fs = opts.fs || 16;
      const n = Math.ceil(w / fs); cols = []; for (let i = 0; i < n; i++) cols.push({ y: -Math.random() * h / fs, v: 0.4 + Math.random() * 0.9 }); g.fillStyle = "#000"; g.fillRect(0, 0, w, h); }
    function frame(ts) { if (!run) return; requestAnimationFrame(frame); if (ts - last < gap || document.hidden) return; last = ts;
      if (Math.round(cv.clientWidth * sc) !== w || Math.round(cv.clientHeight * sc) !== h) size();
      g.fillStyle = "rgba(0,0,0," + (opts.fade || 0.09) + ")"; g.fillRect(0, 0, w, h); g.font = fs + "px monospace";
      for (let i = 0; i < cols.length; i++) { const c = cols[i], x = i * fs, y = c.y * fs;
        g.fillStyle = TH.hi; g.fillText(GL[(Math.random() * GL.length) | 0], x, y);
        g.fillStyle = "rgba(" + TH.rgb + ",.85)"; g.fillText(GL[(Math.random() * GL.length) | 0], x, y - fs);
        c.y += c.v; if (y > h && Math.random() > 0.975) { c.y = -Math.random() * 10; c.v = 0.4 + Math.random() * 0.9; } } }
    size(); requestAnimationFrame(frame); return { stop() { run = false; }, start() { if (!run) { run = true; requestAnimationFrame(frame); } } };
  }
  let bg = null;
  function applyRain() {
    const on = $("mxOptRain").checked; root.classList.toggle("norain", !on); const cv = MX.rainCv || (MX.rainCv = $("mxRainCv"));
    if (on && !bg) { cv.id = "rainCv"; cv.style.display = ""; bg = rain(cv, { fs: 11, fade: 0.12, gap: 100, scale: 0.5 }); }
    else if (!on && bg) { bg.stop(); bg = null; cv.style.display = "none"; }
  }

  /* ---------- splash ---------- */
  function splash() {
    const sp = $("mxSplash"); sp.classList.remove("gone"); sp.style.display = "";
    const r = rain($("mxSplashCv"), { fs: 18, fade: 0.07 });
    const t1 = "PROJECT MATRIX", t2 = "By: Aries Thorne", t3 = "For: Matrix Comm. Systems", L1 = $("mxL1"), L2 = $("mxL2"), L3 = $("mxL3");
    L1.textContent = ""; L2.textContent = ""; L3.textContent = ""; L1.classList.add("cur");
    let done = false, timers = [];
    function type(el, txt, i, next) { if (done) return; if (i <= txt.length) { el.textContent = txt.slice(0, i); timers.push(setTimeout(() => type(el, txt, i + 1, next), 70)); } else if (next) next(); }
    timers.push(setTimeout(() => type(L1, t1, 0, () => { L1.classList.remove("cur"); timers.push(setTimeout(() => type(L2, t2, 0, () => timers.push(setTimeout(() => type(L3, t3, 0, () => timers.push(setTimeout(end, 2200))), 350))), 500)); }), 700));
    function end() { if (done) return; done = true; timers.forEach(clearTimeout); sp.classList.add("gone"); setTimeout(() => { r.stop(); sp.style.display = "none"; }, 1000); document.removeEventListener("keydown", end); }
    sp.onclick = end; document.addEventListener("keydown", end);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { L1.textContent = t1; L2.textContent = t2; L3.textContent = t3; L1.classList.remove("cur"); timers.forEach(clearTimeout); done = false; timers = [setTimeout(end, 1800)]; }
  }

  /* ---------- small chart helpers ---------- */
  const NULLG = new Proxy(function () {}, { get: () => NULLG, apply: () => NULLG, set: () => true });   // stands in for a canvas that is not on screen, so nothing is drawn for it
  function inView(c) { const r = c.getBoundingClientRect(); return r.bottom > -50 && r.top < innerHeight + 50 && r.width > 0; }
  function cv(id) { const c = $(id); if (document.hidden || !inView(c)) return { g: NULLG, w: c.clientWidth || 300, h: +c.getAttribute("height") || 100 }; const dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth || 300, h = +c.getAttribute("height") || 100; if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; } const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.font = "11px monospace"; return { g, w, h }; }
  function grid(g, w, h, lo, hi, unit) { g.strokeStyle = "#08301a"; g.fillStyle = "#3fae62"; g.lineWidth = 1; for (let i = 0; i <= 3; i++) { const y = 4 + (h - 18) * i / 3; g.beginPath(); g.moveTo(30, y); g.lineTo(w, y); g.stroke(); g.fillText(Math.round(hi - (hi - lo) * i / 3) + (unit || ""), 0, y + 4); } }
  function line(g, pts, w, h, lo, hi, col, fill) { if (pts.length < 2) return; const X = (i) => 32 + (w - 34) * i / (pts.length - 1), Y2 = (v) => 4 + (h - 18) * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)); g.beginPath(); pts.forEach((v, i) => { if (i) g.lineTo(X(i), Y2(v)); else g.moveTo(X(i), Y2(v)); }); g.strokeStyle = col; g.lineWidth = 1.6; g.shadowColor = col; g.shadowBlur = 5; g.stroke(); g.shadowBlur = 0; if (fill) { g.lineTo(X(pts.length - 1), h - 14); g.lineTo(X(0), h - 14); g.closePath(); g.fillStyle = fill; g.fill(); } }
  function bucket(recs, now, mins, pick) { const a = new Array(mins).fill(0); recs.forEach((r) => { const k = mins - 1 - Math.floor((now - r.t) / 60000); if (k >= 0 && k < mins) a[k] += pick ? pick(r) : 1; }); return a; }
  const recsNow = () => (typeof MESH !== "undefined" ? MESH.recs : []);

  /* ---------- computations ---------- */
  function budget(m) {
    if (!m || !m.sfac || !m.bw) return null;
    const sf = m.sfac, bw = m.bw * 1000, cr = m.cr >= 5 ? m.cr - 4 : m.cr || 1;
    const bitrate = sf * (bw / Math.pow(2, sf)) * (4 / (4 + cr));
    const snrLim = ({ 5: -2.5, 6: -5, 7: -7.5, 8: -10, 9: -12.5, 10: -15, 11: -17.5, 12: -20 })[sf] || -15;
    const sens = -174 + 10 * Math.log10(bw) + 6 + snrLim;       // 6 dB receiver noise figure assumed
    const bud = m.txp - sens, f = m.fq;                           // no antenna gain counted
    const lKm = Math.pow(10, (bud - 32.44 - 20 * Math.log10(f)) / 20);
    const air = (len) => (typeof airtimeMs === "function" ? airtimeMs(len, { sf: sf, bw: m.bw, cr: m.cr }) : 0);
    return { bitrate, sens, bud, lKm, air32: air(32), air100: air(100), sf, bwk: m.bw, cr, f, txp: m.txp };
  }
  function health() {
    const f = S.frame, l = f && f.links ? f.links : [], best = l.find((x) => x.best) || l.slice().sort((a, b) => b.sc - a.sc)[0], d = MX.d;
    let s = best ? best.sc : 0, parts = [];
    const nf = d ? d.nf : (MESH.nf.length ? MESH.nf[MESH.nf.length - 1].v : null);
    let pen = 0; if (nf != null && nf !== 0) { pen = Math.max(0, Math.min(25, (nf + 105) * 2.5)); }
    const bat = f && f.bat && f.bat.pct >= 0 ? f.bat.pct : 100; const bpen = bat < 25 ? (25 - bat) / 2 : 0;
    const v = Math.max(0, Math.min(100, Math.round(s - pen - bpen)));
    return { v, best, nf, pen: Math.round(pen), bpen: Math.round(bpen), n: l.length };
  }
  function forecast() {
    const now = Date.now(), rx = recsNow().filter((r) => !r.tx && r.t > now - 1800000);
    if (rx.length < 8) return { k: "STANDBY", c: "ok", s: "needs a few more packets to forecast", series: [], nf: [] };
    const half = now - 900000, a = rx.filter((r) => r.t < half), b = rx.filter((r) => r.t >= half), avg = (x, k) => x.reduce((s, r) => s + r[k], 0) / Math.max(1, x.length);
    const dS = b.length && a.length ? avg(b, "snr") - avg(a, "snr") : 0, nfl = MESH.nf.filter((x) => x.t > now - 1800000), dN = nfl.length > 3 ? nfl[nfl.length - 1].v - nfl[0].v : 0;
    const pcs = bucket(rx, now, 30), rate = pcs.slice(-5).reduce((s, v) => s + v, 0) / 5, prev = pcs.slice(0, 25).reduce((s, v) => s + v, 0) / 25;
    let k = "CLEAR", c = "ok", s = "signals steady, noise quiet";
    if (dN >= 6 || dS <= -4) { k = "STORM FRONT"; c = "bad"; s = "noise rising " + fmt(dN, 0) + " dB / SNR " + fmt(dS, 1) + " dB in 30 min"; }
    else if (dN >= 3 || dS <= -2) { k = "DEGRADING"; c = "warn"; s = "slipping: noise " + fmt(dN, 0) + " dB, SNR " + fmt(dS, 1) + " dB"; }
    else if (dS >= 2.5) { k = "CLEARING"; c = "ok"; s = "SNR improving " + fmt(dS, 1) + " dB"; }
    else if (prev > 0 && rate < prev * 0.3) { k = "QUIET"; c = "warn"; s = "traffic dropped to " + fmt(rate, 1) + "/min from " + fmt(prev, 1); }
    return { k, c, s, series: bucket(rx, now, 30, (r) => r.snr).map((v, i) => { const n = bucket(rx, now, 30)[i]; return n ? v / n : null; }), nf: nfl };
  }

  /* ---------- alerts ---------- */
  let ac = null;
  function beep() { if (!$("mxOptBeep").checked) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.value = 0.05; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.18); } catch (e) { /* none */ } }
  function alert1(key, text, cool) { const now = Date.now(); if (MX.cool[key] && now - MX.cool[key] < (cool || 60000)) return; MX.cool[key] = now;
    MX.alerts.unshift({ t: now, text }); if (MX.alerts.length > 60) MX.alerts.pop(); const ul = $("mxAlogList"); ul.innerHTML = MX.alerts.map((a) => '<li><time>' + hhmmss(a.t) + '</time><span class="a">' + esc(a.text) + "</span></li>").join("");
    const f = $("mxFlash"); f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); beep(); termPush("!! ALERT: " + text, "adv"); }
  function checkAlerts() {
    const now = Date.now(), f = S.frame, d = MX.d, live = S.mode === "serial" || S.mode === "demo";
    if (!live) return;
    if ($("aSil").checked && MX.lastHeard && now - MX.lastHeard > +$("aSilV").value * 1000) alert1("sil", "nothing heard for " + Math.round((now - MX.lastHeard) / 1000) + " s", 120000);
    const nf = d ? d.nf : null; if ($("aNoise").checked && nf != null && nf !== 0 && nf > +$("aNoiseV").value) alert1("noise", "noise floor " + nf + " dBm", 90000);
    if ($("aBat").checked && f && f.bat && f.bat.pct >= 0 && f.bat.pct < +$("aBatV").value && !f.bat.chg) alert1("bat", "battery " + f.bat.pct + "%", 300000);
    if ($("aTemp").checked && d && d.t > +$("aTempV").value) alert1("temp", "chip temperature " + fmt(d.t, 1) + " C", 180000);
    if ($("aLink").checked && f && f.links && f.links.length) { const b = Math.max.apply(null, f.links.map((l) => l.sc)); if (b < +$("aLinkV").value) alert1("link", "best link score " + b, 120000); }
    if ($("aNew").checked && S.found) S.found.forEach((n, k) => { if (!MX.nfSeen.has(k)) { if (MX.nfInit) alert1("new" + k, "new " + (n.t === 2 ? "repeater" : n.t === 1 ? "companion" : "node") + " discovered: " + (n.n || k.slice(0, 8)), 1000); MX.nfSeen.add(k); } });
    MX.nfInit = true;
  }

  /* ---------- intercept terminal ---------- */
  const tl = []; let termDirty = false;
  function termPush(txt, cls) { tl.push({ txt, cls }); if (tl.length > 400) tl.shift(); termDirty = true; }
  function pullRecs() { const rs = recsNow(); for (let i = Math.max(0, rs.length - 60); i < rs.length; i++) { const r = rs[i]; if (MX.seenRec.has(r)) continue; MX.seenRec.add(r); if (!r.tx) { MX.lastHeard = Date.now(); SESS.pk++; SESS.bytes += r.len || 0; }
      const nm = (typeof meshNameFor === "function" && r.id) ? meshNameFor(r.id) : "", ty = (typeof MTYPE !== "undefined" ? MTYPE[r.type] : r.type);
      const txt = hhmmss(r.t) + (r.tx ? " TX  " : " RX  ") + String(ty).padEnd(16) + (r.tx ? "" : (String(r.rssi).padStart(5) + "dBm " + r.snr.toFixed(1).padStart(5) + "dB ")) + "hop" + r.hops + " " + String(r.len).padStart(3) + "B " + (r.id ? r.id.toUpperCase() : "------") + (nm ? " " + nm : "");
      termPush(txt, r.tx ? "tx" : kind(r) === "adv" ? "adv" : kind(r) === "msg" ? "msg" : "rx"); } }
  function drawTerm() {
    if (!termDirty || $("mxTermPause").checked) return; termDirty = false; const f = $("mxTermF").value, el = $("mxTerm"), stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 12;
    const rows = tl.filter((x) => !f || (f === "tx" ? x.cls === "tx" : f === "rx" ? x.cls !== "tx" : x.cls === f)).slice(-200);
    el.innerHTML = rows.map((x) => '<div class="' + x.cls + '">' + esc(x.txt) + "</div>").join(""); if (stick) el.scrollTop = el.scrollHeight;
  }

  /* ---------- tiles ---------- */
  function draw() {
    const sel = window.getSelection && window.getSelection(); if (sel && !sel.isCollapsed && $("mxDeck").contains(sel.anchorNode) && !/^(INPUT|TEXTAREA)$/.test((sel.anchorNode.parentElement || {}).tagName || "")) return;   // do not redraw text while it is being selected for copying
    const now = Date.now(), f = S.frame, d = MX.d, rs = recsNow();
    // health
    const H = health(); $("mxHealth").textContent = f ? H.v : "--"; const hb = $("mxHealthBar"); hb.className = "bar" + (H.v < 30 ? " bad" : H.v < 55 ? " warn" : ""); hb.firstChild.style.width = (f ? H.v : 0) + "%";
    $("mxHealthSub").textContent = !f ? "waiting for data" : H.v >= 70 ? "strong" : H.v >= 45 ? "usable" : H.v >= 20 ? "weak" : "poor";
    kvset("mxHealthKv", [["best repeater", H.best ? (H.best.name || H.best.id) + " (" + H.best.sc + ")" : "none"], ["repeaters heard", String(H.n)], ["noise penalty", "-" + H.pen], ["battery penalty", "-" + H.bpen]]);
    // weather
    const W = forecast(); const fc = $("mxFc"); fc.textContent = W.k; fc.className = "fc " + W.c; $("mxFcSub").textContent = W.s;
    { const c = cv("mxCvWx"); grid(c.g, c.w, c.h, -20, 15, ""); line(c.g, W.series.map((v) => (v == null ? 0 : v)), c.w, c.h, -20, 15, G, "rgba(0,255,65,.08)"); c.g.fillStyle = "#3fae62"; c.g.fillText("SNR dB, 30 min", 34, c.h - 2); }
    // pulse
    { const c = cv("mxCvPulse"), rx = rs.filter((r) => !r.tx), tx = rs.filter((r) => r.tx), a = bucket(rx, now, 30), b = bucket(tx, now, 30), mx = Math.max(4, Math.max.apply(null, a.concat(b))); grid(c.g, c.w, c.h, 0, mx, "");
      const bw = (c.w - 34) / 30; for (let i = 0; i < 30; i++) { const x = 32 + i * bw, hh = (c.h - 18) * a[i] / mx, h2 = (c.h - 18) * b[i] / mx; c.g.fillStyle = G; c.g.fillRect(x, c.h - 14 - hh, bw * 0.45, hh); c.g.fillStyle = Y; c.g.fillRect(x + bw * 0.5, c.h - 14 - h2, bw * 0.4, h2); }
      $("mxPulseSub").innerHTML = '<span style="color:' + G + '">&#9632;</span> heard ' + a.reduce((s, v) => s + v, 0) + ' &nbsp;<span style="color:' + Y + '">&#9632;</span> sent ' + b.reduce((s, v) => s + v, 0); }
    // link history
    { const c = cv("mxCvHist"), h = S.hist.slice(-240); grid(c.g, c.w, c.h, 0, 100, ""); line(c.g, h.map((x) => x.best), c.w, c.h, 0, 100, C, "rgba(77,255,210,.08)"); $("mxHistSub").textContent = h.length ? "now " + h[h.length - 1].best + ", peak " + Math.max.apply(null, h.map((x) => x.best)) + ", low " + Math.min.apply(null, h.map((x) => x.best)) : "no data yet"; }
    // census
    { const hr = rs.filter((r) => !r.tx && r.t > now - 3600000), by = {}; hr.forEach((r) => { const k = MTYPE[r.type]; by[k] = (by[k] || 0) + 1; }); const hop = [0, 0, 0, 0, 0]; hr.forEach((r) => { hop[Math.min(4, r.hops)]++; });
      const ids = new Set(hr.filter((r) => r.id).map((r) => r.id)).size, tot = hr.length || 1;
      $("mxCensus").innerHTML = '<div class="big">' + hr.length + '</div><div class="sub">packets heard, ' + ids + ' distinct senders</div>' + Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 5).map((k) => '<div class="kv"><span>' + esc(k) + '</span><b>' + by[k] + "</b></div><div class=\"bar\"><i style=\"width:" + Math.round(100 * by[k] / tot) + '%"></i></div>').join("") +
        '<div class="sub" style="margin-top:6px">hops: ' + hop.map((v, i) => '<span class="pill' + (v ? " hot" : "") + '">' + (i === 4 ? "4+" : i) + ": " + v + "</span>").join("") + "</div>"; }
    // talkers
    { const hr = rs.filter((r) => !r.tx && r.id && r.t > now - 3600000), by = {}; hr.forEach((r) => { (by[r.id] = by[r.id] || { n: 0, r: 0, s: -99 }); const o = by[r.id]; o.n++; o.r += r.rssi; o.s = Math.max(o.s, r.snr); });
      const top = Object.keys(by).sort((a, b) => by[b].n - by[a].n).slice(0, 6), mx = top.length ? by[top[0]].n : 1;
      $("mxTalk").innerHTML = top.length ? top.map((k) => { const nm = meshNameFor(k); return '<div class="kv" data-id="' + esc(k) + '"><span>' + esc(nm || k.toUpperCase()) + '</span><b>' + by[k].n + " pkts &middot; " + Math.round(by[k].r / by[k].n) + ' dBm</b></div><div class="bar"><i style="width:' + Math.round(100 * by[k].n / mx) + '%"></i></div>'; }).join("") : '<div class="sub">nothing heard yet</div>'; }
    // range records
    { const me = f && f.gps && f.gps.fix ? [f.gps.lat, f.gps.lon] : null; let far = null, farRep = null, farD = 0, farRD = 0;
      if (S.found) S.found.forEach((n) => { if (n.alat == null) return; const o = me || (n.hlat != null ? [n.hlat, n.hlon] : null); if (!o) return; const m = meters(o, [n.alat, n.alon]); if (m > farD) { farD = m; far = n; } if (n.t === 2 && m > farRD) { farRD = m; farRep = n; } });
      let bR = null, bS = null, hops = 0, hopr = null; rs.forEach((r) => { if (r.tx) return; if (!bR || r.rssi > bR.rssi) bR = r; if (!bS || r.snr > bS.snr) bS = r; if (r.hops > hops) { hops = r.hops; hopr = r; } });
      const wR = rs.filter((r) => !r.tx).reduce((a, r) => (a == null || r.rssi < a.rssi ? r : a), null);
      const km = (m) => (m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m"), nm = (n) => (n ? (n.n || n.k.slice(0, 8)) : "");
      kvset("mxRecs", [["farthest node", far ? km(farD) + " " + nm(far) : "--"], ["farthest repeater", farRep ? km(farRD) + " " + nm(farRep) : "--"], ["strongest signal", bR ? bR.rssi + " dBm" : "--"], ["weakest signal", wR ? wR.rssi + " dBm" : "--"], ["best SNR", bS ? bS.snr.toFixed(1) + " dB" : "--"], ["deepest path", hops ? hops + " hops" : "--"], ["nodes known", S.found ? String(S.found.size) : "0"]]); }
    // budget
    { const B = budget(d); if (B) kvset("mxBudget", [["frequency", fmt(B.f, 3) + " MHz"], ["SF / BW / CR", "SF" + B.sf + " / " + B.bwk + " kHz / 4/" + (B.cr + 4)], ["TX power", B.txp + " dBm"], ["data rate", Math.round(B.bitrate) + " bit/s"], ["receiver sensitivity", fmt(B.sens, 0) + " dBm"], ["link budget", fmt(B.bud, 0) + " dB"], ["free-space range", B.lKm >= 1 ? fmt(B.lKm, 0) + " km (best case, line of sight)" : fmt(B.lKm * 1000, 0) + " m"], ["airtime 32 B / 100 B", fmt(B.air32, 0) + " / " + fmt(B.air100, 0) + " ms"]]); }
    // airtime
    { const c = cv("mxCvAir"), a = MX.air.slice(-120); grid(c.g, c.w, c.h, 0, 10, "%"); line(c.g, a.map((x) => x.tx), c.w, c.h, 0, 10, Y); line(c.g, a.map((x) => x.rx), c.w, c.h, 0, 10, G);
      const l = a[a.length - 1]; kvset("mxAir", d ? [["transmit duty (recent)", l ? fmt(l.tx, 2) + " %" : "--"], ["receive duty (recent)", l ? fmt(l.rx, 2) + " %" : "--"], ["total on air (sent)", fmt(d.atx / 1000, 0) + " s"], ["total listening (heard)", fmt(d.arx / 1000, 0) + " s"], ["sent flood / direct", d.sf + " / " + d.sd], ["heard flood / direct", d.rf + " / " + d.rd], ["packets waiting to send", String(d.q)]] : [["waiting for the radio", "--"]]); }
    // vitals
    { const rows = []; if (d) { rows.push(["chip temperature", fmt(d.t, 1) + " °C"], ["memory free", fmt(d.hp / 1024, 0) + " of " + fmt(d.hs / 1024, 0) + " kB"], ["memory low point", fmt(d.hm / 1024, 0) + " kB"], ["processor", d.cpu + " MHz"], ["radio uptime", upfmt(d.up)], ["noise floor", d.nf + " dBm"]); }
      if (f && f.bat && f.bat.pct >= 0) rows.push(["battery", f.bat.pct + "% (" + (f.bat.mv / 1000).toFixed(2) + " V)" + (f.bat.chg ? " charging" : "")]); if (f && f.bat && f.bat.hrs != null && !f.bat.chg) rows.push(["battery left", f.bat.hrs >= 99 ? "99+ h" : f.bat.hrs.toFixed(1) + " h"]);
      kvset("mxVit", rows.length ? rows : [["waiting for the radio", "--"]]); }
    // motion
    { const c = cv("mxCvCmp"), g = c.g, cx = c.w / 2, cy = c.h / 2, r = Math.min(cx, cy) - 14; g.strokeStyle = DIM; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.stroke(); g.fillStyle = "#3fae62"; g.textAlign = "center"; g.fillText("N", cx, cy - r - 3); g.fillText("S", cx, cy + r + 11); g.textAlign = "left";
      const gp = f && f.gps; if (gp && gp.fix) { const a = (gp.course || 0) * Math.PI / 180; g.strokeStyle = G; g.lineWidth = 2.5; g.shadowColor = G; g.shadowBlur = 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * r * 0.9, cy - Math.cos(a) * r * 0.9); g.stroke(); g.shadowBlur = 0; }
      const t = f && f.trip || {}; kvset("mxMot", gp && gp.fix ? [["speed", (gp.spd != null ? gp.spd : gp.kmh) + " " + (f.unit || "km/h")], ["heading", (gp.course || 0) + "° " + ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((gp.course || 0) / 45) % 8]], ["satellites", String(gp.sats)], ["position", gp.lat.toFixed(5) + ", " + gp.lon.toFixed(5)], ["trip", fmt(t.km, 2) + " km"], ["top speed", t.top != null ? t.top + "" : "--"]] : [["no GPS fix", "turn GPS on from the phone app or the GPS screen"]]); }
    { const t = $("mxCvWx"); t.dataset.txt = "SNR dB per minute, last 30 min: " + W.series.map((v) => (v == null ? "-" : v.toFixed(1))).join(" ");
      $("mxCvPulse").dataset.txt = "packets per minute, last 30 min\nheard: " + bucket(rs.filter((r) => !r.tx), now, 30).join(" ") + "\nsent: " + bucket(rs.filter((r) => r.tx), now, 30).join(" ");
      $("mxCvHist").dataset.txt = "best repeater score history: " + S.hist.slice(-240).map((x) => x.best).join(" ");
      $("mxCvAir").dataset.txt = "tx duty % / rx duty %:\n" + MX.air.slice(-120).map((x) => x.tx.toFixed(2) + " / " + x.rx.toFixed(2)).join("\n");
      $("mxCvCmp").dataset.txt = f && f.gps && f.gps.fix ? "heading " + (f.gps.course || 0) + " deg" : ""; }
    drawWaterfall(); drawTopo(); drawSession(); drawNode();
    drawTerm();
  }
  const upfmt = (s) => { const dd = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (dd ? dd + "d " : "") + h + "h " + m + "m"; };

  /* ---------- rain trails on the map ---------- */
  let trail = null, tcols = new Map();
  function trailTick() {
    requestAnimationFrame(trailTick); const nowT = performance.now(); if (nowT - (MX.lastTrail || 0) < 100 || document.hidden) return; MX.lastTrail = nowT;
    if (!S.map || !$("mxOptTrail").checked || MX.lite) { if (trail) trail.style.display = "none"; return; }
    const mc = S.map.getContainer(); if (!inView(mc)) return; if (!trail || trail.parentNode !== mc) { trail = document.createElement("canvas"); trail.id = "mxMapRain"; mc.appendChild(trail); }
    trail.style.display = ""; const w = mc.clientWidth, h = mc.clientHeight; if (trail.width !== w || trail.height !== h) { trail.width = w; trail.height = h; }
    const g = trail.getContext("2d"); g.clearRect(0, 0, w, h); g.font = "13px monospace"; const now = Date.now();
    S.found && S.found.forEach((n, k) => { const la = n.alat != null ? n.alat : n.hlat, lo = n.alon != null ? n.alon : n.hlon; if (la == null) return; const p = S.map.latLngToContainerPoint([la, lo]); if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) return;
      const age = (now - n.last) / 1000, str = Math.max(0.25, 1 - age / 1800), col = n.t === 2 ? "0,255,65" : n.t === 1 ? "77,255,210" : "255,228,77"; let c = tcols.get(k); if (!c) { c = { ph: Math.random() * 100 }; tcols.set(k, c); }
      const len = 9; for (let i = 0; i < len; i++) { const ph = ((now / 90 + c.ph) % (len + 4)); const idx = (i - ph + len + 4) % (len + 4); const y = p.y + 10 + i * 13, a = Math.max(0, (1 - i / len)) * str * (idx < 2 ? 1 : 0.55); g.fillStyle = "rgba(" + col + "," + a.toFixed(2) + ")"; g.fillText(GL[(k.charCodeAt(i % k.length) + i + ((now / 400) | 0) * (i % 3)) % GL.length], p.x - 4, y); } });
  }


  /* ---------- operator alias, session ---------- */
  const SESS = { t0: Date.now(), bytes: 0, pk: 0 };
  const cleanAlias = (v) => String(v || "").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 24);
  const getAlias = () => { try { return cleanAlias(localStorage.getItem("mx-alias")); } catch (e) { return ""; } };
  function setAlias(v) { v = cleanAlias(v); if (!v) return false; try { localStorage.setItem("mx-alias", v); } catch (e) { /* kept for this visit only */ } MX.alias = v; showAlias(); termPush("operator alias set: " + v, "adv"); return true; }
  function showAlias() { const a = MX.alias || "?"; $("mxOpName").textContent = a; $("mxOp").textContent = "> " + a; $("mxPrompt").textContent = a + "@matrix>"; }
  function askAlias(first) { const box = $("mxAliasBox"), inp = $("mxAliasIn"); inp.value = first ? "" : MX.alias || ""; box.hidden = false; setTimeout(() => inp.focus(), 50); }
  const THEMES = { green: { rgb: "0,255,65", hi: "#d8ffe4", a: "#00ff41", ink: "#c8ffd6", ink2: "#7fe79b", muted: "#3fae62", line: "#0f4a22", grid: "#08301a", hue: "75deg" },
    red: { rgb: "255,59,59", hi: "#ffe0e0", a: "#ff3b3b", ink: "#ffd6d6", ink2: "#ff9a9a", muted: "#b04a4a", line: "#4a0f0f", grid: "#301010", hue: "-30deg" },
    amber: { rgb: "255,176,0", hi: "#fff0cc", a: "#ffb000", ink: "#ffe8b8", ink2: "#ffcb5c", muted: "#b08020", line: "#4a3a0f", grid: "#302508", hue: "0deg" },
    cyan: { rgb: "77,255,210", hi: "#dcfff6", a: "#4dffd2", ink: "#d0fff2", ink2: "#7fe9cf", muted: "#3fae94", line: "#0f4a40", grid: "#08302a", hue: "135deg" } };
  function applyTheme(n) { const t = THEMES[n] || THEMES.green, st = root.style; TH.rgb = t.rgb; TH.hi = t.hi; st.setProperty("--accent", t.a); st.setProperty("--ink", t.ink); st.setProperty("--ink2", t.ink2); st.setProperty("--muted", t.muted); st.setProperty("--line", t.line); st.setProperty("--grid", t.grid); st.setProperty("--hue", t.hue); st.setProperty("--rep", t.a); try { localStorage.setItem("mx-theme", n); } catch (e) { /* none */ } $("mxTheme").value = THEMES[n] ? n : "green"; }

  /* ---------- command line (display only: reads what the dashboard already knows) ---------- */
  function out(txt, cls) { String(txt).split("\n").forEach((l) => termPush(l, cls || "out")); termDirty = true; }
  const CMDS = {
    help: () => out("commands:\n  help          this list\n  whoami        your alias and session\n  alias NAME    change your alias\n  status        link health, weather, radio vitals\n  nodes         every node this dashboard knows\n  decode NAME   hops and path for one node (or click a node)\n  hack NAME     full file on a node: path, signal, position, history\n  block NAME    stop reporting a node (unblock NAME to undo)\n  blocklist     what is blocked\n  top           busiest senders in the last hour\n  budget        radio link budget\n  weather       signal weather forecast\n  colour NAME   green | red | amber | cyan\n  rain on|off   falling code\n  export        save the intercept log\n  clear         clear this screen\n  intro         replay the splash\n  (nothing typed here is sent to the radio)"),
    whoami: () => out("operator " + (MX.alias || "?") + "  session " + dur((Date.now() - SESS.t0) / 1000) + "  captured " + SESS.pk + " packets"),
    alias: (a) => { if (a && setAlias(a)) out("alias is now " + MX.alias); else askAlias(false); },
    status: () => { const H = health(), W = forecast(), d = MX.d; out("link health " + (S.frame ? H.v : "--") + "/100  weather " + W.k + (d ? "\nchip " + fmt(d.t, 1) + " C  heap " + fmt(d.hp / 1024, 0) + " kB  noise " + d.nf + " dBm  up " + upfmt(d.up) : "\nradio vitals: waiting for the radio")); },
    nodes: () => { const rows = []; S.found && S.found.forEach((n) => rows.push((n.t === 2 ? "RPT " : n.t === 1 ? "CMP " : "ROOM") + " " + (n.n || n.k.slice(0, 8)).padEnd(22) + " " + n.k.slice(0, 8).toUpperCase() + "  " + (n.alat != null ? n.alat.toFixed(4) + "," + n.alon.toFixed(4) : "no position"))); out(rows.length ? rows.join("\n") : "no nodes known yet"); },
    top: () => { const by = {}; recsNow().forEach((r) => { if (!r.tx && r.id && r.t > Date.now() - 3600000) by[r.id] = (by[r.id] || 0) + 1; }); const k = Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 8); out(k.length ? k.map((x) => String(by[x]).padStart(4) + "  " + x.toUpperCase() + " " + meshNameFor(x)).join("\n") : "nothing heard yet"); },
    budget: () => { const B = budget(MX.d); out(B ? "SF" + B.sf + " BW" + B.bwk + "k  " + Math.round(B.bitrate) + " bit/s  sensitivity " + fmt(B.sens, 0) + " dBm  budget " + fmt(B.bud, 0) + " dB  free-space range " + fmt(B.lKm, 0) + " km" : "waiting for the radio"); },
    weather: () => { const W = forecast(); out(W.k + ": " + W.s); },
    colour: (a) => { if (THEMES[a]) { applyTheme(a); out("colour " + a); } else out("green | red | amber | cyan", "err"); },
    rain: (a) => { $("mxOptRain").checked = a !== "off"; $("mxOptRain").dispatchEvent(new Event("change")); out("falling code " + (a === "off" ? "off" : "on")); },
    decode: (a) => { if (!a) out("usage: decode NAME or ID", "err"); else selectNode(normId(a), "decode"); },
    hack: (a) => { if (!a) out("usage: hack NAME or ID", "err"); else { out("scanning " + normId(a).toUpperCase() + " ..."); selectNode(normId(a), "hack"); } },
    block: (a) => { if (!a) out("usage: block NAME or ID", "err"); else { const i = normId(a); blockNode(i, meshNameFor(i)); } },
    unblock: (a) => { const i = normId(a); if (MX.block[i]) unblockNode(i); else out("not blocked: " + a, "err"); },
    blocklist: () => out(Object.keys(MX.block).length ? Object.keys(MX.block).map((k) => k.toUpperCase() + " " + MX.block[k]).join("\n") : "nothing blocked"),
    node: (a) => { if (!a) out("usage: node NAME or ID", "err"); else { selectNode(normId(a)); out("node detail: " + normId(a).toUpperCase() + " (see the Node detail tile)"); } },
    export: () => exportLog(), clear: () => { tl.length = 0; termDirty = true; }, intro: () => splash(),
  };
  CMDS.color = CMDS.colour;
  function runCmd(line) { const t = line.trim(); if (!t) return; termPush((MX.alias || "?") + "@matrix> " + t, "tx"); const w = t.split(/\s+/), f = CMDS[w[0].toLowerCase()]; if (f) f(w.slice(1).join(" ").trim().toLowerCase() === w.slice(1).join(" ").trim() ? w.slice(1).join(" ") : w.slice(1).join(" ")); else out("unknown command: " + w[0] + "  (type help)", "err"); }
  function exportLog() { const b = new Blob([tl.map((x) => x.txt).join("\n") + "\n"], { type: "text/plain" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "matrix-intercept-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const dur = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + "h " : "") + m + "m " + (s % 60) + "s"; };


  /* ---------- node detail: hops and path, from what the radio reports ---------- */
  function normId(v) { v = String(v || "").trim().toLowerCase(); const m = Object.keys(MX.known || {}).find((k) => k === v || k.startsWith(v)); if (m) return m; let hit = null; S.found && S.found.forEach((n) => { if (!hit && (n.k.toLowerCase().startsWith(v) || (n.n && n.n.toLowerCase().indexOf(v) >= 0))) hit = n.k.toLowerCase().slice(0, 6); }); return hit || v.slice(0, 6); }
  /* ---- block list: the dashboard stops reporting these (the radio itself is untouched) ---- */
  MX.block = (() => { try { return JSON.parse(localStorage.getItem("mx-block") || "{}") || {}; } catch (e) { return {}; } })(); MX.stash = {};
  const isBlocked = (id) => !!id && !!MX.block[String(id).toLowerCase().slice(0, 6)];
  const saveBlock = () => { try { localStorage.setItem("mx-block", JSON.stringify(MX.block)); } catch (e) { /* kept for this visit only */ } };
  function purge() {      // take blocked nodes out of everything the dashboard shows; keep them aside so Unblock can bring them back
    const rs = MESH.recs; for (let i = rs.length - 1; i >= 0; i--) if (isBlocked(rs[i].id) || isBlocked(rs[i].src)) rs.splice(i, 1);
    if (S.found) [...S.found.keys()].forEach((k) => { if (isBlocked(k)) { MX.stash[k] = S.found.get(k); S.found.delete(k); } });
    try { rebuildNodeLayers(); renderFoundPanel(); } catch (e) { /* not ready */ } MESH.dirty = true; }
  function blockNode(id, name) { id = id.slice(0, 6); MX.block[id] = name || id.toUpperCase(); saveBlock(); purge(); if (MX.sel === id) { MX.sel = null; $("mxNodeBody").innerHTML = '<div class="sub">nothing selected yet</div>'; } termPush("BLOCKED source " + id.toUpperCase() + (name ? " (" + name + ")" : "") + ": no longer reported by this dashboard", "adv"); drawBlock(); }
  function unblockNode(id) { delete MX.block[id]; saveBlock(); Object.keys(MX.stash).forEach((k) => { if (k.toLowerCase().slice(0, 6) === id) { S.found.set(k, MX.stash[k]); delete MX.stash[k]; } }); try { rebuildNodeLayers(); renderFoundPanel(); } catch (e) { /* none */ } termPush("unblocked source " + id.toUpperCase(), "adv"); drawBlock(); }
  function drawBlock() { const k = Object.keys(MX.block), el = $("mxBlockBody"); el.innerHTML = k.length ? k.map((x) => '<div class="kv"><span>' + esc(MX.block[x]) + " " + esc(x.toUpperCase()) + '</span><b><button type="button" data-unb="' + esc(x) + '">unblock</button></b></div>').join("") : '<div class="sub">nothing blocked</div>'; $("mxBlock").dataset.txt = k.map((x) => x.toUpperCase() + " " + MX.block[x]).join("\n"); }
  const _onFound = window.onFound; window.onFound = onFound = function (f, ts) { if (f && isBlocked(String(f.k).toLowerCase())) return; return _onFound(f, ts); };
  const _onMesh = window.onMeshLine; window.onMeshLine = onMeshLine = function (line) { const r = _onMesh(line); if (Object.keys(MX.block).length) purge(); return r; };

  /* ---- the menu next to a clicked node ---- */
  function openMenu(id, x, y) {
    id = id.toLowerCase().slice(0, 6); const m = $("mxMenu"), nm = meshNameFor(id); m.dataset.id = id; m.querySelector(".mh").textContent = (nm || id.toUpperCase());
    m.hidden = false; const w = m.offsetWidth, h = m.offsetHeight; m.style.left = Math.max(4, Math.min(x + 8, innerWidth - w - 4)) + "px"; m.style.top = Math.max(4, Math.min(y + 8, innerHeight - h - 4)) + "px"; }
  const closeMenu = () => { $("mxMenu").hidden = true; };
  function selectNode(id, mode) { MX.sel = id; MX.mode = mode || "decode"; MX.scanId = (MX.scanId || 0) + 1; runWin(id, MX.mode, MX.scanId); }
  /* the progress window: Decode counts one dot every 2 s for 10 s; Hack steps through . .. . ... .. . at 3 s each, three times over */
  const HACK_DOTS = [".", "..", ".", "...", "..", ".", ".", "..", ".", "...", "..", ".", ".", "..", ".", "...", "..", "."];   // the six-step cycle, three times (54 s)
  function runWin(id, mode, n) {
    const w = $("mxWin"), ti = $("mxWinTitle"), bd = $("mxWinBody"), nm = (meshNameFor(id) || id.toUpperCase()).toUpperCase(), hack = mode === "hack";
    w.hidden = false; w.classList.toggle("hack", hack); bd.innerHTML = '<div class="path">' + (hack ? "gaining access to the data this source has put on the air" : "reading the source's packets") + "</div>"; MX.scanning = true; let i = 0;
    const steps = hack ? HACK_DOTS.length : 5, every = hack ? 3000 : 2000;
    (function tick() { if (MX.scanId !== n || w.hidden) { if (MX.scanId === n) MX.scanning = false; return; }
      if (i < steps) { const dots = hack ? HACK_DOTS[i] : ".".repeat(i + 1); ti.textContent = (hack ? "HACKING " : "Decoding ") + nm + dots; bd.firstChild.textContent = (hack ? "cycle " + (Math.floor(i / 6) + 1) + " of 3" : "pass " + (i + 1) + " of " + steps); i++; setTimeout(tick, every); }
      else { MX.scanning = false; drawNode(); ti.textContent = (hack ? "SUCCESSFUL HACK: " : "Decoded: ") + nm; bd.innerHTML = $("mxNodeBody").innerHTML; $("mxWin").dataset.txt = ti.textContent + "\n" + $("mxNodeBody").innerText; try { $("mxNode").scrollIntoView({ block: "nearest" }); } catch (e) { /* none */ } } })();
  }
  const median = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  function drawNode() {
    if (MX.scanning) return; const el = $("mxNodeBody"), id = MX.sel; if (!id) return; const now = Date.now(), rs = recsNow(), nm = meshNameFor(id), hack = MX.mode === "hack";
    const via = rs.filter((r) => !r.tx && r.id === id), orig = rs.filter((r) => !r.tx && r.src === id && r.src !== r.id), all = via.concat(orig).sort((a, b) => a.t - b.t);
    const known = S.found && [...S.found.values()].find((n) => n.k.toLowerCase().startsWith(id)), f = S.frame, me = f && f.gps && f.gps.fix ? [f.gps.lat, f.gps.lon] : null;
    const hops = via.map((r) => r.hops), mn = hops.length ? Math.min.apply(null, hops) : null, mxh = hops.length ? Math.max.apply(null, hops) : null, avg = hops.length ? hops.reduce((a, b) => a + b, 0) / hops.length : null;
    const who = esc(nm || id.toUpperCase()), tag = hack ? "HACK SOURCE" : "DECODE SOURCE";
    let h = '<div class="sub" style="color:var(--muted)">' + tag + '</div><div class="big">' + who + '</div><div class="sub">id ' + esc(id.toUpperCase()) + (known ? " &middot; " + (known.t === 2 ? "repeater" : known.t === 1 ? "companion" : "room server") : "") + "</div>";
    if (!all.length && !known) { h += '<div class="sub">nothing heard from this node in the intercept history yet</div>'; el.innerHTML = h; $("mxNode").dataset.txt = el.innerText; return; }
    const lastR = all.length ? all[all.length - 1].t : 0, firstR = all.length ? all[0].t : 0;
    let path; if (mn === 0) path = esc(MX.alias || "YOU") + " &larr; " + who + "  (heard directly, 0 hops)"; else if (mn == null) path = "no packet from it has passed through this radio yet"; else path = esc(MX.alias || "YOU") + " &larr; [" + who + " relay] &larr; " + (mn > 1 ? "(" + (mn - 1) + " more relay" + (mn > 2 ? "s" : "") + " not reported) &larr; " : "") + "origin  (" + mn + " hop" + (mn > 1 ? "s" : "") + ")";
    h += '<div class="path">' + path + "</div>";
    const rows = [["hops (best / typical / worst)", hops.length ? mn + " / " + avg.toFixed(1) + " / " + mxh : "--"]];
    if (orig.length) { const by = {}; orig.forEach((r) => { const k = r.id + "|" + r.hops; by[k] = (by[k] || 0) + 1; }); h += '<div class="kv">' + rows.map((r) => "<span>" + esc(r[0]) + "</span><b>" + esc(String(r[1])) + "</b>").join("") + "</div>";
      h += '<div class="sub" style="margin-top:8px">packets this node originated, by the last relay they came through</div><table><tr><th>last relay</th><th>hops</th><th>packets</th></tr>' + Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 8).map((k) => { const p = k.split("|"); return "<tr><td>" + esc((meshNameFor(p[0]) || "") + " " + p[0].toUpperCase()) + "</td><td>" + p[1] + "</td><td>" + by[k] + "</td></tr>"; }).join("") + "</table>"; }
    else h += '<div class="kv">' + rows.map((r) => "<span>" + esc(r[0]) + "</span><b>" + esc(String(r[1])) + "</b>").join("") + "</div>";
    if (hack) {
      const R = [], rx = via.length ? via : all;
      R.push(["type", known ? (known.t === 2 ? "repeater" : known.t === 1 ? "companion" : known.t === 3 ? "room server" : "node") : "not announced yet"]);
      R.push(["name it announced", known && known.n ? known.n : "none"]);
      R.push(["full id", known ? known.k.toUpperCase() : id.toUpperCase() + " (partial)"]);
      R.push(["first / last heard", (firstR ? hhmmss(firstR) : "--") + " / " + (lastR ? hhmmss(lastR) : "--")]);
      R.push(["packets seen", all.length + " (" + via.length + " relayed by it, " + orig.length + " originated by it)"]);
      if (rx.length) { const rs2 = rx.map((r) => r.rssi), sn = rx.map((r) => r.snr); R.push(["signal RSSI (best / avg / worst)", Math.max.apply(null, rs2) + " / " + Math.round(rs2.reduce((a, b) => a + b, 0) / rs2.length) + " / " + Math.min.apply(null, rs2) + " dBm"]); R.push(["SNR (best / avg)", Math.max.apply(null, sn).toFixed(1) + " / " + (sn.reduce((a, b) => a + b, 0) / sn.length).toFixed(1) + " dB"]);
        const mb = budget(MX.d); if (mb && mn === 0) { const best = Math.max.apply(null, rs2); R.push(["range from signal alone (rough)", (Math.pow(10, (mb.txp - best - 32.44 - 20 * Math.log10(mb.f)) / 20)).toFixed(2) + " km, if it transmits at " + mb.txp + " dBm in the open"]); } }
      const adv = all.filter((r) => r.type === 4).map((r) => r.t); if (adv.length > 2) { const gaps = []; for (let i = 1; i < adv.length; i++) gaps.push((adv[i] - adv[i - 1]) / 1000); R.push(["advert interval", Math.round(median(gaps)) + " s typical (" + adv.length + " adverts)"]); } else R.push(["adverts heard", String(adv.length)]);
      const ty = {}; all.forEach((r) => { const k = MTYPE[r.type]; ty[k] = (ty[k] || 0) + 1; }); R.push(["what it sends", Object.keys(ty).sort((a, b) => ty[b] - ty[a]).map((k) => k + " " + ty[k]).join(", ") || "--"]);
      if (known && known.alat != null) { R.push(["GPS position it announced", known.alat.toFixed(6) + ", " + known.alon.toFixed(6)]); if (me) { const mm = meters(me, [known.alat, known.alon]); let br = Math.atan2((known.alon - me[1]) * Math.cos(me[0] * Math.PI / 180), known.alat - me[0]) * 180 / Math.PI; if (br < 0) br += 360; R.push(["distance and bearing from you", (mm / 1000).toFixed(2) + " km at " + Math.round(br) + "\u00b0"]); } R.push(["map link", "https://www.openstreetmap.org/?mlat=" + known.alat.toFixed(6) + "&mlon=" + known.alon.toFixed(6) + "#map=16/" + known.alat.toFixed(5) + "/" + known.alon.toFixed(5)]); }
      else R.push(["GPS position", known ? "not announced (it keeps its location private or has no GPS)" : "unknown"]);
      if (known && known.hlat != null) R.push(["where you were when first heard", known.hlat.toFixed(5) + ", " + known.hlon.toFixed(5)]);
      R.push(["telemetry", "none received (this dashboard only sees what the radio reports; no sensor data is broadcast to it)"]);
      h += '<div class="sub" style="margin-top:8px;color:var(--accent)">FILE</div><div class="kv">' + R.map((r) => "<span>" + esc(r[0]) + "</span><b>" + esc(String(r[1])) + "</b>").join("") + "</div>";
      const c = rx.slice(-40).map((r) => r.rssi); if (c.length > 2) h += '<div class="sub" style="margin-top:8px">signal over its last ' + c.length + " packets (dBm): " + c.join(" ") + "</div>";
    }
    h += '<div class="sub" style="margin-top:8px;color:var(--muted)">' + (hack ? "Everything here was heard over the air or announced by the node itself. Nothing is sent to it and nothing is taken from it. " : "") + "The radio reports the hop count and the last relay, not the full route, so in-between hops show as unknown.</div>";
    el.innerHTML = h; $("mxNode").dataset.txt = el.innerText;
  }

  /* ---------- waterfall and topology ---------- */
  function drawWaterfall() {
    const c = cv("mxCvWf"), g = c.g, now = Date.now(), COLS = 120, STEP = 5000, ROWS = 12, lo = -130, hi = -50, rs = recsNow().filter((r) => !r.tx && r.t > now - COLS * STEP);
    const grid2 = []; for (let i = 0; i < COLS; i++) grid2.push(new Array(ROWS).fill(0)); let mx = 1;
    rs.forEach((r) => { const x = COLS - 1 - Math.floor((now - r.t) / STEP), y = Math.max(0, Math.min(ROWS - 1, Math.floor((r.rssi - lo) / (hi - lo) * ROWS))); if (x >= 0 && x < COLS) { grid2[x][y]++; if (grid2[x][y] > mx) mx = grid2[x][y]; } });
    const cw = (c.w - 40) / COLS, rh = (c.h - 16) / ROWS; g.fillStyle = "#000"; g.fillRect(40, 0, c.w - 40, c.h - 16);
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) { const v = grid2[x][y]; if (!v) continue; const a = 0.2 + 0.8 * v / mx; g.fillStyle = "rgba(" + TH.rgb + "," + a.toFixed(2) + ")"; g.fillRect(40 + x * cw, (ROWS - 1 - y) * rh, Math.ceil(cw), Math.ceil(rh) - 1); }
    g.fillStyle = "#3fae62"; for (let y = 0; y <= 4; y++) g.fillText((hi - (hi - lo) * y / 4) + "", 0, y * (c.h - 16) / 4 + 10); g.fillText("-10 min", 40, c.h - 3); g.fillText("now", c.w - 26, c.h - 3);
  }
  function drawTopo() {
    const c = cv("mxCvTopo"), g = c.g, now = Date.now(), cx = c.w / 2, cy = c.h / 2, R = Math.min(cx, cy) - 22, nodes = {};
    recsNow().forEach((r) => { if (r.tx || !r.id || r.t < now - 3600000) return; const o = nodes[r.id] || (nodes[r.id] = { id: r.id, hop: 9, last: 0, n: 0, rssi: -130 }); o.hop = Math.min(o.hop, r.hops); o.last = Math.max(o.last, r.t); o.n++; o.rssi = Math.max(o.rssi, r.rssi); });
    g.strokeStyle = "#0f4a22"; g.lineWidth = 1; [1, 2, 3].forEach((k) => { g.beginPath(); g.arc(cx, cy, R * k / 3, 0, 6.2832); g.stroke(); g.fillStyle = "#2e8a49"; g.fillText(k === 3 ? "3+ hops" : k - 1 === 0 ? "direct" : (k - 1) + " hop" + (k > 2 ? "s" : ""), cx + 4, cy - R * k / 3 + 12); });
    MX.topoHit = [];
    const list = Object.keys(nodes).map((k) => nodes[k]).sort((a, b) => b.n - a.n).slice(0, 40);
    $("mxCvTopo").dataset.txt = "node id, name, hops, packets, best dBm, seconds since heard\n" + list.map((o) => [o.id.toUpperCase(), meshNameFor(o.id) || "-", o.hop, o.n, o.rssi, Math.round((now - o.last) / 1000)].join(", ")).join("\n");
    list.forEach((o) => { let h = 0; for (let i = 0; i < o.id.length; i++) h = (h * 31 + o.id.charCodeAt(i)) >>> 0; const ang = (h % 3600) / 3600 * 6.2832, rr = R * (Math.min(o.hop, 2) + 0.55) / 3, x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr, age = (now - o.last) / 1000, hot = age < 10;
      g.strokeStyle = hot ? "rgba(" + TH.rgb + ",.9)" : "rgba(" + TH.rgb + ",.18)"; g.lineWidth = hot ? 1.6 : 1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke();
      g.fillStyle = hot ? "#fff" : "rgb(" + TH.rgb + ")"; g.shadowColor = "rgb(" + TH.rgb + ")"; g.shadowBlur = hot ? 12 : 4; g.beginPath(); g.arc(x, y, hot ? 5 : 3.5, 0, 6.2832); g.fill(); g.shadowBlur = 0;
      MX.topoHit.push({ x, y, id: o.id }); if (MX.sel === o.id) { g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 10, 0, 6.2832); g.stroke(); }
      const nm = meshNameFor(o.id) || o.id.toUpperCase(); g.fillStyle = "#9dffb4"; g.textAlign = x > cx ? "left" : "right"; g.fillText(nm.slice(0, 16), x + (x > cx ? 8 : -8), y + 4); g.textAlign = "left"; });
    g.fillStyle = "#000"; g.strokeStyle = "rgb(" + TH.rgb + ")"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 8, 0, 6.2832); g.fill(); g.stroke(); g.fillStyle = "rgb(" + TH.rgb + ")"; g.fillText(MX.alias || "YOU", cx + 12, cy + 4);
    if (!list.length) { g.fillStyle = "#3fae62"; g.textAlign = "center"; g.fillText("nothing heard yet", cx, cy + 40); g.textAlign = "left"; }
  }
  function drawSession() { const now = Date.now(); $("mxOpSub").textContent = "access level: OPERATOR · link: " + (S.mode === "serial" ? "radio on USB" : S.mode === "demo" ? "sample data" : "offline");
    kvset("mxSess", [["session time", dur((now - SESS.t0) / 1000)], ["packets captured", String(SESS.pk)], ["data captured", (SESS.bytes >= 1024 ? (SESS.bytes / 1024).toFixed(1) + " kB" : SESS.bytes + " B")], ["alerts raised", String(MX.alerts.length)], ["nodes discovered", S.found ? String(S.found.size) : "0"]]); }

  function tileText(el) {      // plain text of a tile, one line per row; label: value for the two-column lists
    if (el.classList && el.classList.contains("kv")) { const k = [...el.children], r = []; for (let i = 0; i + 1 < k.length; i += 2) r.push(k[i].textContent + ": " + k[i + 1].textContent); return r.join("\n"); }
    if (el.classList && el.classList.contains("bar")) return "";
    const kids = [...el.children]; if (!kids.length) return el.textContent.trim();
    return kids.map(tileText).filter((x) => x).join("\n");
  }
  function fallbackCopy(txt, done) { const a = document.createElement("textarea"); a.value = txt; a.style.position = "fixed"; a.style.opacity = "0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); done(); } catch (e) { /* the text can still be selected by hand */ } a.remove(); }
  /* ---------- lite mode: no falling code, no map tint, no trails (for slow or low-memory computers) ---------- */
  function setLite(on, why) { MX.lite = on; root.classList.toggle("lite", on); try { localStorage.setItem("mx-lite", on ? "1" : "0"); } catch (e) { /* none */ }
    const ck = (id, v) => { const e = $(id); if (e) e.disabled = on; if (on && e) { e.dataset.was = e.checked ? "1" : "0"; e.checked = false; } else if (e && e.dataset.was) { e.checked = e.dataset.was === "1"; } };
    ["mxOptRain", "mxOptMap", "mxOptTrail"].forEach((id) => ck(id)); $("mxOptLite").checked = on; applyRain(); root.classList.toggle("mxmap", !on && $("mxOptMap").checked);
    if (why) { termPush("LITE MODE on: " + why, "adv"); } }
  setInterval(() => { const m = performance && performance.memory; if (m && !MX.lite && m.usedJSHeapSize > 300e6) setLite(true, "this page is using a lot of memory (" + Math.round(m.usedJSHeapSize / 1e6) + " MB of script memory)"); }, 10000);

  /* ---------- wiring ---------- */
  function onMx(line) { let o; try { o = JSON.parse(line).mx; } catch (e) { return; } if (!o) return; const prev = MX.d; MX.d = o; MX.lastMx = Date.now();
    if (prev && o.up > prev.up) { const dt = (o.up - prev.up) * 1000; MX.air.push({ tx: Math.max(0, 100 * (o.atx - prev.atx) / dt), rx: Math.max(0, 100 * (o.arx - prev.arx) / dt) }); if (MX.air.length > 400) MX.air.shift(); } }
  const _onLine = window.onLine; window.onLine = onLine = function (line) { const t = line.trim(); if (t[0] === "{" && t.indexOf('"mx"') === 1) { onMx(t); return; } return _onLine(line); };
  const _onFrame = window.onFrame; window.onFrame = onFrame = function (f, ts) { MX.lastHeard = Math.max(MX.lastHeard, Date.now() - ((f.diag && f.diag.last_rx_s != null && f.diag.last_rx_s < 3600) ? f.diag.last_rx_s * 1000 : 0)); return _onFrame(f, ts); };
  /* sample data: a made-up mx line every 2 s, made-up packets so the terminal and charts have life */
  const _startDemo = window.startDemo; window.startDemo = startDemo = function () { _startDemo(); MX.d = null; MX.air = []; let n = 0; clearInterval(MX.dt); MX.dt = setInterval(() => { if (!S.demo) { clearInterval(MX.dt); return; } n++;
      const base = MX.d || { atx: 0, arx: 0, sf: 0, sd: 0, rf: 0, rd: 0 }, up = 5000 + n * 2; MX.d = { t: 41 + 6 * Math.sin(n / 30) + Math.random(), hp: 190000 + 4000 * Math.sin(n / 9), hm: 150000, hs: 327680, cpu: 160, up, atx: base.atx + 25 + (n % 7 ? 0 : 400), arx: base.arx + 180 + 120 * Math.random(), sf: base.sf + (n % 5 ? 0 : 1), sd: base.sd + (n % 9 ? 0 : 1), rf: base.rf + 1 + (n % 3 ? 0 : 1), rd: base.rd + (n % 4 ? 0 : 1), q: n % 11 === 0 ? 2 : 0,
        nf: Math.round(-111 + 5 * Math.sin(n / 40) + (n % 90 > 80 ? 14 : 0)), mv: 3980, fq: 910.525, sfac: 7, bw: 62.5, cr: 5, txp: 22 };
      MX.air.push({ tx: 0.4 + 0.3 * Math.sin(n / 5) + (n % 7 ? 0 : 1.5), rx: 2 + Math.sin(n / 8) });
      const ids = ["A1B2C3", "3F00AA", "7C19E0", "D4FF00", "22BB33", "33CC44"], k = (Math.random() * ids.length) | 0, ty = [4, 4, 5, 2, 9, 3][(Math.random() * 6) | 0];
      if (typeof MESH !== "undefined") { for (let j = 0; j < 1 + (n % 3); j++) { const kk = (k + j) % ids.length; MESH.recs.push({ t: Date.now() - j * 700, rssi: -88 - kk * 4 - ((Math.random() * 6) | 0), snr: 9 - kk * 2.2 + Math.random(), type: ty, hops: kk > 3 ? 2 : kk > 1 ? 1 : 0, len: 20 + ((Math.random() * 90) | 0), rt: 1, tx: false, id: ids[kk].toLowerCase(), src: ids[kk].toLowerCase() }); } if (n % 6 === 0) MESH.recs.push({ t: Date.now(), rssi: 0, snr: 0, type: 2, hops: 0, len: 45, rt: 1, tx: true, id: "", src: "" });
        MESH.nf.push({ t: Date.now(), v: MX.d.nf }); if (MESH.nf.length > 2000) MESH.nf.shift(); MESH.cfg = { sf: 7, bw: 62.5, cr: 5 }; } }, 2000);
    for (let i = 0; i < 90; i++) { /* a little history so the charts are not empty at the start */ const t = Date.now() - (90 - i) * 20000; MESH.recs.push({ t, rssi: -90 - ((Math.random() * 20) | 0), snr: 6 + 3 * Math.sin(i / 9) - (i > 60 ? (i - 60) / 12 : 0), type: [4, 5, 2][i % 3], hops: i % 3, len: 40, rt: 1, tx: i % 8 === 0, id: ["a1b2c3", "3f00aa", "7c19e0"][i % 3], src: ""}); } };
  document.addEventListener("DOMContentLoaded", () => {
    const set = (id, k, d) => { const e = $(id); e.checked = opt(k, d); e.addEventListener("change", () => { setOpt(k, e.checked); apply(); }); };
    function apply() { applyRain(); root.classList.toggle("mxmap", $("mxOptMap").checked); }
    set("mxOptRain", "rain", true); set("mxOptMap", "map", true); set("mxOptTrail", "trail", true); set("mxOptBeep", "beep", false);
    $("mxReplay").addEventListener("click", splash); $("mxTermClr").addEventListener("click", () => { tl.length = 0; termDirty = true; drawTerm(); }); $("mxTermF").addEventListener("change", () => { termDirty = true; });
    $("mxNote").textContent = "Display only. Nothing here sends anything to the radio. Link health, the forecast and the budget are estimates worked out in this page from what the radio reports.";
    MX.alias = getAlias(); showAlias(); try { applyTheme(localStorage.getItem("mx-theme") || "green"); } catch (e) { applyTheme("green"); }
    $("mxTheme").addEventListener("change", (e) => applyTheme(e.target.value)); $("mxExport").addEventListener("click", exportLog);
    $("mxCvTopo").addEventListener("click", (e) => { const r = e.target.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 18; (MX.topoHit || []).forEach((h) => { const dd = Math.hypot(h.x - x, h.y - y); if (dd < bd) { bd = dd; best = h; } }); if (best) openMenu(best.id, e.clientX, e.clientY); });
    $("mxTalk").addEventListener("click", (e) => { const r = e.target.closest("[data-id]") || (e.target.classList.contains("bar") || (e.target.parentElement && e.target.parentElement.classList.contains("bar")) ? (e.target.closest(".bar") || e.target).previousElementSibling : null); if (r && r.dataset.id) openMenu(r.dataset.id, e.clientX, e.clientY); });
    $("radarList") && $("radarList").addEventListener("click", (e) => { const row = e.target.closest("[data-k]"); if (row) openMenu(row.dataset.k.toLowerCase().slice(0, 6), e.clientX, e.clientY); });
    $("mxWinX").addEventListener("click", () => { $("mxWin").hidden = true; MX.scanning = false; MX.scanId++; });
    $("mxWinCopy").addEventListener("click", () => { const t = $("mxWin").dataset.txt || $("mxWinTitle").textContent; const done = () => { $("mxWinCopy").textContent = "copied"; setTimeout(() => { $("mxWinCopy").textContent = "copy"; }, 1200); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done)); else fallbackCopy(t, done); });
    $("mxMenu").addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (!b) return; const id = $("mxMenu").dataset.id; closeMenu(); if (b.dataset.act === "block") blockNode(id, meshNameFor(id)); else selectNode(id, b.dataset.act); });
    document.addEventListener("click", (e) => { if (!$("mxMenu").hidden && !e.target.closest("#mxMenu") && !e.target.closest("#mxCvTopo, #mxTalk, #radarList")) closeMenu(); }); document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeMenu(); if (!$("mxWin").hidden) $("mxWinX").click(); } });
    $("mxBlockBody").addEventListener("click", (e) => { const u = e.target.closest("[data-unb]"); if (u) unblockNode(u.dataset.unb); }); drawBlock(); purge();
    $("mxAliasBtn").addEventListener("click", () => askAlias(false));
    $("mxAliasForm").addEventListener("submit", (e) => { e.preventDefault(); if (setAlias($("mxAliasIn").value)) $("mxAliasBox").hidden = true; });
    $("mxAliasBox").addEventListener("keydown", (e) => { if (e.key === "Escape" && MX.alias) $("mxAliasBox").hidden = true; });
    $("mxCmdForm").addEventListener("submit", (e) => { e.preventDefault(); const i = $("mxCmd"); runCmd(i.value); i.value = ""; });
    document.querySelectorAll("#mxDeck .mxt").forEach((t) => { const h = t.querySelector("h3"); if (!h) return; const b = document.createElement("button"); b.type = "button"; b.className = "cp"; b.textContent = "copy"; b.title = "Copy this tile's data as text";
      b.addEventListener("click", () => { let txt = (h.firstChild ? h.firstChild.textContent : "") + " (" + new Date().toISOString() + ", " + (MX.alias || "?") + ")\n"; const own = t.cloneNode(true); own.querySelectorAll("h3, canvas, button, input, select, label").forEach((e) => e.remove());
        txt += (t.id === "mxAlerts" ? MX.alerts.map((a) => hhmmss(a.t) + " " + a.text).join("\n") : t.querySelector("#mxTerm") ? tl.map((x) => x.txt).join("\n") : tileText(own));
        t.querySelectorAll("canvas").forEach((c) => { if (c.dataset.txt) txt += "\n" + c.dataset.txt; });
        const done = () => { b.textContent = "copied"; setTimeout(() => { b.textContent = "copy"; }, 1200); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done)); else fallbackCopy(txt, done); });
      h.appendChild(b); });
    $("mxOptLite").addEventListener("change", (e) => setLite(e.target.checked)); if (opt("lite", false)) setLite(true);
    apply(); splash(); requestAnimationFrame(trailTick);
    if (!MX.alias) { const w = setInterval(() => { if ($("mxSplash").style.display === "none") { clearInterval(w); askAlias(true); } }, 300); } else setTimeout(() => out("welcome back, " + MX.alias + ". type help.", "adv"), 500);
    setInterval(() => { try { pullRecs(); checkAlerts(); } catch (e) { /* keep going */ } }, 1000);
    setInterval(() => { try { draw(); } catch (e) { console.error(e); } }, 1500);
  });
})();
