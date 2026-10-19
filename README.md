# LODESTAR beta releases

The beta downloads for the LODESTAR family of MeshCore firmware, by FEAR REACTIVE.

**Beta 1 downloads are in the [`beta1`](beta1) folder.** There is one setup zip per product and region, plus [`LODESTAR-ALL-beta1.zip`](https://github.com/propertymonitor-web/loadstar-beta-releases/raw/main/beta1/LODESTAR-ALL-beta1.zip) with everything in one download. Every zip has its own step-by-step `setup.txt` or `readme.txt` for beginners.

| Product | What it is | Zips |
|---|---|---|
| **NOVA** | Companion firmware | [`LODESTAR-NOVA-US-beta1.zip`](https://github.com/propertymonitor-web/loadstar-beta-releases/raw/main/beta1/LODESTAR-NOVA-US-beta1.zip), [`LODESTAR-NOVA-EU-beta1.zip`](https://github.com/propertymonitor-web/loadstar-beta-releases/raw/main/beta1/LODESTAR-NOVA-EU-beta1.zip) |
| **ORION** | Wardriving edition of NOVA | [`LODESTAR-ORION-beta1.zip`](https://github.com/propertymonitor-web/loadstar-beta-releases/raw/main/beta1/LODESTAR-ORION-beta1.zip) (US and EU inside) |
| **PULSAR** | Repeater | [`LODESTAR-PULSAR-US-beta1.zip`](https://github.com/propertymonitor-web/loadstar-beta-releases/raw/main/beta1/LODESTAR-PULSAR-US-beta1.zip), [`LODESTAR-PULSAR-EU-beta1.zip`](https://github.com/propertymonitor-web/loadstar-beta-releases/raw/main/beta1/LODESTAR-PULSAR-EU-beta1.zip) |
| **HEARTH** | Room server (XIAO ESP32S3) | Release assets in the [lodestar.alpha2 releases](https://github.com/propertymonitor-web/lodestar.alpha2/releases) |
| **HELIOS** | Solar repeater | In development, not released |

Read [`LODESTAR-OVERVIEW.txt`](LODESTAR-OVERVIEW.txt) for what each one does, how they differ from other options, and a Q&A.

US builds use mph and US region settings. EU builds use km/h and EU/UK region settings.

Source code and build workflows:
[NOVA / ORION](https://github.com/propertymonitor-web/lodestar_nova_alpha) and
[PULSAR / HEARTH](https://github.com/propertymonitor-web/lodestar.alpha2).
Offline map files for the dashboard are on the
[maps release](https://github.com/propertymonitor-web/lodestar_nova_alpha/releases/tag/maps).

**Beta test builds, provided without warranty.** A radio mesh is a backup, not a replacement for 911 or a phone. Never power a radio without its antenna.
