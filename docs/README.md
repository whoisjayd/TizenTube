# Install

**tube** is a maintained version of the original [TizenTube](https://github.com/reisxd/TizenTube). On the TV the app is named tube. Samsung TVs get a TizenBrew module or a `.wgt`. Android TV, Google TV, Fire TV and other smart TVs get the same userscript from the same release.

Releases: https://github.com/whoisjayd/TizenTube/releases

## Samsung TV with TizenBrew

Works on Tizen 3 (2017) and later.

1. Install [TizenBrew](https://github.com/reisxd/TizenBrew).
2. Add a GitHub module: `whoisjayd/TizenTube`.
3. Launch it. If an old copy is cached, remove the module, add it again and restart TizenBrew.

TizenBrew reads `dist/userScript.js` and `dist/service.js` from this repository. You do not need a `.wgt` for this path.

## Samsung TV as a standalone app

Use [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases) on a computer or Android phone.

1. On the TV, open **Apps** or **App Settings** and enter `12345`.
2. Turn **Developer mode** on. Set **Host PC IP** to the computer or phone that will install the app. On a right-to-left language, enter the IP backwards (`192.168.1.5` becomes `5.1.168.192`).
3. Hold the power button until the TV shows the startup logo.
4. In Apps2Samsung, pick the TV (or type its IP).
5. Download the package that matches the TV from this repo's Releases:
   - `TizenTubeCobalt.wgt` — Tizen 6 (2021) and later.
   - `TizenTubeCobaltTizenTubeProxyAddress.wgt` — same TVs, when `127.0.0.2` does not resolve. Your DNS must point the name `tizentube` at the TV's static IP.
   - `TizenTubeOld.wgt` — Tizen 3, 4, 5 and 5.5.
6. In Apps2Samsung settings, enable **Force Samsung Certificate** and **Partner** signing.
7. Choose **Custom WGT File**, select the file, and install.
8. On Tizen 5.5 and older, set Host PC IP to `127.0.0.1` after install and reboot. Playback fails if the debugger stays pointed at another machine.

The app injects `dist/userScript.js` from this repository. It does not download the upstream npm package.

### Standalone app will not start

"A network error has occurred" means the TV never reached the local proxy:

- Partner signing and Force Samsung Certificate were off during install.
- The TV cannot use `http://127.0.0.2:8101`. Install the `tizentube:8101` package and make DNS resolve `tizentube` to the TV.
- The TV is older than Tizen 6. Use `TizenTubeOld.wgt`.
- The TV is offline, or it was just powered on. Wait a few seconds and open the app again.

## Android TV, Google TV, Fire TV and other smart TVs

Download the APK from this repo's Releases and sideload it.

- `cobalt-arm64.apk` for 64-bit devices. This is the one for almost every Android TV, Google TV and Fire TV from the last several years.
- `cobalt-arm.apk` for 32-bit devices.

The player package is `io.gh.reisxd.tizentube.cobalt` and it reports version 2.2.0, the same version as the Samsung app. It loads the userscript from this repository, not from the upstream npm package. The signature is this fork's, so uninstall an official TizenTube Cobalt install before installing this one. The name on the Android home screen stays TizenTube.

The in-app updater reads this repository's latest release and installs `cobalt-arm64.apk` or `cobalt-arm.apk` when the release tag is newer than 2.2.0.

`TizenTube-module.zip` in the same release is the TizenBrew package (`package.json`, `dist/userScript.js`, `dist/service.js`) if you install from a file instead of GitHub.
