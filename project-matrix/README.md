# PROJECT MATRIX

By: Aries Thorne. For: Matrix Comm. Systems. Beta, untested on hardware.

Companion firmware for the Heltec V4 plus a Matrix-style dashboard (falling code, phosphor-green map, a deck of live radio data).

- `tools/apply_matrix.py`: the firmware patch, applied on top of the OTR tactical build (see `.github/workflows/build-matrix.yml` at the repo root)
- `dashboard/base-otr.html` + `dashboard/addon/*`: the dashboard parts. `python3 tools/build_dashboard.py` builds `dashboard/matrix.html`; `--check` fails if it is out of date
- `dashboard/range/*` + `tools/build_range_dashboard.py`: the OPTIONAL range-estimate tile. `python3 tools/build_range_dashboard.py` builds `dashboard/matrix-range.html` from `matrix.html` plus the tile (`--check` fails if it is out of date). It never changes `matrix.html`; see RELEASE-NOTES.
- `docs/RELEASE-NOTES.md`: what is in a release and what is not tested

Planned home: its own `project-matrix` repository. It lives here until that repository is created.

Engineered by: Aries Thorne & Todd Steinhauer for Wolf Reactive Systems (WRS)
Special thanks to the NTXMESH community, Meshcore Community, and Pat Steinhauer-Scates for their guidance and support.
