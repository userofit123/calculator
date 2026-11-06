# Changelog

The top `## [x.y.z]` section is the version the release workflow publishes. Write changes under "Unreleased"; to
release, run `node scripts/bump.mjs x.y.z` (it turns them into the new version's section) and merge to main. See
docs/apps.md, Releases.

## Unreleased

- Basic mode: a calculator that gets sums like 0.1 + 0.2 right, with a history you can reuse.
- Advanced mode: scientific functions (powers, roots, logarithms, trigonometry in degrees or radians, factorials, constants).
- Financial mode: loan payments, interest, depreciation and other money calculations.
- Programming mode: binary, octal, decimal and hexadecimal, bitwise operations and word sizes.
- Converter: currency, length, weight, temperature, area, volume, speed, time, data and more. Currency rates are the
  European Central Bank's daily reference rates, shown with their date; rates ship with the app and can be refreshed
  (or the refresh switched off) in Settings.
- Unit conversions typed straight into the calculator, like the Linux calculator: "5 km in mi", "100 degF to degC",
  "20 USD in EUR", with the Converter's units and rates (the rate's source and date shown under the answer).
- Look and Appearance: themes, colour sets, backgrounds, textures, density and fonts, in place from the first moment.
- Works completely offline from the first open, opens instantly, and can be installed as a web app.
- Hosted web version at https://userofit123.github.io/calculator/, updated with every release: open it in a browser
  and install it; once opened it works offline.
- Desktop app for Linux (AppImage, deb, rpm) and Windows.
- Updates inside the desktop and Android apps: they ask GitHub whether a new version is out (switch it off in Settings,
  Updates), show an Update button, and download and check the new version before it is installed. Nothing else is sent.
- Android app that opens straight onto the calculator, with system bars that follow the look.
- Private: no account, no server, no tracking; everything stays on your device.
