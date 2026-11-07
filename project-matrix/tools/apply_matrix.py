#!/usr/bin/env python3
# Imagined and engineered by:
# Aries Thorne & Todd Steinhauer
#
# Moral Support: Athena the K9
"""PROJECT MATRIX firmware patch. Run AFTER the OTR chain (apply_nova, apply_orion_wolf, apply_orion_mesh, apply_orion_tactical).

usage: apply_matrix.py --meshcore /path/to/MeshCore      (build with -DMATRIX=1 on top of the OTR flags)

What it changes:
  * the edition: product MATRIX, "ed":"matrix" in the dashboard frame, version "0.1.0-matrix" (+ "-mph")
  * the boot screen: PROJECT MATRIX / By: Aries Thorne / For: Matrix Comm. Systems
  * the extra data stream the Matrix dashboard shows: one {"mx":{...}} line every 2 s while a dashboard is connected
    (chip temperature, memory, airtime, packet counters, queue, noise floor, radio settings, battery)
Every anchor must match exactly once, or the build stops.
"""
import argparse, os, sys

ap = argparse.ArgumentParser()
ap.add_argument("--meshcore", required=True)
a = ap.parse_args()
cr = os.path.join(a.meshcore, "examples", "companion_radio")


def patch(path, edits):
    if not os.path.exists(path): sys.exit("missing " + path)
    s = open(path).read()
    for name, old, new in edits:
        n = s.count(old)
        if n != 1: sys.exit("anchor '%s' matched %d times in %s (need exactly 1)" % (name, n, os.path.basename(path)))
        s = s.replace(old, new); print("  +", name)
    open(path, "w").write(s)


# find the NOVA header wherever apply_nova put it
nova_h = os.path.join(a.meshcore, "src", "helpers", "Nova.h")
pages_h = os.path.join(cr, "ui-new", "NovaPages.h")
if not os.path.exists(nova_h) or not os.path.exists(pages_h): sys.exit("apply NOVA first (Nova.h / NovaPages.h not found)")

print("Nova.h")
patch(nova_h, [
    ("matrix edition", "// Speed units. The default build speaks km/h;",
     "#if defined(MATRIX) && MATRIX\n"
     "// PROJECT MATRIX: the OTR tactical firmware with its own name, version and extra dashboard data\n"
     "#undef NOVA_PRODUCT\n#undef NOVA_EDITION\n#undef NOVA_VER_SFX\n"
     "#define NOVA_PRODUCT        \"MATRIX\"\n#define NOVA_EDITION        \"matrix\"\n#define NOVA_VER_SFX        \"-matrix\"\n"
     "#define NOVA_VBASE          \"0.1.0\"\n#else\n#define NOVA_VBASE          \"0.1.2-beta\"\n#endif\n\n"
     "// Speed units. The default build speaks km/h;"),
    ("version mph", 'NOVA_VERSION        "0.1.2-beta" NOVA_VER_SFX "-mph"', 'NOVA_VERSION        NOVA_VBASE NOVA_VER_SFX "-mph"'),
    ("version metric", 'NOVA_VERSION        "0.1.2-beta" NOVA_VER_SFX\n', 'NOVA_VERSION        NOVA_VBASE NOVA_VER_SFX\n'),
])

print("NovaPages.h (boot screen)")
patch(pages_h, [
    ("matrix splash", "#ifdef NOVA_ORION\n  // ORION: smaller emblem top-left, name beside it, credits across the bottom.\n",
     "#if defined(MATRIX) && MATRIX\n"
     "  // PROJECT MATRIX: no emblem, just the words\n"
     "  d.setColor(UIColor::primary_txt);\n"
     "  d.setTextSize(1); d.drawTextCentered(d.width() / 2, 0, \"PROJECT\");\n"
     "  d.setTextSize(2); d.drawTextCentered(d.width() / 2, 9, \"MATRIX\");\n"
     "  d.setTextSize(1);\n"
     "  d.drawTextCentered(d.width() / 2, 29, \"By: Aries Thorne\");\n"
     "  d.drawTextCentered(d.width() / 2, 40, \"For: Matrix\");\n"
     "  d.drawTextCentered(d.width() / 2, 50, \"Comm. Systems\");\n"
     "  return;\n"
     "#endif\n"
     "#ifdef NOVA_ORION\n  // ORION: smaller emblem top-left, name beside it, credits across the bottom.\n"),
])

print("MyMesh.cpp (mx stream)")
MX = r'''  {   // PROJECT MATRIX: extra data for the Matrix dashboard, one line every 2 s while a dashboard is connected
    static uint32_t nv_mx_next = 0;
    if (nova_core.dash_on && (int32_t)(nv_now - nv_mx_next) >= 0) {
      nv_mx_next = nv_now + 2000u;
      static char nv_mx[520];
#ifdef ESP32
      float nv_mx_t = temperatureRead();
      uint32_t nv_mx_hp = ESP.getFreeHeap(), nv_mx_hm = ESP.getMinFreeHeap(), nv_mx_hs = ESP.getHeapSize(), nv_mx_cpu = ESP.getCpuFreqMHz();
#else
      float nv_mx_t = 0; uint32_t nv_mx_hp = 0, nv_mx_hm = 0, nv_mx_hs = 0, nv_mx_cpu = 0;
#endif
      int nv_mx_n = snprintf(nv_mx, sizeof(nv_mx),
        "{\"mx\":{\"t\":%.1f,\"hp\":%lu,\"hm\":%lu,\"hs\":%lu,\"cpu\":%lu,\"up\":%lu,\"atx\":%lu,\"arx\":%lu,"
        "\"sf\":%lu,\"sd\":%lu,\"rf\":%lu,\"rd\":%lu,\"q\":%d,\"nf\":%d,\"mv\":%d,\"fq\":%.3f,\"sfac\":%d,\"bw\":%.1f,\"cr\":%d,\"txp\":%d}}",
        (double)nv_mx_t, (unsigned long)nv_mx_hp, (unsigned long)nv_mx_hm, (unsigned long)nv_mx_hs, (unsigned long)nv_mx_cpu, (unsigned long)(nv_now / 1000u),
        (unsigned long)getTotalAirTime(), (unsigned long)getReceiveAirTime(),
        (unsigned long)getNumSentFlood(), (unsigned long)getNumSentDirect(), (unsigned long)getNumRecvFlood(), (unsigned long)getNumRecvDirect(),
        (int)_mgr->getOutboundCount(nv_now), (int)_radio->getNoiseFloor(), (int)nova_core.batt.mv(),
        (double)_prefs.freq, (int)_prefs.sf, (double)_prefs.bw, (int)_prefs.cr, (int)_prefs.tx_power_dbm);
      if (nv_mx_n > 0 && nv_mx_n < (int)sizeof(nv_mx)) { Serial.write((const uint8_t*)nv_mx, (size_t)nv_mx_n); Serial.write('\n'); }
    }
  }
  static bool nv_was_on = false;
'''
patch(os.path.join(cr, "MyMesh.cpp"), [
    ("mx stream", "  static bool nv_was_on = false;\n", MX),
])
print("matrix applied")
