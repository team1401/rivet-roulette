You are an autonomous frontend implementation agent working inside this exact directory:
/Users/helix/.Hermes/workspace/rivet-roulette

Read PRODUCT.md, DESIGN.md, DESIGN-BRIEF.md, PLAN.md, and src/lines.js before editing.

Goal:
Build the complete Rivet Roulette static iPad PWA demo. It must respond instantly, work offline after first load, and speak a secure-random no-repeat compliment or playful insult using the browser's on-device speech synthesis.

Deliverables:
- A complete static app under `public/`.
- Move the exact line arrays from `src/lines.js` to `public/js/lines.js` without changing their strings, then remove the now-empty `src/` directory if appropriate.
- `public/index.html`, `public/styles.css`, `public/js/app.js`, `public/js/deck.js`, `public/js/lines.js`, `public/manifest.webmanifest`, `public/sw.js`, an SVG favicon, and an Apple touch icon strategy that works without network calls.
- `package.json` using only Node built-ins.
- Unit/static tests under `test/`.
- `wrangler.jsonc` configured to serve `public/` as Cloudflare static assets.
- A concise `README.md` with local run, tests, deployment, iPad install, and known Siri voice caveat.

Hard boundaries:
- Write only inside /Users/helix/.Hermes/workspace/rivet-roulette.
- Do not change PRODUCT.md, DESIGN.md, DESIGN-BRIEF.md, PLAN.md, or COPY_TASK.md.
- Do not alter any of the 144 spoken strings.
- No framework, bundler, package install, external font, external image, API, CDN, telemetry, backend, secrets, public posting, deploy, git push, PR, email, DNS, billing, or account changes.
- Do not ask questions. Make reasonable decisions and document them.

Functional requirements:
1. Two huge semantic buttons clearly labeled COMPLIMENT and INSULT. Each works with touch, mouse, Enter, and Space.
2. On activation, cancel current speech, draw a line, update visible text immediately, then call `speechSynthesis.speak()` in that same user gesture.
3. Use a Web Crypto based rejection-sampled integer function and Fisher-Yates shuffle bag. Every line in a category must be used once before reshuffling. Avoid an immediate repeat across reshuffle boundaries. Persist deck state in localStorage when available, but fail safely if storage is unavailable.
4. Repeated taps interrupt current speech cleanly. Stale `onend` or `onerror` callbacks must not overwrite state for a newer utterance.
5. Voice selection: populate asynchronously and on `voiceschanged`; prefer a saved voice; otherwise names containing Siri; otherwise high-quality local English Apple voices; otherwise any local English voice; otherwise browser default. Expose a compact settings dialog with voice picker, rate control, replay, deck reset, and close.
6. Do not claim the exact Siri voice is active unless the selected voice name actually contains Siri. Show a concise fallback status.
7. If speech synthesis is unsupported or errors, the text result must still work and the error copy must be useful, not humorous.
8. PWA: valid manifest, service worker cache with safe update behavior, theme colors, viewport-fit cover, standalone display, Apple web app meta tags, and complete offline shell.
9. Visual direction: bright Expo Hall light theme, brushed-aluminum/rivet cues, mid-century enamel-sign energy, full palette with distinct non-red/green-only cues. No gradient text, glassmorphism, SaaS cards, casino styling, fake thinking delay, generic icon library, pure black, or pure white.
10. Portrait stacks choices and landscape uses a 50/50 split when space permits. Respect safe areas, 320px minimum, iPad portrait and landscape, 44px minimum secondary targets, very large primary targets, no hover-only functionality.
11. Accessibility: semantic landmarks, h1, live region for result/status, visible focus rings, WCAG AA intent, reduced motion, color is not the only category cue, zoom remains enabled.
12. Motion is limited to 100-150ms press feedback and a roughly 220ms result reveal using transform/opacity only.
13. Use native/system fonts for zero network latency. Use OKLCH color tokens with conservative hex fallbacks.
14. Content count remains exactly 72 in each category.

Testing requirements:
- Use `node:test` and `node:assert` only.
- Tests must cover exact content counts/uniqueness, deterministic full-deck no-repeat behavior, reshuffle boundary behavior, invalid persisted state recovery, and key static/PWA/accessibility assertions.
- Add `npm test` and `npm run check` scripts.
- Run both before finishing.

Design influence:
Translate polished aircraft aluminum, mid-century roadside signage, and direct Apple touch interactions into a distinctive but simple one-screen tool.

Final response must include only:
- Files created/changed.
- Verification commands run and pass/fail result.
- Design influence and how it shaped the UI.
- Known compromises/risks.