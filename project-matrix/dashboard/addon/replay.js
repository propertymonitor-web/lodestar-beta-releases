/* ============================================================ TRACE REPLAY (dashboard 1.1.0)
   Full-screen replay of the last recorded trip: the map starts close up on the first point and the marker retraces the route,
   waiting where the radio stood still and showing how long. Repeaters, companions and room servers appear when they were first
   heard and can be hovered for their name and radio ID. Display only: it reads S.route and S.found and changes nothing. */
(() => {
  "use strict";
  const STOP_MS = 30000;                                   // a gap this long between two recorded points counts as a stop
  const RP = { ov: null, map: null, pts: [], tt: [], stops: [], nodes: [], clock: 0, t0: 0, t1: 0, playing: false, speed: 10, zoom: 17, last: 0, raf: 0, drawn: 0, free: false, seeking: false,
    trail: null, tail: null, me: null, shownN: new Set(), shownS: new Set(), opener: null, skip: false };
  const $r = (id) => document.getElementById(id);
  const fmt = (ms) => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(x).padStart(2, "0"); };
  const dur = (ms) => { const s = Math.round(ms / 1000); if (s < 60) return s + " s"; const m = Math.floor(s / 60); return m < 60 ? m + " min " + (s % 60) + " s" : Math.floor(m / 60) + " h " + (m % 60) + " min"; };
  const note = (t) => { const n = $r("mapNote"); if (n) { n.hidden = false; n.textContent = t; } };

  function prep() {
    const R = (S.route || []).filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]));
    if (R.length < 2) return false;
    RP.pts = R.map((p) => [p[0], p[1]]);
    let prev = isFinite(R[0][2]) ? R[0][2] * 1000 : Date.now() - R.length * 1000;
    RP.tt = R.map((p, i) => { let t = isFinite(p[2]) ? p[2] * 1000 : prev + 1000; if (t < prev) t = prev; prev = t; return t; });
    RP.t0 = RP.tt[0]; RP.t1 = RP.tt[RP.tt.length - 1]; if (RP.t1 <= RP.t0) RP.t1 = RP.t0 + 1000;
    RP.stops = [];
    for (let i = 0; i < RP.tt.length - 1; i++) { const gap = RP.tt[i + 1] - RP.tt[i]; if (gap >= STOP_MS) RP.stops.push({ a: RP.tt[i], b: RP.tt[i + 1], pos: RP.pts[i] }); }
    RP.nodes = [];
    S.found.forEach((n) => {
      if (n.t !== 1 && n.t !== 2 && n.t !== 3) return; const pos = nodePos(n); if (!pos) return;
      if (n.first && n.first > RP.t1 + 60000) return;                // first heard after this trip ended
      RP.nodes.push({ n, pos, at: n.first && n.first > RP.t0 ? n.first : RP.t0 });
    });
    return true;
  }
  function posAt(T) {
    const tt = RP.tt, n = tt.length; if (T <= tt[0]) return { p: RP.pts[0], i: 0 }; if (T >= tt[n - 1]) return { p: RP.pts[n - 1], i: n - 1 };
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tt[m] <= T) lo = m; else hi = m; }
    const a = RP.pts[lo], b = RP.pts[lo + 1], gap = tt[lo + 1] - tt[lo]; let f;
    if (gap >= STOP_MS) { const m0 = tt[lo + 1] - 2000; f = T < m0 ? 0 : (T - m0) / 2000; } else f = (T - tt[lo]) / gap;   // stand still through a stop, then move
    return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], i: lo };
  }
  function stopAt(T) { for (const s of RP.stops) if (T >= s.a && T < s.b) return s; return null; }

  function nodeMarker(o) {
    const n = o.n; let m;
    if (n.t === 2) m = L.circleMarker(o.pos, { radius: 7, color: "#ffffff", weight: 2, fillColor: "#1a9e63", fillOpacity: 1 });
    else if (n.t === 1) m = L.marker(o.pos, { icon: L.divIcon({ className: "nodeSq", iconSize: [14, 14] }), keyboard: false });
    else m = L.circleMarker(o.pos, { radius: 7, color: "#ffffff", weight: 2, fillColor: "#8b3fb8", fillOpacity: 1 });
    m.bindTooltip("<b>" + esc(nodeLabel(n)) + "</b><br>" + esc(TYPE_NAME[n.t] || "node") + "<br>Radio ID: " + esc(n.k), { direction: "top", className: "rpTip" });
    return m;
  }
  function tiles(map) {
    try { if (S.offUse && S.offLayer && window.protomapsL) { protomapsL.leafletLayer(Object.assign({}, S.offLayer.options || {})).addTo(map); return; } } catch (e) { /* use the online map below */ }
    const spec = S.tileSpec || { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", opt: { subdomains: "abcd", maxZoom: 19, attribution: "&copy; OpenStreetMap contributors &copy; CARTO" } };
    L.tileLayer(spec.url, spec.opt).addTo(map);
  }

  function setClock(T, seeking) {
    RP.clock = Math.max(RP.t0, Math.min(RP.t1, T));
    const { p, i } = posAt(RP.clock);
    RP.me.setLatLng(p);
    if (seeking || i + 1 < RP.drawn) { RP.trail.setLatLngs(RP.pts.slice(0, i + 1)); RP.drawn = i + 1; }
    else { for (; RP.drawn <= i; RP.drawn++) RP.trail.addLatLng(RP.pts[RP.drawn]); }
    RP.tail.setLatLngs([RP.pts[i], p]);
    RP.nodes.forEach((o) => {
      const on = o.at <= RP.clock;
      if (on && !o.mk) { o.mk = nodeMarker(o).addTo(RP.map); } else if (!on && o.mk) { RP.map.removeLayer(o.mk); o.mk = null; }
    });
    RP.stops.forEach((s) => {
      const on = s.a <= RP.clock;
      if (on && !s.mk) { s.mk = L.circleMarker(s.pos, { radius: 9, color: "#c26a00", weight: 3, fillColor: "#ffb000", fillOpacity: 0.7 }).bindTooltip("Stopped " + dur(s.b - s.a), { direction: "top", className: "rpTip" }).addTo(RP.map); }
      else if (!on && s.mk) { RP.map.removeLayer(s.mk); s.mk = null; }
    });
    const st = stopAt(RP.clock), badge = $r("rpStop");
    if (st) { badge.hidden = false; badge.textContent = "Stopped " + fmt(RP.clock - st.a) + " of " + fmt(st.b - st.a); } else badge.hidden = true;
    $r("rpTime").textContent = fmt(RP.clock - RP.t0) + " / " + fmt(RP.t1 - RP.t0);
    if (!RP.seeking) $r("rpScrub").value = String(Math.round((RP.clock - RP.t0) / (RP.t1 - RP.t0) * 1000));
    if (!RP.free) RP.map.setView(p, RP.zoom, { animate: false });
  }
  function loop(now) {
    RP.raf = 0; if (!RP.ov || RP.ov.hidden) return;
    const dt = Math.min(250, now - RP.last); RP.last = now;
    if (RP.playing) {
      const inStop = !!stopAt(RP.clock), k = RP.speed * (RP.skip && inStop ? 25 : 1);
      setClock(RP.clock + dt * k, false);
      if (RP.clock >= RP.t1) { setPlaying(false); $r("rpPlay").textContent = "Replay"; }
    }
    RP.raf = requestAnimationFrame(loop);
  }
  function setPlaying(on) { RP.playing = on; $r("rpPlay").textContent = on ? "Pause" : (RP.clock >= RP.t1 ? "Replay" : "Play"); }

  function build() {
    if (RP.ov) return;
    const ov = document.createElement("div"); ov.id = "rpOv"; ov.hidden = true; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Trace replay");
    ov.innerHTML = '<div id="rpMap"></div><div id="rpStop" hidden></div>' +
      '<div id="rpBar"><div class="rpRow"><button type="button" id="rpPlay">Play</button><button type="button" id="rpRestart">Restart</button>' +
      '<label>Speed <select id="rpSpeed"><option value="1">1x</option><option value="2">2x</option><option value="5">5x</option><option value="10" selected>10x</option><option value="30">30x</option><option value="60">60x</option><option value="120">120x</option></select></label>' +
      '<label>Zoom <input type="range" id="rpZoom" min="8" max="19" value="17" aria-label="Zoom level"></label>' +
      '<label><input type="checkbox" id="rpSkip"> Hurry through stops</label>' +
      '<button type="button" id="rpCenter" hidden>Re-center</button><span id="rpTime" aria-live="off"></span><button type="button" id="rpClose">Close</button></div>' +
      '<input type="range" id="rpScrub" min="0" max="1000" value="0" aria-label="Position in the trace">' +
      '<div class="rpKey"><span class="sw sw-you"></span> you &nbsp; <span class="sw sw-rep"></span> repeater &nbsp; <span class="sw sw-comp"></span> companion &nbsp; <span class="rpRm"></span> room server &nbsp; <span class="rpStopSw"></span> stop &nbsp; Hover a node for its name and radio ID.</div></div>';
    document.body.appendChild(ov); RP.ov = ov;
    $r("rpPlay").addEventListener("click", () => { if (RP.clock >= RP.t1) setClock(RP.t0, true); setPlaying(!RP.playing); });
    $r("rpRestart").addEventListener("click", () => { RP.free = false; $r("rpCenter").hidden = true; setClock(RP.t0, true); setPlaying(true); });
    $r("rpSpeed").addEventListener("change", (e) => { RP.speed = +e.target.value || 10; });
    $r("rpSkip").addEventListener("change", (e) => { RP.skip = e.target.checked; });
    $r("rpZoom").addEventListener("input", (e) => { RP.zoom = +e.target.value; RP.map.setZoom(RP.zoom, { animate: false }); if (!RP.free) RP.map.setView(posAt(RP.clock).p, RP.zoom, { animate: false }); });
    $r("rpCenter").addEventListener("click", () => { RP.free = false; $r("rpCenter").hidden = true; RP.map.setView(posAt(RP.clock).p, RP.zoom, { animate: false }); });
    const sc = $r("rpScrub");
    sc.addEventListener("pointerdown", () => { RP.seeking = true; });
    sc.addEventListener("input", () => { RP.seeking = true; setClock(RP.t0 + (RP.t1 - RP.t0) * (+sc.value / 1000), true); });
    sc.addEventListener("change", () => { RP.seeking = false; });
    sc.addEventListener("pointerup", () => { RP.seeking = false; });
    $r("rpClose").addEventListener("click", close);
    ov.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); else if (e.key === " " && e.target === ov) { e.preventDefault(); $r("rpPlay").click(); } });
  }
  function open() {
    if (!window.L) { note("The map library did not load, so the replay cannot start."); return; }
    if (!prep()) { note("Nothing to replay yet: drive or walk a little with the radio so a route is recorded."); return; }
    build(); RP.opener = document.activeElement; RP.ov.hidden = false; document.body.style.overflow = "hidden";
    if (RP.map) { RP.map.remove(); RP.map = null; }
    RP.nodes.forEach((o) => { o.mk = null; }); RP.stops.forEach((s) => { s.mk = null; });
    RP.map = L.map("rpMap", { zoomControl: false, attributionControl: true, zoomSnap: 1 }).setView(RP.pts[0], RP.zoom);
    tiles(RP.map); L.control.zoom({ position: "topright" }).addTo(RP.map);
    RP.trail = L.polyline([], { color: "#6250d6", weight: 5, opacity: 0.9 }).addTo(RP.map); RP.tail = L.polyline([], { color: "#6250d6", weight: 5, opacity: 0.9 }).addTo(RP.map);
    RP.me = L.circleMarker(RP.pts[0], { radius: 10, color: "#ffffff", weight: 3, fillColor: "#6250d6", fillOpacity: 1, interactive: false }).addTo(RP.map);
    RP.map.on("dragstart", () => { RP.free = true; $r("rpCenter").hidden = false; });
    RP.map.on("zoomend", () => { RP.zoom = Math.round(RP.map.getZoom()); $r("rpZoom").value = String(RP.zoom); });
    RP.free = false; RP.drawn = 0; $r("rpCenter").hidden = true; $r("rpSkip").checked = RP.skip; $r("rpSpeed").value = String(RP.speed); $r("rpZoom").value = String(RP.zoom);
    RP.map.invalidateSize(); setClock(RP.t0, true); setPlaying(true); RP.last = performance.now(); if (!RP.raf) RP.raf = requestAnimationFrame(loop);
    $r("rpClose").focus();
  }
  function close() {
    if (!RP.ov) return; setPlaying(false); RP.ov.hidden = true; document.body.style.overflow = "";
    if (RP.raf) { cancelAnimationFrame(RP.raf); RP.raf = 0; }
    if (RP.map) { RP.map.remove(); RP.map = null; }
    if (RP.opener && RP.opener.focus) RP.opener.focus();
  }
  const b = document.getElementById("btnReplay"); if (b) b.addEventListener("click", open);
  window.PM_REPLAY = { open, close };
})();
