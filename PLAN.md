# Rivet Roulette Demo Implementation Plan

**Goal:** Build and deploy a fast, offline-capable iPad PWA that speaks a no-repeat random compliment or insult.

**Architecture:** Static HTML, CSS, JavaScript, manifest, and service worker. Web Speech API stays entirely on-device. Node’s built-in test runner validates deck and selection behavior.

**Success criteria:**
1. One tap immediately displays and attempts to speak a line.
2. Secure random shuffle bag prevents repeats until the category deck is exhausted.
3. At least 50 safe lines exist in each category.
4. Current speech is interrupted cleanly by another tap.
5. Voice selection prefers Siri/Apple English voices but always has a fallback.
6. App installs and functions offline after initial load.
7. Keyboard, focus, reduced-motion, safe-area, portrait, and landscape behavior are present.
8. Tests, syntax checks, browser console inspection, and live HTTPS fetch all pass.

## Tasks

1. Create content data and content validation tests.
2. Implement reusable secure shuffle-deck module with tests.
3. Build the single-screen semantic interface and speech controller.
4. Add manifest, icons, and service worker.
5. Run unit tests and static checks.
6. Inspect tablet, mobile, and desktop browser views, critique, and fix.
7. Deploy to a temporary HTTPS URL and verify live output.