# Daily Prize and Partner Feature Brief

## Confirmed behavior

- The first Compliment or Insult tap begins a 30-second session.
- Only one play and at most one prize award are allowed during that session.
- Both primary buttons remain locked until the screen returns to READY after 30 seconds.
- The session lock persists across refreshes and reopening the PWA.
- The prize proof displays the iPad's current local date/time, an expiration exactly one hour later, and instructions to photograph the screen.
- There are no coupon codes. The photograph is the proof shown to the vendor.
- The app remains offline-first and stores configuration, the hidden schedule, and awarded counts locally on one iPad.
- Admin settings remain PIN protected.

## Daily prize model

- Percentage-per-spin prize rolls are removed.
- Expo Hall hours default to 8:00 AM through 5:00 PM in the iPad's local timezone.
- Every Brian Smith - Author award and every partner offer has a configurable nonnegative integer `prizes per day` quantity.
- Each configured unit becomes one hidden daily prize token.
- All remaining author and partner tokens are shuffled into one coordinated pool.
- The algorithm divides the remaining operating window into one equal band per token and places one token at a cryptographically random time inside each band.
- Example: three Vendor A prizes and two author awards create five coordinated release bands rather than separate vendor-specific timelines.
- A token cannot be awarded before its release time.
- The first eligible turn at or after release claims the earliest due token.
- Only one token is claimed per 30-second turn. Additional overdue tokens remain queued for later turns.
- No token is awarded before opening or at/after closing.
- Unawarded tokens do not carry into the next local calendar day. A fresh schedule is generated for the new day.
- If the app first starts after opening, the first remaining token releases within one minute and the rest are distributed across the remaining open hours rather than creating an immediate overdue backlog.

## Persistence and settings edits

- The complete schedule is generated once and persisted so refreshes, PWA reopening, sleep, and offline operation do not reroll release times.
- Same-day settings edits preserve already-awarded counts by stable prize ID.
- Only the combined remaining daily quantity is rescheduled after a settings change.
- Version-1 schedules migrate to version 2 from the current time while preserving awarded history.
- Reducing a daily quantity below its already-awarded count never creates negative inventory or additional tokens.
- Malformed saved schedule arrays are discarded and regenerated rather than breaking the kiosk.

## Admin experience

- Tapping the gear opens the existing PIN prompt.
- Correct PIN opens settings; closing settings relocks it.
- Settings retain voice/rate controls and provide:
  - Native Expo Opens and Expo Closes time controls
  - Add/edit/remove Brian Smith - Author award rows
  - Exact award offer text
  - Prizes per day for each award
  - Add/edit/remove partner rows
  - Vendor name
  - Exact offer text
  - Prizes per day for each partner offer
  - Today's scheduled, awarded, and remaining totals
  - Validation and save feedback
- A quantity of zero disables that offer.

## Prize proof

The visible prize proof includes:

- Clear prize headline
- Brian Smith - Author or partner vendor name
- Exact offer text
- Awarded local date/time with timezone
- Valid-until local date/time, one hour later
- “Take a photo of this screen and show it to the vendor.”
- A note that the offer expires one hour after award

## Limitations

This is an offline single-iPad system. The iPad clock is the time authority. Changing the device clock, clearing site data, reinstalling the PWA, or using another device can erase or bypass local session, schedule, and award state. Multi-device authoritative inventory or redemption would require a backend and is outside this feature.
