const CM = require("../dashboard/contacts_model.js"); const assert = require("assert"); let n = 0; const ok = (c, m) => { n++; assert.ok(c, m); };
const k = (s) => (s + "0".repeat(64)).slice(0, 64);
const good = { k: k("ab"), n: "Ada ☃", t: 1, f: 0, pl: 3, p: "aabbcc", la: 1700000000, lm: 1700000100, lat: -97123456, lon: 32123456 };
// frames from the radio: nh = name in hex (utf-8)
const fr = { k: good.k, t: 1, f: 0, pl: 3, p: "aabbcc", la: 1700000000, lm: 1700000100, lat: -97123456, lon: 32123456, nh: CM.nameToHex("Ada ☃") };
ok(JSON.stringify(CM.fromFrame(fr)) === JSON.stringify(good), "frame -> contact");
ok(CM.fromFrame({ ...fr, nh: "ff" }) === null, "bad utf-8 name");
ok(CM.fromFrame({ ...fr, nh: "00" }) === null, "NUL name");
ok(CM.fromFrame({ ...fr, nh: "" }) === null, "empty name");
ok(CM.fromFrame({ ...fr, t: 0 }) === null && CM.fromFrame({ ...fr, t: 5 }) === null, "type range");
ok(CM.fromFrame({ ...fr, k: fr.k.toUpperCase() }) === null, "key must be lowercase hex");
ok(CM.fromFrame({ ...fr, lat: 2147483648 }) === null, "lat range");
ok(CM.fromFrame(null) === null && CM.fromFrame("x") === null, "junk");
// add line: matches what the firmware parser expects
ok(CM.addLine(good) === "nova contact add " + good.k + " 1 0 3 aabbcc 1700000000 1700000100 -97123456 32123456 " + CM.nameToHex("Ada ☃"), "add line");
ok(CM.addLine({ ...good, p: "" }).includes(" 3 - 1700000000 "), "no path -> dash");
ok(CM.addLine({ ...good, n: "x".repeat(32) }) === null && CM.addLine({ ...good, n: "x".repeat(31) }) !== null, "name 31 bytes max");
ok(CM.addLine({ ...good, n: "é".repeat(16) }) === null, "name limit is bytes not characters");
ok(CM.addLine({ ...good, n: "a\nb" }) === null, "control char");
ok(CM.addLine({ ...good, n: "\ud800" }) === null, "lone surrogate");
ok(CM.addLine({ ...good, p: "a" }) === null && CM.addLine({ ...good, p: "zz" }) === null, "path hex");
// file round trip
const list = [good, { ...good, k: k("cd"), n: "Ben", t: 2, pl: 255, p: "" }];
const txt = CM.serialize(list, "2026-11-13T12:00:00Z"); const back = CM.parseFile(txt);
ok(back.ok && back.contacts.length === 2 && back.skipped === 0, "round trip"); ok(back.contacts.find((c) => c.n === "Ada ☃"), "unicode survives");
ok(!/prv|private_key/i.test(txt.replace(/No private keys\./, "")), "no private key field in file");
// hostile / damaged files
ok(!CM.parseFile("{").ok && !CM.parseFile("[]").ok && !CM.parseFile('{"format":"x"}').ok, "bad files refused");
ok(!CM.parseFile(JSON.stringify({ format: CM.FORMAT, version: 2, contacts: [] })).ok, "newer version refused");
ok(CM.parseFile("").ok && CM.parseFile("  \n").empty, "empty file ok");
const dup = CM.parseFile(JSON.stringify({ format: CM.FORMAT, version: 1, contacts: [good, good, { ...good, k: "zz" }, { __proto__: { x: 1 }, k: 5 }, null, 7] }));
ok(dup.ok && dup.contacts.length === 1 && dup.skipped === 5, "dups and junk skipped");
ok(!CM.parseFile(JSON.stringify({ format: CM.FORMAT, version: 1, contacts: new Array(2001).fill(good) })).ok, "too many");
ok(!CM.parseFile("x".repeat(3 * 1024 * 1024)).ok, "too big");
const proto = CM.parseFile('{"format":"lodestar-contacts","version":1,"contacts":[{"__proto__":{"k":"x"},"k":"' + good.k + '","n":"A","t":1,"f":0,"pl":255,"p":"","la":0,"lm":0,"lat":0,"lon":0,"polluted":1}]}');
ok(proto.ok && proto.contacts[0].polluted === undefined && ({}).k === undefined, "extra fields dropped, no pollution");
// merge: nothing is ever lost, radio wins for entries both have
const radio = [{ ...good, n: "Ada (new name)" }, { ...good, k: k("ef"), n: "Cy" }], file = [good, { ...good, k: k("12"), n: "Only in file" }];
const m = CM.merge(file, radio); ok(m.length === 3 && m.find((c) => c.k === good.k).n === "Ada (new name)" && m.find((c) => c.n === "Only in file"), "merge");
const cmp = CM.compare(file, radio); ok(cmp.onlyFile.length === 1 && cmp.onlyFile[0].n === "Only in file" && cmp.onlyRadio.length === 1 && cmp.both === 1, "compare");
// fuzz: random mutations of a good file never throw and never yield an entry the radio would refuse
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = 0; i < 20000; i++) { let s = txt.split(""); for (let j = 0, q = 1 + Math.floor(rnd() * 4); j < q; j++) { const p = Math.floor(rnd() * s.length); const t = rnd(); if (t < .4) s[p] = String.fromCharCode(32 + Math.floor(rnd() * 90)); else if (t < .7) s.splice(p, 1 + Math.floor(rnd() * 3)); else s.splice(p, 0, "\u0000\ud800é\"{}"[Math.floor(rnd() * 6)]); }
  const r = CM.parseFile(s.join("")); if (r.ok) for (const c of r.contacts) { if (!CM.addLine(c)) throw new Error("accepted an entry the radio would refuse: " + JSON.stringify(c)); } }
n++;
console.log(n + " checks passed");
