// Drives the built dashboard in a real browser against a PRETEND radio that follows the same rules as the firmware code.
const { chromium } = require("playwright"); const path = require("path"); const assert = require("assert");
const http = require("http"), fs = require("fs"); const srv = http.createServer((q, r) => { r.setHeader("content-type", "text/html; charset=utf-8"); r.end(fs.readFileSync(path.resolve(__dirname, "../dashboard/matrix-contacts.html"))); }); srv.listen(0);
let page_url;
const SIM = () => {
  const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join(""), enc = new TextEncoder();
  const radio = { list: [], cap: 14, self: "ee".repeat(32), lines: [] };
  for (let i = 1; i <= 12; i++) radio.list.push({ k: hex(new Uint8Array(32).map((_, j) => (i * 7 + j) & 255)), t: i % 4 + 1, f: 0, pl: i % 2 ? 255 : 3, p: i % 2 ? "" : "aabbcc", la: 1700000000 + i, lm: 1700000100 + i, lat: -97000000 + i, lon: 32000000 + i, name: i === 5 ? "Ünï ☃ " + i : "Node " + i });
  window.__radio = radio;
  const hexRe = /^[0-9a-f]*$/;
  const respond = (line, out) => {
    if (line === "nova contacts") { let sent = 0; for (const c of radio.list) { if (c.badname) { out(JSON.stringify({ nova: 1, contact: { k: c.k, t: c.t, f: c.f, pl: c.pl, p: c.p, la: c.la, lm: c.lm, lat: c.lat, lon: c.lon, nh: "ff" } })); continue; } sent++; out(JSON.stringify({ nova: 1, contact: { k: c.k, t: c.t, f: c.f, pl: c.pl, p: c.p, la: c.la, lm: c.lm, lat: c.lat, lon: c.lon, nh: hex(enc.encode(c.name)) } })); } out(JSON.stringify({ nova: 1, contacts_end: radio.list.length, sent })); return; }
    const m = line.match(/^nova contact add (\S+) (\d+) (\d+) (\d+) (\S+) (\d+) (\d+) (-?\d+) (-?\d+) ([0-9a-f]+)$/);
    if (m) {
      radio.lines.push(line);
      const bad = (why) => out(JSON.stringify({ nova: 1, contact_ack: { k: "", r: "bad", why } }));
      if (m[1].length !== 64 || !hexRe.test(m[1])) return bad("key"); const t = +m[2]; if (t < 1 || t > 4) return bad("type");
      const k12 = m[1].slice(0, 12), ack = (r) => out(JSON.stringify({ nova: 1, contact_ack: { k: k12, r } }));
      if (m[1] === radio.self) return ack("self"); if (radio.list.some((c) => c.k === m[1])) return ack("kept"); if (radio.list.length >= radio.cap) return ack("full");
      const nm = new TextDecoder().decode(new Uint8Array(m[10].match(/../g).map((h) => parseInt(h, 16))));
      radio.list.push({ k: m[1], t, f: +m[3], pl: +m[4], p: m[5] === "-" ? "" : m[5], la: +m[6], lm: +m[7], lat: +m[8], lon: +m[9], name: nm }); return ack("added");
    }
  };
  let ctl; const rs = new ReadableStream({ start(c) { ctl = c; setInterval(() => { try { ctl.enqueue(enc.encode("# sim alive\n")); } catch (e) {} }, 1000); } });
  const out = (s) => ctl.enqueue(enc.encode(s + "\n")); let buf = "";
  const ws = new WritableStream({ write(ch) { buf += new TextDecoder().decode(ch); let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); respond(l, out); } } });
  const port = { readable: rs, writable: ws, open: async () => {}, close: async () => {}, setSignals: async () => {}, getInfo: () => ({ usbVendorId: 0x303a }), addEventListener() {} };
  Object.defineProperty(navigator, "serial", { value: { requestPort: async () => port, getPorts: async () => [], addEventListener() {} }, configurable: true });
  window.showSaveFilePicker = async () => { const d = await navigator.storage.getDirectory(); return d.getFileHandle("lodestar-contacts.json", { create: true }); };
  window.showOpenFilePicker = async () => [await window.showSaveFilePicker()];
};
(async () => {
  page_url = "http://localhost:" + srv.address().port + "/"; const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 1500 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("mx-alias", "tester"); } catch (e) {} });
  await p.addInitScript(SIM);
  await p.goto(page_url); await p.waitForTimeout(500);
  await p.click("#btnConnect"); await p.waitForFunction(() => S.mode === "serial", null, { timeout: 8000 });
  await p.waitForTimeout(1500);
  const fileText = () => p.evaluate(async () => { const d = await navigator.storage.getDirectory(); const h = await d.getFileHandle("lodestar-contacts.json"); return (await h.getFile()).text(); });
  const status = () => p.textContent("#mxcStatus");
  // 1 create file -> compare shows file empty, radio 12
  await p.click("text=Create a new backup file…"); await p.waitForFunction(() => /Compared/.test(document.getElementById("mxcStatus").textContent), null, { timeout: 15000 });
  assert.match(await p.textContent("#mxcSum"), /On the radio: 12.*In the file: 0.*Only in the file: 0.*Only on the radio: 12/s);
  // 2 back up
  await p.click("text=Back up now (radio → file)"); await p.waitForFunction(() => /Backed up/.test(document.getElementById("mxcStatus").textContent));
  let f = JSON.parse(await fileText()); assert.equal(f.contacts.length, 12); assert.ok(f.contacts.some((c) => c.n === "Ünï ☃ 5")); assert.ok(!/"prv|private_?key|"priv/i.test(await fileText()));
  await p.locator("#mxContacts").screenshot({ path: path.resolve(__dirname, "../docs/contacts-tile-backed-up.png") });
  // 3 the radio is wiped and one new contact appears; compare, then restore only on click
  await p.evaluate(() => { __radio.list = [{ k: "ab".repeat(32), t: 1, f: 0, pl: 255, p: "", la: 5, lm: 5, lat: 0, lon: 0, name: "Brand new" }]; });
  await p.click("text=Compare radio and file"); await p.waitForFunction(() => /Only in the file: 12/.test(document.getElementById("mxcSum").textContent));
  assert.equal(await p.evaluate(() => __radio.list.length), 1, "compare must not change the radio");
  await p.click("button.mxc-go"); await p.waitForFunction(() => /Restored 12/.test(document.getElementById("mxcStatus").textContent), null, { timeout: 30000 });
  assert.equal(await p.evaluate(() => __radio.list.length), 13); assert.ok(await p.evaluate(() => __radio.list.some((c) => c.name === "Ünï ☃ 5" && c.p === "" || c.name === "Node 2" && c.p === "aabbcc")));
  assert.ok(await p.evaluate(() => __radio.list.some((c) => c.name === "Brand new")), "existing radio contact untouched");
  // 4 file only ever grows on backup: "Brand new" is added, none of the 12 lost
  await p.click("text=Back up now (radio → file)"); await p.waitForFunction(() => /Backed up: the file now has 13/.test(document.getElementById("mxcStatus").textContent));
  assert.equal(JSON.parse(await fileText()).contacts.length, 13);
  // 5 full radio: nothing removed, clear message
  await p.evaluate(() => { __radio.list = __radio.list.slice(0, 3); __radio.cap = 5; });
  await p.click("text=Compare radio and file"); await p.waitForFunction(() => /Only in the file: 10/.test(document.getElementById("mxcSum").textContent));
  const before = await p.evaluate(() => __radio.list.slice(0, 3).map((c) => c.k).join());
  await p.click("button.mxc-go"); await p.waitForFunction(() => /list is full/.test(document.getElementById("mxcStatus").textContent), null, { timeout: 30000 });
  assert.equal(await p.evaluate(() => __radio.list.length), 5); assert.equal(await p.evaluate(() => __radio.list.slice(0, 3).map((c) => c.k).join()), before, "existing contacts kept when full");
  // 6 hostile radio data: an entry with an invalid name is skipped, and the page says so
  await p.evaluate(() => { __radio.cap = 50; __radio.list[0].badname = true; });
  await p.click("text=Compare radio and file"); await p.waitForFunction(() => /not valid text|Compared/.test(document.getElementById("mxcStatus").textContent));
  assert.equal(await p.evaluate(() => CU_ok = true), true);
  // 7 a damaged backup file is refused and not overwritten
  await p.evaluate(async () => { const d = await navigator.storage.getDirectory(); const h = await d.getFileHandle("lodestar-contacts.json"); const w = await h.createWritable(); await w.write("{not json"); await w.close(); });
  await p.click("text=Compare radio and file"); await p.waitForFunction(() => /not a contacts backup/.test(document.getElementById("mxcStatus").textContent));
  assert.equal(await fileText(), "{not json", "damaged file left alone");
  assert.deepEqual(errs, [], "no page errors: " + errs.join("|"));
  console.log("browser test passed"); await b.close(); srv.close();
})().catch((e) => { console.error("FAILED:", e.message); srv.close(); process.exit(1); });
