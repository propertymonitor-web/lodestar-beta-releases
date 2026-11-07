// Imagined and engineered by:
// Aries Thorne & Todd Steinhauer
//
// Moral Support: Athena the K9
(() => {
  if (window.__nsInstalled) return; window.__nsInstalled = true;
  const N = window.AndroidUsb, F = window.AndroidFiles;
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const blobB64 = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(b); });
  let cur = null, pOpen = null, pReq = null;

  class Port extends EventTarget {
    constructor(i) { super(); this._i = i; this.readable = null; this.writable = null; this._ctl = null; this._open = false; this._dtr = false; this._rts = false; }
    getInfo() { return { usbVendorId: this._i.vid, usbProductId: this._i.pid }; }
    open(o) {
      if (this._open) return Promise.reject(new DOMException("The port is already open.", "InvalidStateError"));
      return new Promise((res, rej) => { pOpen = { res, rej, port: this }; N.open((o && o.baudRate) || 115200); });
    }
    _mk() {
      this.readable = new ReadableStream({ start: (c) => { this._ctl = c; } });
      this.writable = new WritableStream({ write: (ch) => { N.write(b64(ch instanceof Uint8Array ? ch : new Uint8Array(ch.buffer || ch))); } });
      this._open = true;
    }
    close() { N.close(); try { this._ctl && this._ctl.close(); } catch (e) {} this._ctl = null; this.readable = null; this.writable = null; this._open = false; return Promise.resolve(); }
    setSignals(s) {
      if (s && "dataTerminalReady" in s) this._dtr = !!s.dataTerminalReady;
      if (s && "requestToSend" in s) this._rts = !!s.requestToSend;
      N.setSignals(this._dtr, this._rts); return Promise.resolve();
    }
    getSignals() { return Promise.resolve({}); }
  }
  const info = () => { try { return JSON.parse(N.present()); } catch (e) { return []; } };
  const portFor = (d) => { if (!cur || cur._i.id !== d.id) cur = new Port(d); return cur; };

  window.__ns = {
    rx(s) { if (cur && cur._ctl) { try { cur._ctl.enqueue(unb(s)); } catch (e) {} } },
    openDone(ok, msg) {
      const p = pOpen; pOpen = null; if (!p) return;
      if (ok) { p.port._mk(); p.res(); } else p.rej(new DOMException(msg || "Failed to open serial port.", "NetworkError"));
    },
    reqDone(ok, msg) {
      const p = pReq; pReq = null; if (!p) return;
      const d = ok ? info()[0] : null;
      if (d) p.res(portFor(d)); else p.rej(new DOMException(msg || "No port selected by the user.", "NotFoundError"));
    },
    lost() {
      if (!cur) return;
      try { cur._ctl && cur._ctl.close(); } catch (e) {}
      cur._ctl = null; cur._open = false;
      cur.dispatchEvent(new Event("disconnect", { bubbles: true }));
      serial.dispatchEvent(new Event("disconnect"));
    },
    attached() { const d = info()[0]; if (d) serial.dispatchEvent(Object.assign(new Event("connect"), { port: portFor(d) })); },
  };

  const serial = new EventTarget();
  serial.requestPort = () => new Promise((res, rej) => { pReq = { res, rej }; N.request(); });
  serial.getPorts = () => Promise.resolve(info().filter((d) => d.perm).map(portFor));
  Object.defineProperty(navigator, "serial", { value: serial, configurable: true });

  // Saving files: the page makes a blob link; hand it to the app, which saves to Downloads.
  const save = (a) => fetch(a.href).then((r) => r.blob()).then((b) => blobB64(b).then((d) => F.saveFile(a.download || "download", b.type || "application/octet-stream", d)));
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && /^blob:/.test(this.href)) { save(this); return; }
    return origClick.apply(this, arguments);
  };
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest && e.target.closest("a[download]");
    if (a && /^blob:/.test(a.href)) { e.preventDefault(); e.stopPropagation(); save(a); }
  }, true);

  // Share sheet
  navigator.canShare = () => true;
  navigator.share = async (d) => {
    d = d || {};
    if (d.files && d.files.length) { const f = d.files[0]; F.shareFile(f.name, f.type || "application/octet-stream", await blobB64(f), d.title || "", d.text || ""); }
    else F.shareText(d.title || "", d.text || "", d.url || "");
  };
})();
