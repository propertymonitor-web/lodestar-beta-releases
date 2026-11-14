/* ---------- CONTACTS BACKUP: the file format and the checks. Pure functions: no page, no radio, no browser needed (so they can be tested in Node). ---------- */
const CM = (function () {
  "use strict";
  const FORMAT = "lodestar-contacts", VERSION = 1, MAX_CONTACTS = 2000, MAX_FILE = 2 * 1024 * 1024;
  const hexRe = /^[0-9a-f]*$/;
  const u = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
  const i32 = (v) => Number.isInteger(v) && v >= -2147483647 && v <= 2147483647;

  function hexToBytes(h) { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(2 * i, 2), 16); return o; }
  function bytesToHex(b) { let s = ""; for (const x of b) s += (x < 16 ? "0" : "") + x.toString(16); return s; }
  function nameToHex(n) { return bytesToHex(new TextEncoder().encode(n)); }
  function hexToName(h) {
    if (typeof h !== "string" || h.length % 2 || !hexRe.test(h)) return null;
    try { return new TextDecoder("utf-8", { fatal: true }).decode(hexToBytes(h)); } catch (e) { return null; }
  }
  // the radio accepts a name of 1 to 31 bytes of valid UTF-8 with no control characters
  function goodName(n) {
    if (typeof n !== "string" || !n.length) return false;
    for (const ch of n) { const c = ch.codePointAt(0); if (c < 0x20 || c === 0x7f || (c >= 0xd800 && c <= 0xdfff)) return false; }
    const b = new TextEncoder().encode(n); return b.length >= 1 && b.length <= 31;
  }
  // Check one contact; returns a clean copy or null. Unknown extra fields are dropped.
  function clean(c) {
    if (!c || typeof c !== "object") return null;
    if (typeof c.k !== "string" || c.k.length !== 64 || !hexRe.test(c.k)) return null;
    if (!u(c.t, 4) || c.t < 1) return null;
    if (!u(c.f, 255) || !u(c.pl, 255)) return null;
    if (typeof c.p !== "string" || c.p.length > 128 || c.p.length % 2 || !hexRe.test(c.p)) return null;
    if (!u(c.la, 4294967295) || !u(c.lm, 4294967295) || !i32(c.lat) || !i32(c.lon)) return null;
    if (!goodName(c.n)) return null;
    return { k: c.k, n: c.n, t: c.t, f: c.f, pl: c.pl, p: c.p, la: c.la, lm: c.lm, lat: c.lat, lon: c.lon };
  }
  // a {"nova":1,"contact":{...}} frame's inner object -> contact, or null
  function fromFrame(o) {
    if (!o || typeof o !== "object") return null;
    const n = hexToName(o.nh); if (n === null) return null;
    return clean({ k: o.k, n, t: o.t, f: o.f, pl: o.pl, p: o.p, la: o.la, lm: o.lm, lat: o.lat, lon: o.lon });
  }
  // contact -> the line to send the radio, or null if it would be refused
  function addLine(c) {
    c = clean(c); if (!c) return null;
    return "nova contact add " + c.k + " " + c.t + " " + c.f + " " + c.pl + " " + (c.p || "-") + " " + c.la + " " + c.lm + " " + c.lat + " " + c.lon + " " + nameToHex(c.n);
  }
  function parseFile(text) {
    if (typeof text !== "string") return { ok: false, error: "The file could not be read." };
    if (text.length > MAX_FILE) return { ok: false, error: "The file is too big to be a contacts backup." };
    if (!text.trim()) return { ok: true, contacts: [], skipped: 0, empty: true };      // a brand-new empty file is fine
    let j; try { j = JSON.parse(text); } catch (e) { return { ok: false, error: "That file is not a contacts backup (it is not valid JSON)." }; }
    if (!j || j.format !== FORMAT) return { ok: false, error: "That file is not a LODESTAR contacts backup." };
    if (j.version !== VERSION) return { ok: false, error: "That backup is a newer or unknown version (" + String(j.version).slice(0, 10) + "). Update the dashboard." };
    if (!Array.isArray(j.contacts) || j.contacts.length > MAX_CONTACTS) return { ok: false, error: "The backup's contact list is missing or too long." };
    const seen = new Set(), out = []; let skipped = 0;
    for (const raw of j.contacts) { const c = clean(raw); if (!c || seen.has(c.k)) { skipped++; continue; } seen.add(c.k); out.push(c); }
    return { ok: true, contacts: out, skipped, saved: typeof j.saved === "string" ? j.saved.slice(0, 40) : "" };
  }
  function serialize(contacts, whenIso) {
    const list = contacts.slice().sort((a, b) => a.n.localeCompare(b.n) || (a.k < b.k ? -1 : 1));
    return JSON.stringify({ format: FORMAT, version: VERSION, saved: whenIso,
      note: "Names and public keys of this radio's contacts. No private keys. Keep this file private.", contacts: list }, null, 1) + "\n";
  }
  // Back up = the radio's version of every contact it has, plus anything only the file has. A backup never loses a contact.
  function merge(fileList, radioList) {
    const m = new Map(); for (const c of fileList) m.set(c.k, c); for (const c of radioList) m.set(c.k, c);
    return Array.from(m.values());
  }
  function compare(fileList, radioList) {
    const f = new Map(fileList.map((c) => [c.k, c])), r = new Map(radioList.map((c) => [c.k, c]));
    return { onlyFile: fileList.filter((c) => !r.has(c.k)), onlyRadio: radioList.filter((c) => !f.has(c.k)), both: radioList.filter((c) => f.has(c.k)).length };
  }
  return { FORMAT, VERSION, MAX_CONTACTS, clean, fromFrame, addLine, parseFile, serialize, merge, compare, goodName, nameToHex, hexToName };
})();
if (typeof module !== "undefined") module.exports = CM;
