# Daily Prize Schedule Implementation Plan

**Goal:** Replace percentage-per-spin prizes with a persistent, randomized daily schedule from 8:00 AM to 5:00 PM.

**Architecture:** Keep the app static and offline. Store prize configuration and one hidden daily schedule in `localStorage`. Generate one scheduled token per physical prize unit using cryptographic random integers. Stratify each configured prize type across the event day, merge all tokens chronologically, and award at most the earliest due token per 30-second visitor turn.

**Assumptions**

- "My awards" means Nomad's Edge book awards.
- Every book award and vendor offer has its own non-negative integer daily quantity.
- Default hours are 08:00 through 17:00 in the iPad's local timezone.
- A prize released during a traffic gap remains due until the next spin, but no prizes are awarded after closing.
- The daily schedule persists across reloads and cannot be regenerated to restore claimed inventory.
- Saving edited settings preserves today's awarded count by stable prize ID, then schedules only the remaining daily quantity.

## Task 1: Prize scheduling domain

**Files:** `public/js/prizes.js`, `test/deck.test.js`

1. Replace percentage configuration with opening time, closing time, daily book awards, and daily partner offers.
2. Add migration from legacy book offers and partner inventory without silently awarding legacy book offers.
3. Validate times, required names/offers, and integer daily quantities.
4. Add pure helpers for local date keys, day boundaries, schedule generation, due-prize claiming, awarded counts, and schedule reconciliation.
5. Write failing tests first for stratification, combined inventory, one-claim-per-spin, opening/closing boundaries, persistence inputs, and preservation of awarded counts.

## Task 2: App integration and settings

**Files:** `public/js/app.js`, `public/index.html`, `public/styles.css`

1. Replace chance fields and freeform offers with dynamic "Your Awards" rows and daily quantity fields.
2. Rename partner inventory to prizes per day.
3. Generate/reconcile today's schedule on load, settings save, focus, and each spin.
4. Replace `selectPrize()` with a claim against the hidden daily schedule.
5. Persist the claimed schedule before rendering the voucher.
6. Add an admin-only daily schedule summary without exposing future release times.

## Task 3: Offline cache, docs, and verification

**Files:** `public/sw.js`, `README.md`, `test/static-check.js`

1. Bump the service-worker cache version.
2. Update static checks for new settings controls and removed percentage controls.
3. Document the schedule model, local-clock limitation, configuration changes, and late-traffic behavior.
4. Run `npm test`, `npm run check`, browser interaction checks, offline reload, and viewport inspection.
5. Review the diff for legacy probability code, accidental schedule disclosure, duplicate claims, and stale inventory terminology.
