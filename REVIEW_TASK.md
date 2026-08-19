You are a skeptical senior frontend reviewer. Work read-only inside:
/Users/helix/.Hermes/workspace/rivet-roulette

Read PRODUCT.md, DESIGN.md, DESIGN-BRIEF.md, PLAN.md, package.json, all files under public/, and all files under test/.

Goal: produce a concise, evidence-based review of the current Rivet Roulette iPad PWA demo. Do not edit any files.

Review for:
- Correctness of secure random rejection sampling, shuffle bag, persistence validation, and no-repeat behavior.
- iPad Safari Web Speech API timing, voice discovery, voice naming honesty, rapid repeated taps, stale callbacks, unsupported/error behavior, and settings persistence.
- PWA/offline correctness, service worker update behavior, manifest/icon compatibility with iPadOS, and Cloudflare static asset paths.
- Semantic HTML, screen reader behavior, keyboard behavior, focus, contrast, reduced motion, safe areas, portrait/landscape, and 320px behavior.
- Visual fidelity to DESIGN.md and anti-pattern violations.
- Test quality, especially false-positive assertions and missing regression coverage.
- Security/privacy and any network behavior.

Known suspicions to verify rather than blindly accept:
1. Direct localStorage settings reads may trigger a catch that replaces decks with first-item-only fallbacks.
2. Persisted shuffledIndices may accept duplicate values.
3. Apple touch icon as an SVG data URI may not be reliable on iPadOS.
4. Result-stage pseudo-elements may fail to produce four rivets.
5. Voice prioritization may miss common Apple voice names.

Run tests if useful. No package installs, network calls, public actions, git changes, or secrets.

Final response format:
- P0/P1/P2 findings, each with exact file and line references, impact, and minimal fix.
- What is already solid.
- Exact verification additions recommended.
- No vague style commentary and no edits.