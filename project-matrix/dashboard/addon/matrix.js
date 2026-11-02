/* ============================================================ PROJECT MATRIX add-on (display only). By: Aries Thorne, For: Matrix Comm. Systems.
   Reads S, S.found, MESH and the {"mx":...} line. It never sends anything to the radio. */
(function () {
  "use strict";
  const root = document.documentElement, MX = { d: null, hist: [], air: [], seenRec: new WeakSet(), alerts: [], lastHeard: Date.now(), cool: {}, nfSeen: new Set() };
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
    const g = cv.getContext("2d"); let cols = [], fs = 16, w = 0, h = 0, run = true, last = 0;
    function size() { const dpr = Math.min(window.devicePixelRatio || 1, 2); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); fs = opts.fs || 16;
      const n = Math.ceil(w / fs); cols = []; for (let i = 0; i < n; i++) cols.push({ y: -Math.random() * h / fs, v: 0.4 + Math.random() * 0.9 }); g.fillStyle = "#000"; g.fillRect(0, 0, w, h); }
    function frame(ts) { if (!run) return; requestAnimationFrame(frame); if (ts - last < 45) return; last = ts;
      if (cv.clientWidth !== w || cv.clientHeight !== h) size();
      g.fillStyle = "rgba(0,0,0," + (opts.fade || 0.09) + ")"; g.fillRect(0, 0, w, h); g.font = fs + "px monospace";
      for (let i = 0; i < cols.length; i++) { const c = cols[i], x = i * fs, y = c.y * fs;
        g.fillStyle = "#d8ffe4"; g.fillText(GL[(Math.random() * GL.length) | 0], x, y);
        g.fillStyle = "rgba(0,255,65,.85)"; g.fillText(GL[(Math.random() * GL.length) | 0], x, y - fs);
        c.y += c.v; if (y > h && Math.random() > 0.975) { c.y = -Math.random() * 10; c.v = 0.4 + Math.random() * 0.9; } } }
    size(); requestAnimationFrame(frame); return { stop() { run = false; }, start() { if (!run) { run = true; requestAnimationFrame(frame); } } };
  }
  let bg = null;
  function applyRain() {
    const on = $("mxOptRain").checked; root.classList.toggle("norain", !on); const cv = $("mxRainCv");
    if (on && !bg) { cv.id = "rainCv"; cv.style.display = ""; bg = rain(cv, { fs: 18, fade: 0.06 }); }
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
  function cv(id) { const c = $(id), dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth || 300, h = +c.getAttribute("height") || 100; if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; } const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.font = "11px monospace"; return { g, w, h }; }
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
  function pullRecs() { const rs = recsNow(); for (let i = Math.max(0, rs.length - 60); i < rs.length; i++) { const r = rs[i]; if (MX.seenRec.has(r)) continue; MX.seenRec.add(r); if (!r.tx) MX.lastHeard = Date.now();
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
      $("mxTalk").innerHTML = top.length ? top.map((k) => { const nm = meshNameFor(k); return '<div class="kv"><span>' + esc(nm || k.toUpperCase()) + '</span><b>' + by[k].n + " pkts &middot; " + Math.round(by[k].r / by[k].n) + ' dBm</b></div><div class="bar"><i style="width:' + Math.round(100 * by[k].n / mx) + '%"></i></div>'; }).join("") : '<div class="sub">nothing heard yet</div>'; }
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
    drawTerm();
  }
  const upfmt = (s) => { const dd = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (dd ? dd + "d " : "") + h + "h " + m + "m"; };

  /* ---------- rain trails on the map ---------- */
  let trail = null, tcols = new Map();
  function trailTick() {
    requestAnimationFrame(trailTick);
    if (!S.map || !$("mxOptTrail").checked) { if (trail) trail.style.display = "none"; return; }
    const mc = S.map.getContainer(); if (!trail || trail.parentNode !== mc) { trail = document.createElement("canvas"); trail.id = "mxMapRain"; mc.appendChild(trail); }
    trail.style.display = ""; const w = mc.clientWidth, h = mc.clientHeight; if (trail.width !== w || trail.height !== h) { trail.width = w; trail.height = h; }
    const g = trail.getContext("2d"); g.clearRect(0, 0, w, h); g.font = "13px monospace"; const now = Date.now();
    S.found && S.found.forEach((n, k) => { const la = n.alat != null ? n.alat : n.hlat, lo = n.alon != null ? n.alon : n.hlon; if (la == null) return; const p = S.map.latLngToContainerPoint([la, lo]); if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) return;
      const age = (now - n.last) / 1000, str = Math.max(0.25, 1 - age / 1800), col = n.t === 2 ? "0,255,65" : n.t === 1 ? "77,255,210" : "255,228,77"; let c = tcols.get(k); if (!c) { c = { ph: Math.random() * 100 }; tcols.set(k, c); }
      const len = 9; for (let i = 0; i < len; i++) { const ph = ((now / 90 + c.ph) % (len + 4)); const idx = (i - ph + len + 4) % (len + 4); const y = p.y + 10 + i * 13, a = Math.max(0, (1 - i / len)) * str * (idx < 2 ? 1 : 0.55); g.fillStyle = "rgba(" + col + "," + a.toFixed(2) + ")"; g.fillText(GL[(k.charCodeAt(i % k.length) + i + ((now / 400) | 0) * (i % 3)) % GL.length], p.x - 4, y); } });
  }

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
    apply(); splash(); requestAnimationFrame(trailTick);
    setInterval(() => { try { pullRecs(); checkAlerts(); } catch (e) { /* keep going */ } }, 1000);
    setInterval(() => { try { draw(); } catch (e) { console.error(e); } }, 1500);
  });
})();
