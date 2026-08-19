# Design System

## Visual Theme

A playful mid-century rally kiosk made from polished aluminum and printed enamel signage. The physical scene is a standing attendee tapping a shared iPad under bright Expo Hall lighting while a small group watches, so the interface uses a light, high-contrast theme with oversized controls.

## Color Strategy

Full palette with two deliberate action fields, not semantic red/green alone.

- Aluminum canvas: `oklch(91% 0.012 235)`
- Deep ink: `oklch(20% 0.025 245)`
- Compliment field: `oklch(74% 0.15 88)` with deep ink text
- Insult field: `oklch(57% 0.19 25)` with warm near-white text
- Cool accent: `oklch(52% 0.12 225)`
- Warm near-white: `oklch(97% 0.008 80)`
- Focus: `oklch(50% 0.18 265)`

Use texture and borders sparingly. Never use pure black, pure white, gradient text, or decorative transparency.

## Typography

Use the Apple/system sans stack for zero network latency and an iPad-native feel. All-caps labels receive 0.08em to 0.11em tracking. Primary action labels are extremely bold; spoken text is large, balanced, and limited to a readable measure.

## Layout

Portrait: compact title and status, result stage, then two vertically stacked action fields. Landscape and larger tablets: result stage above a 50/50 two-column action area. Respect iPad safe areas. Avoid nested cards.

## Components

- `masthead`: compact product name, mode hint, and small settings button.
- `result-stage`: persistent central text area with neutral, compliment, insult, and unsupported states. It is not a modal.
- `choice-button`: huge semantic button with label, short cue, tactile active state, focus ring, and no hover dependency.
- `settings-panel`: native details/dialog treatment for voice, speed, and deck reset. Secondary to the core flow.
- `voice-status`: plain-language readiness or fallback message.

## Motion

Instant 100–150ms press feedback and a 220ms result reveal using opacity and transform. No page-load choreography. Respect `prefers-reduced-motion`.

## Responsiveness

Touch-first and mobile-first. Minimum supported layout is 320px wide, but primary target is modern iPad portrait and landscape. Use content-driven breakpoints and coarse-pointer sizing. Avoid device sniffing.