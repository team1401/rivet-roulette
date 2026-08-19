You are an autonomous frontend implementation agent working inside this exact directory:
/Users/helix/.Hermes/workspace/rivet-roulette

Read PRODUCT.md, DESIGN.md, DESIGN-BRIEF.md, PRIZE-FEATURE-BRIEF.md, PLAN.md, package.json, all files under public/, and all files under test/ before editing.

Goal:
Implement the confirmed 30-second session reset, random book discounts, inventory-limited partner perks, spoken prize proof, and PIN-protected admin settings in the existing Rivet Roulette offline iPad PWA.

Hard boundaries:
- Write only inside this project directory.
- Do not alter any of the 144 compliment/insult strings.
- No framework, bundler, package install, external dependency, network API, backend, telemetry, secret service, deploy, git operation, public action, or account change.
- Do not change the confirmed behavior in PRIZE-FEATURE-BRIEF.md.
- Do not ask questions.

Required implementation:
1. Add `public/js/prizes.js` with small testable pure functions for config normalization, probability validation, secure prize selection using injected randomInt, eligible partner filtering, and partner inventory decrement.
2. Persist prize config locally. Default to zero chances and empty offers. Preserve existing voice/rate and deck state.
3. The first primary tap locks both buttons for exactly 30 seconds, stores the session expiration in localStorage, draws and speaks the compliment/insult, and performs at most one prize roll.
4. Reloading or reopening during the lock must not permit another play. Show a concise countdown and return to the default READY state when the lock expires. Use visibility/focus checks so suspended iPad timers recover correctly.
5. If a prize is awarded, render a screenshot-friendly proof panel with category/vendor, offer, awarded device-local date/time including timezone, expiration exactly one hour later, and photo instructions. Speak the prize after the base line in the same utterance.
6. Partner inventory decrements before the proof is shown and persists immediately. A zero-inventory partner can never win.
7. Use two mutually exclusive probability bands: book chance first, then partner chance, then no prize. Combined chance must be 0-100. If a selected category has no eligible offers, award nothing; do not transfer its probability.
8. Book offers are exact nonempty lines from a textarea and are unlimited-use.
9. Replace direct gear-to-settings with an accessible PIN dialog. PIN is 4167. Wrong PIN shows a clear inline error. Correct PIN opens settings. Closing settings relocks admin access. Do not display the PIN elsewhere.
10. Extend settings with numeric 0-100 fields for book and partner frequencies, book-offer textarea, dynamic partner rows containing vendor name, offer text, remaining inventory, remove button, and Add partner. Save validates combined chance <=100 and requires complete partner rows. Show remaining inventory clearly.
11. Keep existing voice selection, speech rate, replay, deck reset, service worker, offline behavior, responsive design, icons, and accessibility.
12. Update service worker cache version and asset list for prizes.js.
13. Update README with configuration, proof-photo workflow, inventory semantics, PIN-protected settings, 30-second lock, and the offline/device-clock limitation.
14. Update/add node:test coverage for:
   - normalization and invalid config
   - exact probability boundaries
   - no eligible offers
   - zero-inventory exclusion
   - deterministic offer selection
   - inventory decrement without going negative
   - 30-second/session constants or static behavior assertions
   - PIN dialog and prize proof markup
   - new service worker asset
15. Preserve no external fonts/images and current visual direction. Prize proof should look like a deliberate rally voucher, not a nested SaaS card or casino jackpot. Use visible labels and high contrast, no gradient text, no em dashes, no pure black/white.

Verification required:
- `npm test`
- `npm run check`
- `git diff --check`

Final response must include only files changed, exact verification results, design decisions, and known limitations.