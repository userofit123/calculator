# Desktop and Android apps

## Desktop (Linux and Windows)

The same calculator as the web app, in its own window. It carries all its files, so it opens at once and works with no
internet at all, from the very first start.

### Install

From the [latest release](https://github.com/userofit123/calculator/releases/latest):

- **Linux:** `calculator-x.y.z-x86_64.AppImage` (make it executable and run it, nothing to install), or the `.deb`
  (Debian, Ubuntu, Mint) or `.rpm` (Fedora, openSUSE) package: open it with your software installer, or
  `sudo apt install ./calculator-x.y.z-amd64.deb` / `sudo dnf install ./calculator-x.y.z-x86_64.rpm`.
- **Windows:** `calculator-x.y.z-setup.exe`. The installer isn't signed, so Windows SmartScreen may warn the first time:
  choose "More info", then "Run anyway".

Opening Calculator again while it is open brings the open window to the front. The window remembers its size and place;
make it wider for the desktop layout.

### Private

- No account, no server, no analytics, no tracking, no crash reports.
- Everything (history, settings, look, the last currency rates) stays on your computer.
- The only thing the app ever downloads is the European Central Bank's public currency rates, to keep the currency
  converter current. It sends nothing about you, and you can switch it off in Settings. Rates ship with the app, so the
  converter works without it.

### Works offline

Every mode and conversion works with no connection. Links (for example to the source code) open in your web browser,
never inside the app.

### Build it yourself

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

## Android

The same calculator as an Android app (Android 5.1 and newer). It carries all its files, so it opens at once, like a
built-in calculator (no splash screen), and works with no internet at all from the very first start.

### Install

From the [latest release](https://github.com/userofit123/calculator/releases/latest), download `calculator-x.y.z.apk`
on the phone and open it. Android asks you to allow "Install unknown apps" for your browser or file manager the first
time. Later versions install over it and keep your history and settings (they are signed with the same key).

The status bar and navigation bar follow the look: the app's background runs under them, and the clock and buttons turn
dark or light with it. Back closes an open panel, then goes back through the pages, and from the calculator leaves the app.

### Private

- No account, no server, no analytics, no tracking, no crash reports, no Google Play services or Firebase.
- The only permission is internet access, used only for the European Central Bank's public currency rates (switch it
  off in Settings; rates ship with the app). It sends nothing about you.
- Everything (history, settings, look, the last currency rates) stays on the phone and is left out of Android's cloud
  backup.

### Works offline

Every mode and conversion works in airplane mode, from the first open after installing.

### Build it yourself

Needs Node 22, JDK 17 or newer and the Android SDK (platform 34).

```sh
./scripts/pnpm.sh install
./scripts/pnpm.sh --filter @calc/web exec vite build
cd apps/android
pnpm run sync                       # copies apps/web/dist into the Android project (npx cap sync android)
cd android && ./gradlew assembleDebug   # app/build/outputs/apk/debug/app-debug.apk
```

A release build (`./gradlew assembleRelease -PappVersion=1.2.3`) is signed when these are set; the keystore stays
outside the repo and is never committed: `CALC_KEYSTORE` (path to the .jks), `CALC_KEYSTORE_PASSWORD`, and optionally
`CALC_KEY_ALIAS` (default `calculator`) and `CALC_KEY_PASSWORD`. The launcher icons are made from
`apps/web/public/icon.svg` with `python3 make-icons.py` (needs ImageMagick).
