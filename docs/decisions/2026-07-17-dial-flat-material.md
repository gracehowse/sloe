---
date: 2026-07-17
area: today/dial
status: Resolved
owner: Grace (ENG-1571, Redesign — Design Direction 2026)
linear: ENG-1571
---

# Calorie dial — flat material, all states, both themes

## Decision

The calorie ring dial (web `src/app/components/suppr/calorie-ring-dial.tsx`,
mobile `apps/mobile/components/charts/CalorieRingDial.tsx`) renders as **flat
material in ALL states, in BOTH themes**. The radial **bloom** — the luminous
core/rim radial-gradient halo seated beneath the dial — is **removed** and
stays removed. Kept from the jewel identity: the **48 frost graduation
ticks**, the **per-state lit tick gradient**, and the **lead-segment gem cap**
(absent at a full dial, where there is no leading edge). The **zero/empty
state stays bare** — no decorative glow on an unstarted day.

This ruling supersedes the atmosphere layer of the earlier jewel-dial spec
(which kept the bloom as part of the jewel identity). The tick gradient and
gem cap survive; the bloom does not.

## Why — two reasons

1. **Trust (the amber half).** The bloom is celebratory material. In the
   over-budget state it wrapped the amber "kcal over" read in a warm glow —
   the dial *celebrating* going over budget. That directly contradicts
   ENG-1296's calm-amber posture: over-budget is a quiet, matter-of-fact
   state, never a party and never a punishment. A halo around the amber
   number reads as either reward or alarm; flat amber reads as information.
2. **Material (the haze half).** On light ground the radial bloom doesn't
   read as luminosity — it reads as **haze**, a smudge under the dial. The
   jewel effect only worked on the dark prototype ground; on the shipped
   white card ground (Grace's 2026-06-22 white-background call) it degrades
   the material quality it was meant to add.

## Evidence — rendered, not argued

Judged from a **side-by-side rendered state matrix** (empty / under-budget /
over-budget × light / dark, bloom vs flat), published as **artifact
`ca208c9e`**, judged 2026-07-17 with **Grace concurring**. The flat column won
in every cell; the bloom column's only defensible cell was dark-theme
under-budget, which is not worth a two-material dial.

## Explicitly unchanged

- **ENG-1477 tick colours** — the per-state tick colour families are exactly
  as ENG-1477 ruled them; this decision touches material, not colour.
- **ENG-1296 state families** — under/over/empty state semantics and the
  calm-amber over-budget posture are untouched (this ruling *serves* them).
- **Gestures** — the ENG-1465 tap/long-press macro toggle contract on both
  platforms is untouched.
- **The 48-tick graduation ring, the state-gradient def, and the
  lead-segment gem cap** — the jewel identity minus atmosphere.

## Flag + ramp — ruling vs implementation resolution

The ruling specified `dial_flat_material_v1`, **default OFF**, with the bloom
as the `else`/kill switch, ramped PostHog row → internal → 100% → cleanup
after 2 stable weeks.

**Implementation resolution: the flag was intentionally NOT registered.** The
bloom was already dropped **unconditionally** on 2026-06-22 (commit
`03946c62`, Grace's white-background call) on both platforms — the
Circle/RadialGradient bloom code no longer exists, so there is no `else`
branch for the flag to gate and no bloom to kill-switch back to. Registering
a flag that gates nothing would dead-letter the rollout runbook (an "active"
flag whose two arms are byte-identical). This is a permanent, correct
resolution — not a gap: production has been flat-dial since 2026-06-22 with
no regression, which is itself the ramp evidence the flag was meant to
gather. The ramp plan is therefore void; no PostHog row is created (recorded
in `docs/operations/posthog-rollout.md`).

What the ruling gains instead is a **regression gate**: the flat material is
pinned by tests on both platforms (below), so the ENG-1247
prototype-conformance pass — or any future "match `Sloe-App.html`" sweep —
cannot re-teach the bloom back in from the prototype. The prototype itself
still carries the bloom today; updating `docs/ux/redesign/v3/Sloe-App.html`
to the flat material is **assigned to the prototype-holding session** (per
the ticket) and is deliberately not touched here.

## Pressure-tested failure modes

- **Conformance pass re-imports the bloom from the prototype.** The main
  live risk — the prototype is canonical and still blooms. Mitigated by the
  ENG-1571 test blocks (zero `radialGradient`/`circle` nodes in every state)
  and by the assigned prototype update.
- **"Flag default OFF" read literally as unshipped work.** Mitigated by this
  section: the flag is resolved not-needed, explicitly, with the reason.
- **Flat dial loses the jewel identity.** Mitigated by pinning what's kept —
  the tests assert the 48 ticks, the gradient def, and the gem cap are still
  present, not just that the bloom is absent.

## Files

- `src/app/components/suppr/calorie-ring-dial.tsx` — web dial (already flat
  since `03946c62`; unchanged this ticket).
- `apps/mobile/components/charts/CalorieRingDial.tsx` — mobile dial (same).
- `tests/unit/calorieRingDial.test.tsx` — ENG-1571 flat-material pins, web
  (no bloom nodes in empty/under/over; ticks + gradient + gem cap kept;
  no gem cap at over-budget full dial).
- `apps/mobile/tests/unit/calorieRingDial.test.tsx` — parity twin, mobile.
- `docs/ux/redesign/v3/Sloe-App.html` — prototype update pending, assigned
  to the prototype-holding session (not this change).
