# Design Direction 2026 — "Calm publication, alive at the moments that matter"

- **Date:** 2026-06-01
- **Status:** Resolved (direction + win colour approved by Grace 2026-06-01)
- **Area:** Design system / web + mobile + iOS (cross-surface)
- **Owner:** Grace
- **Specialist input:** `design-director` whole-product brief (Phase 1 DIRECT)

## Context

Grace's verdict on the flag-gated "Redesign 2026" as rendered: web "has some
changes but still looks awful"; iOS "no changes at all". A whole-product
`design-director` pass (judged from real captures + the Claude Design prototype
+ best-in-class research, cross-checked against HEAD source) found the root
cause:

> **The premium design system was built but never swept onto the surfaces that
> form the first impression.** Web Today / `NutritionTracker` / `daily-ring` use
> bare `bg-card border` with zero elevation-flag consumption; `SupprCard` is
> consumed in **2 files** vs **278 hand-rolled card divs**. The win-moment Lottie
> is a **1-frame transparent placeholder** on both platforms. So with the flags
> ON, the spine surfaces still render flat and the goal-hit payoff is a no-op.

Mobile *did* adopt the primitives in code (25 files use `SupprCard`/
`useCardElevation`; Today wires the win-moment), but the running build is stale,
dark mode intentionally suppresses shadows (subtle delta), and the win-moment is
blank — so it reads as "no changes".

## Decision — the unifying direction

**One through-line for all three surfaces:** a quiet, warm, editorial surface
(the calm of Notion / Things / Cron) that comes alive with depth, motion, and
colour-as-emotion *precisely at the data moments a user repeats* — the log, the
ring closing, the goal hit. Calm everywhere; electric at the wins.

The unified spine:

1. **One elevation model.** Light (web hero theme) = soft drop shadow
   `0 4px 14px rgba(28,25,22,.07)`, **no hairline border**. Dark (iOS hero
   theme) = no shadow, **tonal lift** (`cardElevated`) + hairline.
2. **Counting hero number** — the calorie total / fasting timer / weight renders
   at display size, heavy, tabular, and odometers up on change. The visual
   anchor of the product.
3. **Macros as tinted bars/tiles** in their fixed colours (protein blue / carbs
   orange `#E8721E` / fat magenta `#DF5EBC` / fibre green) — number in the macro
   colour, soft tinted track, never a flood fill.
4. **Three-role colour law (absolute):** blue `#588CE4` = action only; green
   `#56A775` = success/identity; **brand-spectrum = win/landmark celebration
   only** (see win-colour below).
5. **Brand tokens only** — eliminate the off-palette drift (census found 68×
   `slate-900`, 81× `violet-*`, plus `indigo`/`emerald`) via codemod.
6. **The goal-hit moment is the shared delight peak** — real celebration asset +
   `success` haptic (iOS) / colour-pulse + odometer settle (web), once per day.

### Win / achievement colour — BRAND SPECTRUM (chosen 2026-06-01)

Considered amber (director interim), gold, and purple; **chose the brand
spectrum** — the celebration ring/glow lights up in Suppr's own colours. Most
ownable (no competitor celebrates in its own brand spectrum), ties straight to
the brandmark + the empty-ring gradient, collision-free with the macro/warning
colours, and the strongest expression of "calm everywhere, alive at the win."

- `--accent-win-gradient: linear-gradient(120deg, #588CE4 0%, #9679D9 50%, #DF5EBC 100%)` — the celebration MOMENT: ring fill + glow + colour-pulse.
- `--accent-win: #9679D9` (brand purple) — single calm hue for **persistent**
  achievement bits (streak chip, milestone badges) so they never read busy.
- Celebration hero number renders in warm-white / ink so it stays legible
  against the multi-colour ring.

Mobile + web read the same tokens; the win-moment is colour-themed by token, so
the colour decision is a one-place change.

## Hero themes

- **Web hero = warm-paper light** (`#fbfaf6` page, `#fff` cards, chocolate ink
  `#1a1714`) — made premium by landing the soft-shadow sweep, not left as
  accidental flat-light.
- **iOS hero = dark** (`#0f0e12`) — depth via tonal lift; verify it reads.

## Keep (already at/above bar — do not sand off)

Multi-ring calorie + macro system; the ~3% "what to eat next" fit chip; the
warm-paper chocolate-ink palette; the 8-slot palette lock + three-role colour
law (spec is excellent, just unobeyed); the 6/8px tight radius ladder; the
shared motion source of truth (`src/lib/motion.ts`); the calm voice + sparse
weight chart; the brandmark-as-glyph.

## Implementation = a SWEEP (apply existing primitives, don't invent)

1. Token layer: define the gold win token (+ gradient); make `SupprCard` / one
   `.card` utility the only blessed card; encode the three-role colour law.
2. Codemod: `slate-*` / `violet-*` / `indigo-*` / `emerald-*` → brand tokens (web).
3. Card-elevation sweep: route the ~280 hand-rolled web cards + Today + daily-ring
   through the elevated card (behind `design_system_elevation`).
4. Counting hero: wire the odometer into the web daily-ring.
5. Win-moment: ship the real gold celebration asset (web + iOS) — ENG-798.
6. iOS: ship the redesign build; verify dark tonal-lift reads; wire
   `confirm`/`success`/`selection` haptics across the daily loop.
7. Parity (web + mobile lockstep) + a before/after screenshot of every surface;
   tests + docs; each change behind its existing flag; ramp only after Grace
   reviews real (not mock) screenshots.

## Artefacts

- Director brief: Phase 1 (DIRECT) — whole-product canvas judgement.
- Prototypes (HTML mocks, approved): web Today (warm-paper light), iOS Today
  (dark hero) + goal-hit moment, win-colour comparison (gold chosen).
- Flags: `design_system_elevation`, `design_system_colours`,
  `design_system_brandmark`, `design_system_icons`, `redesign_winmoment`,
  `redesign_motion`, `redesign_branded_sheets`, `redesign_search_results`.

## Update 2026-06-01 (evening) — redesign UN-GATED, flag-gating retired

Grace: *"turn everything on so I can see everything, never build in this
flag-gated way again, it's a mess."* The flag-gated rollout (step 7 above)
backfired: the redesign was built, gated, and then **invisible** — the flags
didn't resolve on the iOS build (ENG-840: the env-force is dead in RN bundles,
sim PostHog unreachable, and a ramp was mis-targeted to the wrong email). For a
solo founder pre-launch (N=1), the safe-rollback benefit was worth less than the
cost of not being able to see her own work.

Decision: the 8 redesign flags are now **default-ON in every build**, un-gated,
via `REDESIGN_DEFAULT_ON` in `apps/mobile/lib/analytics.ts` +
`src/lib/analytics/track.ts`. No PostHog/env dependency; an explicit dev/test
force can still turn one OFF (so pre-redesign captures work). The PostHog rows
survive only as emergency kill switches. Verified on the real iOS Today (cards
render soft elevation): `docs/ux/captures/today-elevation-2026-06-01/`.

ENG-840 is resolved-by-elimination for the redesign (the residual non-redesign
dev-force is still open on that ticket). Forward policy: **no new
`isFeatureEnabled` gates for visual/redesign work** — the new design is the
default path. Still owed (tracked): web Today card-elevation sweep (278
hand-rolled divs); win-moment asset (ENG-798).
