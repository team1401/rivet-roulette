# Double Decks and Airstream Hosting Plan

**Goal:** Expand Rivet Roulette to 144 compliments and 144 insults, then host the verified offline-first PWA on the physical Airstream server.

1. Update deck-count regression tests from 72 to 144 and verify they fail.
2. Add 72 unique, rally-safe compliments and 72 unique, playful insults. Preserve the existing arrays and shuffled-deck behavior.
3. Bump the service-worker cache version so installed iPads receive the new line deck.
4. Run unit, static, syntax, uniqueness, and content checks. Exercise both 144-card decks in a browser.
5. Commit the app change.
6. Deploy `public/` to an isolated nginx container on Airstream, bound to loopback for Tailscale Serve and specifically to `<home-assistant-host>` for LAN access.
7. Add an unused Tailscale Serve HTTPS port and verify online, cache-controlled, and offline PWA behavior.
