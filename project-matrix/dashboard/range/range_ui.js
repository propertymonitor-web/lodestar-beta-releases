/* ---------- RANGE TILE: the questions, the weather lookup and the drawing. Display only: nothing here talks to the radio. ---------- */
try {
  const RG_KEY = "mx-range-cfg", RG_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600], RG_STD = { k: 4 / 3, trap: false };
  const rg = { cfg: null, W: null, loc: null, zips: {}, busy: false, lastTry: 0, err: "", E: null, series: [], sig: "", wxNote: "" };
  const el = (id) => document.getElementById(id);
  const DEF = { loc: "", zip: "", cc: "us", lat: "", lon: "", auto: true, f: 910.525, sf: 7, bw: 62.5, tx: 22, h: 20, hu: "ft", g: 2, cl: 0, inn: "out", far: "roof", env: "suburban", m: 10, x: 0, gr: 2, nf: true };
  const rgLoad = () => { let c = {}; try { c = JSON.parse(localStorage.getItem(RG_KEY) || "{}") || {}; } catch (e) { c = {}; } return Object.assign({}, DEF, c); };
  const rgSave = () => { try { localStorage.setItem(RG_KEY, JSON.stringify(rg.cfg)); } catch (e) { /* not kept; fine */ } };
  const mi = (km) => km * 0.621371, ft2m = (v) => v * 0.3048;
  const kmTxt = (km) => (!Number.isFinite(km) ? "no limit" : km < 0.05 ? "under 50 m" : km < 10 ? km.toFixed(1) + " km" : Math.round(km) + " km");
  const both = (km) => (!Number.isFinite(km) ? "no limit" : km < 0.05 ? "under 50 m (160 ft)" : kmTxt(km) + " (" + (mi(km) < 10 ? mi(km).toFixed(1) : Math.round(mi(km))) + " mi)");
  const ENVH = { los: "Clear line of sight: open water, flat open land, or hilltop to hilltop.", open: "Open country: farmland with few trees or buildings.", suburban: "Suburban: houses and trees between you and the other radio.", urban: "Urban: dense buildings. Expect the shortest range." };
  const hh = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric" });

  async function rgGet(url, ms) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms || 12000);
    try { const r = await fetch(url, { signal: ac.signal, cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); }
  }

  /* ----- form <-> config ----- */
  function rgToForm() {
    const c = rg.cfg;
    el("mxrSf").innerHTML = [5, 6, 7, 8, 9, 10, 11, 12].map((s) => "<option>" + s + "</option>").join("");
    el("mxrZip").value = c.zip; el("mxrCc").value = c.cc; el("mxrLat").value = c.lat; el("mxrLon").value = c.lon; el("mxrAuto").checked = !!c.auto;
    el("mxrF").value = c.f; el("mxrSf").value = String(c.sf); el("mxrBw").value = String(c.bw); el("mxrTx").value = c.tx; el("mxrH").value = c.h; el("mxrHu").value = c.hu;
    el("mxrG").value = c.g; el("mxrCl").value = c.cl; el("mxrIn").value = c.inn; el("mxrFar").value = c.far; el("mxrEnv").value = c.env; el("mxrM").value = c.m; el("mxrX").value = c.x; el("mxrGr").value = c.gr; el("mxrNf").checked = !!c.nf;
    const first = c.loc || (hasGps() ? "gps" : c.zip ? "zip" : c.lat ? "ll" : "zip");
    document.querySelectorAll('input[name="mxrLoc"]').forEach((r) => { r.checked = r.value === first; });
    rg.locAuto = !c.loc; c.loc = first;
  }
  function rgFromForm() {
    const c = rg.cfg, v = (id) => el(id).value, n = (id) => parseFloat(el(id).value);
    const loc = document.querySelector('input[name="mxrLoc"]:checked'); c.loc = loc ? loc.value : "";
    c.zip = v("mxrZip").trim(); c.cc = (v("mxrCc").trim().toLowerCase() || "us"); c.lat = v("mxrLat").trim(); c.lon = v("mxrLon").trim(); c.auto = el("mxrAuto").checked;
    c.f = n("mxrF"); c.sf = parseInt(v("mxrSf"), 10); c.bw = parseFloat(v("mxrBw")); c.tx = n("mxrTx"); c.h = n("mxrH"); c.hu = v("mxrHu"); c.g = n("mxrG"); c.cl = n("mxrCl");
    c.inn = v("mxrIn"); c.far = v("mxrFar"); c.env = v("mxrEnv"); c.m = n("mxrM"); c.x = n("mxrX"); c.gr = n("mxrGr"); c.nf = el("mxrNf").checked;
  }
  const hasGps = () => !!(S.frame && S.frame.gps && S.frame.gps.fix && Number.isFinite(+S.frame.gps.lat) && Number.isFinite(+S.frame.gps.lon) && (+S.frame.gps.lat || +S.frame.gps.lon));

  // the radio's own settings, when it reports them (Matrix firmware does)
  function rgRadio() { const d = MX.d; return d && d.sfac && d.bw && d.fq ? { f: +d.fq, sf: +d.sfac, bw: +d.bw, tx: Number.isFinite(+d.txp) ? +d.txp : null, nf: Number.isFinite(+d.nf) && +d.nf !== 0 ? +d.nf : null } : null; }
  function rgSyncAuto() {
    const r = rgRadio(), on = rg.cfg.auto && !!r, ids = ["mxrF", "mxrSf", "mxrBw", "mxrTx"];
    ids.forEach((id) => { el(id).disabled = on; });
    if (on) {
      el("mxrF").value = r.f; el("mxrSf").value = String(r.sf);
      const opts = Array.from(el("mxrBw").options).map((o) => o.value), want = opts.find((o) => Math.abs(parseFloat(o) - r.bw) < 0.05); if (want) el("mxrBw").value = want;
      if (r.tx != null) el("mxrTx").value = r.tx;
    }
    return on ? r : null;
  }

  /* ----- where ----- */
  async function rgZip(cc, zip) {
    const key = cc + ":" + zip.replace(/\s+/g, "").toUpperCase();
    if (rg.zips[key]) return rg.zips[key];
    try { const s = JSON.parse(localStorage.getItem("mx-range-zips") || "{}"); if (s[key]) return (rg.zips[key] = s[key]); } catch (e) { /* none */ }
    let hit = null;
    try { const j = await rgGet("https://api.zippopotam.us/" + encodeURIComponent(cc) + "/" + encodeURIComponent(zip.split("-")[0].trim()), 9000), p = j.places && j.places[0]; if (p) hit = { lat: +p.latitude, lon: +p.longitude, name: p["place name"] + (p["state abbreviation"] ? ", " + p["state abbreviation"] : "") }; } catch (e) { /* try the next one */ }
    if (!hit) { try { const a = await rgGet("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&postalcode=" + encodeURIComponent(zip) + "&countrycodes=" + encodeURIComponent(cc), 9000); if (a && a[0]) hit = { lat: +a[0].lat, lon: +a[0].lon, name: (a[0].display_name || "").split(",").slice(0, 2).join(",").trim() }; } catch (e) { /* none */ } }
    if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) throw new Error("ZIP lookup failed");
    rg.zips[key] = hit; try { const s = JSON.parse(localStorage.getItem("mx-range-zips") || "{}"); s[key] = hit; localStorage.setItem("mx-range-zips", JSON.stringify(s)); } catch (e) { /* none */ }
    return hit;
  }
  function rgWhere() {      // returns {lat, lon, src} from what is known right now, or null
    const c = rg.cfg, g = hasGps() ? { lat: +S.frame.gps.lat, lon: +S.frame.gps.lon, src: "radio GPS" } : null;
    const ll = Number.isFinite(parseFloat(c.lat)) && Number.isFinite(parseFloat(c.lon)) && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180 ? { lat: parseFloat(c.lat), lon: parseFloat(c.lon), src: "typed coordinates" } : null;
    const key = c.cc + ":" + c.zip.replace(/\s+/g, "").toUpperCase(), z = c.zip && rg.zips[key] ? { lat: rg.zips[key].lat, lon: rg.zips[key].lon, src: "ZIP " + c.zip + (rg.zips[key].name ? " (" + rg.zips[key].name + ")" : "") } : null;
    const order = c.loc === "gps" ? [g, z, ll] : c.loc === "ll" ? [ll, z, g] : [z, ll, g];
    return order.find((x) => x) || null;
  }

  /* ----- weather ----- */
  async function rgFetch(force) {
    const where = rgWhere(); if (!where) { rg.err = ""; return; }
    const now = Date.now(), key = where.lat.toFixed(1) + "," + where.lon.toFixed(1);
    if (rg.busy) return;
    if (!force && rg.W && rg.W.key === key && now - rg.W.at < 20 * 60000) return;
    if (!force && now - rg.lastTry < 60000) return;
    rg.busy = true; rg.lastTry = now; rg.err = ""; paintNet("Getting the weather...");
    const la = where.lat.toFixed(2), lo = where.lon.toFixed(2), base = "https://api.open-meteo.com/v1/forecast?latitude=" + la + "&longitude=" + lo + "&forecast_days=2&timezone=UTC";
    const up = RG_LEVELS.map((l) => "temperature_" + l + "hPa,relative_humidity_" + l + "hPa,geopotential_height_" + l + "hPa").join(",");
    try {
      const [a, b] = await Promise.allSettled([rgGet(base + "&current=temperature_2m,relative_humidity_2m,surface_pressure&hourly=temperature_2m,relative_humidity_2m,surface_pressure"), rgGet(base + "&hourly=" + up)]);
      if (a.status !== "fulfilled" || !a.value || !a.value.hourly) throw new Error(a.status === "rejected" ? a.reason.message : "no weather data");
      const A = a.value, B = b.status === "fulfilled" && b.value && b.value.hourly ? b.value : null, t0 = Date.parse(A.hourly.time[0] + "Z");
      rg.W = { key, at: Date.now(), where, elev: A.elevation, cur: A.current || null, A, B, t0, upper: false };
      rg.wxNote = B ? "" : "Upper-air data was not available, so the standard atmosphere is assumed.";
    } catch (e) { rg.err = e && e.name === "AbortError" ? "timed out" : (e && e.message) || "failed"; }
    rg.busy = false; paintNet(); rgRender(true);
  }
  function wxAt(i) {        // surface + upper levels for hour index i of the loaded forecast
    const W = rg.W; if (!W) return null; const A = W.A.hourly, B = W.B && W.B.hourly, useCur = i === W.nowIdx && W.cur;
    const sfc = { h: +W.elev, t: useCur ? +W.cur.temperature_2m : +A.temperature_2m[i], rh: useCur ? +W.cur.relative_humidity_2m : +A.relative_humidity_2m[i], p: useCur ? +W.cur.surface_pressure : +A.surface_pressure[i] };
    const lv = B ? RG_LEVELS.map((L) => ({ p: L, t: +(B["temperature_" + L + "hPa"] || [])[i], rh: +(B["relative_humidity_" + L + "hPa"] || [])[i], h: +(B["geopotential_height_" + L + "hPa"] || [])[i] })) : [];
    return { sfc, lv };
  }
  function atmAt(i) { const w = wxAt(i); if (!w) return null; const g = RM.gradient(w.sfc, w.lv); return g ? { g, sfc: w.sfc, k: g.k, trap: g.trap } : { g: null, sfc: w.sfc, k: RG_STD.k, trap: false }; }

  /* ----- the estimate ----- */
  function rgInputs() {
    const c = rg.cfg, r = rgSyncAuto(), num = (v) => (Number.isFinite(v) ? v : NaN), bad = [];
    const hM = c.hu === "ft" ? ft2m(c.h) : c.h, far = RM.FAR[c.far] || RM.FAR.roof;
    const i = { f: r ? r.f : num(c.f), sf: r ? r.sf : c.sf, bw: r ? r.bw : c.bw, txp: r && r.tx != null ? r.tx : num(c.tx), nf: c.nf && r ? r.nf : (c.nf && rgRadio() ? rgRadio().nf : null), gTx: num(c.g), cTx: num(c.cl), gRx: num(c.gr), cRx: 0, h1: hM, h2: far.h, env: c.env, indoor: c.inn, extra: num(c.x), margin: num(c.m) };
    [["f", "frequency"], ["txp", "TX power"], ["gTx", "antenna gain"], ["cTx", "cable loss"], ["gRx", "far antenna gain"], ["h1", "antenna height"], ["extra", "extra blockage"], ["margin", "safety margin"]].forEach(([k, n]) => { if (!Number.isFinite(i[k])) bad.push(n); });
    if (Number.isFinite(i.f) && (i.f < 150 || i.f > 2500)) bad.push("frequency (150 to 2500 MHz)");
    if (Number.isFinite(i.h1) && i.h1 < 0.5) bad.push("antenna height (at least 1.6 ft / 0.5 m)");
    if (!(i.sf >= 5 && i.sf <= 12) || !(i.bw > 0)) bad.push("spreading factor or bandwidth");
    return { i, bad, farLabel: far.label, auto: !!r };
  }
  function rgCompute() {
    const { i, bad, farLabel, auto } = rgInputs(); if (bad.length) return { bad };
    const W = rg.W; if (W) { W.nowIdx = Math.max(0, Math.min(W.A.hourly.time.length - 1, Math.floor((Date.now() - W.t0) / 3600000))); }
    const now = atmAt(W ? W.nowIdx : -1), atm = now ? { k: now.k, trap: now.trap } : RG_STD, E = RM.estimate(i, atm);
    const series = [];
    if (W) for (let j = W.nowIdx; j < Math.min(W.nowIdx + 24, W.A.hourly.time.length); j++) { const a = atmAt(j); if (!a) continue; const e = RM.estimate(i, { k: a.k, trap: a.trap }); series.push({ t: W.t0 + j * 3600000, range: e.rangeKm, k: a.k, trap: a.trap, limit: e.limit }); }
    return { i, E, now, series, farLabel, auto, hasUpper: !!(now && now.g) };
  }

  /* ----- paint ----- */
  function paintNet(msg) {
    const n = el("mxrNet"); if (!n) return;
    if (msg) { n.textContent = msg; n.className = "mxr-dim"; return; }
    const W = rg.W;
    if (rg.err) { n.className = "mxr-dim bad"; n.textContent = "Could not get the weather (" + rg.err + "). Using the standard atmosphere" + (W ? " and the last data from " + new Date(W.at).toLocaleTimeString() : "") + "."; return; }
    n.className = "mxr-dim"; n.textContent = W ? "Weather for " + W.where.src + ", updated " + new Date(W.at).toLocaleTimeString() + ". It refreshes about every 20 minutes." : rgWhere() ? "Weather not loaded yet." : "Add a location above to use today's weather. Without it the standard atmosphere is assumed.";
  }
  function farthest(me) {
    try { if (!me || !S.found) return null; let best = null, bd = 0; S.found.forEach((n) => { if (n.alat == null || n.alon == null) return; const m = meters([me.lat, me.lon], [n.alat, n.alon]); if (m > bd) { bd = m; best = n; } }); return best ? { km: bd / 1000, name: best.n || (best.k || "").slice(0, 8) } : null; } catch (e) { return null; }
  }
  function drawPl(R) {
    const c = cv("mxrCvPl"), g = c.g, w = c.w, h = c.h, E = R.E, i = R.i; if (!g || !w) return;
    const xmax = Math.max(2, Math.min(1000, Math.max(E.rangeKm, E.budgetKm) * 3)), x0 = Math.log10(0.1), x1 = Math.log10(xmax), L = 36, T = 6, B = 20, Rm = 8;
    const X = (d) => L + (w - L - Rm) * (Math.log10(Math.max(d, 0.1)) - x0) / (x1 - x0);
    const lo = 60, hi = Math.max(E.allow + 25, RM.pathLoss(i.f, i.h1, i.h2, xmax, i.env) + 5), Y = (v) => T + (h - T - B) * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo));
    g.font = "11px monospace"; g.strokeStyle = "#08301a"; g.fillStyle = "#3fae62"; g.lineWidth = 1;
    for (let k = -1; k <= Math.ceil(x1); k++) { const d = Math.pow(10, k); if (d < 0.1 || d > xmax) continue; g.beginPath(); g.moveTo(X(d), T); g.lineTo(X(d), h - B); g.stroke(); g.fillText(d >= 1 ? d + " km" : d * 1000 + " m", Math.min(X(d) + 2, w - 40), h - 6); }
    for (let v = Math.ceil(lo / 20) * 20; v < hi; v += 20) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(w - Rm, Y(v)); g.stroke(); g.fillText(v + "", 2, Y(v) + 4); }
    g.strokeStyle = G; g.lineWidth = 2; g.beginPath(); for (let s = 0; s <= 90; s++) { const d = Math.pow(10, x0 + (x1 - x0) * s / 90), y = Y(RM.pathLoss(i.f, i.h1, i.h2, d, i.env)); if (s) g.lineTo(X(d), y); else g.moveTo(X(d), y); } g.stroke();
    g.strokeStyle = Y_; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(L, Y(E.allow)); g.lineTo(w - Rm, Y(E.allow)); g.stroke(); g.setLineDash([]);
    g.fillStyle = Y_; g.fillText("most loss this link can take: " + E.allow.toFixed(0) + " dB", L + 4, Math.max(T + 10, Y(E.allow) - 4));
    if (E.rangeKm > 0.1) { g.strokeStyle = C_; g.beginPath(); g.moveTo(X(E.rangeKm), T); g.lineTo(X(E.rangeKm), h - B); g.stroke(); g.fillStyle = C_; g.fillText(kmTxt(E.rangeKm), Math.min(X(E.rangeKm) + 3, w - 50), T + 20); }
    if (Number.isFinite(E.hz) && E.hz < xmax) { g.strokeStyle = "#7a7a7a"; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(E.hz), T); g.lineTo(X(E.hz), h - B); g.stroke(); g.setLineDash([]); g.fillStyle = "#9a9a9a"; g.fillText("horizon", Math.min(X(E.hz) + 3, w - 50), T + 32); }
  }
  const Y_ = "#ffe44d", C_ = "#4dffd2";
  function draw24(R) {
    const c = cv("mxrCv24"), g = c.g, w = c.w, h = c.h, s = R.series; if (!g || !w) return;
    const sub = el("mxrSub24");
    if (!s.length) { g.fillStyle = "#3fae62"; g.font = "12px monospace"; g.fillText(rg.W ? "no forecast hours" : "needs a location and an internet connection", 8, h / 2); sub.textContent = ""; return; }
    const mx = Math.max(0.5, Math.max.apply(null, s.map((p) => (Number.isFinite(p.range) ? p.range : 0)))) * 1.15, L = 36, B = 18, bw = (w - L - 4) / s.length;
    g.font = "11px monospace"; g.strokeStyle = "#08301a"; g.fillStyle = "#3fae62"; g.lineWidth = 1;
    g.fillText("km", L + 4, 12);
    [0, 0.5, 1].forEach((f) => { const y = 4 + (h - B - 4) * (1 - f); g.beginPath(); g.moveTo(L, y); g.lineTo(w, y); g.stroke(); g.fillText((mx * f < 10 ? (mx * f).toFixed(1) : Math.round(mx * f)) + "", 2, y + 4); });
    s.forEach((p, k) => { const v = Number.isFinite(p.range) ? p.range : mx, bh = (h - B - 4) * Math.min(1, v / mx), x = L + k * bw; g.fillStyle = p.trap ? C_ : G; g.globalAlpha = k === 0 ? 1 : 0.65; g.fillRect(x + 1, h - B - bh, Math.max(1, bw - 2), bh); g.globalAlpha = 1; if (k % 6 === 0) { g.fillStyle = "#3fae62"; g.fillText(hh(p.t), x, h - 5); } });
    const vals = s.map((p) => p.range).filter(Number.isFinite), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), tr = s.filter((p) => p.trap).length;
    sub.textContent = (hi - lo < 0.05 * Math.max(hi, 0.01) ? "Flat: the link budget sets the limit, so weather barely changes it. " : "Between " + kmTxt(lo) + " and " + kmTxt(hi) + " over the next 24 hours. ") + (tr ? tr + " hour" + (tr > 1 ? "s" : "") + " with possible ducting (cyan)." : "") + (R.hasUpper ? "" : " Standard atmosphere assumed: no upper-air data.");
    el("mxrCv24").dataset.txt = "next 24 h (km): " + s.map((p) => hh(p.t) + "=" + (Number.isFinite(p.range) ? p.range.toFixed(1) : "no limit")).join(", ");
  }
  function rgRender(force) {
    const out = el("mxrBig"); if (!out) return;
    const sel = window.getSelection && window.getSelection(); if (!force && sel && !sel.isCollapsed && el("mxRange").contains(sel.anchorNode)) return;
    const R = rgCompute(); rg.E = R;
    if (R.bad) { out.textContent = "--"; el("mxrSub").textContent = "Check: " + R.bad.join(", "); el("mxrBand").innerHTML = ""; el("mxrWx").textContent = ""; return; }
    const E = R.E, i = R.i, where = rgWhere(), N = R.now, s = N && N.sfc;
    out.textContent = "about " + both(E.rangeKm);
    el("mxrSub").textContent = (E.limit === "horizon" ? "Held back by the radio horizon: the antennas cannot see each other farther out. " : "Held back by signal strength: the signal gets too weak before the horizon. ") + "Estimated from here to " + R.farLabel + ".";
    el("mxrBand").innerHTML = "<span>best case <b>" + esc(kmTxt(E.bestKm)) + "</b></span><span>cautious <b>" + esc(kmTxt(E.cautiousKm)) + "</b></span><span>radio horizon <b>" + esc(kmTxt(E.hz)) + "</b></span>";
    // what the weather is doing to it
    let wx = "";
    if (!N) wx = "<span class='warn'>Using the standard atmosphere" + (rg.W ? " (upper-air data was not usable)" : "") + ". Add a location and go online to use today's weather.</span>";
    else if (E.trap) wx = "<span class='hot'>Layers in the air today may trap radio waves (ducting). Contacts well beyond the usual range can happen, but they come and go. Do not count on them.</span>";
    else if (E.limit === "horizon" && Math.abs(E.rangeKm / E.stdKm - 1) > 0.01) wx = "Today's air bends radio waves " + (E.k > 4 / 3 ? "<span class='hot'>more</span>" : "<span class='warn'>less</span>") + " than usual, so the radio horizon is about " + Math.abs(Math.round((E.rangeKm / E.stdKm - 1) * 100)) + "% " + (E.k > 4 / 3 ? "longer" : "shorter") + " than normal (normal air: " + both(E.stdKm) + ").";
    else wx = "Signal strength, not the horizon, sets the limit right now, so today's weather changes the answer very little. At this frequency rain and humidity barely absorb the signal.";
    el("mxrWx").innerHTML = wx + (rg.wxNote ? " <span class='warn'>" + esc(rg.wxNote) + "</span>" : "");
    kvset("mxrAtm", N && s ? [["temperature", fmt(s.t, 1) + " °C (" + fmt(s.t * 9 / 5 + 32, 0) + " °F)"], ["humidity", fmt(s.rh, 0) + " %"], ["pressure at the ground", fmt(s.p, 0) + " hPa"], ["ground height above sea level", fmt(s.h, 0) + " m (" + fmt(s.h * 3.28084, 0) + " ft)"], ["air bending (k factor)", E.k === Infinity ? "trapping" : fmt(E.k, 2) + (R.hasUpper ? "" : " (standard)")], ["standard air", "1.33"], ["lowest 1 km gradient", N.g ? fmt(N.g.dN, 0) + " N/km (standard -40)" : "not available"], ["possible ducting", N.g ? (N.trap ? "yes, in a layer aloft" : "no") : "unknown"]] : [["weather", rg.err ? "could not load" : "not loaded"], ["air bending (k factor)", "1.33 (standard)"]]);
    const gps = where && where.src === "radio GPS" ? where : null, fh = farthest(where), S_ = E.sens;
    kvset("mxrBud", [["radio power sent out (EIRP)", fmt(E.eirp, 1) + " dBm"], ["far antenna gain", fmt(i.gRx, 1) + " dBi"], ["quietest signal it can hear", fmt(S_.sens, 1) + " dBm" + (S_.src === "measured" ? " (counting measured noise " + fmt(S_.floor, 0) + ")" : " (theory)")], ["most loss without a margin", fmt(E.plMax, 1) + " dB"], ["safety margin", "-" + fmt(i.margin, 0) + " dB"], ["indoors and blockage", "-" + fmt(E.indoor + E.extra, 0) + " dB"], ["most loss this link can take", fmt(E.allow, 1) + " dB"], ["loss model", i.env === "los" ? "free space, then ground bounce" : "Okumura-Hata, " + i.env], ["range from signal strength alone", both(E.budgetKm)], ["radio horizon", both(E.hz)], ["farthest node heard so far", fh ? both(fh.km) + " " + (fh.name || "") : "--"]]);
    drawPl(R); draw24(R);
    el("mxrEnvHelp").textContent = ENVH[rg.cfg.env] || "";
    el("mxrGpsNote").textContent = hasGps() ? "(has a fix)" : "(no fix yet)";
    el("mxrLocNote").textContent = where ? "Using " + where.src + (gps ? "" : "") + "." : "Nothing to use yet. Pick one and fill it in.";
    paintNet();
  }

  /* ----- wiring ----- */
  rg.cfg = rgLoad(); rgToForm();
  el("mxrFoot").innerHTML = "Weather data by <a href='https://open-meteo.com/' target='_blank' rel='noopener'>Open-Meteo.com</a> (CC BY 4.0). ZIP codes are looked up with zippopotam.us, then OpenStreetMap Nominatim if that fails. When the weather is fetched, this page sends your location rounded to about 1 km to Open-Meteo, and a typed ZIP to the lookup service. Nothing is sent to your radio, and nothing about your radio is sent anywhere. " +
    "How it works: the radio's transmit power and antennas, minus the quietest signal it can hear (from the spreading factor and bandwidth), give the most path loss the link can take. A textbook model (free space with ground bounce, or Okumura-Hata for suburbs and cities) turns that into a distance, and it is capped by the radio horizon, which the weather stretches or shrinks through the air's refractivity (ITU-R P.453). It does not know about hills, buildings, trees or your exact antenna. Hata is used below its usual antenna heights on purpose, so treat the numbers as a rough guide.";
  const onChange = () => { rgFromForm(); rgSave(); rgRender(true); };
  document.querySelectorAll("#mxRange input, #mxRange select").forEach((x) => { x.addEventListener("input", onChange); x.addEventListener("change", onChange); });
  let zt = 0;
  async function zipGo() {
    const c = rg.cfg; if (c.loc !== "zip" || !c.zip) return;
    try { el("mxrLocNote").textContent = "Looking up " + c.zip + "..."; await rgZip(c.cc, c.zip); rg.err = ""; } catch (e) { rg.err = "ZIP lookup failed. Check the ZIP and country, or enter latitude and longitude instead."; paintNet(); rgRender(true); return; }
    rgFetch(true);
  }
  ["mxrZip", "mxrCc"].forEach((id) => { el(id).addEventListener("input", () => { clearTimeout(zt); zt = setTimeout(zipGo, 900); }); el(id).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(zt); zipGo(); } }); });
  ["mxrLat", "mxrLon"].forEach((id) => el(id).addEventListener("change", () => { if (rg.cfg.loc === "ll") rgFetch(true); }));
  document.querySelectorAll('input[name="mxrLoc"]').forEach((r) => r.addEventListener("change", async () => { rg.locAuto = false; rgFromForm(); if (rg.cfg.loc === "zip") await zipGo(); else rgFetch(true); }));
  el("mxrGo").addEventListener("click", async () => { rgFromForm(); if (rg.cfg.loc === "zip" && rg.cfg.zip) { await zipGo(); } else rgFetch(true); });
  el("mxrReset").addEventListener("click", () => { rg.cfg = Object.assign({}, DEF); rg.W = null; rg.err = ""; rgSave(); rgToForm(); rgRender(true); });
  // keep going on its own: recompute as the radio reports, fetch the weather when there is somewhere to fetch it for
  setInterval(() => { try { if (document.hidden) return; if (rg.locAuto && hasGps()) { rg.locAuto = false; rg.cfg.loc = "gps"; document.querySelectorAll('input[name="mxrLoc"]').forEach((r) => { r.checked = r.value === "gps"; }); rgSave(); rgFetch(true); } rgRender(false); if (rgWhere() && (!rg.W || Date.now() - rg.W.at > 20 * 60000 || rg.W.key !== rgWhere().lat.toFixed(1) + "," + rgWhere().lon.toFixed(1))) rgFetch(false); } catch (e) { console.error(e); } }, 1500);
  setTimeout(() => { if (rg.cfg.loc === "zip" && rg.cfg.zip) zipGo(); else rgRender(true); }, 600);
} catch (e) { console.error("range tile failed to start", e); }
