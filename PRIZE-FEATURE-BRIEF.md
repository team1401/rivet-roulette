# Prize and Partner Feature Brief

## Confirmed behavior

- The first Compliment or Insult tap begins a 30-second session.
- Only one play and one prize roll are allowed during that session.
- Both primary buttons remain locked until the screen returns to READY after 30 seconds.
- The session lock persists across refreshes and reopening the PWA.
- Any awarded prize is spoken after the compliment or insult.
- The prize proof displays the iPad's current local date/time, an expiration exactly one hour later, and instructions to photograph the screen.
- There are no coupon codes. The photograph is the proof shown to the vendor.
- The app remains offline-first and stores configuration and inventory locally on one iPad.
- Admin settings are protected by PIN 4167.

## Prize model

- Book discounts and partner perks have separate configurable integer percentages.
- Their combined percentage cannot exceed 100.
- At most one prize can be awarded per session.
- Book offers are unlimited-use text entries, one per line.
- Partner offers contain vendor name, offer text, and remaining inventory.
- Partners with zero inventory are ineligible.
- Eligible partner offers are selected uniformly.
- Partner inventory decrements immediately when the prize is awarded because the photo becomes the redemption proof.
- If a configured prize category has no eligible offers, its probability band yields no prize rather than shifting probability to another category.

## Admin experience

- Tapping the gear opens a PIN prompt.
- Correct PIN opens settings; closing settings relocks it.
- Settings retain voice/rate controls and add:
  - Book discount chance
  - Book offers textarea, one exact offer per line
  - Partner perk chance
  - Add/edit/remove partner rows
  - Vendor name
  - Offer text
  - Remaining inventory
  - Validation and save feedback
- Empty prize configuration defaults both chances to zero.

## Prize proof

The visible prize proof must include:

- Clear prize headline
- Book discount or partner vendor name
- Exact offer text
- Awarded local date/time with timezone
- Valid-until local date/time, one hour later
- “Take a photo of this screen and show it to the vendor.”
- A note that the offer expires one hour after award

## Limitations

This is an offline single-iPad system. The iPad clock is the time authority. Changing the device clock, clearing site data, reinstalling the PWA, or using another device can bypass local session and inventory state. Multi-device authoritative redemption would require a backend and is outside this feature.