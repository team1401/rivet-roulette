# Rivet Roulette

A lightweight, offline-first static iPad progressive web app (PWA) for Airstream rally Expo Halls. One tap speaks a secure-random, no-repeat compliment or playful roast, and the same spin doubles as the rally prize dispenser.

Built with vanilla JavaScript, CSS, and system fonts only. There is no bundler, no framework, and no backend, so the app has zero network latency once loaded and keeps working when Expo Hall Wi-Fi does not.

## Contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Running locally](#running-locally)
- [Running the tests](#running-the-tests)
- [Project layout](#project-layout)
- [Deployment](#deployment)
- [Installing on the iPad](#installing-on-the-ipad)
- [Prize system and admin settings](#prize-system-and-admin-settings)
- [Architecture notes](#architecture-notes)

## What it does

- **Instant response**: pure vanilla JavaScript and CSS, system fonts only, so a tap produces speech without a network round trip.
- **On-device speech**: uses the browser's native `SpeechSynthesis` API with high-quality voice prioritization.
- **Offline shell**: fully functional offline after the first load, via a stale-while-revalidate service worker.
- **Expanded decks**: 144 compliments and 144 playful insults.
- **Secure, no-repeat draws**: Web Crypto rejection sampling plus a Fisher-Yates shuffle bag, so a line cannot repeat until all 144 lines in that category are exhausted.
- **Prize dispenser**: turns each spin into a timed daily prize draw with screenshot-redeemable vouchers (see [Prize system](#prize-system-and-admin-settings)).

## Requirements

- **Node.js 18 or newer** — only needed to run the test suite; the app itself has no install step and no dependencies.
- **A modern browser** — Safari on iPad is the target platform. Chrome, Edge, and Firefox work for development.

There are no npm dependencies to install. `package.json` defines scripts only.

## Running locally

The app uses native ES modules, so it must be served over HTTP rather than opened as a `file://` path. Any static server works:

```bash
# Python built-in server
python3 -m http.server -d public
```

```bash
# or, with Node
npx serve public
```

Then open `http://localhost:8000`.

The included `deploy/airstream/docker-compose.yml` mounts `./public` next to itself, so it is meant for the deployed directory layout described under [Deployment](#deployment) rather than for a local preview from the repository root.

## Running the tests

Two commands, both defined in `package.json`:

```bash
npm test        # unit tests: node --test test/*.test.js
npm run check   # syntax check (node --check) plus test/static-check.js
```

`npm test` runs the Node built-in test runner over `test/*.test.js`:

| File | Covers |
| --- | --- |
| `test/app.test.js` | The main module's pure logic: config constants, voice selection tiers, date formatting, HTML escaping, UUID generation, voucher rendering, and every element id `app.js` queries |
| `test/deck.test.js` | Deck counts, case-insensitive line uniqueness, `getRandomInt` bounds, Fisher-Yates boundary conditions, and `localStorage` recovery |
| `test/daily-prizes.test.js` | Prize config validation, daily schedule generation, stratified release bands, late starts, and claim semantics |
| `test/reports.test.js` | Report normalization, scope summaries, prize attribution, and CSV export |

`npm run check` runs `node --check` on `app.js`, `deck.js`, and `sw.js` to catch syntax errors, then `test/static-check.js`, which validates the PWA manifest, service worker lifecycle hooks, `wrangler.jsonc`, and the accessibility requirements in `index.html`. Both commands resolve paths relative to the repository, so they work from any checkout location.

## Project layout

```
public/                 The deployable app — this is the only served directory
  index.html            Single-page shell
  styles.css            Rally kiosk design system (see DESIGN.md)
  manifest.webmanifest  PWA manifest (standalone display, iPad icons)
  sw.js                 Service worker: precache + stale-while-revalidate
  js/app.js             Main module: DOM wiring, speech, session lock, orchestration
  js/deck.js            Secure random, Fisher-Yates shuffle, no-repeat deck
  js/lines.js           The 144 compliments and 144 insults
  js/prizes.js          Prize config validation and daily schedule generation
  js/reports.js         On-device spin events, summaries, CSV export
deploy/airstream/       nginx + docker-compose used by the Airstream host
test/                   Node test suite and static checks
scripts/                Python helpers for icon generation and viewport capture
signage/                Print-ready 8x10 signage assets and their generator scripts
wrangler.jsonc          Cloudflare Pages config (assets directory: public)
```

The other `*.md` files at the repository root are the project's working documents — `PRODUCT.md`, `DESIGN.md`, `DESIGN-BRIEF.md`, and the various `*-PLAN.md` and `*_TASK.md` briefs — and are the source of truth for feature intent.

## Deployment

The primary deployment runs on the physical Airstream server and is reachable over the Tailnet at:

`https://airstream.tail4532cc.ts.net:10443`

The nginx container binds to `127.0.0.1:18088` for Tailscale Serve and to the Airstream LAN address `192.168.50.5:18088`. It is not bound to every interface and is not exposed to the public internet. LAN access is `http://192.168.50.5:18088`.

Use the Tailnet HTTPS URL for PWA installation and verified offline caching: service workers require a secure context, which the plain HTTP LAN URL does not provide. The LAN URL is fine for normal online viewing.

Deploy from the repository root:

```bash
rsync -a --delete public/ airstream:/opt/rivet-roulette/public/
rsync -a deploy/airstream/ airstream:/opt/rivet-roulette/
ssh airstream 'cd /opt/rivet-roulette && docker compose up -d'
ssh airstream 'sudo tailscale serve --bg --https=10443 http://127.0.0.1:18088'
```

Because `public/` is a plain static directory, the same tree can also be published with `npx wrangler deploy` using the included `wrangler.jsonc`.

## Installing on the iPad

1. Open the deployed HTTPS URL in **Safari** on the iPad.
2. Tap the **Share** button (the box with an upward arrow) in the toolbar.
3. Select **Add to Home Screen**.
4. Launch "Rivet Roulette" from the home screen. It opens fullscreen without a URL bar and works fully offline.

### Siri voice caveat

iPadOS controls which voices a browser may expose, so exact Siri voices are not always available:

- An exact Siri voice is available only if it is downloaded on the iPad (Settings > Accessibility > Spoken Content > Voices) and exposed by the browser.
- The app scans for any English voice whose name contains `Siri` and uses it when present. Otherwise it falls back to other high-quality local Apple English voices (Samantha, Daniel, Karen, Moira, and similar) and shows a status line in the footer noting that fallback speech is active.

## Prize system and admin settings

An integrated prize and partner-perk system for rally giveaways.

### 30-second session lock

- The first tap on Compliment or Insult starts a 30-second lock. Both buttons stay disabled and show a countdown (`Locked (24s)`) so one visitor cannot spin repeatedly.
- The expiry is persisted in `localStorage` under `rivet-roulette-session-expires`, so a reload or reopen cannot bypass the lock.
- Page visibility and window focus listeners recover the countdown if the iPad sleeps or is suspended; when the timer expires the app returns to the `READY` state.

### Prize model and configuration

- **Daily window**: prizes are distributed across a configurable day, defaulting to 08:00–17:00 in the iPad's local timezone.
- **Inventory**: both the "Brian Smith - Author" awards ("Your Awards") and Partner Perks have stable ids and non-negative daily quantities; the system mints one hidden token per unit.
- **Stratified release times**: author and partner tokens are shuffled into one pool, the open window is split into one equal band per token, and each token releases at a cryptographically random moment inside its band. This spreads prizes evenly instead of clustering them.
- **Late starts**: a schedule first created or migrated after the window opened releases the next token within one minute, then spreads the rest across the remaining hours.
- **Claim rules**: prizes are claimable only during open hours, and a spin may claim only the earliest due unclaimed token. Overdue tokens stay due, but clearing several takes several visitor turns because of the spin lock.
- **Persistence**: the version-2 schedule and awarded counts live in `localStorage`. Saving edits or migrating an older schedule on the same day preserves awarded counts and reschedules only what remains. A new calendar day resets counts and generates a fresh schedule.
- **Admin summary**: shows today's scheduled, awarded, and remaining totals without revealing future release times.

### Screenshot-redeemable voucher

When a prize is awarded, a high-contrast voucher replaces the result area with the category (Book Discount or Partner Perk), provider and exact offer text, awarded date/time with timezone, an expiry exactly one hour later, and the instruction "Take a photo of this screen and show it to the vendor." Attendees show the photo to the vendor to redeem.

### PIN-protected settings

Settings are behind the gear icon and require PIN **4167**; a wrong PIN shows an inline error. Closing the panel relocks immediately, so the PIN is required again on the next visit.

### Admin reports and analytics

- **Local-only and privacy-safe**: events are stored on-device under `rivet-roulette-report-events-v1`. No voice data, visitor identity, device id, or spoken line text is recorded.
- **Metrics** per scope (Today, All Time, or a recorded date): total spins, compliment and insult counts and percentages, prizes awarded and prize rate, no-prize spins, and prize wins split by spin preference.
- **Vendor breakdown**: a table of total, compliment, and insult wins per configured provider and offer.
- **CSV export**: full spin history as `rivet-roulette-report-YYYY-MM-DD.csv`. Cell values are neutralized against spreadsheet formula injection (`=`, `+`, `-`, `@`).
- **Data reset**: clears report events only, after confirmation, leaving deck state, prize settings, and daily schedules intact.

### Offline and device-clock limitations

The app is entirely on-device, so the iPad's system clock is the only time authority. Resetting the clock, clearing site data, or reinstalling the app can bypass session locks and erase prize configuration, the hidden daily schedule, awarded counts, and report history.

## Architecture notes

- **No build step**: `public/` is served as written. `js/app.js` imports the other modules directly as ES modules, which is why the app must be served over HTTP.
- **Module shape**: `app.js` owns DOM wiring, speech, and the session lock, and imports pure logic from `deck.js`, `prizes.js`, and `reports.js`. Those three modules are DOM-free and directly testable in Node; `app.js` exports its pure helpers (`getBestFallbackVoice`, `formatDateTime`, `escapeHtml`, `generateUUID`, `renderPrizeProof`) so `test/app.test.js` can exercise them with a minimal DOM stub instead of a mocking library.
- **State**: all persistence goes through `localStorage` under `rivet-roulette-*` keys. Every read is wrapped in try/catch with a sane default, because Safari throws when the storage quota is hit or in private mode.
- **Caching**: `sw.js` precaches the full asset list under a versioned cache name (`rivet-roulette-v9`) and serves stale-while-revalidate with `ignoreSearch: true`. Bumping `CACHE_NAME` is how a deploy invalidates the old shell.
