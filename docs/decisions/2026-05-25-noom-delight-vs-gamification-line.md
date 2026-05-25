# Decision — The Noom delight-vs-gamification line

- **Date:** 2026-05-25
- **Area:** Brand / Today / Onboarding
- **Status:** Resolved (revised same day — see Revision below)
- **Owner:** Grace (product call), framed by `product-lead`
- **Evolves:** D-2026-04-27-07 (streak/recap stance), DC12 (calm voice — "no gamification" clause); re-affirms DC8 (calm streak pip). The sweep decisions-log entry (ENG-718) "calm voice / no gamification — KEPT" is **superseded by this** — see ENG-718 cross-link.
- **Companion:** `docs/ux/teardown-2026-05-25-noom-interaction.md`

## Revision (2026-05-25, same day)

The first cut of this decision set the ceiling at "one-off confetti only / no running counter survives." **Grace overrode that ceiling the same day:** *"some gamification makes sense but we can do it in a better way — we want haptics and interactivity and for the app to look cool and premium and have wow moments."* Direction: **shame-free achievements** (celebration + milestones + achievements + progress that only ever reward, never punish), across four surfaces (recipe import, daily logging, goals/milestones, onboarding). The gate rule below is unchanged and was the right test — product-lead was simply too conservative applying it (it concluded "no running counter survives" because even decay punishes; a genuinely additive, no-decay, no-break-penalty achievement does **not** punish, so it passes). The Decision section reflects the raised ceiling.

## Context

A Noom interaction teardown reopened the question of "light gamification." Grace's standing position was "calm voice / no gamification," and the 2026-05-25 full-product sweep's strategic note states plainly: MFP's April-2026 redesign *added* streaks and that is part of what's driving the MFP exodus we're capturing — do not answer the anti-tracking-exhaustion cohort with streaks/gamification. This session Grace asked to *"reconsider light gamification."*

D-2026-04-27-07's `Reconsider on` field reads "N/A — this is a stance, not a hypothesis to test." Reopening it at all — even to land on "still no economy" — touches a decision marked un-reconsiderable, so the outcome must be recorded or the decisions log misrepresents its own status.

**Stale-premise correction (important):** the framing "the streak was removed, keep it removed" is **wrong**. Suppr ships a live calm streak **pip** today (DC8) — pale, gated to ≥2 days, no decay, no reset ceremony, no break-penalty, no notification — rated AT BAR / BETTER THAN BAR by the 2026-05-15 premium audit. What D-2026-04-27-07 removed was the celebration ribbon and motivational copy, **not** the counter. The line was already drawn; this decision sharpens it and records that it held.

## The gate rule

> **Does the mechanic have a state the user can be punished for not maintaining?**
> **Yes → it is gamification economy → refuse.**
> **No → it is delight → safe to borrow.**

Delight decorates an event that already happened (no memory, no debt). Economy maintains a ledger the user can fall behind on, and runs on loss-aversion — a missed day must *cost* something for the mechanic to work, and that manufactured cost is exactly the shame MFP refugees cite (the 2026-04-27 category sentiment work documents the move toward adherence-neutral, non-punitive coaching).

This gate is now the mechanical filter the `premium-auditor` and `design-system-enforcer` apply to any future Noom/competitor delight borrow — the same way `defended-choices.md` gates surface changes.

## Decision

1. **ADOPT — shame-free achievements + premium delight.** The app should feel cool, premium, and have wow moments. In scope:
   - **Motion + haptics + interactivity** as a first-class layer (a shared premium-motion/haptics primitive, reduce-motion safe).
   - **Celebration moments:** milestone confetti and equivalent flourishes — *not* limited to one trigger; fire on genuine accomplishments (first verified import, first plan, first week, target hit, weight milestone, north-star accept).
   - **Achievements / milestones / progress with running state** — *allowed*, because they only ever reward. An achievement that unlocks and stays unlocked, a "you've logged N days" stat, a progress bar toward a goal: these have memory but no punishment, so they pass the gate.
   - Plus the already-scoped Noom delight: scoped editorial serif, progressive onboarding reveal, dotted-baseline empty states, per-meal completion feel, one hand-drawn human touch.
2. **REFUSE — the punishment/loss-aversion economy.** Still a hard no: streaks-**with-decay**, "best week" high-water marks that read as decline, points/Seeds-as-pressure currency, gift-card rewards (extrinsic-reward loop), leaderboards (social-comparison shame), and any copy that punishes a miss ("don't lose your streak", "you broke it", "streak lost"). The test is unchanged: *does the mechanic punish a missed day?* If yes, refuse.
3. **RE-AFFIRM the existing streak pip (DC8)** as already-correct: additive, no decay, no break-penalty, ≥2 gate. Achievements built under this decision must hold the same posture — celebrate progress, never shame its absence.

**The calm-voice clause (DC12) evolves, it is not dropped.** "Calm" means non-manipulative and shame-free — it does **not** mean flat or joyless. Suppr should be delightful and premium *and* refuse dark patterns. Both are true at once; that's the "better way."

**Confidence:** 7/10. The gate is principled and the anti-shame wedge is intact (we only added reward-only mechanics, not punishment). Docked because: (a) N=1 on TestFlight — we have no retention telemetry to confirm achievements lift activation rather than feel patronising; (b) "reward-only" has a real execution failure mode (achievement spam = Cal-AI shouting in a calmer costume), so restraint and trigger-curation at design time are load-bearing; (c) the line between "additive progress" and "implicit pressure" is judgement-sensitive per mechanic — each one gets run through the gate individually.

## What would change this

- **Toward more:** post-launch retention showing the calm cohort churns at MFP-comparable rates *and* exit interviews citing "not motivating enough" (not "too much pressure") — that would mean the anti-gamification bet is wrong, not just under-built.
- **Toward less:** milestone confetti reading as patronising / Noom-cosplay in sim, or TF feedback flagging "trying too hard." Delight the user clocks as manipulation is worse than no delight.

## Failure modes considered

1. Confetti sprawl (fires on everything → Cal-AI shouting in a calmer costume) → mitigated by single north-star trigger.
2. Treatment drift on the pip (someone later adds a decay or "you broke it" state) → explicitly forbidden here and in DC8.
3. Borrowing serif into chrome again (the thing #311 correctly removed) → serif is scoped to editorial display headings only; never wordmark/sidebar/Today.
