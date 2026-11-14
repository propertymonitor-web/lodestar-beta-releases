#!/usr/bin/env python3
"""
apply_safe_save.py - TEST BUILD: make MeshCore's contact-list save safe against an interrupted write (ESP32 boards only).

MeshCore saves all contacts to ONE file by emptying it first and then writing every contact. If the radio loses power or
restarts part-way through, the file is left short and the next start loads only what is there (no error shown), and the next
save keeps the short list. This patch writes the new list to /contacts3.new first and swaps it in only after every write worked.
If a restart lands between the delete and the rename, the next start finishes the swap. Other platforms are left as they were.

  python tools/apply_safe_save.py --meshcore MeshCore
NOT hardware-tested. Fails loudly if upstream changed the code it patches.
"""
import argparse, os, re, sys

def die(m): print("\nERROR: " + m + "\n", file=sys.stderr); sys.exit(1)
def once(t, old, new, what):
    if t.count(old) != 1: die("expected exactly 1 match for '%s', found %d. tools/apply_safe_save.py needs updating." % (what, t.count(old)))
    return t.replace(old, new, 1)

SAVE_OPEN_OLD = '  File file = openWrite(_getContactsChannelsFS(), "/contacts3");\n  if (file) {\n    uint32_t idx = 0;'
SAVE_OPEN_NEW = '''  bool cs_ok = true;   // LODESTAR: false if any write failed
#if defined(ESP32)
  // LODESTAR: write the whole list to a NEW file and swap it in only when every write worked, so an interrupted save cannot leave a short list
  FILESYSTEM* cs_fs = _getContactsChannelsFS();
  File file = openWrite(cs_fs, "/contacts3.new");
#else
  File file = openWrite(_getContactsChannelsFS(), "/contacts3");
#endif
  if (file) {
    uint32_t idx = 0;'''
SAVE_FAIL_OLD = '      if (!success) break; // write failed\n\n      idx++;  // advance to next contact\n    }\n    file.close();\n  }\n}\n\nvoid DataStore::loadChannels'
SAVE_FAIL_NEW = '''      if (!success) { cs_ok = false; break; } // write failed

      idx++;  // advance to next contact
    }
    file.close();
#if defined(ESP32)
    if (cs_ok) { cs_fs->remove("/contacts3"); cs_fs->rename("/contacts3.new", "/contacts3"); }   // LODESTAR: swap in the complete list
    else { cs_fs->remove("/contacts3.new"); }                                                    // LODESTAR: keep the last whole list
#endif
  }
  (void)cs_ok;
}

void DataStore::loadChannels'''
LOAD_OLD = 'File file = openRead(_getContactsChannelsFS(), "/contacts3");\n    if (file) {\n      bool full = false;'
LOAD_NEW = '''#if defined(ESP32)
    {  // LODESTAR: finish a save that was interrupted (see saveContacts)
      FILESYSTEM* cs_fs = _getContactsChannelsFS();
      if (!cs_fs->exists("/contacts3") && cs_fs->exists("/contacts3.new")) cs_fs->rename("/contacts3.new", "/contacts3");   // the old file was deleted, the new one is whole
      else if (cs_fs->exists("/contacts3.new")) cs_fs->remove("/contacts3.new");                                           // a save that did not finish: the old list is still whole
    }
#endif
File file = openRead(_getContactsChannelsFS(), "/contacts3");
    if (file) {
      bool full = false;'''

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--meshcore", required=True); a = ap.parse_args()
    p = os.path.join(a.meshcore, "examples", "companion_radio", "DataStore.cpp")
    if not os.path.isfile(p): die("Cannot find %s" % p)
    t = open(p).read()
    if "contacts3.new" in t: die("Already applied. Use a fresh clone.")
    t = once(t, SAVE_OPEN_OLD, SAVE_OPEN_NEW, "saveContacts open")
    t = once(t, SAVE_FAIL_OLD, SAVE_FAIL_NEW, "saveContacts end")
    t = once(t, LOAD_OLD, LOAD_NEW, "loadContacts open")
    open(p, "w").write(t)
    print("Safe contact save applied:\n  ~ examples/companion_radio/DataStore.cpp  (ESP32: write /contacts3.new, then swap)")
if __name__ == "__main__": main()
