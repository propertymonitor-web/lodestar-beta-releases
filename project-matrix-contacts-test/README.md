# Matrix contacts backup (TEST BUILD)

Lives beside `project-matrix/` and changes nothing in it. Built by `.github/workflows/build-matrix-contacts.yml`, which only ever makes a DRAFT release (not public).

Imagined and engineered by: Aries Thorne & Todd Steinhauer for Wolf Reactive Systems (WRS)
Moral Support: Athena the K9

Keeps the contact list of a Matrix radio in a file on the computer it is plugged into, and puts missing contacts back.
Designed so it can move to Cairn later (same radio-side commands; the tile would go into Cairn's dashboard).

## STATUS
- Tested on a PC: the radio-side logic (2,810 checks, 200,000 mangled lines, memory and undefined-behavior checkers on), the
  file format and checks (28 checks, 20,000 mangled files), and the dashboard tile in a real browser against a PRETEND radio.
- NOT tested on a real radio. The patches apply to the pinned MeshCore commit; the real firmware is compiled by the workflow above.
- NOT tested in Firefox or Safari (they cannot keep a file open; the tile falls back to open and download).

## How it works
- The radio's USB port (free in Matrix, because the phone uses Bluetooth) answers two new text commands:
  - `nova contacts` streams one JSON line per contact, then a line with the count.
  - `nova contact add ...` adds one contact if the radio does not have it. It never changes or removes an existing one, refuses the
    radio's own key, refuses bad names and types, and refuses when the list is full (it never pushes a contact out).
- The dashboard tile (Chrome or Edge on a computer) asks you to create or choose ONE file, remembers it, and then:
  - **Compare** shows what the file and the radio each have that the other lacks. Nothing changes.
  - **Back up now** writes the radio's contacts into the file. The file only grows: a contact the radio no longer has stays in the file.
  - **Restore** adds the file's missing contacts to the radio. Only when you press it. A reconnect never restores by itself.
  - When a radio connects and the file is already allowed, it compares and tops up the backup automatically. It never restores by itself.
- The file holds names and public keys. No private keys exist anywhere in this code. The file is not encrypted: keep it private.
- Nothing runs on the phone. It is USB and a computer only.

## Known limits
- The browser asks permission to change the file each time you open the page. If you open the dashboard as a downloaded file
  (file://) the browser may not remember the file choice between visits; choosing it again is the workaround.
- The radio keeps its own contact file and saves a few seconds after changes. The phone app may need to reconnect to show restored contacts.
- A radio contact whose name is not valid text is not listed (the page says how many).
- Fast restore of hundreds of contacts takes a while (one at a time, each confirmed).

## Files
- `nova/Contacts.h` radio-side logic (no hardware calls) · `tools/apply_contacts.py` patches MeshCore after `apply_nova.py`
- `dashboard/contacts_model.js` file format and checks · `contacts_ui.js`, `contacts_tile.*` the tile · `tools/build_contacts_dashboard.py`
- `dashboard/matrix-contacts.html` the built dashboard (own id `matrix-contacts`; the standard Matrix dashboard is untouched)
- `test/` all tests · `run_tests.sh` runs them · `docs/contacts-tile-backed-up.png` how the tile looks

## Safe contact save (also in this build)
MeshCore saves contacts by emptying one file and rewriting it; a restart part-way leaves a short list that is loaded without any error. `tools/apply_safe_save.py` (ESP32 only) writes `/contacts3.new` first and swaps it in only when every write worked. Not hardware-tested.

## Build the firmware
    git clone --depth 1 https://github.com/meshcore-dev/MeshCore.git
    python lodestar_nova_alpha/tools/apply_nova.py --meshcore MeshCore
    python tools/apply_contacts.py --meshcore MeshCore
    cd MeshCore && pio run -e <Heltec V4 companion BLE env>
