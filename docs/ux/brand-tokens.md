# Brand color tokens (web + mobile)

Single reference for **accent roles** so violet / purple / pink do not drift between the Next app and Expo.

## Roles

| Role | Hex (canonical) | Usage |
|------|-----------------|--------|
| **Primary accent (violet)** | `#7c3aed` | Tab selected state (dark), list tint, primary buttons that should feel “brand” |
| **Secondary accent (purple)** | `#a855f7` | Headers, macro “calories” chip, timeline highlights, some dark-theme tab selection |
| **Magenta / pink** | `#ff2d78` / `#e839f6` | Energy / marketing gradients only — use `Brand.gradient` on mobile, not for body UI |
| **Success** | `#22c55e` | Confirmations, “verified”, positive CTAs where green reads as success |
| **Destructive** | `#ef4444` | Errors, destructive actions |

## Where it lives in code

- **Mobile:** `apps/mobile/constants/theme.ts` — `Neon`, `MacroColors`, `Brand`, `Colors.light` / `Colors.dark`.
- **Web:** Inline Tailwind classes and shared CSS variables (violet–indigo family). When adding a new surface, pick **either** violet **or** purple for the same *semantic* role as an existing screen (do not introduce a third primary without updating this doc).

## Rules of thumb

1. **One primary per screen region:** e.g. section title + primary CTA share the same accent family (violet *or* purple), not both competing.
2. **Pink is not a default text or border color** — reserve for hero / onboarding / paywall emphasis.
3. **Macro colors** stay mapped through `MacroColors` on mobile so protein/carbs/fat stay consistent with the tracker and recipe cards.

## Visual QA

When changing accents, spot-check: Discover header, tab bar (light + dark), tracker macro chips, paywall header, and one settings row.
