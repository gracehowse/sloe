# Persona session — lazy-partial-logger — 2026-06-11

- **Surface(s):** mobile (Path A — iOS sim)
- **Account:** gracehowse+lazylogger@outlook.com
- **Seeded:** yes — `scripts/seed-persona.mts --persona lazy-partial-logger --reset` (28-day series w/ 7 partial + 3 empty days, 6 weigh-ins trending up, goal=lose / target 1,450). Modelled on the real series in `docs/ux/research/2026-06-10-adaptive-tdee-review.md`.
- **Auth path:** A

## Goals attempted

1. **"Quickly log the one thing I ate."** — **PASS (by parity, not re-tested).** Log flow is the shared FAB→recent 2-tap path validated in the mfp-refugee session; not independently exercised this run.
2. **"Glance under/over for the day."** — **PASS.** Today opened "Under budget / On track" (1,440 / 1,450), instantly legible.
3. **"What does the app think my maintenance is — does it look right?"** *(load-bearing)* — **FAIL.** Maintenance = **1,270 kcal**, *below* the formula floor (1,460) the card itself discloses. Physiologically implausible for this persona; the documented collapse. → **ENG-1057 (P1)** + comment on **ENG-793**.
4. **"Does it nag me about days I didn't log — supportive or shaming?"** — **PASS (good).** "🏅 2 on-target days this week — your most consistent week this month" celebrates the hits; empty days just show no bar. Body-neutral, no shame. Exactly right for this cohort.
5. **"Understand in one screen why my target is what it is."** — **FAIL (format good, content wrong).** The "How this works" breakdown is clear and non-jargony (good for a non-reader), but it computes **"= Calorie goal 720 kcal"**, contradicting the real 1,450 target and showing a dangerous number. → ENG-1057.
6. **"Do I trust this enough to keep using casually?"** — **Lean NO.** The supportive framing and clean UI are genuinely good, but the load-bearing number (maintenance 1,270, below floor; goal 720 vs the real 1,450) is exactly the "this app doesn't know me" trust break the review predicted for the median under-logger.

**Task success:** 2/6 PASS (2, 4), 2 FAIL (3, 5 — same root), 1 PASS-by-parity (1), 1 verdict (6).

## Findings

### Finding 01 — adaptive maintenance collapses below the formula floor; explainer shows a contradictory, unsafe "Calorie goal" (720 vs the real 1,450)
- **Screen:** Progress → Maintenance card + "How this works"
- **Expected:** a maintenance number that survives my sloppy logging and an explanation whose number matches my actual target.
- **Happened:**
  - Maintenance **1,270 kcal**, disclosed as **"Formula estimate 1,460 (−190 actual)"** — adaptive sits 190 below the sedentary floor for an under-logger. Expected ~1,500–1,630 (R1 gate); got *below* the 1,314 the review documented.
  - **AVG INTAKE 1,122 · EST. TDEE 1,270 · DEFICIT −148** shown while **weight RATE +0.2 kg/wk (gaining)** — "deficit while gaining" is impossible, the tell of under-logging the estimate trusted.
  - Explainer: 1,270 − 550 deficit = **"Calorie goal 720 kcal"**, contradicting the Today target of **1,450** and showing a dangerous sub-floor number with no mention of the safety-floor clamp.
  - Projection card predicts **loss** ("54.7 kg in ~5 weeks") while the measured trend is **gain** — same collapsed-maintenance root.
- **Severity:** P1 (P0-adjacent — median user, safety appearance)
- **Trust-impact:** yes
- **Screenshots:** 02-sm.png, 03-sm.png, 05-sm.png, 06b-breakdown.png
- **Linear:** **ENG-1057** (new). Commented on **ENG-793** (the no-HealthKit instance of "dangerously low targets").

## What worked well
- **No-shame framing for gaps** (Goal 4): "2 on-target days · your most consistent week" + empty bars for missed days. Body-neutral, supportive — the non-negotiable for this cohort, handled correctly.
- **Transparency present:** the card *does* disclose "Formula estimate 1,460 (−190 actual)" and "an estimate, not a promise" — the honesty is there; the problem is the underlying number, not hidden methodology.
- **Explainer format** is a clean stepped breakdown (not a wall of text) — legible to a non-reader. It's the *content* (720) that's wrong.

## Linear
- **Filed new:** ENG-1057 (P1). **Commented:** ENG-793 (launch-blocker).

## Honest gaps
- **Apple Health empty on sim** (Steps/Active/Resting all "—"), so this run isolates the intake/completeness path — which is actually *useful*: it shows the low-maintenance spiral happens even without the HealthKit path ENG-793 names.
- **Goal 1 (logging) not independently re-tested** — relied on the shared log flow validated for mfp-refugee.
- **Web parity unchecked** (iOS-primary).
- Did not verify whether the R1 completeness gate is meant to be live yet on this build; flagging the *behaviour* (sub-floor maintenance) regardless.
</content>
