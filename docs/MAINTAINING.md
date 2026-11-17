# Maintaining this fork

**tube** is the maintained version of the original [TizenTube](https://github.com/reisxd/TizenTube). One tree for Samsung and Android/smart TVs. The repository path stays `whoisjayd/TizenTube`. The name on the TV is tube.

## Layout

- `mods/` builds `dist/userScript.js`. Tests are `mods/tests`.
- `service/` builds `dist/service.js`, the DIAL launcher. It starts the GitHub module `whoisjayd/TizenTube`.
- `standalone/` is the Samsung widget. Its proxy and debugger inject `standalone/service/utils/userScriptSource.js`, which points at this repo.
- `dist/` stays committed. TizenBrew loads it from the repository, and Releases attach the same files.

## Commands

```sh
cd mods && npm ci && npm test
cd ../service && npm ci && npx rollup -c rollup.config.js
```

## Upstream

`.github/workflows/upstream-sync.yaml` opens a PR from `upstream-sync` when `reisxd/TizenTube` main moves. To do it by hand:

```sh
git remote add upstream https://github.com/reisxd/TizenTube.git
git fetch upstream
git checkout -b upstream-sync main
git merge upstream/main
cd mods && npm test
cd ../service && npx rollup -c rollup.config.js
```

Rebuild `dist/` after a merge. Keep both sides of `mods/tests/startup.test.js` when that file conflicts.

## Version

`package.json` `"version"` is the version for Samsung and Android. Change that, then run:

```sh
node scripts/sync-version.js
```

Use one digit per part: `2.2.0`, then `2.2.1`, up to `9.9.9`. The Android manifest stores the old Cobalt version in a fixed-width field, and the release refuses any other shape. Tag `v` plus that version (`v2.2.0`). Android's integer version is derived from it (`2.2.0` is `20200`, `2.2.1` is `20201`).

## Releases

Push a tag `v*.*.*` matching `package.json`. The release workflow copies that version onto the Samsung widget, tests the userscript, rebuilds both bundles, and attaches:

- `cobalt-arm64.apk` and `cobalt-arm.apk` for Android and other smart TVs. The workflow downloads Cobalt `v2.0.3`, rewrites the userscript URL, and stamps `package.json` version onto the player. Signing uses `signing/tube.keystore` (alias `tube`, password `tubeapk`).
- `TizenTube-userScript.js` and `TizenTube-module.zip` for TizenBrew
- `TizenTubeCobalt.wgt`, `TizenTubeCobaltTizenTubeProxyAddress.wgt` and `TizenTubeOld.wgt`, signed with `signing/tizen-author.p12` (password `tubewgt`). This is this fork's author certificate. Reis Can's certificate is not in the repository. Set `TIZEN_AUTHOR_KEY` (base64 `.p12`) and `TIZEN_AUTHOR_KEY_PW` only to sign with a different key.

A release still publishes the userscript and the APKs if the widget step fails.

Stay on the current majors. Babel 8, Rollup 4 and a newer Express are untested on Tizen 3 (Chrome 47) and Cobalt.
