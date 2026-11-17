# Moving to tube 2.2.0

tube 2.2.0 is the maintained version of the original [TizenTube](https://github.com/reisxd/TizenTube). Samsung and Android use that same version. The GitHub module id stays `whoisjayd/TizenTube`.

## Samsung TV, TizenBrew

1. Remove the old module (`reisxd/TizenTube` or an older `whoisjayd/TizenTube`).
2. Add `whoisjayd/TizenTube` again.
3. Restart TizenBrew and open it.

Saved settings stay on the TV. The module loads `dist/` from this repository.

## Samsung TV, installed app

Install the `.wgt` from this repo's Releases that matches the TV:

- `TizenTubeCobalt.wgt` for Tizen 6 and later
- `TizenTubeOld.wgt` for Tizen 3 through 5.5

The widget version is 2.2.0, which is newer than the original 2.1.1 app, and the app id is unchanged. This fork is signed with its own author certificate, not Reis Can's, so the TV will not update over the original app. Uninstall that app, then install this one. Setup is in [docs/README.md](./docs/README.md).

## Android TV, Google TV, Fire TV

Uninstall the original TizenTube Cobalt app first. This build is signed with a different key, so Android will not update over it.

Install from this repo's Releases:

- `cobalt-arm64.apk` on a 64-bit TV
- `cobalt-arm.apk` on a 32-bit TV

The player reports 2.2.0, the same version as Samsung. The home-screen name stays TizenTube. The app then loads this repository's userscript. A later release updates inside the app when its tag is newer than 2.2.0.

## Next version

Bump one field, `version` in `package.json`. It has to stay one digit per part (`2.2.1`, not `2.10.0`) because the Android manifest still has a fixed-width version. Then:

```sh
node scripts/sync-version.js
```

That writes the Samsung widget version. A release tag `v2.2.1` stamps the same number on both APKs. Details are in [docs/MAINTAINING.md](./docs/MAINTAINING.md).
