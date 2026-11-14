#include "../nova/Contacts.h"
#include <vector>
#include <string>
#include <random>
#include <cstdlib>
using namespace nova::contacts;
static int fails = 0, checks = 0;
#define CHECK(c) do { checks++; if (!(c)) { fails++; printf("FAIL line %d: %s\n", __LINE__, #c); } } while (0)

struct FakeStore {
  std::vector<Rec> v; int cap = 5; uint8_t self[32]; FakeStore() { memset(self, 0xEE, 32); }
  int count() { return (int)v.size(); }
  bool get(int i, Rec& r) { if (i < 0 || i >= (int)v.size()) return false; r = v[i]; return true; }
  bool has(const uint8_t* k) { for (auto& r : v) if (!memcmp(r.key, k, 32)) return true; return false; }
  bool isSelf(const uint8_t* k) { return !memcmp(self, k, 32); }
  bool pathLenOk(uint8_t p) { return (p & 63) <= 64 && (p >> 6) != 3; }   // stand-in for the radio's own rule
  bool add(const Rec& r) { if ((int)v.size() >= cap) return false; v.push_back(r); return true; }
};
struct Cap { std::vector<std::string> L; void put(const char* s) { L.push_back(s); } };

static Rec mk(uint8_t seed, const char* name) {
  Rec r; memset(&r, 0, sizeof(r)); for (int i = 0; i < 32; i++) r.key[i] = (uint8_t)(seed + i);
  r.type = 1; r.flags = 2; r.plen = 3; r.path[0] = 0xAA; r.path[1] = 0xBB; r.path[2] = 0xCC;
  r.lastadv = 1700000000; r.lastmod = 1700000100; r.lat = -97123456; r.lon = 32123456; strcpy(r.name, name); return r;
}
// the same conversion the dashboard does, in C++, so this test can close the loop
static std::string addLineFromExport(const std::string& j) {
  auto get = [&](const char* k) { std::string p = std::string("\"") + k + "\":"; size_t a = j.find(p) + p.size(); bool q = j[a] == '"'; if (q) a++; size_t b = a; while (b < j.size() && (q ? j[b] != '"' : (j[b] != ',' && j[b] != '}'))) b++; return j.substr(a, b - a); };
  std::string p = get("p"); if (p.empty()) p = "-";
  return "add " + get("k") + " " + get("t") + " " + get("f") + " " + get("pl") + " " + p + " " + get("la") + " " + get("lm") + " " + get("lat") + " " + get("lon") + " " + get("nh");
}

int main() {
  // 1. export lines are what the dashboard expects
  { Rec r = mk(1, "Ada ☃"); char b[512]; size_t n = formatLine(r, b, sizeof b); CHECK(n > 0); std::string s(b);
    CHECK(s.find("\"nova\":1,\"contact\":{\"k\":\"0102") == 1); CHECK(s.find("\"p\":\"aabbcc\"") != std::string::npos); CHECK(s.find("\"lat\":-97123456") != std::string::npos);
    char tiny[20]; CHECK(formatLine(r, tiny, sizeof tiny) == 0); }
  // 2. round trip: export a store, import into an empty one, identical
  { FakeStore a; a.cap = 50; a.v.push_back(mk(1, "Ada")); a.v.push_back(mk(40, "Ben \xF0\x9F\x90\x95")); Rec rp = mk(90, "Repeater"); rp.type = 2; rp.plen = 0xFF; memset(rp.path, 0, 64); a.v.push_back(rp);
    Rec full = mk(120, "Full path"); full.plen = 64; for (int i = 0; i < 64; i++) full.path[i] = (uint8_t)(i + 1); a.v.push_back(full);
    Exporter e; Cap out; e.start(); int calls = 0; while (e.active()) { e.pump(a, out, 2); calls++; }
    CHECK(out.L.size() == 5); CHECK(calls == 2); CHECK(out.L.back().find("\"contacts_end\":4,\"sent\":4") != std::string::npos);
    FakeStore b; b.cap = 50; Cap ack;
    for (size_t i = 0; i + 1 < out.L.size(); i++) { std::string l = addLineFromExport(out.L[i]); std::vector<char> buf(l.begin(), l.end()); buf.push_back(0); CHECK(handleAdd(buf.data(), b, ack) == ADDED); }
    CHECK(b.v.size() == 4);
    for (size_t i = 0; i < 4; i++) { CHECK(!memcmp(a.v[i].key, b.v[i].key, 32)); CHECK(!strcmp(a.v[i].name, b.v[i].name)); CHECK(a.v[i].type == b.v[i].type && a.v[i].flags == b.v[i].flags && a.v[i].plen == b.v[i].plen);
      CHECK(!memcmp(a.v[i].path, b.v[i].path, 64)); CHECK(a.v[i].lastadv == b.v[i].lastadv && a.v[i].lastmod == b.v[i].lastmod && a.v[i].lat == b.v[i].lat && a.v[i].lon == b.v[i].lon); }
    // importing again changes nothing
    for (size_t i = 0; i + 1 < out.L.size(); i++) { std::string l = addLineFromExport(out.L[i]); std::vector<char> buf(l.begin(), l.end()); buf.push_back(0); CHECK(handleAdd(buf.data(), b, ack) == KEPT); }
    CHECK(b.v.size() == 4); }
  // 3. never overwrites: same key, different name stays as it was
  { FakeStore s; s.v.push_back(mk(1, "Mine")); char l[512]; Rec r = mk(1, "Theirs"); char hx[600]; formatLine(r, hx, sizeof hx);
    std::string a = addLineFromExport(hx); strcpy(l, a.c_str()); Cap c; CHECK(handleAdd(l, s, c) == KEPT); CHECK(!strcmp(s.v[0].name, "Mine")); }
  // 4. own key, full table, bad fields
  { FakeStore s; Cap c; Rec me = mk(0, "me"); memset(me.key, 0xEE, 32); char hx[600]; formatLine(me, hx, sizeof hx); std::string a = addLineFromExport(hx); std::vector<char> b(a.begin(), a.end()); b.push_back(0);
    CHECK(handleAdd(b.data(), s, c) == SELF); CHECK(s.v.empty());
    s.cap = 1; s.v.push_back(mk(5, "x")); Rec r = mk(9, "y"); formatLine(r, hx, sizeof hx); a = addLineFromExport(hx); b.assign(a.begin(), a.end()); b.push_back(0); CHECK(handleAdd(b.data(), s, c) == FULL); }
  { const char* bad[] = { "add", "add zz", "add 00 1 0 0 - 0 0 0 0 41", "x", "", "add  ", };
    FakeStore s; Cap c; for (auto b : bad) { std::vector<char> v(b, b + strlen(b) + 1); CHECK(handleAdd(v.data(), s, c) == BAD); } CHECK(s.v.empty()); }
  { Rec r = mk(3, "ok"); char hx[600]; formatLine(r, hx, sizeof hx); std::string base = addLineFromExport(hx);
    auto tryit = [&](std::string line) { FakeStore s; Cap c; std::vector<char> v(line.begin(), line.end()); v.push_back(0); return handleAdd(v.data(), s, c); };
    CHECK(tryit(base) == ADDED);
    std::string z = base; z.replace(z.find(" 1 2 3 "), 7, " 0 2 3 "); CHECK(tryit(z) == BAD);      // type 0 (not a real contact)
    z = base; z.replace(z.find(" 1 2 3 "), 7, " 5 2 3 "); CHECK(tryit(z) == BAD);                 // type 5
    z = base; z.replace(z.find(" 1 2 3 "), 7, " 1 256 3 "); CHECK(tryit(z) == BAD);               // flags too big
    z = base; z.replace(z.find(" 1 2 3 "), 7, " 1 2 255 "); CHECK(tryit(z) == ADDED);             // unknown route
    z = base; z.replace(z.find(" 1 2 3 "), 7, " 1 2 192 "); CHECK(tryit(z) == BAD);               // radio's own rule rejects it
    z = base; z += "00"; CHECK(tryit(z) == BAD);                                                   // a NUL byte inside the name
  }
  // 5. names: control chars, bad UTF-8, too long, empty
  { auto nm = [](const char* h) { uint8_t b[40]; size_t n = 0; return parseHex(h, b, 40, n) && goodName(b, n); };
    CHECK(nm("41")); CHECK(nm("e298ba")); CHECK(!nm("")); CHECK(!nm("00")); CHECK(!nm("4100")); CHECK(!nm("0a")); CHECK(!nm("7f")); CHECK(!nm("c0af")); CHECK(!nm("eda080")); CHECK(!nm("e298")); CHECK(!nm("f4908080")); CHECK(!nm("ff"));
    CHECK(nm("414141414141414141414141414141414141414141414141414141414141" "41")); /* 31 bytes */ CHECK(!nm("41414141414141414141414141414141414141414141414141414141414141" "41")); /* 32 bytes */ }
  // 6. fuzz: random lines and random mutations never crash and never add a contact with a bad name/type
  { std::mt19937 g(7); FakeStore s; s.cap = 100000; Cap c; Rec r = mk(3, "seed"); char hx[600]; formatLine(r, hx, sizeof hx); std::string base = addLineFromExport(hx);
    for (int i = 0; i < 200000; i++) { std::string l = base; int k = g() % 4; for (int j = 0; j <= k; j++) { size_t p = g() % l.size(); int m = g() % 3; if (m == 0) l[p] = (char)(g() % 256); else if (m == 1) l.erase(p, 1 + g() % 3); else l.insert(p, 1, (char)(32 + g() % 90)); }
      if (l.size() > 400) { l.resize(400); }
      std::vector<char> v(l.begin(), l.end()); v.push_back(0); c.L.clear(); handleAdd(v.data(), s, c); }
    for (auto& x : s.v) { CHECK(x.type >= 1 && x.type <= 4); CHECK(strlen(x.name) >= 1 && strlen(x.name) < 32); CHECK(goodName((const uint8_t*)x.name, strlen(x.name))); } }
  printf("%d checks, %d failed\n", checks, fails);
  return fails ? 1 : 0;
}
