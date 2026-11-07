# LODESTAR MATRIX PROJECT: matrix_project_beta

PROJECT MATRIX. By: Aries Thorne. For: Matrix Comm. Systems.

A companion radio firmware with a Matrix-style dashboard. **Beta. Used by its makers on a real Heltec V4 R2 (computer browser and Android app). Not tested on the V4 R8 or V3.**

## Download
Get **`LODESTAR-MATRIX-PROJECT-Heltec-V4-R2-beta.zip`** (or the R8 or V3 zip, both untested). Each holds the User's Manual (PDF), a Quick Start Guide, a README, the dashboard (`matrix.html`), the Android app (`Matrix-MNA-dashboard.apk`) and the firmware. The manual and Quick Start were updated for dashboard 1.2.0 and the Android app.

Start with the Quick Start Guide.

## Firmware files in this release
| File | Radio | Use |
|---|---|---|
| `matrix-heltec_v4-mph-merged.bin` / `-update.bin` | Heltec V4 R2 (with screen) | **US edition** (mph). `merged` for a first install, `update` to keep settings |
| `matrix-heltec_v4-metric-merged.bin` / `-update.bin` | Heltec V4 R2 (with screen) | **UK/EU edition** (km/h) |
| `matrix-heltec_v4_r8-*` | Heltec V4 R8 | Compiled, **untested** |
| `matrix-heltec_v3-*` | Heltec V3 | Compiled, **untested** |
| `matrix.html` | any | The dashboard |
| `Matrix-MNA-dashboard.apk` | Android phone | The dashboard as an app, connects over USB (tested on the V4 R2) |

US and UK/EU differ only in the speed unit. The radio region (frequency) is set in the MeshCore app.

## Dashboard 1.2.0
- **Share a trace between devices.** "Share trace" packs the recorded route and the nodes heard into one file and opens the phone's share sheet (or saves the file when sharing is not available). "Open a trace file" on another device, such as the laptop, loads that file straight into the replay. Used from the Android app on a phone to a laptop and works.

## Dashboard 1.1.1-beta1
- **Phone home-screen icon.** When the dashboard is opened from its hosted web address in Chrome on Android, Chrome's menu offers Install app / Add to Home screen with a Matrix icon. A copy opened from a file does not get this. Not tested on a phone.

## Dashboard 1.1.0-beta1
- **Replay last trace.** New button in the map bar. It opens a full-screen map that starts close up on the first point of the last recorded trip (zoom is adjustable) and replays the route. Where the radio stood still the marker waits, and a banner shows how long the stop was; each stop stays marked on the map. Repeaters, companions and room servers appear when they were first heard, and hovering one shows its name and radio ID. Speed, pause, restart and a position slider are included, plus a "Hurry through stops" option. Stops are gaps of 30 seconds or more between recorded points, so a gap with no GPS fix also looks like a stop. Tested with simulated data in a browser only, not on a radio. The offline map is used if one is loaded, otherwise the online map.

## Dashboard 1.0.3-beta1
- **Compass option for the radar.** New tick box "Use this device's compass" above the radar. When it is on, the radar and map under it turn with the compass in the phone or tablet showing the page, so they turn the moment you turn, even standing still. Without it, the radar still follows the GPS course, which only exists while moving. A radio has no compass of its own; this is the direction the phone is facing. iPhones ask for permission. Tested with simulated compass readings in a browser only.

## Dashboard 1.0.2-beta1
- **Heading-up radar.** While Follow me is on, the radar turns so the direction you are travelling is at the top (the compass letters, rings and contacts turn with it, and the map under the radar turns too). It uses the GPS course, which only updates while moving, so it holds the last heading when you stop. Tick box above the radar turns it off. Tested with the sample trip in a browser only, not on a radio.

## Honest limits
- The Heltec V4 R2 firmware, the dashboard on a computer and the Android app on a phone have been used by the makers on a real V4 R2. Heading-up radar, the compass option and the offline map in the replay were tried with sample trips and simulated readings, not on a long real trip.
- The V4 R8 and V3 builds only prove that the code compiles for them.
- The dashboard's Updates button updates the dashboard (`matrix.html`) only. It does not flash MATRIX firmware and it does not update the Android app.
- Several dashboard numbers (link health, signal weather, link budget, range guesses) are estimates.

Engineered by: Aries Thorne & Todd Steinhauer for Wolf Reactive Systems (WRS)
Special thanks to the NTXMESH community, Meshcore Community, and Pat Steinhauer-Scates for their guidance and support.

## Android app (1.2.0-app1)
`matrix_project_beta/Matrix-MNA-dashboard.apk`, also inside each radio zip: the dashboard as an Android app that connects over USB with its own driver. Tested on a phone with the Heltec V4 R2 (works); not tested with other radios.
