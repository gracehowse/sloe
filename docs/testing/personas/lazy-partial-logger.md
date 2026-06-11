# Persona — Lazy partial logger

**Seed name:** `lazy-partial-logger`
**Grounded in:** `docs/ux/research/2026-06-10-adaptive-tdee-review.md` — this
persona's seeded history is modelled directly on the **real 28-day series** that
dragged Grace's adaptive TDEE down to 1,314.

## Identity + backstory

Means well, logs breakfast, then life happens. Some days they capture one snack
and nothing else; some days nothing at all. They weigh themselves now and then,
not on a schedule. They are the *median* tracker — not the disciplined power user
and not a total lapse — and they are the hardest case for any "learn your real
metabolism" feature, because the data they give it is full of holes.

## Data shape (what `--seed` lays down)

Modelled on the forensic series (§2 of the review):

- **28 days**, of which **7 are partial** (a single ~380–700 kcal entry) and
  **3 are empty** (genuine gaps). The other 18 are full days. The exact
  partial/empty cadence mirrors the documented pattern.
- **6 weigh-ins** — sparse, exactly like the real series.
- Weight **trends UP +0.6 kg** across the window while logged intake averages
  well under maintenance — the physiologically-inconsistent signature of
  under-logging (you don't gain weight eating 1,369 kcal).
- **2 library recipes.**
- Profile: `goal: lose`, `activity: light`, target **1,450 kcal**, female 31,
  157 cm, 54.4 → 52 kg goal. Onboarding complete.

This is the persona the **adaptive-TDEE completeness gate (R1)** exists for. With
the gate live, the 7 partial days should be excluded and the estimate should land
in the ~1,500–1,630 range, not collapse to ~1,314. This persona keeps that
surface honest as the algorithm evolves.

## Behavioural traits

- **Taps fast, reads almost nothing.** Skims past explanatory copy and confidence
  badges. If the app needs them to read three sentences to trust a number, they
  won't.
- **Inconsistent.** Won't backfill missed days. Treats the diary as "whatever I
  remembered to add."
- **Notices the headline number, not the methodology.** Will see "your
  maintenance: 1,314" and react to *the number*, not to the medium-confidence
  badge next to it.
- **Low friction tolerance (~8s).** Any speed bump and the day goes unlogged.

## Session goals (human intentions)

1. "Quickly log the one thing I actually ate so far today."
2. "Glance at whether I'm under or over for the day — without doing setup."
3. "Check what the app thinks my maintenance calories are, and whether it looks
   right." *(This is the load-bearing goal — it should surface whether the number
   is trustworthy despite the gaps.)*
4. "See if the app nags me about the days I didn't log — and whether that feels
   supportive or shaming."
5. "Understand, in one screen, why my target is what it is." *(Tests the
   "why this number" explanation for a sparse-data user.)*
6. "Decide whether I trust this app's numbers enough to keep using it casually."

## Trust-sensitivities

- **The maintenance number must survive their own sloppiness.** If partial days
  visibly drag the estimate below their plausible maintenance with no
  explanation, this persona concludes "the app doesn't know me" — the precise
  trust break the review documented. The R1 gate is what protects this.
- **No silent wrong numbers.** A confident-looking estimate built on 7 partial
  days is the worst case; an honest hedge ("we need a few more full days") is
  fine.
- **No shame for gaps.** Diet-culture nagging over missed days will lose them.
  Body-neutral, supportive framing is non-negotiable for this cohort.
- **The "why this number" explanation must be legible to a non-reader** — a wall
  of text fails them even if it's correct.
