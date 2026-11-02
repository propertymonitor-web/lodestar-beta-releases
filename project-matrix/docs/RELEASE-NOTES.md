# LODESTAR MATRIX PROJECT: matrix_project_beta

PROJECT MATRIX. By: Aries Thorne. For: Matrix Comm. Systems.

A companion radio firmware with a Matrix-style dashboard. **Beta 1. Not yet tested on a real radio.**

## Download
Get **`LODESTAR-MATRIX-PROJECT-beta.zip`**. It holds the User's Manual (PDF), a Quick Start Guide, a README, the dashboard (`matrix.html`) and the firmware.

Start with the Quick Start Guide.

## Firmware files in this release
| File | Radio | Use |
|---|---|---|
| `matrix-heltec_v4-mph-merged.bin` / `-update.bin` | Heltec V4 R2 (with screen) | **US edition** (mph). `merged` for a first install, `update` to keep settings |
| `matrix-heltec_v4-metric-merged.bin` / `-update.bin` | Heltec V4 R2 (with screen) | **UK/EU edition** (km/h) |
| `matrix-heltec_v4_r8-*` | Heltec V4 R8 | Compiled, **untested** |
| `matrix-heltec_v3-*` | Heltec V3 | Compiled, **untested** |
| `matrix.html` | any | The dashboard |

US and UK/EU differ only in the speed unit. The radio region (frequency) is set in the MeshCore app.

## Honest limits
- Nothing here has been run on a real radio by its makers. The firmware builds and the dashboard was tested with sample data in a browser.
- The Heltec V4 R2 is the intended radio. The V4 R8 and V3 builds only prove that the code compiles for them.
- The dashboard's Updates button does not know about MATRIX yet.
- Several dashboard numbers (link health, signal weather, link budget, range guesses) are estimates.

Engineered by: Aries Thorne & Todd Steinhauer for Wolf Reactive Systems (WRS)
Special thanks to the NTXMESH community, Meshcore Community, and Pat Steinhauer-Scates for their guidance and support.
