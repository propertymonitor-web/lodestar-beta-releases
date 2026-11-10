/* ---------- RANGE MODEL: pure functions, no page access. Everything here is an estimate from textbook formulas. ---------- */
const RM = (function () {
  const log10 = (x) => Math.log(x) / Math.LN10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SNR_LIM = { 5: -2.5, 6: -5, 7: -7.5, 8: -10, 9: -12.5, 10: -15, 11: -17.5, 12: -20 };   // LoRa demodulation limit per spreading factor
  const INDOOR = { out: 0, window: 8, room: 14, deep: 22 };                                      // rough building-entry loss, dB (typical values, not measured)
  const FAR = { hand: { h: 2, label: "another handheld or car radio" }, roof: { h: 10, label: "a repeater on a rooftop" }, tower: { h: 30, label: "a repeater on a tall tower or hilltop" } };

  // receiver sensitivity: thermal noise in the channel + 6 dB receiver noise figure + the SF's SNR limit.
  // If the radio reports a measured noise floor that is HIGHER than thermal, the noisier one is used (a busy band costs range; a quiet one cannot beat physics).
  function sensitivity(sf, bwKhz, nfMeasured) {
    const snr = SNR_LIM[sf] != null ? SNR_LIM[sf] : -15, thermal = -174 + 10 * log10(bwKhz * 1000) + 6;
    let floor = thermal, src = "theory";
    if (Number.isFinite(nfMeasured) && nfMeasured > -135 && nfMeasured < -70 && nfMeasured > thermal) { floor = nfMeasured; src = "measured"; }
    return { sens: floor + snr, floor, src, thermal, snr };
  }

  const fspl = (fMHz, dKm) => 32.44 + 20 * log10(fMHz) + 20 * log10(dKm);

  // Okumura-Hata. Meant for base heights 30-200 m and 1-20 km; used here outside that on purpose (see the disclaimer), and never below free space.
  function hata(fMHz, hA, hB, dKm, env) {
    const hb = clamp(Math.max(hA, hB), 1, 200), hm = clamp(Math.min(hA, hB), 1, 10), lf = log10(fMHz);
    const a = (1.1 * lf - 0.7) * hm - (1.56 * lf - 0.8);
    const urban = 69.55 + 26.16 * lf - 13.82 * log10(hb) - a + (44.9 - 6.55 * log10(hb)) * log10(dKm);
    if (env === "suburban") return urban - 2 * Math.pow(log10(fMHz / 28), 2) - 5.4;
    if (env === "open") return urban - 4.78 * lf * lf + 18.33 * lf - 40.94;
    return urban;
  }

  // free space out to the break distance, then the plane-earth (ground bounce) slope of 40 dB per decade
  function losLoss(fMHz, h1, h2, dKm) {
    const lam = 299.792458 / fMHz, db = Math.max(0.001, 4 * Math.max(h1, 0.5) * Math.max(h2, 0.5) / lam / 1000);
    return dKm <= db ? fspl(fMHz, dKm) : fspl(fMHz, db) + 40 * log10(dKm / db);
  }

  function pathLoss(fMHz, h1, h2, dKm, env) {
    const fs = fspl(fMHz, dKm);
    return Math.max(fs, env === "los" ? losLoss(fMHz, h1, h2, dKm) : hata(fMHz, h1, h2, dKm, env));
  }

  // largest distance (km) whose path loss does not exceed `pl`; bisection, the loss only grows with distance
  function solveRange(pl, fMHz, h1, h2, env) {
    let lo = 0.005, hi = 3000;
    if (pathLoss(fMHz, h1, h2, lo, env) > pl) return 0;
    if (pathLoss(fMHz, h1, h2, hi, env) <= pl) return hi;
    for (let i = 0; i < 70; i++) { const mid = (lo + hi) / 2; if (pathLoss(fMHz, h1, h2, mid, env) <= pl) lo = mid; else hi = mid; }
    return lo;
  }

  // radio horizon, km, heights in metres, k = effective earth radius factor (Infinity = the air is trapping the signal)
  const horizon = (h1, h2, k) => (k === Infinity ? Infinity : 3.5696 * Math.sqrt(k) * (Math.sqrt(Math.max(h1, 0)) + Math.sqrt(Math.max(h2, 0))));

  // ---- atmosphere (ITU-R P.453 refractivity) ----
  const satVap = (tc) => 6.1121 * Math.exp((18.678 - tc / 234.5) * (tc / (257.14 + tc)));       // hPa, over water (Buck)
  function refractivity(tc, rh, p) { const tk = tc + 273.15, e = clamp(rh, 0, 100) / 100 * satVap(tc); return 77.6 / tk * (p + 4810 * e / tk); }
  function kFromGradient(dN) { const d = 1 + 0.006371 * dN; return d > 0.05 ? 1 / d : Infinity; }   // dN in N-units per km; standard air is about -40 -> k 1.34

  // sfc: {h (m above sea level), t (C), rh (%), p (hPa)}; levels: [{h, t, rh, p}] at pressure levels. Uses the lowest ~1 km, the way P.452 does.
  function gradient(sfc, levels) {
    if (![sfc.h, sfc.t, sfc.rh, sfc.p].every(Number.isFinite)) return null;
    const N0 = refractivity(sfc.t, sfc.rh, sfc.p), pts = [{ h: sfc.h, N: N0 }];
    (levels || []).filter((l) => [l.h, l.t, l.rh, l.p].every(Number.isFinite) && l.h > sfc.h + 80 && l.h < sfc.h + 2500)
      .sort((a, b) => a.h - b.h).forEach((l) => pts.push({ h: l.h, N: refractivity(l.t, l.rh, l.p) }));
    if (pts.length < 2) return null;
    const up = pts.slice(1).filter((p) => p.h - sfc.h >= 300);
    if (!up.length) return null;                                                   // nothing high enough above the ground to measure a 1 km gradient
    const ref = up.reduce((a, b) => (Math.abs(b.h - sfc.h - 1000) < Math.abs(a.h - sfc.h - 1000) ? b : a));
    const dN = (ref.N - N0) / ((ref.h - sfc.h) / 1000);
    let trap = false, minG = Infinity;
    for (let i = 0; i < pts.length - 1; i++) { const dh = pts[i + 1].h - pts[i].h; if (dh < 50) continue; const g = (pts[i + 1].N - pts[i].N) / (dh / 1000); minG = Math.min(minG, g); if (g <= -157) trap = true; }
    return { N0, dN, k: kFromGradient(dN), trap, minG: minG === Infinity ? dN : minG, layers: pts.length - 1, top: ref.h - sfc.h };
  }

  // ---- the estimate ----
  // in: {f, sf, bw, txp, nf, gTx, cTx, gRx, cRx, h1, h2, env, indoor, extra, margin}   atm: {k, trap}
  function estimate(i, atm) {
    const S = sensitivity(i.sf, i.bw, i.nf), indoor = INDOOR[i.indoor] || 0, extra = i.extra || 0, k = atm && atm.k != null ? atm.k : 4 / 3;
    const eirp = i.txp + i.gTx - i.cTx, plMax = eirp + i.gRx - i.cRx - S.sens;            // total loss the link can stand with no margin
    const allow = (m) => plMax - m - indoor - extra;
    const hz = horizon(i.h1, i.h2, k), hzStd = horizon(i.h1, i.h2, 4 / 3);
    const at = (m) => { const b = solveRange(allow(m), i.f, i.h1, i.h2, i.env); return { budget: b, range: Math.min(b, hz) }; };
    const main = at(i.margin), best = at(0), cautious = at(i.margin * 2), std = Math.min(main.budget, hzStd);
    return { sens: S, eirp, plMax, indoor, extra, allow: allow(i.margin), margin: i.margin, hz, hzStd, k, trap: !!(atm && atm.trap),
      budgetKm: main.budget, rangeKm: main.range, bestKm: best.range, cautiousKm: cautious.range, stdKm: std,
      limit: main.budget <= hz ? "budget" : "horizon", bandHz: hz };
  }

  return { sensitivity, fspl, hata, losLoss, pathLoss, solveRange, horizon, satVap, refractivity, kFromGradient, gradient, estimate, INDOOR, FAR, SNR_LIM };
})();
