# Persona — MFP-refugee power logger

**Seed name:** `mfp-refugee-power-logger`
**Grounded in:** `docs/growth/tiktok-instagram-viral-plan.md` (MFP mass-exodus
2026-05-03, the highest-value capture cohort).

## Identity + backstory

Four years on MyFitnessPal, logged almost every meal, knows their macros by
heart. They left the week MFP paywalled barcode scanning and stripped the free
feature set, found Suppr through an r/loseit "what I switched to" thread, and
imported their diet history mentally rather than literally. They are not a
beginner — they will judge Suppr against a tool they used 1,400 times.

## Data shape (what `--seed` lays down)

- **21 days** of *complete* diaries — breakfast/lunch/dinner/snack every day, no
  gaps. This cohort logs everything.
- **9 weigh-ins** across the window, trending **down ~0.14 kg/week** — a clean,
  believable deficit.
- **4 library recipes** (a couple imported, a couple they cook weekly).
- Profile: `goal: lose`, `activity: moderate`, target **1,850 kcal**, female 34,
  168 cm, 72 → 65 kg goal. Onboarding complete.

This shape exercises the *populated, trustworthy* path: adaptive TDEE should be
eligible and confident, the diary should be dense, the weekly recap should have
real data.

## Behavioural traits

- **Reads the numbers, not the copy.** Skims headers; zooms in on macro grams,
  the calorie ring, and the maintenance estimate. Decorative copy is noise.
- **Fast, keyboard-fluent.** Expects search → result → log in under three taps.
  A slow or two-step quick-log is a regression *against MFP*, and they'll say so.
- **Compares constantly.** Every friction is "MFP did this better / worse."
- **High trust bar on accuracy.** A macro that looks wrong, or a maintenance
  number below their own sedentary floor, breaks trust instantly.
- **Tolerant of friction up to ~15s** if the payoff is obviously better data —
  but unforgiving of friction that buys nothing.

## Session goals (human intentions)

1. "Log everything I ate today as fast as I did in MFP — and see if it's faster
   or slower."
2. "Check whether the calorie + macro numbers actually add up across my day."
3. "Find out if this app's maintenance/TDEE estimate is one I'd trust enough to
   set my deficit from."
4. "See my last two weeks at a glance — am I actually on track to lose?"
5. "Re-log a meal I eat all the time without re-entering every ingredient."
6. "Decide, by the end of the session, whether I'd delete MyFitnessPal for good."

## Trust-sensitivities

- **Macro arithmetic must close.** If the day's macros don't sum to the day's
  calories (4/4/9), they notice and distrust the whole pipeline.
- **The maintenance number must be defensible.** Below their sedentary formula
  floor with no explanation reads as a bug (this is the exact failure the
  adaptive-TDEE review caught).
- **"Estimated" framing is expected, not alarming** — but a *confident-looking*
  wrong number is worse than an honestly-hedged one.
- **Quick-log speed is a trust proxy.** Slow logging signals "this app wasn't
  built by someone who logs," and they'll churn.
