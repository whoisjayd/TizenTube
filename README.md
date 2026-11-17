# tube

<p align="center">
    <img width="420" src=".github/assets/logo.svg" alt="tube">
</p>

**tube** is a maintained version of the original [TizenTube](https://github.com/reisxd/TizenTube) by Reis Can. One userscript for Samsung Tizen and for Android TV, Google TV, Fire TV and other smart TVs.

The GitHub module name stays `whoisjayd/TizenTube`. That is the install id. The app on the TV is **tube**. Samsung and Android are both version 2.2.0. Moving from an older install is covered in [MIGRATION.md](./MIGRATION.md).

## Install

| TV | What you install | Where |
| --- | --- | --- |
| Samsung, any year | TizenBrew module `whoisjayd/TizenTube` | This repo. `dist/` is what the TV loads. |
| Samsung Tizen 6+ (2021 and later) | `TizenTubeCobalt.wgt` | [Releases](https://github.com/whoisjayd/TizenTube/releases) |
| Samsung Tizen 3–5.5 | `TizenTubeOld.wgt` | [Releases](https://github.com/whoisjayd/TizenTube/releases) |
| Android TV, Google TV, Fire TV, other 64-bit smart TVs | `cobalt-arm64.apk` | [Releases](https://github.com/whoisjayd/TizenTube/releases) |
| 32-bit smart TVs | `cobalt-arm.apk` | [Releases](https://github.com/whoisjayd/TizenTube/releases) |

The Samsung app and the Android/smart-TV build run the same `dist/userScript.js`. Android remotes use Back (`4`) and D-pad center (`23`). Picture-in-picture uses the Cobalt `h5vcc` bridge when the device has it.

Install steps, proxy packages and the developer-mode IP are in the [installation guide](./docs/README.md).

## Features

- Ad blocking, including player responses and Home-feed slots
- SponsorBlock and DeArrow
- Video previews, speed, quality and per-channel speed
- Picture-in-picture, voice search, block channels
- Progress-bar colour and a true-black background
- End time, dislike counts, sleep timer
- OLED care: hide the YouTube logo, and shift the clock off the same pixels

Previews, DeArrow and the layout stay on when their settings are on, including 1 GB boxes. The device budget only limits cache size and how many requests run at once.

## Development

```sh
cd mods && npm ci && npm test
cd ../service && npm ci && npx rollup -c rollup.config.js
```

`npm test` in `mods/` rebuilds `dist/userScript.js` and runs the tests. CI does that on every push to `main`, then rebuilds `dist/service.js` and commits `dist/` if it changed. A tag `v*.*.*` publishes the userscript and, when the Tizen certificate is configured, the Samsung packages.

## Community

[r/TizenTube](https://www.reddit.com/r/TizenTube/) · [Discord](https://discord.gg/m2P7v8Y2qR) · [Telegram](https://t.me/tizentubeofficial) · [Matrix](https://matrix.to/#/!BLE5ubNYktI30e8K0j:matrix.6513006.xyz) · [Issues](https://github.com/whoisjayd/TizenTube/issues)
