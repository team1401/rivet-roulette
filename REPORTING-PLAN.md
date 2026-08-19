# Rivet Roulette Admin Reporting Plan

**Goal:** Add accurate, offline admin reports and deploy the verified PWA.

**Architecture:** Store one privacy-safe event per accepted 30-second turn in localStorage. Keep pure event normalization, deduplication, summary, date-filter, and CSV logic in `public/js/reports.js`; integrate rendering and controls in the existing PIN-gated settings dialog.

## Stored event

```js
{
  id: 'stable unique id',
  timestamp: 0,
  dateKey: 'YYYY-MM-DD',
  category: 'compliment' | 'insult',
  prize: null | {
    prizeId: 'configured prize id',
    type: 'book' | 'partner',
    provider: 'Nomad\'s Edge Books or vendor',
    offer: 'exact offer'
  }
}
```

No line text, name, contact information, device identifier, or visitor identifier is stored.

## Pure reporting API

Create `public/js/reports.js` exporting:

- `normalizeReportStore(raw)`
- `createSpinEvent({ category, prize, timestamp, id, bookProvider })`
- `recordSpin(store, event)`
- `getReportDateKeys(store)`
- `summarizeReport(store, scope, nowDate)`
- `reportToCsv(store)`

Requirements:

- Invalid/corrupt records are ignored without breaking the kiosk.
- Duplicate event IDs are ignored.
- `scope` accepts `today`, `all`, or a stored `YYYY-MM-DD` date.
- Summary returns total spins, compliment/insult counts and percentages, prize count/rate, prize wins by choice, no-prize count, and prize breakdown by stable prize ID.
- Breakdown includes provider, offer, type, total wins, compliment wins, and insult wins.
- CSV contains one row per spin and safely escapes quotes, commas, newlines, and cells beginning with spreadsheet formula characters.

## Admin UI

Add a PIN-gated `Reports` section containing:

- Scope selector with Today, All Time, and each recorded date.
- Metric cards for spins, preference split, prizes, and no-prize spins.
- Prize wins by compliment/insult.
- Prize/vendor breakdown table or an empty state.
- Export CSV button.
- Reset Reports button with browser confirmation.

## Integration

- Storage key: `rivet-roulette-report-events-v1`.
- Record exactly one event after each accepted spin and after prize determination.
- Report write failures must not block the kiosk result.
- Refresh reports on settings open, report-scope change, event record, and reset.
- Keep vendor and prize configuration manual in the existing settings UI.
- Add `js/reports.js` to the service worker and bump cache to v7.
- Preserve all existing scheduling, voucher, speech, deck, and session behavior.

## Verification

1. RED: add pure reporting and static UI/cache tests, then run `npm test` and confirm failure.
2. GREEN: implement the module and UI integration.
3. Run `npm test`, `npm run check`, and `git diff --check`.
4. Browser-test real spins, Today/All Time/date filters, prize-choice attribution, reload persistence, CSV download, reset confirmation/cancel, and offline reload.
5. Independent code review, fixes, rerun gates.
6. Commit, deploy with Wrangler, and verify live HTML/assets/service worker plus a cache-busted browser load.
