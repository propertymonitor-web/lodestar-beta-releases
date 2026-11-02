# PROJECT MATRIX (BETA)

By: Aries Thorne. For: Matrix Comm. Systems.

A companion radio firmware for the Heltec V4 with a Matrix-style dashboard. It is the OTR tactical firmware (NOVA + ORION radar + Mesh Analyzer) with a Matrix boot screen and one extra data line for the dashboard.

## What is in this release
- `matrix-heltec_v4-mph-*` and `matrix-heltec_v4-metric-*`: firmware for the Heltec V4. Use the `-merged.bin` file for a first install and the `-update.bin` file to update a radio that already runs it.
- `matrix.html`: the dashboard. Open it in Chrome or Edge, connect the radio over USB, or click **Try sample data**.

## The dashboard
Splash screen ("PROJECT MATRIX / By: Aries Thorne / For: Matrix Comm. Systems"), falling code, a green phosphor map, and everything the OTR Tactical dashboard has (radar with map, trip line, found nodes, mesh analyzer, battery, offline maps, updates) plus the Matrix deck:
- Link health score, signal weather forecast, packet pulse, link history
- Intercept terminal (every packet heard or sent, filterable)
- Census, top talkers, range records
- Radio link budget (data rate, sensitivity, free-space range, airtime), airtime and duty cycle
- System vitals (chip temperature, memory, uptime, noise floor, battery), compass and motion
- Alerts and triggers with flash and optional beep, and rain trails on the map

## Honest limits
- **Nothing in this beta has been tested on a real radio.** The firmware is built by GitHub Actions and the dashboard was tested with sample data in a browser only.
- Heltec V4 only. Other boards are not built.
- The extra values (chip temperature, memory, airtime, queue) come from a new `{"mx":...}` line the firmware prints every 2 seconds. On a radio that does not send it, those tiles stay on "waiting for the radio".
- Link health, the forecast and the link budget are estimates worked out in the dashboard. Free-space range is a best case with no antenna gain and no obstacles.
- The dashboard loads one web font and map tiles from the internet. Offline it falls back to a system monospace font; offline maps work as in OTR.

Engineered by: Aries Thorne & Todd Steinhauer for Wolf Reactive Systems (WRS)
Special thanks to the NTXMESH community, Meshcore Community, and Pat Steinhauer-Scates for their guidance and support.
