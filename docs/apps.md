# Desktop app (Linux and Windows)

The same calculator as the web app, in its own window. It carries all its files, so it opens at once and works with no
internet at all, from the very first start.

## Install

From the [latest release](https://github.com/userofit123/calculator/releases/latest):

- **Linux:** `calculator-x.y.z-x86_64.AppImage` (make it executable and run it, nothing to install), or the `.deb`
  (Debian, Ubuntu, Mint) or `.rpm` (Fedora, openSUSE) package: open it with your software installer, or
  `sudo apt install ./calculator-x.y.z-amd64.deb` / `sudo dnf install ./calculator-x.y.z-x86_64.rpm`.
- **Windows:** `calculator-x.y.z-setup.exe`. The installer isn't signed, so Windows SmartScreen may warn the first time:
  choose "More info", then "Run anyway".

Opening Calculator again while it is open brings the open window to the front. The window remembers its size and place;
make it wider for the desktop layout.

## Private

- No account, no server, no analytics, no tracking, no crash reports.
- Everything (history, settings, look, the last currency rates) stays on your computer.
- The only thing the app ever downloads is the European Central Bank's public currency rates, to keep the currency
  converter current. It sends nothing about you, and you can switch it off in Settings. Rates ship with the app, so the
  converter works without it.

## Works offline

Every mode and conversion works with no connection. Links (for example to the source code) open in your web browser,
never inside the app.

## Build it yourself

```sh
./scripts/pnpm.sh install
cd apps/desktop
pnpm run dist:linux   # builds the web app, then release/calculator-*.AppImage, .deb and .rpm
pnpm run dist:win     # release/calculator-*-setup.exe (on Windows, or Linux with Wine)
pnpm start            # runs it from the source (after `pnpm run web`)
```

Building the Linux packages in a container (needs no tools on the computer):

```sh
docker run --rm -u 1000:1000 -v "$PWD":/repo -w /repo/apps/desktop -e HOME=/tmp \
  electronuserland/builder:20 bash -c "node build.mjs && ./node_modules/.bin/electron-builder --linux --publish never"
```
