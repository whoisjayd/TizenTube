# Maintaining this fork

This repo is a maintained fork of [reisxd/TizenTube](https://github.com/reisxd/TizenTube).

## Layout
- `mods/` – the userscript (rollup -> `dist/userScript.js`). Tests live in `mods/tests`.
- `service/` – DIAL service bundle (-> `dist/service.js`).
- `standalone/` – standalone Tizen app and its service.
- `dist/` – **committed on purpose**: TizenBrew loads the module straight from this repo. CI rebuilds it on every push to `main`.

## Local commands
```sh
cd mods && npm ci && npm run build
node --experimental-vm-modules --test tests/*.test.js
cd ../service && npm ci && npx rollup -c rollup.config.js
```

## Pulling upstream changes
A weekly workflow (`upstream-sync.yaml`) opens a PR from `upstream-sync`. Manually:
```sh
git remote add upstream https://github.com/reisxd/TizenTube.git   # once
git fetch upstream
git checkout -b upstream-sync main
git merge upstream/main        # resolve conflicts; rebuild dist
cd mods && npm run build && node --experimental-vm-modules --test tests/*.test.js
```
Expect conflicts in `dist/` (just rebuild) and `mods/tests/startup.test.js` (keep both sides).

## Dependencies
Stay on the current majors. Babel 8, Rollup 4 and Express 5 are untested on old Tizen (Chrome 56-76).
