# Rivet Roulette Demo Design Brief

## 1. Feature Summary

An offline-first iPad PWA for an Airstream rally Expo Hall. A visitor chooses Compliment or Insult and immediately sees and hears one rally-safe line spoken through the best Apple voice exposed by the browser.

## 2. Primary User Action

Tap one of two unmistakable choices and receive an immediate spoken payoff.

## 3. Design Direction

Full-palette product surface. Scene: a standing attendee uses a shared iPad under bright Expo Hall lighting while friends watch and wait for the punchline. Anchor references are polished aircraft aluminum, mid-century roadside attraction signage, and Apple’s direct touch interaction patterns. The image-generation probe is skipped because this harness has no native image-generation tool.

## 4. Scope

High-fidelity interactive demo, one screen plus compact settings, installable PWA, suitable for remote HTTPS hosting and offline reuse. No backend and no AI generation at runtime.

## 5. Layout Strategy

A compact masthead, a prominent persistent result stage, and two dominant choice fields. Portrait stacks choices. Landscape splits them evenly. The core choice must remain obvious from several feet away.

## 6. Key States

- Ready: invitation to choose.
- Compliment: line is visible and spoken, with compliment field emphasized.
- Insult: line is visible and spoken, with insult field emphasized.
- Speaking: visible status while speech is active.
- Unsupported speech: line still appears with a useful browser message.
- Empty voice list: retry when voices become available and use browser default meanwhile.
- Deck exhausted: reshuffle automatically without repeating the immediately prior line.
- Offline: fully functional after first successful load.

## 7. Interaction Model

One tap cancels current speech, draws from the chosen no-repeat deck, updates the result immediately, then calls speech synthesis in the same user gesture. Repeated taps interrupt cleanly. Keyboard users can Tab and activate with Enter/Space. Settings adjust voice and speech rate, and reset both decks.

## 8. Content Requirements

At least 50 compliments and 50 playful insults for the demo. Lines must be short enough to speak quickly. Avoid profanity, protected classes, politics, sexual content, cruelty, body comments, financial comments, and dangerous behavior. Prefer rally, towing, backing, polishing, campsite, hitch, awning, and camping-culture observations.

## 9. Recommended References

Spatial design, typography, interaction design, motion design, responsive design, color and contrast, and UX writing.

## 10. Open Questions

Exact exposed voice names vary by iPadOS. The demo must prefer names containing Siri, then high-quality Apple English voices, while exposing a voice picker and browser-default fallback.