// Imagined and engineered by:
// Aries Thorne & Todd Steinhauer
//
// Moral Support: Athena the K9
//
// NOVA contacts backup (TEST BUILD): lets the Matrix dashboard, over USB, read the radio's contact list and
// add missing contacts back. Hardware-free so it can be tested on a PC. The radio side (MyMesh) is a small
// adapter that is added by tools/apply_contacts.py.
//
// STATUS: tested on a PC against a pretend contact store. NOT run on a real radio yet.
//
// Commands (USB text, same link as the other "nova" commands):
//   nova contacts                       -> one JSON line per contact, then {"nova":1,"contacts_end":N,...}
//   nova contact add <key> <type> <flags> <plen> <path|-> <lastadv> <lastmod> <lat> <lon> <namehex>
//                                       -> {"nova":1,"contact_ack":{"k":"..","r":"added|kept|self|full|bad","why":".."}}
// Rules that keep this safe:
//   * Import only ADDS. A contact the radio already has is left exactly as it is ("kept").
//   * The radio's own key is refused. Types other than 1..4 are refused. Names must be valid text.
//   * Private keys are never read, written or sent by this code.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdio.h>

namespace nova {
namespace contacts {

constexpr int KEY_LEN = 32, PATH_MAX_BYTES = 64, NAME_MAX_BYTES = 32;   // name is at most 31 bytes + 0
constexpr uint8_t PATH_UNKNOWN = 0xFF;

struct Rec {
  uint8_t key[KEY_LEN];
  uint8_t type, flags, plen;        // plen is the radio's raw path-length byte (0xFF = no route known)
  uint8_t path[PATH_MAX_BYTES];
  uint32_t lastadv, lastmod;
  int32_t lat, lon;
  char name[NAME_MAX_BYTES];
};

inline int hexval(char c) { return c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : c >= 'A' && c <= 'F' ? c - 'A' + 10 : -1; }
inline void hexOut(char* o, const uint8_t* b, size_t n) { static const char* H = "0123456789abcdef"; for (size_t i = 0; i < n; i++) { o[2 * i] = H[b[i] >> 4]; o[2 * i + 1] = H[b[i] & 15]; } o[2 * n] = 0; }

// Is this well-formed UTF-8 with no control characters (so it can go into a file, a page and a name field)?
inline bool goodName(const uint8_t* s, size_t n) {
  if (n == 0 || n >= NAME_MAX_BYTES) return false;
  for (size_t i = 0; i < n;) {
    uint8_t c = s[i];
    if (c < 0x20 || c == 0x7F) return false;
    size_t k = c < 0x80 ? 1 : (c >= 0xC2 && c <= 0xDF) ? 2 : (c >= 0xE0 && c <= 0xEF) ? 3 : (c >= 0xF0 && c <= 0xF4) ? 4 : 0;
    if (!k || i + k > n) return false;
    for (size_t j = 1; j < k; j++) if ((s[i + j] & 0xC0) != 0x80) return false;
    if (k == 3 && ((c == 0xE0 && s[i + 1] < 0xA0) || (c == 0xED && s[i + 1] >= 0xA0))) return false;   // overlong, surrogate
    if (k == 4 && ((c == 0xF0 && s[i + 1] < 0x90) || (c == 0xF4 && s[i + 1] >= 0x90))) return false;
    i += k;
  }
  return true;
}

// One contact as one JSON line (no newline). Returns the length, or 0 if it does not fit in cap.
inline size_t formatLine(const Rec& r, char* out, size_t cap) {
  char key[KEY_LEN * 2 + 1], path[PATH_MAX_BYTES * 2 + 1], nh[NAME_MAX_BYTES * 2 + 1];
  hexOut(key, r.key, KEY_LEN);
  size_t pn = PATH_MAX_BYTES; while (pn > 0 && r.path[pn - 1] == 0) pn--;       // trailing zeros are padding
  hexOut(path, r.path, pn);
  size_t nl = strnlen(r.name, NAME_MAX_BYTES - 1);
  hexOut(nh, (const uint8_t*)r.name, nl);
  int n = snprintf(out, cap, "{\"nova\":1,\"contact\":{\"k\":\"%s\",\"t\":%u,\"f\":%u,\"pl\":%u,\"p\":\"%s\",\"la\":%lu,\"lm\":%lu,\"lat\":%ld,\"lon\":%ld,\"nh\":\"%s\"}}",
                   key, r.type, r.flags, r.plen, path, (unsigned long)r.lastadv, (unsigned long)r.lastmod, (long)r.lat, (long)r.lon, nh);
  return (n > 0 && (size_t)n < cap) ? (size_t)n : 0;
}

enum Result { ADDED, KEPT, SELF, FULL, BAD };

// Split on single spaces; strict. Fills `t` with up to max pointers into the (modified) line.
inline int split(char* s, char** t, int max) {
  int n = 0;
  while (*s) {
    if (n >= max) return -1;
    t[n++] = s;
    while (*s && *s != ' ') s++;
    if (*s == ' ') { *s++ = 0; if (*s == ' ' || *s == 0) return -1; }   // double or trailing space
  }
  return n;
}
inline bool parseU(const char* s, uint32_t maxv, uint32_t& v) {
  if (!*s || strlen(s) > 10) return false;
  uint64_t x = 0;
  for (; *s; s++) { if (*s < '0' || *s > '9') return false; x = x * 10 + (uint64_t)(*s - '0'); }
  if (x > maxv) return false;
  v = (uint32_t)x; return true;
}
inline bool parseI(const char* s, int32_t& v) {
  bool neg = (*s == '-'); if (neg) s++;
  uint32_t u; if (!parseU(s, 2147483647u, u)) return false;
  v = neg ? -(int32_t)u : (int32_t)u; return true;
}
inline bool parseHex(const char* s, uint8_t* out, size_t maxBytes, size_t& n) {
  size_t l = strlen(s);
  if (l % 2 || l / 2 > maxBytes) return false;
  for (size_t i = 0; i < l; i += 2) { int a = hexval(s[i]), b = hexval(s[i + 1]); if (a < 0 || b < 0) return false; out[i / 2] = (uint8_t)(a * 16 + b); }
  n = l / 2; return true;
}

// Parse the "add ..." arguments (the text after "nova contact "). `line` is modified. why is set on BAD.
inline bool parseAdd(char* line, Rec& r, const char** why) {
  char* t[12]; int n = split(line, t, 12);
  *why = "fields";
  if (n != 11 || strcmp(t[0], "add") != 0) return false;
  memset(&r, 0, sizeof(r));
  size_t got;
  if (strlen(t[1]) != KEY_LEN * 2 || !parseHex(t[1], r.key, KEY_LEN, got)) { *why = "key"; return false; }
  uint32_t v;
  if (!parseU(t[2], 255, v) || v < 1 || v > 4) { *why = "type"; return false; } r.type = (uint8_t)v;
  if (!parseU(t[3], 255, v)) { *why = "flags"; return false; } r.flags = (uint8_t)v;
  if (!parseU(t[4], 255, v)) { *why = "plen"; return false; } r.plen = (uint8_t)v;
  if (strcmp(t[5], "-") != 0) { if (!parseHex(t[5], r.path, PATH_MAX_BYTES, got)) { *why = "path"; return false; } }
  if (!parseU(t[6], 0xFFFFFFFFu, r.lastadv)) { *why = "lastadv"; return false; }
  if (!parseU(t[7], 0xFFFFFFFFu, r.lastmod)) { *why = "lastmod"; return false; }
  if (!parseI(t[8], r.lat)) { *why = "lat"; return false; }
  if (!parseI(t[9], r.lon)) { *why = "lon"; return false; }
  uint8_t nm[NAME_MAX_BYTES + 2];
  if (strlen(t[10]) > 2 * NAME_MAX_BYTES || !parseHex(t[10], nm, NAME_MAX_BYTES, got) || !goodName(nm, got)) { *why = "name"; return false; }
  memcpy(r.name, nm, got); r.name[got] = 0;
  return true;
}

// Store: int count(); bool get(int, Rec&); bool has(const uint8_t* key); bool isSelf(const uint8_t* key);
//        bool pathLenOk(uint8_t plen); bool add(const Rec&)   (false = the radio's list is full)
// Out:   void put(const char* line_without_newline)   (the adapter adds the newline)
template <class Store, class Out>
inline Result handleAdd(char* args, Store& s, Out& o) {
  Rec r; const char* why = "";
  char ack[160];
  if (!parseAdd(args, r, &why)) { snprintf(ack, sizeof(ack), "{\"nova\":1,\"contact_ack\":{\"k\":\"\",\"r\":\"bad\",\"why\":\"%s\"}}", why); o.put(ack); return BAD; }
  if (r.plen != PATH_UNKNOWN && !s.pathLenOk(r.plen)) { snprintf(ack, sizeof(ack), "{\"nova\":1,\"contact_ack\":{\"k\":\"\",\"r\":\"bad\",\"why\":\"plen\"}}"); o.put(ack); return BAD; }
  char k12[13]; hexOut(k12, r.key, 6);
  Result res; const char* word;
  if (s.isSelf(r.key)) { res = SELF; word = "self"; }
  else if (s.has(r.key)) { res = KEPT; word = "kept"; }
  else if (!s.add(r)) { res = FULL; word = "full"; }
  else { res = ADDED; word = "added"; }
  snprintf(ack, sizeof(ack), "{\"nova\":1,\"contact_ack\":{\"k\":\"%s\",\"r\":\"%s\"}}", k12, word);
  o.put(ack);
  return res;
}

// Sends the contact list a few lines per call so the radio keeps working while it streams.
class Exporter {
 public:
  bool active() const { return _on; }
  void start() { _on = true; _i = 0; _sent = 0; _total = -1; }
  template <class Store, class Out>
  void pump(Store& s, Out& o, int budget) {
    if (!_on) return;
    if (_total < 0) _total = s.count();
    char line[512];
    while (budget-- > 0 && _i < _total) {
      Rec r;
      // only what an import would accept goes out, so the file never holds an entry that cannot be restored
      if (s.get(_i++, r) && r.type >= 1 && r.type <= 4 && goodName((const uint8_t*)r.name, strnlen(r.name, NAME_MAX_BYTES - 1))) { size_t n = formatLine(r, line, sizeof(line)); if (n) { o.put(line); _sent++; } }
    }
    if (_i >= _total) {
      snprintf(line, sizeof(line), "{\"nova\":1,\"contacts_end\":%d,\"sent\":%d}", _total, _sent);
      o.put(line); _on = false;
    }
  }
 private:
  bool _on = false; int _i = 0, _sent = 0, _total = -1;
};

}  // namespace contacts
}  // namespace nova
