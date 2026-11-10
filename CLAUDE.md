# Calculator: working notes

## Task queue
The chat message "Work the queue" means: read and follow `workflow/RUNNER.md` (tasks from the Focus list "Calculator", account "Server"). Otherwise tasks come from the chat as usual. `workflow/` is git-ignored and never committed.

A private, offline-first calculator: basic, advanced (scientific), financial, programming and a unit/currency converter
(the same modes and conversion categories as the GNOME/Linux calculator). Web app / PWA, desktop app (Electron, Linux and
Windows) and Android app (Capacitor). No server, no account, no tracking.

## Layout
- `packages/core` (`@calc/core`): all maths, pure TypeScript, no DOM: expression parser and evaluator, number formatting,
  programming (bases, bitwise), financial functions, unit tables and conversion. Tested with vitest.
- `apps/web` (`@calc/web`): Vue 3 + TypeScript UI. Two shells (desktop, phone) sharing pages. Look and Appearance panel
  ported from Motus / Money Manager (theme engine, colour sets, backgrounds, textures, density, fonts).
- `apps/desktop`: Electron wrapper (same window frame and top bar as Motus's desktop app).
- `apps/android`: Capacitor wrapper (same status bar / navigation bar handling as Motus's Android app).

## Rules
- **Private from the start.** Nothing personal in the repo, commits or app: no name, email, location, analytics, telemetry or
  crash reporting. Git identity is `userofit123` with the GitHub no-reply address (the pre-commit hook enforces it; commit
  times are stored in UTC by the post-commit hook). The only network requests the app makes are the optional currency-rate
  refresh (official central-bank rates: the ECB, plus the National Bank of Ukraine and the Central Bank of
  Argentina for their own currencies; no key, no identifiers) and, in the desktop and Android apps, the optional update check
  (GitHub's public releases, no identifiers); both can be switched off in Settings.
- **Opens instantly.** The first paint must not wait for anything: the saved look and layout are applied by an inline script
  in index.html, the calculator is the first screen and is in the main bundle, everything else (converter tables, settings,
  Appearance panel) loads lazily. No splash delays. The service worker precaches the built files so later opens are offline.
- **Works completely offline.** Every screen and feature works with no internet at all, from the first open after install:
  nothing (fonts, icons, scripts, data) is loaded from the internet; the service worker caches the whole app on install;
  currency rates ship with the app and the last downloaded rates are kept on the device.
- **Official currency data only**: the European Central Bank's daily reference rates fetched from the ECB itself (and
  official central-bank sources for anything it lacks), never a third-party rates API. Show the source and rate date.
- Styles only through the theme tokens (`--acc`, `--s1`, `--tx2`, …); never hard-coded colours.
- Spacing inside blocks from the density tokens, between blocks from `--spg` / `--hg`; no fixed paddings on cards, rows, keys.
- Both desktop and phone layouts for every screen; full keyboard support on desktop.
- Maths lives in `packages/core` with tests; the UI never does arithmetic itself. Use exact/decimal-safe arithmetic where
  the user would notice float errors (0.1 + 0.2 = 0.3).
- Plain wording in the UI. Comments say why.
- Only plain dashes "-" in the UI text (the minus key may show "−"), never "–" or "—".
- Dot separators always have equal space on both sides (" · ").

## Develop
- `docker compose -f docker-compose.dev.yml up -d` → https://calculator.local (Caddy proxy + mkcert certificate; the
  Caddy block lives in the shared proxy, see docs/development.md). Direct: http://127.0.0.1:8795.
- Run pnpm through the container: `./scripts/pnpm.sh …` (e.g. `./scripts/pnpm.sh --filter @calc/core test`).
- Checks: `./scripts/pnpm.sh -r typecheck`, `./scripts/pnpm.sh --filter @calc/core test`, `./scripts/pnpm.sh --filter @calc/web exec vite build`.
