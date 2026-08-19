# Rivet Roulette

A lightweight, offline-first static iPad progressive web app (PWA) designed for Airstream rally Expo Halls. It delivers a secure-random, no-repeat spoken compliment or playful roast with a single tap.

## Features
- **Instant Response**: Built using pure vanilla JavaScript and CSS (system fonts only) with zero network latency.
- **On-Device Speech**: Employs browser-native SpeechSynthesis with high-quality voice prioritization.
- **Offline Shell**: Fully functional offline after initial load using a Service Worker cache (stale-while-revalidate).
- **Secure Shuffling**: Implements Web Crypto rejection sampling and Fisher-Yates shuffle bags so lines do not repeat until their category is exhausted.

## Local Development & Running

To run the application locally without any bundling steps:

1. **Serve the Static Files**:
   Since the app uses native ES Modules, files must be served over HTTP rather than opened as static local paths. You can use any static server, for example:
   ```bash
   # Option A: Using wrangler (Cloudflare dev server)
   npx wrangler dev

   # Option B: Python built-in server
   python3 -m http.server -d public
   ```
2. Open `http://localhost:8787` (Wrangler) or `http://localhost:8000` (Python) in your browser.

## Tests & Static Checks

Unit tests validate deck counts, uniqueness, Fisher-Yates boundary conditions, and localStorage recovery. Static checks verify markup, PWA manifest, service worker assets, and accessibility.

- **Run Unit Tests**:
  ```bash
  npm test
  ```
- **Run Static Checks**:
  ```bash
  npm run check
  ```

## Cloudflare Deployment

The project contains a `wrangler.jsonc` file pre-configured for Cloudflare static assets.

1. Install Wrangler globally or run it via npx:
   ```bash
   npx wrangler deploy
   ```
2. It will deploy all files inside the `public/` directory as highly-available static assets.

## iPad PWA Installation

To run this as an installable fullscreen iPad app:
1. Open the deployed HTTPS URL in **Safari** on the iPad.
2. Tap the **Share** button (box with an arrow pointing up) in the toolbar.
3. Scroll down and select **Add to Home Screen**.
4. Launch "Rivet Roulette" from the home screen; it will open in fullscreen mode without URL bar borders and function fully offline.

## Siri Voice Caveat

**Important Note on Siri Voices**:
The availability of exact Siri voices is controlled by iPadOS and the active browser instance:
- Exact Siri voices are only loaded if they are locally downloaded on the iPad system (Settings > Accessibility > Spoken Content > Voices) and exposed by the web browser.
- The app scans for voice names containing the substring `"Siri"`. If found, it uses it. If not found, it falls back to other high-quality local English Apple voices (e.g. Samuel, Samantha, Daniel, Karen, Moira) and displays a clear, useful status in the footer notifying that fallback speech is active.

## Prize System & Admin Settings

This offline iPad PWA includes an integrated prize and partner perk system designed for rally giveaways.

### 30-Second Session Lock
- The first tap on Compliment or Insult initiates a 30-second session lock.
- Both primary buttons remain locked and show a countdown (e.g., "Locked (24s)") to prevent immediate repeat spins.
- The session expiration is persisted in `localStorage` under `rivet-roulette-session-expires`, preventing bypasses via page reload or reopen.
- Page visibility and window focus listeners recover and update the countdown correctly if the iPad goes to sleep or gets suspended.
- When the timer expires, the app returns to the default READY state.

### Prize Model & Configuration
- **Daily Randomized Schedule**: Prizes are distributed across a configurable daily window (defaulting to 08:00 through 17:00 in the iPad's local timezone).
- **Prizes & Inventory**: Both Nomad's Edge book awards ("Your Awards") and Partner Perks are configured with stable IDs and non-negative daily quantities. The system generates one hidden prize token per unit.
- **Stratified Release Times**: For each configured prize of quantity N, the day's event interval is divided into N equal time bands, and one release time is selected cryptographically at random within each band. All tokens are then merged by release time.
- **Claim Semantics**: Prizes can only be claimed during active hours (between opening and closing times). A spin may claim only the earliest due unclaimed token. Overdue tokens remain due if traffic is absent, but multiple overdue tokens require multiple visitor turns (respecting the 30-second spin lock).
- **Persistence & Reconciliation**: The schedule and awarded counts are persisted in `localStorage`. Saving edits on the same day preserves already awarded counts and reschedules only the remaining quantity. A new calendar day resets awarded counts and generates a new daily schedule.
- **Admin Summary**: An admin-only summary displays today's total scheduled, awarded, and remaining counts without exposing future release times.

### Screenshot-Friendly Proof-Photo Workflow
- When a prize is awarded, a high-contrast screenshot-friendly voucher is displayed in the result area.
- It includes:
  - Voucher Category (Book Discount or Partner Perk)
  - Provider name and exact offer text
  - Awarded date/time with local timezone
  - Expiry date/time (exactly one hour later)
  - Photo instructions: "Take a photo of this screen and show it to the vendor."
- Attendees present the photo of the screen to the vendor to redeem their prize.

### PIN-Protected Settings
- Accessing settings via the gear icon requires entering the PIN: **4167**.
- Entering an incorrect PIN displays a clear inline error.
- Closing the settings panel relocks administrative access immediately. The PIN must be entered again for subsequent settings access.

### Admin Reports & Analytics
- **Local-Only & Privacy-Safe**: To comply with privacy requirements, report events are saved purely on-device in `localStorage` under `rivet-roulette-report-events-v1`. No voice data, visitor identity, device ID, or specific spoken line text is recorded.
- **Reporting Metrics**: Track metrics dynamically per scope (Today, All Time, or specific recorded dates YYYY-MM-DD):
  - Total spins
  - Compliment and insult spin counts and percentages
  - Total prizes awarded and prize rate
  - No-prize spin count
  - Prize wins broken down by spin preference (compliment vs. insult)
- **Vendor/Perk Breakdown**: A detailed table displays total wins, compliment wins, and insult wins for each configured provider and offer.
- **CSV Export**: Admins can export the full spin history to a CSV file (e.g. `rivet-roulette-report-YYYY-MM-DD.csv`). Cell contents are neutralized against formula injection (protecting spreadsheet software from malicious `=`, `+`, `-`, or `@` characters).
- **Data Reset**: A dedicated button allows clearing only report events (requiring confirmation) without affecting deck states, prize settings, or current daily schedules.

### Offline & Device-Clock Limitations
- Since this PWA operates entirely on-device and offline, the iPad's system clock serves as the sole time authority.
- Resetting the device clock, clearing browser site data, or reinstalling the web app can bypass session locks and erase prize configuration, the hidden daily schedule, awarded counts, and report history.
