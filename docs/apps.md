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
- The app goes online for two things only, and each can be switched off in Settings: the European Central Bank's public
  currency rates (to keep the converter current; rates ship with the app, so it works without them) and the update
  check (see [Updates and privacy](#updates-and-privacy)). Neither sends anything about you.

### Works offline

Every mode and conversion works with no connection. Links (for example to the source code) open in your web browser,
never inside the app, and only a few addresses are allowed (this project's page and the ECB).

### Updates

The AppImage and the Windows version update themselves: when a new version is out, an **Update** button appears in the
menu (and Settings → Updates shows the version and what's new). **Download** fetches it from this project's GitHub
release and checks it against the release's `latest-linux.yml` / `latest.yml` (SHA-512) before anything is used;
**Restart and install** closes the app, installs it and opens the new version. Nothing is downloaded or installed
without your click. The `.deb` and `.rpm` are installed by your system's package manager, so there the app only says a
new version is out and links to the release page: download the new package and open it like the first time.

### Build it yourself

```sh
./scripts/pnpm.sh install
cd apps/desktop
pnpm run dist:linux   # builds the web app, then release/calculator-*.AppImage, .deb and .rpm
pnpm run dist:win     # release/calculator-*-setup.exe (on Windows, or Linux with Wine)
pnpm start            # runs it from the source (after `pnpm run web`)
```

The app's own names are specific to it so it does not clash with another calculator: `userofit123-calculator` for the
program, the package, the icon and the install folder (`/opt/userofit123-calculator` for the .deb and .rpm), and
`io.github.userofit123.calculator` for the data folder under the user's config directory. The name people see is
"Calculator". electron-builder takes the `/opt` folder from `build.productName` (there is no separate option), so that
is set to `userofit123-calculator`, while the packaged `package.json` keeps `productName: "Calculator"` (the app's
runtime name, so the X11 WM_CLASS and Wayland app_id stay "Calculator"); the menu entry pins `Name` and
`StartupWMClass` to "Calculator" and the Windows installer pins its shortcut and uninstall names to "Calculator".
Built on Electron 45 (keep it on a supported major).

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
- Two permissions: internet access, used only for the European Central Bank's public currency rates and the update
  check (each can be switched off in Settings; rates ship with the app), and "install apps", used only to hand an update
  you chose to Android's installer. Neither sends anything about you.
- Everything (history, settings, look, the last currency rates) stays on the phone and is left out of Android's cloud
  backup.

### Works offline

Every mode and conversion works in airplane mode, from the first open after installing.

### Updates

When a new version is out, an **Update** row appears above the tabs (and Settings → Updates shows the version and
what's new). **Download** fetches `calculator-x.y.z.apk` from this project's GitHub release into the app's own storage
and checks it before it can be installed: its size and SHA-256 must be the ones in the release's `android-latest.json`,
and it must be Calculator, exactly that version, newer than the one you have, and signed with the same key. Anything
else is deleted. **Install** opens Android's installer, which asks you to confirm (the first time Android also asks you
to allow Calculator to install apps). Your history and settings stay.

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

## Updates and privacy

What the update check contacts, and when (the desktop and Android apps only; the web app updates itself through its
service worker and has no update check):

- **What:** one request to GitHub's public API, `https://api.github.com/repos/userofit123/calculator/releases/latest`
  (the Android app also reads that release's `android-latest.json`). It carries no account, cookie or identifier of
  you or the device; GitHub sees the request like any visit to a public page (your IP address). Downloading an update
  you chose fetches its files from the same release (github.com, which redirects to GitHub's file host).
- **Who makes it:** the app itself (the desktop app's main process, the Android app's updater), never the page: the
  page's own rules still allow only the ECB rates, and the requests may reach GitHub's addresses and nothing else.
- **When:** with "Check for updates automatically" on (the default, as in Motus), a few seconds after the app opens
  and then every 6 hours while it is open, at most once every 6 hours; and whenever you press **Check now**.
- **How to switch it off:** Settings → Updates → "Check for updates automatically". Then the app never checks on its
  own; Check now still works when you press it.

## Releases

Every push to main and every pull request runs the checks (`.github/workflows/ci.yml`): types, the maths and web app
tests, the web build, an Android debug build and an unpacked desktop build. Nothing is signed or published there.

A release is published by `.github/workflows/release.yml` when CHANGELOG.md on main gets a new top `## [x.y.z]` section:

1. While working, write each user-visible change under `## Unreleased` in CHANGELOG.md, in plain words. Never add a
   `## [x.y.z]` heading by hand: on main that publishes a release.
2. To release: `node scripts/bump.mjs 0.2.0` (or `pnpm bump 0.2.0`). It sets the version in package.json and
   apps/desktop/package.json (the web app shows the root version; the Android app gets it from the workflow as
   `-PappVersion`, which also makes its versionCode) and turns "Unreleased" into `## [0.2.0] - date`. Read the section
   over, commit, and merge or push to main.
3. The workflow reads the top version, skips it if the tag `v0.2.0` already exists, runs the tests, builds the web app
   once and packs it into the desktop and Android apps, and builds `calculator-0.2.0-x86_64.AppImage`, `-amd64.deb`,
   `-x86_64.rpm`, `calculator-0.2.0-setup.exe`, the signed `calculator-0.2.0.apk` and `calculator-0.2.0-web.zip`.
4. Only when every build succeeded it writes `android-latest.json` (version, download address, sha256 and size of the
   APK, for the Android app's updater) and `SHA256SUMS`, and creates the GitHub release `v0.2.0` with the CHANGELOG
   section as its notes and all those files attached, together with `latest-linux.yml`, `latest.yml` and the
   `.blockmap` files that electron-builder writes for the desktop app's updater (electron-updater). electron-builder
   runs with `--publish never`; the `publish` setting in apps/desktop/package.json is what makes it write those files
   and tells the app where its updates come from.
5. After the release is published, the `pages` job builds the web app again for the `/calculator/` sub-path
   (`CALC_BASE=/calculator/`; every address in the app starts from Vite's base) and deploys it to GitHub Pages:
   https://userofit123.github.io/calculator/ (the repository's Pages source is "GitHub Actions"). `404.html` is a copy
   of the page, so deep links like `/calculator/converter` open the app on a first visit too.

To build a version again (for example after a failed run), run the Release workflow by hand (Actions → Release → Run
workflow) with "Build again" ticked; the files of the existing release are replaced.

### Android signing key

Every version of the APK must be signed with the same key, or phones refuse to install the update over the old one. The
release stops with an error when the key is missing; it never publishes an unsigned APK. Make the key once, outside the
repository (never commit it), and keep a copy of the .jks and its password somewhere safe:

```sh
keytool -genkeypair -v -keystore calculator.jks -alias calculator -keyalg RSA -keysize 4096 -validity 36500 \
  -dname "CN=Calculator"
base64 -w0 calculator.jks > calculator.jks.b64
```

`keytool` comes with any JDK (17 or newer). The `-dname` is stored in the APK's certificate, which anyone can read: keep
it to the app name, with no personal name, place or email. keytool asks for a password (use one password for the store
and the key, or set CALC_KEY_PASSWORD too).

Then add these under GitHub → the repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
| --- | --- |
| `CALC_KEYSTORE` | the contents of `calculator.jks.b64` |
| `CALC_KEYSTORE_PASSWORD` | the keystore password |
| `CALC_KEY_ALIAS` | optional, defaults to `calculator` |
| `CALC_KEY_PASSWORD` | optional, defaults to the keystore password |

Or with the GitHub CLI: `gh secret set CALC_KEYSTORE < calculator.jks.b64` and `gh secret set CALC_KEYSTORE_PASSWORD`.
Delete `calculator.jks.b64` afterwards. The desktop installers are not signed (Windows SmartScreen warns once, see above).
