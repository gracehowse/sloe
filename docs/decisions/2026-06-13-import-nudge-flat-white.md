# Today import nudge → flat-white card (ENG-1097)

**Date:** 2026-06-13
**Area:** Today tab / onboarding nudge (mobile, iOS-only)
**Status:** Resolved
**Flag:** `import_nudge_flat_white_v1` (in mobile `REDESIGN_DEFAULT_ON`; off → legacy tinted+bordered slab + outline CTA). iOS-only — the nudge has no web surface.

## Context

Grace (2026-06-13), on the Today screen's "Import recipes from anywhere" card:
"is this import in keeping with styling?"

It was not. The card is the **onboarding import nudge** (`OnboardingNudgeBanner.tsx`), styled with grammar that predated the flat-card law (ENG-1078, 2026-06-12):

- fill `accent.primary + "0A"` — a ~4% clay wash (reads as a warm-grey slab on the cream ground)
- a **1px accent border** (`accent.primary + "30"`)
- an **outline** "Try it" CTA

Every sibling card on Today (meal slots, Add food, Planned, macro tiles) is a **flat white card with no border**. The nudge was the only tinted, bordered card in the stream — it broke the flat-card law (page-ground cards = flat white, separation via fill-vs-ground, no borders) and the "same element, same treatment" rule. The muted treatment read as a "nag box," the worst outcome for the single most strategic affordance (recipe import = the viral wedge): neither cohesive-flat-white nor a confident accent.

## Decision

Render the nudge as a **flat white card** via the shared `SupprCard` primitive
(the same one every sibling Today card uses), so it inherits the exact chrome
(white `colors.card` fill, radius 24, flat, no border) and can never drift again.

- Keep the accent **icon chip** (a nested affordance — fine on a white card).
- The **"Try it" CTA becomes a solid aubergine pill** (button-system solid-primary
  grammar). One-filled-CTA is excepted for conversion surfaces (the FAB/conversion
  carve-out), and the import wedge is exactly that. "Maybe later" stays a tertiary
  text dismiss.

### Surface determines treatment (vs the Discover import hero, ENG-1087)

ENG-1087 made the **Discover** import card a confident **hero** (stronger tint +
solid plum icon + "Paste link" pill). That is correct *there*: the Discover card
is a **permanent** discovery affordance. The Today card is a **transient,
dismissible nudge** — a quiet, cohesive flat-white card is right for a dismissible
prompt; it shouldn't shout. So the two import surfaces diverge deliberately by
context, both internally consistent: permanent hero vs transient flat-white.

## Files

- `apps/mobile/components/today/onboarding-nudges/OnboardingNudgeBanner.tsx` — flag-gated flat-white `SupprCard` + solid CTA; legacy tinted+bordered slab + outline CTA in the off path
- `apps/mobile/lib/analytics.ts` — `import_nudge_flat_white_v1` in `REDESIGN_DEFAULT_ON`
- Tests: `apps/mobile/tests/unit/importNudgeFlatWhite.test.ts`

## Verified

Mobile typecheck + the existing `onboardingNudgeQueue` render suite (16) green;
new wiring test (5) green. The flat-white path uses the identical `SupprCard`
rendering the visible sibling cards, so the rendered nudge matches the Snacks /
Planned cards exactly. (The nudge's eligibility gating — `mealsToday ≥ 1` AND
`libraryCount < 3` — makes a deterministic sim capture unreliable; verified by
primitive-identity + the rendered before/after comparison shown to Grace.)

## Related

- ENG-1078 — flat-card surfaces (the law this restores).
- ENG-1081 — card-fill cohesion flat-white (the same direction, Progress/Settings).
- ENG-1087 — Discover import hero (the deliberate permanent-surface contrast).
- ENG-1094 — the *Discover* import card (a different component; still open, awaiting Grace's A/B). The surface logic here (permanent hero vs transient flat-white) is the lens for that call.
