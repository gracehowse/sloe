# Calorie ring colour mapping — three states (2026-05-05)

**Status:** Resolved.
**Authority:** Grace product call after reviewing live ring states on
2026-05-05.
**Owner:** Grace / executor.

## Problem

Build 41 (TestFlight, 2026-05-01) shipped a two-state ring colour
mapping:

- `consumed >= goal`: solid success green
- otherwise: brand gradient

The intent was "you've hit the target → celebrate green". But the
range that wasn't "hit target" included BOTH "haven't logged yet" and
"logged some, under target". Both rendered as the welcome gradient,
which read as "you haven't started" — visually undermining the
logging the user had just done. The over-budget case ALSO rendered
green, while the centre digit flipped to red/amber for the same
state — incoherent cue between the ring and the digit.

## Fix

Three-state mapping replaces two-state. Outer ring stroke and centre
digit colour map to the same three states:

| State | Outer ring | Centre digit |
|---|---|---|
| Empty (`consumed === 0`) | brand gradient (full opacity) | default text |
| Logged-and-under (`0 < consumed <= goal`) | `Accent.success` / `var(--success)` | default text |
| Logged-and-over (`consumed > goal`) | `Accent.destructive` / `var(--destructive)` | `var(--destructive)` |

### Files

- [apps/mobile/components/charts/CalorieRing.tsx](../../apps/mobile/components/charts/CalorieRing.tsx) — outer ring stroke (already used `Accent.destructive` for centre digit).
- [src/app/components/suppr/daily-ring.tsx](../../src/app/components/suppr/daily-ring.tsx) — outer ring stroke + centre digit + centre label. Web previously used `var(--warning)` for over (amber); this commit aligns it with mobile's destructive red for parity.

### Why destructive red, not warning amber

The 2026-04-19 prototype's `colors_and_type.css` comments
`/* errors only; NEVER over-budget */` on the destructive token, and
puts `over-budget` in the warning (amber) bucket. Grace's 2026-05-05
feedback explicitly said "logged over and red" — overriding the
prototype rule. New rule lives at memory
`feedback_calorie_ring_colour_mapping.md` so design-system-enforcer
agents don't re-flag this as a prototype violation.

## Validation

- **Web visual**: `apps/mobile/screenshots/latest/after-ring-colors-web-states.png` — captures `/dev/daily-ring-states` showing all 4 ring states (empty, partial, at-goal, over). Empty = gradient, partial = green, at-goal = green, over = red. Centre digits match.
- **Mobile visual**:
  - Tue 5 May 2026 — 702 of 1132 kcal logged → ring renders green ✓ (`/tmp/sim-check/after-ring-colors-today.png`)
  - Sun 3 May 2026 — 1,543 logged, over target → ring renders red ✓ (`/tmp/sim-check/after-ring-over-mobile-clean.png`)
- `tsc --noEmit` clean web + mobile.

## Cross-platform

Web and mobile both updated in this commit. Parity maintained.

## Closes

- Grace's 2026-05-05 in-session feedback on the audit captures.
- Updates memory `feedback_calorie_ring_colour_mapping.md` (NEW) and
  the MEMORY.md index.
