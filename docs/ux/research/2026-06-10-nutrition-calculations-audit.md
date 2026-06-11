# Nutrition calculations audit — every formula vs what everyone else does

**Date:** 2026-06-10
**Trigger:** Grace: "for ALL nutrition/calculation decisions we should NOT be reinventing the wheel — what does everyone else do."
**Method:** Six independent validation passes (BMR/TDEE seeding, deficit/pace/goals, activity bonus, macro targets, weight trend, micros/daily values, projections & insights) checked every formula in the nutrition codebase against named industry practice — MyFitnessPal, MacroFactor, Cronometer, Lose It, Hacker's Diet/TrendWeight, NHS, FDA, ISSN — with sources. Where two validators disagreed, this report sides with the stricter reading and says so.
**Status:** Audit only. **Nothing in the code was changed.**

**Verdict key:**
- **STANDARD** — matches a named industry/clinical standard, often digit-for-digit.
- **ACCEPTABLE-VARIANT** — defensible choice inside accepted practice, but ours rather than a named standard; usually needs documentation, not a code change.
- **NONSTANDARD** — invented here with no precedent, or contradicts how the rest of the industry does it.
- **WRONG** — internally inconsistent or mathematically biased; produces incorrect output.

**Headline:** Of ~75 distinct formulas audited, **1 is WRONG at P0**, **1 WRONG at P1**, **2 NONSTANDARD at P1**, and **3 acceptable-variants carry P1 product risk**. Everything else is either the exact industry standard (the large majority — Mifflin–St Jeor, the activity multipliers, the 7700 kcal/kg convention, the FDA daily values, the MFP activity-bonus model are all digit-for-digit matches) or a defensible variant needing only a comment or a UI note. We are not reinventing the wheel in the core math; the real problems cluster in **how the weight trend is smoothed** and **a 2× display/math mismatch for people gaining weight**.

---

## 1. Executive table

Formulas validated by multiple passes are consolidated into one row. WRONG and NONSTANDARD first, sorted by severity.

### Problems first

| # | Formula (plain English) | Where | Verdict | Severity |
|---|---|---|---|---|
| 1 | **Weight-change rate for adaptive calorie burn** — the smoothing average is restarted at the start of each 28-day window, so the two endpoints lag differently and the measured weight change shrinks 35–85% toward zero. Result: the "learned" calorie burn is pulled toward average intake by up to ~400 kcal/day for someone losing 0.5 kg/week — and this number feeds real calorie budgets. | `adaptiveTdee.ts` | **WRONG** | **P0** |
| 2 | **Gain-goal math vs display disagree by 2×** — the budget halves the surplus for lean gaining (+275 kcal at "steady"), but the "why this number" explainer and the goal-date projection use the full pace (+550, 0.5 kg/wk). Every gaining user sees a Goal row that contradicts the Result row, and goal dates ~2× optimistic. | `tdee.ts` vs `whyThisNumber.ts` | **WRONG** | **P1** |
| 3 | **Weight smoothing applied per weigh-in, not per day** — the 10% smoothing constant is the Hacker's Diet/TrendWeight standard, but the standard applies it on a gap-filled daily series (MacroFactor interpolates missing days). Ours applies it per entry, so a weekly weigher gets ~7× less smoothing than a daily weigher. The docstring also claims gap-filling that doesn't exist. | `adaptiveTdee.ts emaSmooth` | **NONSTANDARD** | **P1** |
| 4 | **"On track" tile judges raw scale readings** — the weekly trend tile compares two raw weigh-ins ~7 days apart. Every trend app (MacroFactor, TrendWeight, Hacker's Diet) judges the smoothed trend, because raw daily weight swings 1–2 kg on water alone. One water blip flips the copy to "off track". | `weightTrendTile.ts` | **NONSTANDARD** | **P1** |
| 5 | **Safety floor warns but doesn't gate** — our floors (1200 women / 1500 men) are the standard values, but MFP and Lose It hard-refuse to set a target below them; Cronometer requires an explicit acknowledgment tap; MacroFactor an explicit opt-out. We show a banner the user can scroll past, and a vigorous pace on a small-stats user can produce a ~400 kcal budget with only an advisory string. (One validator rated this fine; two rated it P1 — stricter reading adopted.) | `budgetSafety` / onboarding pace step | ACCEPTABLE-VARIANT | **P1** |
| 6 | **Fasting "autophagy" copy** — staging matches consumer fasting apps (Zero) and is more conservative than most, with properly hedged verbs. But human autophagy timing is not established (evidence is mostly animal) — highest claims-risk line in the app. | `fastingStageNarrative` | ACCEPTABLE-VARIANT | **P1** |
| 7 | **5-week weight projection uses the linear 7700 kcal/kg rule** — same as MFP/Lose It, and our mitigations (5-week cap, scale-trend override, water/glycogen caveat) are best-practice. Risk is only if this linear path is ever extended to longer horizons. | `projectWeight` | ACCEPTABLE-VARIANT | **P1** |
| 8 | "No weight change" band ±0.05 kg — far below physiological noise (water alone is 1–2 kg/day), so no real week ever reads "the same"; comment says "5g" but 0.05 kg is 50 g | `weeklyCheckin.ts` | **NONSTANDARD** | P2 |
| 9 | Nutrient panel sorts %DV descending while the comment says "deficiencies bubble to top" — the sort buries deficiencies at the bottom; self-contradiction | `fullNutrientPanel.ts` | **NONSTANDARD** | P2 |
| 10 | "Closest to target" day score — invented composite (no app publishes one); statistically sane; one wild macro can dominate | `weeklyRecap.ts` | **NONSTANDARD** | P2 |
| 11 | Hydration day "counts" at ≥90% of goal — invented threshold; apps count goal-met (100%) days | `weeklyRecap.ts` | **NONSTANDARD** | P2 |

### Acceptable variants — ours, defensible, mostly need documentation (P2)

| # | Formula | Verdict | Severity |
|---|---|---|---|
| 12 | Unspecified-sex BMR = midpoint of male/female (−78). No published standard exists; most apps force a binary pick; midpoint is the most defensible inclusive choice but carries ±~80 kcal extra uncertainty | ACCEPTABLE-VARIANT | P2 |
| 13 | Bulk surplus = half the deficit (+137…+550). Sound lean-bulk asymmetry (gain is slower than loss; +250–500 is the norm) but the 0.5 factor has no named precedent and is the root of finding #2's label mismatch | ACCEPTABLE-VARIANT | P2 |
| 14 | Caution band (1800 men / 1400 women) above the hard floors — Suppr-added buffer, conservative, no single named source | ACCEPTABLE-VARIANT | P2 |
| 15 | High-protein 45%-of-calories cap exceeds the 35% AMDR ceiling — only binds in deep cuts where high protein-% is exactly what ISSN recommends; intentional, needs a comment | ACCEPTABLE-VARIANT | P2 |
| 16 | Protein citations in comments are off: "ISSN minimum 1.6" (ISSN is 1.4–2.0; 1.6 is Morton 2018's breakpoint), 2.2 g/kg attributed to ISSN (it's Morton's upper CI), Leidy 2015 cited for 1.8 (Leidy supports 1.2–1.6). Values fine; comments mislead | ACCEPTABLE-VARIANT | P2 |
| 17 | Protein % cap can undercut the g/kg target for heavy users in deep cuts (100 kg @ 1500 kcal balanced → 1.31 g/kg vs 1.6 intended); bounded because the lose path uses the 40%-cap strategy | ACCEPTABLE-VARIANT | P2 |
| 18 | Fiber divisors hand-tuned (/55, /70, /45, /80) instead of derived from the IOM 14 g/1000 kcal anchor (= /71). Only high-protein matches the standard; balanced runs ~30% above it; low-carb dips below it | ACCEPTABLE-VARIANT | P2 |
| 19 | Activity-level labels include exercise while the Watch bonus also credits exercise — netted out by subtracting full maintenance (no double-count) but it's the opposite convention to MFP and confuses honest multiplier picks | ACCEPTABLE-VARIANT | P2 |
| 20 | Workout-only fallback credits 100% of logged workout calories — MFP's default, but coaching norms discount to 50–75% because trackers overestimate ~30–50%; bounded path | ACCEPTABLE-VARIANT | P2 |
| 21 | Flat 7700 kcal/kg applied to total weight change in adaptive TDEE — standard simplification; MacroFactor partitions fat vs lean tissue energy; optional refinement | ACCEPTABLE-VARIANT | P2 |
| 22 | Adaptive confidence gates (21d/7 weigh-ins = high; 14/5 = medium; 7/3 floor) and 14-day staleness — no published thresholds exist; tracks MacroFactor's 2–3-week maturation; document as product-defined | ACCEPTABLE-VARIANT | P2 |
| 23 | TDEE "flat" arrow band ±20 kcal — too tight vs realistic week-over-week estimate noise (50–100+); users see spurious arrows | ACCEPTABLE-VARIANT | P2 |
| 24 | Weekly check-in suggested-target floor 1200 kcal applied unisex — a man can be suggested 1200, which our own `budgetSafety` (1500 male floor) labels "warning"; internal inconsistency | ACCEPTABLE-VARIANT | P2 |
| 25 | US FDA daily values only, no EU/UK NRV set — calcium 1300 vs 800, iron 18 vs 14, vit D 20 vs 5 µg; Suppr is UK/EU-market-first; Cronometer/MFP offer region pickers | ACCEPTABLE-VARIANT | P2 |
| 26 | "Limit" nutrients = sodium, sat fat, cholesterol — FDA's flagship limit nutrient is **added sugars** (DV 50 g), which we don't track at all; cholesterol-as-limit is fine to keep | ACCEPTABLE-VARIANT | P2 |
| 27 | FatSecret %DV→absolute conversions (calcium ×1300, iron ×18, vit A/C/D) — correct **only** for the legacy v1 API we call; v2 returns absolutes, so a future migration silently inflates micros ~13× with no guard; vit A/C/D references never spot-checked live | ACCEPTABLE-VARIANT | P2 |
| 28 | Display rounding comment claims it "mirrors FDA packaging label rounding" — it doesn't (FDA uses per-nutrient increments); the simpler rule is fine, the comment overstates | ACCEPTABLE-VARIANT | P2 |
| 29 | Default fat target 65 g is the pre-2016 FDA DV; our own daily-values map correctly uses the current 78 g — mixed vintages in defaults | ACCEPTABLE-VARIANT | P2 |
| 30 | Projection unlock floor of 5 logged days — on the low side vs the ~10–20 days water noise takes to clear; mitigated by trend override + "could" framing | ACCEPTABLE-VARIANT | P2 |
| 31 | Goal-date ETA shown as a precise day count from a constant recent rate — drifts near plateau; present as a range / "at your recent pace" | ACCEPTABLE-VARIANT | P2 |
| 32 | Two different meal-slot share tables in one codebase (25/30/30/15 vs 25/35/35/10) — both inside guidance bands, but they should be one constant or a documented difference | ACCEPTABLE-VARIANT | P2 |
| 33 | Comment-only citation fixes: 7700 credited to "Hall & Chow 2011" (it's Wishnofsky 1958; Hall *critiques* it); "Helms 2020" should be Helms 2014; floors credited to "NHS" are US-convention (NHS publishes 1400/1900); multipliers called "Mifflin-St Jeor" are the McArdle set; adaptive header comment has a sign error (says +, code correctly subtracts); `targets.ts` header still describes a superseded goal→strategy mapping | ACCEPTABLE-VARIANT | P2 (comments only) |

### Validated as standard (no action)

| Formula | Matches |
|---|---|
| Mifflin–St Jeor BMR, male +5 / female −161, coefficients 10 / 6.25 / −5 | Original 1990 paper digit-for-digit; the Academy of Nutrition and Dietetics' recommended equation; what Cronometer/MFP/MacroFactor use |
| Activity multipliers 1.2 / 1.375 / 1.55 / 1.725 / 1.9 and tier labels | The canonical set, digit-for-digit (Cronometer documents the identical table) |
| TDEE = BMR × multiplier; maintenance = TDEE untouched | Universal |
| Pace ladder 0.25/0.5/0.75/1.0 kg/wk; deficits 275/550/825/1100; pace↔kcal inverse math | Exact 7700 kcal/kg arithmetic; NHS-safe band; same rungs as MFP/Lose It (½–2 lb/wk) |
| 7700 kcal/kg planning constant | Universal consumer convention (= 3500 kcal/lb); known imperfect (Hall), correctly mitigated by adaptive TDEE |
| Fast-loss warning at >1% bodyweight/week | The evidence-based threshold (Helms 2014) |
| Safety floor *values* 1200 women / 1500 men | NIH/NHLBI; identical to MFP and Lose It |
| Protein g/kg-first then %-capped; 1.6 / 1.8 / 2.2 g/kg by strategy | Inside ISSN 2017 / Morton 2018 ranges; MacroFactor-style protein-first design |
| Fat 25% / 30% (within AMDR 20–35%); low-carb 45% deliberately outside it | AMDR; Volek/Phinney precedent for low-carb |
| Carbs as the remainder; Atwater 4/4/9 (+7 alcohol) | How MacroFactor/MFP reconcile macros; standard label factors |
| Adaptive TDEE structure: burn = intake − weight-change energy, 800 floor, formula seed → adaptive takeover gated on confidence + freshness | Exactly the MacroFactor-class architecture (the *structure* is right; finding #1 is the slope inside it) |
| EMA smoothing constant α = 0.1 | The Hacker's Diet / TrendWeight standard (the *constant* is right; finding #3 is where it's applied) |
| Activity bonus: projected end-of-day = burn so far + remaining resting burn, credit only above full maintenance, floor at 0; closed-day = actual burn − maintenance | MFP's documented calorie-adjustment model, structurally identical; Lose It same shape; max(0) mirrors MFP's negative-adjustment default |
| All 33 FDA daily values; %DV = amount/DV rounded; sodium 2300 mg basis; salt ×2.54; no %DV for total sugars; per-100g scaling | FDA 2016 final rule verified value-by-value; correct handling throughout |
| Largest-remainder rounding for macro %; remaining = max(0, target−consumed) with separate over flag; macro scaling on activity bonus | Standard apportionment method; MFP/Cronometer display conventions |
| Tukey 3×IQR outlier fences on weigh-ins; journey baseline anchoring; progress %, chart domain | Textbook robust statistics; coherent product definitions |
| Weekly recap honesty thresholds (0.3 kg announce floor, ±25 kcal "within range", 14-day pattern gate, logged-days-only averaging) | Suppresses water noise correctly; adherence-neutral like MacroFactor |
| Meal-slot ratios (within CACFP/IOM bands); calorie banking over unlogged slots; recipe-ranking weights | Inside guidance bands / proprietary ranker with sane asymmetry |
| maintenanceChain weekly-loss line with explicit water/glycogen caveat | Best-in-class — exceeds most consumer apps, which show the number unqualified |
| Unit conversions (2.20462, 2.54, 14 lb/stone, 12 in/ft); input clamps; 0.1 kg display precision; protein-mass plausibility guard ≤0.95 | Exact constants; sane guards |

---

## 2. The problems in detail

### #1 (P0) — Adaptive calorie burn is systematically biased toward "eat what you ate"

**What we do:** To learn someone's true daily burn, we average their logged intake and subtract the energy value of their weight change over 28 days. The weight change comes from a smoothed series — but the smoothing average is **restarted at the first weigh-in of each window**. That gives the first data point zero lag and the last point ~9 samples of lag, so the measured change captures only ~15% of the real change at 3 weigh-ins, ~23% at 5, ~30% at 7, ~65% even with 28 daily entries.

**What everyone else does:** Hacker's Diet ([fourmilab.ch](https://www.fourmilab.ch/hackdiet/e4/signalnoise.html)) keeps a *continuously maintained* trend so both endpoints carry the same lag and it cancels. MacroFactor ([expenditure algorithm](https://macrofactor.com/expenditure-v3/)) fills missing days by interpolation and regresses over the smoothed series. Nobody re-seeds the average inside the measurement window.

**Why it matters:** For someone genuinely losing 0.5 kg/week, the learned burn can read ~400 kcal/day too low — pulled toward their average intake. At medium/high confidence this number **replaces the formula and sets real calorie budgets**, so the app under-credits real progress.

**Fix:** Interpolate weigh-ins to a daily series, then take a least-squares slope over the smoothed dailies (or seed the smoother with pre-window history so the lags cancel). Pin with a test: a synthetic 0.5 kg/week series must recover ~550 kcal/day of deficit, not ~130.

### #2 (P1) — Gaining users see numbers that contradict each other by 2×

**What we do:** The budget halves the surplus for gaining (steady pace → +275 kcal/day ≈ 0.25 kg/wk — a sound lean-bulk choice). But the "why this number" explainer and the weeks-to-goal projection use the **full** preset (+550, 0.5 kg/wk). The Goal row and the Result row disagree by exactly 2×, and projected goal dates are ~2× optimistic.

**What everyone else does:** MacroFactor's coached gain rates are deliberately slower than loss rates — but display and math agree. ([MacroFactor goal adjustments](https://help.macrofactorapp.com/en/articles/222))

**Fix:** Pick one truth — either apply the 0.5 factor in the explainer + weeks-to-goal, or drop it from the budget — then add a parity test asserting display == implementation. While there, label the surplus honestly (the "vigorous" gain rung currently delivers "steady"-sized surplus).

### #3 (P1) — Weight smoothing ignores gaps between weigh-ins

**What we do:** Apply the 10% smoothing step once per weigh-in, however far apart they are. A weekly weigher effectively gets ~7× less smoothing per unit time than a daily weigher. The docstring claims gap-filling that the code doesn't do.

**What everyone else does:** Hacker's Diet assumes daily entries; MacroFactor explicitly "fills in the gaps it sees using linear interpolation" before trending ([MacroFactor weight trend](https://help.macrofactorapp.com/en/articles/21-weight-trend)).

**Fix:** Interpolate to daily before smoothing; delete the false docstring. (Same code change underpins #1.)

### #4 (P1) — "On track" copy flips on water weight

**What we do:** The weekly trend tile compares two **raw** weigh-ins ~7 days apart and writes "on track" / "off track" from the sign.

**What everyone else does:** MacroFactor explicitly teaches users that raw weight is dominated by water/glycogen noise (1–2 kg daily swings) and judges the smoothed trend ([MacroFactor on bloating/water](https://help.macrofactorapp.com/en/articles/209)); TrendWeight and Hacker's Diet exist precisely to avoid this.

**Fix:** Compute the weekly delta on the smoothed trend series (reuse the fixed smoother from #1/#3). Keep the ±0.5 kg maintenance band.

### #5 (P1) — Safety floors are correct values, weakly enforced

**What we do:** Below 1200 (women) / 1500 (men) kcal we show a warning banner, but the user can advance without acknowledging it; nothing clamps the budget. A vigorous pace on a small-stats user can produce a ~400 kcal target with only an advisory string attached.

**What everyone else does:** MFP and Lose It **refuse** to assign a goal below 1200/1500 ([MFP help](https://support.myfitnesspal.com/hc/en-us/articles/360032625391); [Lose It](https://apps.apple.com/us/app/lose-it-calorie-counter/id297368629)). Cronometer requires a checkbox acknowledgment to proceed below range ([Cronometer](https://support.cronometer.com/hc/en-us/articles/32978027080980)). MacroFactor ships a 1200 floor users must explicitly opt out of ([MacroFactor](https://help.macrofactorapp.com/en/articles/34)).

**Fix:** Keep soft-warn (it has precedent at the higher-trust end of the market) but require an explicit acknowledgment tap before advancing below the hard floor — Cronometer's pattern. Closes the gap with the two biggest MFP-refugee competitors without paternalistic hard-blocking. Also make the weekly check-in's suggested-target floor sex-aware (it's currently 1200 unisex, which our own safety classifier flags for men — table #24).

### #6 (P1) — The autophagy line is the riskiest sentence in the app

**What we do:** Fasting stage copy at 24–36h says "Autophagy may engage". Our staging is actually *more* conservative than Zero's, and every verb is hedged — good posture.

**The issue:** Human autophagy timing is not established; the evidence is mostly rodent ([Cleveland Clinic](https://my.clevelandclinic.org/health/articles/24058-autophagy)). Even hedged, it implies a personal physiological claim no one can verify.

**Fix:** Reword to population framing ("In studies — mostly animal — autophagy may increase around this point") and add a one-tap "how we know this" note for the fasting copy.

### #7 (P1) — The 5-week projection is fine; just never stretch it

**What we do:** Linear 7700 kcal/kg projection, capped at 5 weeks, overridden by the observed scale trend when reliable, with a water/glycogen caveat. That's the universal consumer pattern **plus** the right mitigations.

**The risk:** The linear rule overestimates loss over long horizons (Hall et al., [Int J Obes 2013](https://www.nature.com/articles/ijo2013112)). If any future surface shows a longer ETA off this path, it drifts badly.

**Fix:** No change now. Add a guard comment that the linear path must never feed a >5-week display; longer horizons need the observed trend or a decaying model.

### P2 details worth a sentence each

- **#8** Widen "no weight change" to ±0.2–0.3 kg on the trend, fix the "5g"→"50 g" comment.
- **#9** Sort target nutrients ascending (deficiencies first), limit nutrients descending — and make the comment match.
- **#10/#11** Keep the recap metrics, cap per-macro error at 100%, and either count hydration at 100% or say "within 90%" in the copy.
- **#18** Re-anchor balanced fiber to the IOM 14 g/1000 kcal rule (divisor ≈71); keep the elevated number only for high-satisfaction, where it's the point.
- **#19** Either relabel activity tiers to exclude logged workouts (MFP's convention) or nudge Watch users to "sedentary" seeding (Cronometer's convention) — pick one and document it.
- **#25** Region-aware nutrient reference set (EU/UK NRV vs US DV) using the same region signal that drives currency/VAT — we're UK-first showing US numbers.
- **#26** Add added-sugars tracking to unlock its 50 g DV and limit-warning — it's the flagship FDA limit nutrient and we don't track it.
- **#27** Guard the FatSecret micros path against the v1→v2 API trap (values would silently inflate ~13×) and live spot-check vitamins A/C/D as was done for calcium/iron.
- **#29** Bump default fat 65 g → 78 g (current FDA DV) or document why not.
- **#32** Unify the two meal-slot share tables into one constant.
- **#33** One comment-hygiene sweep for all the citation mislabels (values all stay).

---

## 3. Validated as standard — on the record

The core of the product is **not** reinventing the wheel:

- **BMR/TDEE:** Mifflin–St Jeor digit-for-digit; the canonical activity multipliers digit-for-digit. This is exactly Cronometer's documented setup and the dietetics-association recommendation.
- **Targets:** deficit ladder is exact 7700-rule arithmetic on the same rungs as MFP/Lose It, inside the NHS-safe band; protein/fat/carb derivation follows the MacroFactor pattern (protein from body weight first, carbs as remainder) with every value inside ISSN/AMDR ranges; the >1%-bodyweight/week warning is the textbook threshold.
- **Adaptive burn:** the *architecture* (formula as cold-start, learned burn takes over when confident and fresh, 800 floor) is exactly MacroFactor's design; α=0.1 smoothing is the Hacker's Diet constant. The defects are in two implementation details (#1, #3), not the design.
- **Activity bonus:** structurally identical to MyFitnessPal's documented calorie-adjustment model, including projecting only resting burn forward and suppressing negative adjustments.
- **Micros:** all 33 FDA daily values verified exact; %DV math exact; sodium/salt handling exact; total-sugars correctly given no %DV.
- **Honesty layer:** the recap noise floors, the water/glycogen caveat on weekly-loss projections, and adherence-neutral logged-days-only averaging match or exceed best-in-class practice (most apps show these numbers unqualified).

Defended choices to keep (deliberately non-standard, with named precedent): low-carb fat at 45% (Volek/Phinney), high-protein 45% calorie cap (ISSN deep-cut logic), unspecified-sex midpoint BMR (no standard exists; most inclusive defensible option), surplus-smaller-than-deficit bulking (lean-bulk norm).

---

## 4. Cross-reference — adaptive TDEE has its own deep-dives

The adaptive-TDEE findings here (#1, #3, plus the flat-7700 refinement and confidence gates) are covered forensically in:

- `docs/ux/research/2026-06-10-adaptive-tdee-review.md` — line-by-line forensic of the expenditure engine (the canonical home for the P0).
- `docs/ux/research/2026-06-10-tdee-methodology-survey.md` — industry methodology survey (**in flight** at time of writing).

This audit covers **everything else** in the nutrition calculation surface (seeding, pace/goals, activity bonus, macro targets, micros/DVs, weight-trend display, projections, recap/check-in math) and includes the adaptive findings only so the executive table is complete. Where this doc and the forensic disagree, the forensic wins on adaptive-TDEE specifics.

---

## 5. Prioritised fix list — FOR GRACE'S CALL — nothing changed

No code was modified in this audit. Ordered by user harm; items marked *(comment)* are documentation-only.

**P0**
1. **Fix the adaptive-TDEE slope bias** (#1): interpolate weigh-ins to daily, least-squares slope on the smoothed series; pin with the 0.5 kg/wk ≈ 550 kcal/day synthetic test. (Subsumes the #3 gap-filling fix.)

**P1**
2. **Resolve the 2× gain mismatch** (#2): one truth for surplus across budget, explainer, and weeks-to-goal + parity test.
3. **Smooth the "on track" tile** (#4): judge the trend series, not raw weigh-ins (lands free once 1. ships).
4. **Acknowledge-to-proceed below the safety floor** (#5): Cronometer-style explicit tap; make the check-in floor sex-aware (#24) in the same change.
5. **Reword the autophagy line** (#6): population framing + "how we know this" disclosure.
6. **Guard the projection horizon** (#7): comment/assert that the linear path never feeds >5-week displays. *(comment)*

**P2 — high-value, small**
7. Re-anchor balanced fiber to 14 g/1000 kcal (#18).
8. FatSecret v1/v2 version guard + vit A/C/D spot-check (#27).
9. Region-aware nutrient references for UK/EU (#25) — fits the existing region-aware pricing workstream.
10. Track added sugars → unlock its DV + limit warning (#26).
11. Fix nutrient-panel sort direction (#9); widen the "no change" band + 50 g comment (#8); widen the TDEE flat band to ~50 kcal after the P0 lands (#23).
12. Default fat 65→78 g (#29); unify meal-slot tables (#32); cap recap macro error + hydration copy (#10/#11); grams-floor option on the protein cap (#17).
13. One comment-hygiene sweep: all citation mislabels, sign-error header, stale `targets.ts` mapping, activity-label convention decision (#16, #19, #28, #33). *(mostly comments)*

Per the no-silent-deferrals rule: each item Grace green-lights should get a Linear issue on pickup; none of these are tracked yet as of this audit.
