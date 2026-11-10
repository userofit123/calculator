# Changelog

The top `## [x.y.z]` section is the version the release workflow publishes. Write changes under "Unreleased"; to
release, run `node scripts/bump.mjs x.y.z` (it turns them into the new version's section) and merge to main. See
docs/apps.md, Releases.

## Unreleased

## [0.3.3] - 2026-11-10

- Clicking the app icon at the top of the sidebar to change the look gives it a short wobble, as in Money Manager
  (not with "reduce motion" on).

## [0.3.2] - 2026-11-07

- The Windows installer, its install folder and the program are called "Calculator" (they were
  "userofit123-calculator"). An installed copy updates in place.
- Android: an update keeps downloading when you switch to another app, with its progress notification, and ends with
  "Update ready - tap to install". Reopening the app during a download shows its progress again.
- Tip & Split: "Split between people" slides its section open and closed instead of jumping, and the "People" label
  has room above it.
- Phone tabs: the highlight behind the chosen tab stays on its icon when the next page's scrollbar shifts the tabs, and
  only the chosen tab's label is bold.

## [0.3.1] - 2026-11-07

- The desktop `.deb` and `.rpm` update in the app like the AppImage: the update downloads with a progress bar in
  Settings, and Install asks for your password, installs it and opens the new version (never on closing the app). A
  cancelled password prompt or a failed install says so and Install can be tapped again. The web app shows its new
  version downloading with a progress bar, and an Update button when it is ready to restart.
- With "Download updates automatically" on, the AppImage and Windows app now really install a ready update when you
  close the app (the request to do so was set too late to take effect).

## [0.3.0] - 2026-11-07

- The top of the calculator is a row of tabs: the calculator, named after its type (Basic, Advanced, Financial,
  Programming, Keyboard, chosen from its menu), then Tip & Split, Discount, Percent and Date, one tap each.
- Everyday is gone: its Percent, Discount and Tip & Split are tabs of their own. VAT is no longer in the calculator.
  A calculator last left in Everyday opens on the tool it was showing.
- New app icon: the four operators (+ − × ÷) in navy, the plus in amber, on a lime-to-teal tile. The logo in the app and
  the browser tab show the same signs in the colours of the chosen look.
- The calculator's tabs: the underline slides to the chosen tab, arrows at the ends scroll the row when it doesn't fit,
  modes slide in from the side, and on a computer the calculator grows or shrinks smoothly to its new size.
- Converter: the card is split at the swap button, with the result in a tinted panel below and an even gap around it
  and around the button. For currencies the rates line sits inside that panel.
- Settings sits at the bottom of the desktop sidebar, under Appearance.
- Group thousands is on by default (1,000,000); turning it off still sticks.
- The converter's swap icon turns smoothly through its whole half turn, even with quick repeated taps.
- Copy with nothing to copy does nothing, the same on every screen.
- The license is stated in the app's packages and the README: free for non-commercial use.

## [0.2.0] - 2026-11-06

- New app icon: a cleaner calculator on a mint-to-blue tile.
- Tip calculator: its own page in the mode menu, with preset percentages, the tip shown big, the total and an optional
  split.
- Everyday helpers (percent, discount, tip and split, VAT) are always in the mode menu, no setting needed.
- Currency graph: the exchange rate over the last month, 3 months or year, from the ECB, kept for offline use.
- 17 more languages: Spanish, French, German, Portuguese, Italian, Dutch, Polish, Russian, Ukrainian, Turkish, Arabic,
  Hindi, Chinese, Japanese, Korean, Indonesian and Vietnamese.
- App & updates in Settings, like Motus: check now, how often to check, automatic downloads (Wi-Fi only on Android),
  download progress, and on Android a notification with progress that installs when tapped.
- The number you type is shown big like the answer, and the display never changes height or gets cut off.
- Keys are see-through, so they stay visible on every theme and background texture.
- Desktop app: opens at a calculator-sized window, has its icon in menus and the taskbar, and a Money Manager-style top
  bar in the app's own colours.
- Swiping left or right on the calculator page changes pages like on the other pages.
- Converter: rounded results, the swap button centred, "All units" on one line, the online-updates note matches
  Settings, and swiping the category chips no longer changes page.

## [0.1.0] - 2026-11-06

- Basic mode: a calculator that gets sums like 0.1 + 0.2 right, with a history you can reuse.
- Advanced mode: scientific functions (powers, roots, logarithms, trigonometry in degrees or radians, factorials, constants).
- Financial mode: loan payments, interest, depreciation and other money calculations.
- Programming mode: binary, octal, decimal and hexadecimal, bitwise operations and word sizes.
- Keyboard mode: type whole sums on one line with no keypad (the default on computers without a touch screen).
- Date mode: days between dates, adding to a date, age, business days (choose your weekend) and time sums.
- Everyday helpers (switch on in Settings): percent, discount, tip and bill split, VAT.
- Answers as fractions (7/4) or mixed numbers (1 3/4); change the number format and decimal places from the display.
- History: search, pin entries, copy, export as text or CSV, or keep no history at all.
- Converter: currency, length, weight, temperature, area, volume, speed, time, data and more. Currency rates are the
  European Central Bank's daily reference rates, plus the central banks of Ukraine and Argentina and the official fixed
  rates of the CFA francs and several Gulf currencies, each shown with its source and date; rates ship with the app and
  can be refreshed (or the refresh switched off) in Settings.
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
- Hebrew: the whole app in Hebrew with a right-to-left layout (Settings, Language: Auto, English or עברית), while
  numbers, sums, the keypad and the display stay left to right.
- Accessible: screen-reader labels and spoken answers, full keyboard use, large text, high contrast, reduced motion.
- Smooth animations throughout: pages, modes, keys, menus, panels and lists move instead of jumping.
- Private: no account, no server, no tracking; everything stays on your device.
