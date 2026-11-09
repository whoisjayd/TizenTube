# ▶️ TizenTube
<p align="center">
    <img width="600px" src=".github/assets/TizenTube Standalone Banner.png">
    <br>
    <sub> TizenTube logo, banner and README by <a href="https://github.com/Zyborg777">@Zyborg777</a> </sub>
</p>

**TizenTube** is a TizenBrew module that enhances YouTube on Tizen TVs by removing ads and adding SponsorBlock, DeArrow and more. It also works as a standalone app.

> **This is a maintained fork** of [reisxd/TizenTube](https://github.com/reisxd/TizenTube) with extra startup, ad-block and preview fixes. It tracks upstream; see [docs/MAINTAINING.md](./docs/MAINTAINING.md).

## 🚀 Quick start (TizenBrew)
1. Install [TizenBrew](https://github.com/reisxd/TizenBrew) on your TV.
2. In TizenBrew, add a GitHub module: `whoisjayd/TizenTube`.
3. Launch it. If an old version is cached, remove the module, re-add it and restart TizenBrew.

`dist/` is committed, so TizenBrew loads the latest build directly from this repository.

** **
🤖 **Looking for an app for Android TVs?** Check out [TizenTube Cobalt](https://github.com/reisxd/TizenTubeCobalt). It offers everything TizenTube has for Android TVs.


<p align="left">
    <a href="https://github.com/reisxd/TizenTubeCobalt/releases/latest">
        <picture>
            <img width="250px"
                src=".github/assets/TizenTube_Cobalt_dl-button.png" />
        </picture>
    </a>
</p>

## ❓ How to install

Follow the guide in the [Installation Guide](./docs/README.md).

## ✨ Features
- 📺 **Picture-in-Picture Mode**
- 🛑 **Ad Blocker**, including ads nested in player responses and Home-feed ad slots
- ❗ **SponsorBlock Support**: automatically skip sponsored segments
- ⏭️ **Video Speed Control**
- 🔺 **[DeArrow](https://dearrow.ajay.app/) Support**: replace clickbait titles and thumbnails
- 🚫 **Block channels** from video menus
- 🎞️ **Video previews on every row**, including scrolled-in tiles
- 🔍 **Voice search** through the standalone proxy
- 🔧 **Hardened startup** for early injection and corrupt saved settings

## 🛠️ Development
```sh
cd mods && npm ci && npm run build
node --experimental-vm-modules --test tests/*.test.js
```
CI builds, tests and refreshes `dist/` on every push to `main`.

## 🌐 Community and Support 
| Links |
| ------------- |
| [r/TizenTube Subreddit](https://www.reddit.com/r/TizenTube/)  |
| [Discord Server](https://discord.gg/m2P7v8Y2qR)  | 
| [Telegram](https://t.me/tizentubeofficial)  |
| [Matrix Space](https://matrix.to/#/!BLE5ubNYktI30e8K0j:matrix.6513006.xyz)  |
| [Upstream issues](https://github.com/reisxd/TizenTube/issues) · [Fork issues](https://github.com/whoisjayd/TizenTube/issues)  |
