#!/usr/bin/env python3
"""
apply_contacts.py - TEST BUILD: add the USB contacts backup commands to a MeshCore checkout that already has NOVA applied.

  python tools/apply_nova.py     --meshcore MeshCore       (from lodestar_nova_alpha)
  python tools/apply_contacts.py --meshcore MeshCore

Adds `nova contacts` (stream the contact list) and `nova contact add ...` (add a missing contact) to the USB text link that
the dashboard uses. Needs the build where USB is free (the phone uses Bluetooth), i.e. ENABLE_USB_INTERFACE is NOT defined.
Every edit must match exactly once; if upstream or apply_nova moved something the script stops and says which anchor it missed.
"""
import argparse, os, re, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
CONTACTS_H = os.path.join(HERE, "..", "nova", "Contacts.h")

def die(m): print("\nERROR: " + m + "\n", file=sys.stderr); sys.exit(1)

def patch(t, pat, repl, what):
    n = len(re.findall(pat, t))
    if n != 1: die("expected exactly 1 match for '%s', found %d. tools/apply_contacts.py needs updating." % (what, n))
    return re.sub(pat, lambda m: repl(m), t, count=1)

ADAPTER = r'''
  static nova::contacts::Exporter nv_exp;
  // The radio's contact list, seen through the small interface in NovaContacts.h (adds only; never removes, never overwrites).
  struct NvStore {
    MyMesh* m;
    int count() { return m->getNumContacts(); }
    bool get(int i, nova::contacts::Rec& r) {
      ContactInfo c;
      if (!m->getContactByIdx((uint32_t)i, c)) return false;
      memcpy(r.key, c.id.pub_key, 32); r.type = c.type; r.flags = c.flags; r.plen = c.out_path_len; memcpy(r.path, c.out_path, 64);
      r.lastadv = c.last_advert_timestamp; r.lastmod = c.lastmod; r.lat = c.gps_lat; r.lon = c.gps_lon;
      memcpy(r.name, c.name, 31); r.name[31] = 0;
      return true;
    }
    bool has(const uint8_t* k) { return m->lookupContactByPubKey(k, PUB_KEY_SIZE) != NULL; }
    bool isSelf(const uint8_t* k) { return memcmp(k, m->self_id.pub_key, PUB_KEY_SIZE) == 0; }
    bool pathLenOk(uint8_t p) { return mesh::Packet::isValidPathLen(p); }
    bool add(const nova::contacts::Rec& r) {
      if (m->getNumContacts() >= MAX_CONTACTS) return false;   // full means full: never push an existing contact out
      ContactInfo c;
      c.id = mesh::Identity(r.key); c.type = r.type; c.flags = r.flags; c.out_path_len = r.plen; memcpy(c.out_path, r.path, MAX_PATH_SIZE);
      memset(c.name, 0, sizeof(c.name)); memcpy(c.name, r.name, 31);
      c.shared_secret_valid = false; c.last_advert_timestamp = r.lastadv; c.lastmod = r.lastmod; c.gps_lat = r.lat; c.gps_lon = r.lon; c.sync_since = 0;
      if (!m->addContact(c)) return false;
      m->dirty_contacts_expiry = m->futureMillis(LAZY_CONTACTS_WRITE_DELAY);
      return true;
    }
  };
  struct NvOut { void put(const char* s) { Serial.println(s); } };
'''

INTERCEPT = r'''    if (strncmp(nv_line + 4, " contacts", 9) == 0 && nv_line[13] == 0) {   // contacts backup (test build): stream the list
      if (nv_exp.active()) Serial.println("# busy"); else nv_exp.start();
      continue;
    }
    if (strncmp(nv_line + 4, " contact ", 9) == 0) {                          // contacts backup (test build): add one if missing
      NvStore nv_st{this}; NvOut nv_o; nova::contacts::handleAdd(nv_line + 13, nv_st, nv_o);
      continue;
    }
'''

PUMP = r'''  if (nv_exp.active()) { NvStore nv_st{this}; NvOut nv_o; nv_exp.pump(nv_st, nv_o, 4); }   // a few contacts per pass so the radio keeps working
'''

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--meshcore", required=True); a = ap.parse_args()
    root = a.meshcore; comp = os.path.join(root, "examples", "companion_radio"); cpp_p = os.path.join(comp, "MyMesh.cpp")
    for p in (cpp_p, CONTACTS_H):
        if not os.path.isfile(p): die("Cannot find %s. Is --meshcore a MeshCore checkout?" % p)
    c = open(cpp_p).read()
    if "nova_core" not in c: die("Run apply_nova.py first: the contacts commands are an add-on to NOVA.")
    if "NovaContacts.h" in c: die("This checkout already has the contacts commands. Use a fresh clone.")
    c = patch(c, r'(#include "MyMesh\.h"\n)', lambda m: m.group(1) + "#include <helpers/NovaContacts.h>\n", "MyMesh.h include")
    c = patch(c, r"static char nv_line\[96\];", lambda m: "static char nv_line[384];   // long enough for one `nova contact add ...` line", "nv_line buffer")
    c = patch(c, r"(  static uint32_t nv_next_json = 0;\n)", lambda m: m.group(1) + ADAPTER, "nv_next_json")
    c = patch(c, r"(    char nv_reply\[160\];\n)", lambda m: INTERCEPT + m.group(1), "nv_reply")
    c = patch(c, r"(  static bool nv_was_on = false;\n)", lambda m: PUMP + m.group(1), "nv_was_on")
    open(cpp_p, "w").write(c)
    shutil.copyfile(CONTACTS_H, os.path.join(root, "src", "helpers", "NovaContacts.h"))
    print("Contacts backup commands applied:\n  + src/helpers/NovaContacts.h\n  ~ examples/companion_radio/MyMesh.cpp  (`nova contacts`, `nova contact add`)")

if __name__ == "__main__": main()
