# Matrix+MNA dashboard — Android app

Opens the Matrix+MNA dashboard in its own app (own icon) and talks to the radio over the phone's USB port with a
native USB serial driver, so it does not depend on Chrome's Web Serial. BLE stays free for the MeshCore app.

**Status: tested on a phone with the Heltec V4 R2 (works). Not tested with other radios.** Built from the same matrix.html as the web dashboard.

Credit: Engineered by Aries Thorne & Todd Steinhauer for Wolf Reactive Systems (WRS). Special thanks to the NTXMESH
community, Meshcore Community, and Pat Steinhauer-Scates for their guidance and support.

- `app/src/main/assets/serial-polyfill.js` gives the page `navigator.serial` backed by the native bridge, and turns
  file downloads and the share button into Android save/share.
- Uses usb-serial-for-android (MIT) by mik3y.
- The signing key in this folder is for sideloading only (it lets a newer APK install over an older one). It is not a
  store-release key.
- The Update button inside the app does not update the app; install a newer APK instead.
