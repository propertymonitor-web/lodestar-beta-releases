/* ---------- CONTACTS BACKUP: the tile. Talks to the radio with `nova contacts` and `nova contact add`, and to ONE file the person picks. ---------- */
try {
  const CU = { handle: null, name: "", loaded: null, radio: null, file: null, cmp: null, busy: false, want: null, ack: null, wasOn: false };
  const el = (id) => document.getElementById(id);
  const FSA = !!(window.showSaveFilePicker && window.showOpenFilePicker && window.indexedDB);
  const nameOf = (c) => esc(c.n) + " <span style='opacity:.55'>" + c.k.slice(0, 8) + "</span>";
  const TYPE = { 1: "companion", 2: "repeater", 3: "room", 4: "sensor" };
  const on = () => { try { return S.mode === "serial" && !!S.writer; } catch (e) { return false; } };

  /* ----- the remembered file: browsers let a page keep a file handle in IndexedDB, but ask again for permission each session ----- */
  const db = () => new Promise((res, rej) => { const r = indexedDB.open("lodestar-contacts", 1); r.onupgradeneeded = () => r.result.createObjectStore("h"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const dbGet = async () => { try { const d = await db(); return await new Promise((res) => { const q = d.transaction("h").objectStore("h").get("file"); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } };
  const dbPut = async (h) => { try { const d = await db(); await new Promise((res) => { const t = d.transaction("h", "readwrite"); if (h) t.objectStore("h").put(h, "file"); else t.objectStore("h").delete("file"); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* not kept: the person picks again next time */ } };
  const perm = async (ask) => { if (!CU.handle) return false; try { const o = { mode: "readwrite" }; if ((await CU.handle.queryPermission(o)) === "granted") return true; return ask ? (await CU.handle.requestPermission(o)) === "granted" : false; } catch (e) { return false; } };

  function status(msg, kind) { const s = el("mxcStatus"); if (!s) return; s.textContent = msg; s.className = "mxc-status" + (kind ? " " + kind : ""); }
  function btn(label, fn, cls, dis) { const b = document.createElement("button"); b.type = "button"; b.textContent = label; if (cls) b.className = cls; b.disabled = !!dis || CU.busy; b.addEventListener("click", fn); return b; }

  function render() {
    const fr = el("mxcFileRow"), ac = el("mxcActions"), sm = el("mxcSum"), ls = el("mxcList"); if (!fr) return;
    fr.textContent = ""; ac.textContent = ""; sm.innerHTML = ""; ls.innerHTML = "";
    const have = FSA ? !!CU.handle : CU.loaded !== null;
    const f = document.createElement("span"); f.className = "mxc-file"; f.textContent = have ? "Backup file: " + (CU.name || "(loaded)") : "No backup file chosen yet."; fr.appendChild(f);
    if (FSA) { fr.appendChild(btn("Create a new backup file…", newFile)); fr.appendChild(btn("Use an existing backup file…", openFile)); }
    else { fr.appendChild(btn("Open a backup file…", openPlain)); }
    if (CU.handle && FSA) { /* permission may have lapsed since the last visit */ }
    const radioOk = on();
    ac.appendChild(btn("Compare radio and file", () => compare(true), "", !have || !radioOk));
    if (CU.cmp) {
      ac.appendChild(btn("Back up now (radio → file)", backup, "", !radioOk));
      if (CU.cmp.onlyFile.length) ac.appendChild(btn("Restore " + CU.cmp.onlyFile.length + " missing to the radio", restore, "mxc-go", !radioOk));
      const c = CU.cmp;
      sm.innerHTML = "<span>On the radio: <b>" + CU.radio.length + "</b></span><span>In the file: <b>" + CU.file.length + "</b></span><span>Only in the file: <b>" + c.onlyFile.length + "</b></span><span>Only on the radio: <b>" + c.onlyRadio.length + "</b></span>";
      const show = (t, a) => a.length ? "<h4>" + t + " (" + a.length + ")</h4>" + a.slice(0, 60).map((x) => "<div>" + nameOf(x) + " <span style='opacity:.55'>" + (TYPE[x.t] || "") + "</span></div>").join("") + (a.length > 60 ? "<div>… and " + (a.length - 60) + " more</div>" : "") : "";
      ls.innerHTML = show("In the file but not on the radio: restoring would add these", c.onlyFile) + show("On the radio but not in the file: backing up would add these", c.onlyRadio);
    }
    if (!FSA && CU.loaded !== null) ac.appendChild(btn("Download backup file", () => download()));
  }

  /* ----- choosing the file ----- */
  const TYPES = [{ description: "LODESTAR contacts backup", accept: { "application/json": [".json"] } }];
  async function newFile() {
    try { CU.handle = await window.showSaveFilePicker({ suggestedName: "lodestar-contacts.json", types: TYPES }); } catch (e) { return; }
    CU.name = CU.handle.name; await dbPut(CU.handle);
    if (!(await perm(true))) { status("Without permission to change the file, nothing can be saved.", "err"); render(); return; }
    const r = await readFile(); if (!r.ok) { status(r.error, "err"); render(); return; }
    status("File ready. Reading the radio…"); await compare(true);
  }
  async function openFile() {
    let hs; try { hs = await window.showOpenFilePicker({ types: TYPES, multiple: false }); } catch (e) { return; }
    CU.handle = hs[0]; CU.name = CU.handle.name; await dbPut(CU.handle);
    if (!(await perm(true))) { status("Without permission to change the file, nothing can be saved.", "err"); render(); return; }
    await compare(true);
  }
  function openPlain() {
    const i = document.createElement("input"); i.type = "file"; i.accept = ".json,application/json";
    i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return; if (f.size > 2 * 1024 * 1024) { status("That file is too big to be a contacts backup.", "err"); return; } CU.name = f.name; CU.loaded = await f.text(); await compare(true); };
    i.click();
  }
  async function readFile() {
    let text;
    try { text = FSA ? await (await CU.handle.getFile()).text() : CU.loaded; } catch (e) { return { ok: false, error: "Could not read the file: " + e.message }; }
    const r = CM.parseFile(text); if (r.ok) CU.file = r.contacts; return r;
  }
  async function writeFile(list) {
    const text = CM.serialize(list, new Date().toISOString());
    if (FSA) { const w = await CU.handle.createWritable(); await w.write(text); await w.close(); CU.file = list.slice(); }
    else { CU.loaded = text; CU.file = list.slice(); download(); }
  }
  function download() {
    const a = document.createElement("a"), b = new Blob([CU.loaded !== null ? CU.loaded : CM.serialize(CU.file || [], new Date().toISOString())], { type: "application/json" });
    a.href = URL.createObjectURL(b); a.download = CU.name || "lodestar-contacts.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ----- the radio ----- */
  window.mxContactsFrame = function (o) {
    if (o.contact_ack && CU.ack) { const a = CU.ack; CU.ack = null; clearTimeout(a.t); a.res(o.contact_ack); return; }
    const w = CU.want; if (!w) return;
    if (o.contact) { const c = CM.fromFrame(o.contact); if (c) w.list.push(c); else w.bad++; }
    else if (o.contacts_end !== undefined) { clearTimeout(w.t); CU.want = null; w.res({ list: w.list, bad: w.bad, total: o.contacts_end, sent: o.sent }); return; }
    clearTimeout(w.t); w.t = setTimeout(() => { CU.want = null; w.res(null); }, 6000);
  };
  function fetchRadio() {
    return new Promise((res) => {
      const w = { list: [], bad: 0, res, t: 0 }; CU.want = w;
      w.t = setTimeout(() => { CU.want = null; res(null); }, 8000);
      send("nova contacts");
    });
  }
  const sendAdd = (line) => new Promise((res) => { const a = { res, t: setTimeout(() => { CU.ack = null; res(null); }, 4000) }; CU.ack = a; send(line); });

  async function compare(verbose) {
    if (CU.busy) return; CU.busy = true; render();
    try {
      if (!on()) { status("Connect the radio first.", "err"); return; }
      if (FSA && !(await perm(true))) { status("Allow access to the backup file to continue.", "err"); return; }
      const f = await readFile(); if (!f.ok) { status(f.error, "err"); return; }
      status("Reading the radio's contacts…");
      const r = await fetchRadio();
      if (!r) { status("The radio did not answer. Its firmware may not have contacts backup (it is a test feature), or it is busy. Try again in a few seconds.", "err"); return; }
      CU.radio = r.list; CU.cmp = CM.compare(CU.file, CU.radio);
      const skipped = r.total - r.sent;
      status("Compared. " + (f.skipped ? f.skipped + " damaged or duplicate entries in the file were ignored. " : "") + (skipped > 0 ? skipped + " radio contacts were not listed because their names are not valid text. " : "") + (CU.cmp.onlyFile.length ? "The file has contacts the radio does not. Nothing is restored until you press Restore." : "Nothing is missing from the radio."), "ok");
    } finally { CU.busy = false; render(); }
  }
  async function backup() {
    if (CU.busy || !CU.radio) return; CU.busy = true; render();
    try {
      if (FSA && !(await perm(true))) { status("Allow access to the backup file to continue.", "err"); return; }
      const merged = CM.merge(CU.file || [], CU.radio); await writeFile(merged);
      CU.cmp = CM.compare(CU.file, CU.radio); status("Backed up: the file now has " + merged.length + " contacts (nothing it already had was removed).", "ok");
    } catch (e) { status("Could not save the file: " + e.message, "err"); } finally { CU.busy = false; render(); }
  }
  async function restore() {
    if (CU.busy || !CU.cmp || !CU.cmp.onlyFile.length) return; CU.busy = true; render();
    const todo = CU.cmp.onlyFile.slice(), n = { added: 0, kept: 0, self: 0, bad: 0, none: 0 }; let full = false, i = 0;
    try {
      for (const c of todo) {
        if (!on()) { status("The radio disconnected after " + i + " of " + todo.length + ".", "err"); break; }
        const line = CM.addLine(c); if (!line) { n.bad++; continue; }
        status("Restoring " + (++i) + " of " + todo.length + "…");
        const a = await sendAdd(line);
        if (!a) { n.none++; if (n.none >= 2) { status("The radio stopped answering. Stopped after " + (i - 1) + " of " + todo.length + ".", "err"); break; } continue; }
        if (a.r === "added") n.added++; else if (a.r === "kept") n.kept++; else if (a.r === "self") n.self++; else if (a.r === "full") { full = true; break; } else n.bad++;
      }
      const r = await fetchRadio(); if (r) { CU.radio = r.list; CU.cmp = CM.compare(CU.file, CU.radio); }
      status("Restored " + n.added + " contact" + (n.added === 1 ? "" : "s") + (n.bad ? "; " + n.bad + " refused as invalid" : "") + (n.self ? "; skipped the radio's own entry" : "") + (full ? ". The radio's contact list is full, so the rest were not added (nothing was removed)" : "") + ". The radio saves them to its own memory a few seconds later, so wait before unplugging. The phone app may need to reconnect to show them.", full || n.bad ? "err" : "ok");
    } finally { CU.busy = false; render(); }
  }

  /* ----- when a radio connects: if the file is already allowed, compare and top up the backup; never restore by itself ----- */
  async function connected() {
    if (!CU.handle) return;
    if (!(await perm(false))) { status("Radio connected. Press “Compare radio and file” to allow access to your backup file.", ""); return; }
    await compare(false);
    if (CU.cmp && CU.cmp.onlyRadio.length && !CU.busy) { await backup(); status("Radio connected. " + el("mxcStatus").textContent + (CU.cmp.onlyFile.length ? " The file also has " + CU.cmp.onlyFile.length + " contacts the radio lacks: press Restore if you want them back." : ""), "ok"); }
  }
  setInterval(() => {
    const now = on() && Date.now() - (S.lastRx || 0) < 5000;
    if (now && !CU.wasOn) setTimeout(connected, 2500); else if (!now && CU.wasOn) { CU.radio = null; CU.cmp = null; status("Connect your radio to begin."); render(); }
    CU.wasOn = now;
  }, 1000);
  (async () => { if (FSA) { CU.handle = await dbGet(); if (CU.handle) CU.name = CU.handle.name; } if (!FSA) status("This browser cannot keep a file open. You can still open a backup file and download a new one. Chrome or Edge on a computer can save to one file directly."); render(); })();
} catch (e) { /* the tile is optional: if it fails, the rest of the dashboard still works */ }
