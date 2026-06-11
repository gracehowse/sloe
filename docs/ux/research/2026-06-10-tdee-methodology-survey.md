# TDEE methodology survey — what the best apps do + the wearable-accuracy evidence

**Date:** 2026-06-10 · **Status: FOR GRACE'S CALL — no code changed.**
Companion to `docs/ux/research/2026-06-10-adaptive-tdee-review.md` (the forensic
root-cause of why Grace's adaptive TDEE read 1,314). That doc asked *what broke*.
This doc asks *how it should work* — surveying the best apps, weighing the
evidence, and being deliberately adversarial to **all three** live positions:

- **P-current** — the shipped estimator: pure energy-balance (avg intake − weight
  trend × 7,700), 28-day window, **no completeness gate**. This is what produced
  1,314.
- **P-watch** — Grace's proposal: formula seed → maintenance ≈ average of *actual
  Apple Watch total burn* (lazy-day ~1,600 = baseline; workout days arrive as
  per-day exercise bonus, which Suppr already does).
- **P-blend** — the prior session's sketch: formula seed → Watch baseline as the
  operating number → gated energy-balance as a slow drift corrector.

Grace asked explicitly *not* to be agreed with. The evidence below does not fully
vindicate any of the three. The recommendation in §6 is a fourth thing.

**One-paragraph answer.** The best-in-class apps (MacroFactor, Carbon, RP) have
independently converged on the *same* method — **adaptive energy balance from
intake + weight-trend, and they deliberately refuse wearable burn as an input** —
because the published accuracy of wearable energy expenditure is poor enough to
make it a worse signal than the weight trend it would replace. So the evidence
points *away* from P-watch as the *estimator of record*. **But** every one of
those apps does the one thing Suppr does not: they protect the energy-balance
math from bad logging (trend-weighting, confidence handling, carry-forward,
adherence framing). Suppr's bug was never "we should have used the Watch" — it was
"we fed energy balance 7 partial days with no gate." The right architecture keeps
**energy balance as the estimator**, **fixes the completeness/trend defects**
(forensic R1+R2), and demotes the Apple Watch to the role the literature actually
supports: **a per-day activity signal and a plausibility bound, not the
maintenance number.**

---

## 1. Per-app methodology — seed / estimator / wearable role / gating

| App | Seed (cold start) | Ongoing estimator | Wearable role | Logging-completeness handling | Source |
|---|---|---|---|---|---|
| **MacroFactor** | Custom BMR eq + custom activity multipliers; explicitly called "easily the least important bit" | **Adaptive energy balance**: solves expenditure from intake + weight-trend, weighted toward recent data over a long timescale; converges ~14–30 days | **Refused as input by design.** Used only to *notice* unusual days / lifestyle shifts | Carries forward last "high-confidence" expenditure across gaps; no requirement for perfect daily logging; tolerates multi-week gaps | [algorithms](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/) · [wearables](https://macrofactor.com/wearables/) |
| **Carbon (Layne Norton)** | Formula TDEE from age/sex/height/weight/activity/goal | **Adaptive**: trend-weight algorithm; recalculates targets at **weekly check-in**, gated on self-reported adherence; "learns your metabolic response over time" | Not used as an expenditure input | Adjustments **only applied if the user reports they were adherent** — adherence is an explicit gate | [how-it-works](https://www.joincarbon.com/how-it-works) · [trend weight](https://help.joincarbon.com/en/articles/6078877-coach-trend-weight) |
| **RP Diet Coach** | Formula TDEE from intake form | **Adaptive**: 2–3 weigh-ins/week → trend; adjusts calories to keep you on the goal trajectory; **weekly-average** focus not daily | Not an expenditure input | Weekly-average framing absorbs single bad days; coach-style weekly cadence | [diet coach app](https://rpstrength.com/pages/diet-coach-app) |
| **Cronometer** | BMR (formula or **custom**) + activity-level multiplier | **User's choice**: static activity level *or* device-synced burn. Components: BMR + activity + tracker activity + exercise + optional TEF | **First-class, opt-in.** Synced device burn *gradually replaces* the baseline activity → "Adjusted Baseline Activity," engineered to **avoid double-counting** | No adaptive energy-balance loop; expenditure is additive, not inferred from weight | [energy expenditure](https://support.cronometer.com/hc/en-us/articles/31974307318420-Energy-Expenditure) |
| **MyFitnessPal** | Mifflin + activity level (NEAT only) | **Static** maintenance − fixed deficit (e.g. 500 kcal/lb-wk); "net calories" model | **Exercise added back**: logged/synced exercise *raises that day's budget* | None — no expenditure learning; widely criticised for over-crediting exercise and never adapting | [how MFP calculates goals](https://support.myfitnesspal.com/hc/en-us/articles/360032625391-How-does-MyFitnessPal-calculate-my-initial-goals) |
| **Lose It!** | Mifflin + assumed PAL | **Static** TDEE − deficit; manual "Adjustment" field for fast/slow metabolisms | **Exercise added back** (projected-EOD model — Suppr borrowed this for the *daily bonus*, not for maintenance) | None adaptive; relies on accurate PAL guess | [Lose It calorie budget](https://personifyhealth.zendesk.com/hc/en-us/articles/28073592908187-What-is-Lose-It-Calorie-Counter) |
| **Noom** | Harris-Benedict TDEE from age/sex/height/weight/activity | **Adaptive-lite**: "weight-loss zone" range that shifts as logged weight progresses | Not a core expenditure input | Range (not point) softens noise; no published completeness gate | [Noom weight-loss zone](https://www.noom.com/support/faqs/using-the-app/logging-and-tracking/biometrics/2025/10/how-noom-sets-your-weight-loss-zone-and-tracks-your-progress/) |
| **Lifesum** | Formula targets at sign-up | **Static**; user manually edits | Optional sync, not adaptive | None | [Lifesum vs Noom](https://nutrola.app/en/blog/lifesum-vs-noom-for-beginners-2026) |
| **Apple (Fitness/Health)** | Resting Energy = Harris-Benedict/Mifflin-style formula from age/sex/weight/height (+ ML refinement) | Not a diet target system; reports **Total = Resting + Active** per day | The watch *is* the wearable; Active Energy from PPG+accelerometer, Resting from the formula | N/A (not intake-aware) | [Apple Health calorie metrics](https://appleinsider.com/inside/apple-fitness-plus/tips/how-to-use-apple-healths-calorie-burn-metrics) · [basalEnergyBurned](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/basalenergyburned) |
| **Suppr (today)** | Mifflin × user-selected activity multiplier (Grace = light 1.375 → 1,671) | **Adaptive energy balance, NO completeness gate** → produced 1,314; per-day activity bonus added on top via projected-EOD | Watch burn drives the *daily bonus* only; **not** the maintenance estimate | **None — the defect** | `src/lib/nutrition/adaptiveTdee.ts` |

**The pattern that matters:** the three apps built by people who publish their
reasoning (MacroFactor, Carbon, RP) all use **adaptive energy balance and all
refuse wearable burn as the expenditure input.** The apps that lean on wearable
burn (Cronometer's sync mode, MFP/Lose It "add it back") are the *additive*
school — they never try to *infer* expenditure, they just sum components and
accept the device's error. No serious app uses "average of the wearable's daily
total burn" as its maintenance number. That is the precise shape of P-watch, and
it has no peer adopter — for the reasons in §2.

---

## 2. Wearable energy-expenditure accuracy — the numbers

The question that decides P-watch: **how wrong is the Apple Watch about
calories?** Receipts, worst-to-best:

- **Shcherbina et al. 2017 (Stanford, *J Pers Med* 7(2):3)** — 7 wrist devices vs
  indirect calorimetry. Heart rate was good (within ~5% error), but **energy
  expenditure was not usable on any device: the most accurate was off by a median
  ~27%, the least accurate by ~93%.** The headline finding of the field: *trackers
  measure your pulse well and your calories badly.*
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5491979/) ·
  [Stanford Bio-X](https://biox.stanford.edu/highlight/fitness-trackers-accurately-measure-heart-rate-not-calories-burned)
- **O'Driscoll et al. 2020 (*Br J Sports Med* 54:332–340)** — meta-analysis, **60
  studies / 104 effect sizes**, devices vs indirect calorimetry / room calorimeter
  / doubly-labelled water. Conclusion: wrist/arm consumer devices are **not
  sufficiently accurate** for energy expenditure; huge between-device and
  between-activity heterogeneity (I² > 75%); only research-grade multi-sensor
  devices approach acceptable total-EE accuracy.
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/30194221/)
- **npj Digital Medicine 2025 — living systematic review of the Apple Watch
  specifically** (56 studies, 270 effect sizes: 71 EE, 148 HR, 51 steps). The
  cleanest current receipt:
  - **Energy expenditure:** every one of the 6 MAPE-reporting studies hit **≥20%
    error in at least one condition; overall MAPE ranged 9.71% (running) to
    151.66% (walking).** Margins of error "often large, both during exercise and
    at rest."
  - **Heart rate:** **never exceeded the 10% MAPE validity threshold** — valid.
  - **Steps:** small underestimation, strong correlation — broadly usable.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12823594/) ·
  [npj](https://www.nature.com/articles/s41746-025-02238-1)
- **MacroFactor's own citation set** (their wearables page) lands in the same
  place: a 2020 review found devices off by >10% **82% of the time** in
  free-living; a 2022 study reported MAPE **14.9%–47.8%** (Apple Watch 6 best at
  14.9 ± 9.8% running); a later review found MAPE **>30% for all brands**.
  [MacroFactor wearables](https://macrofactor.com/wearables/)

**The active-vs-total distinction — and why it partly rescues Grace's instinct.**
Those eye-watering MAPEs are almost all measuring **active energy during exercise
bouts** — the hardest case. A full-day *total* burn is a different quantity:

- Total daily burn = **Resting + Active.** Apple derives Resting Energy from a
  Harris-Benedict/Mifflin-style **formula** off your demographics (age, sex,
  weight, height) plus light ML refinement — not from the error-prone sensors.
  [AppleInsider](https://appleinsider.com/inside/apple-fitness-plus/tips/how-to-use-apple-healths-calorie-burn-metrics)
- Resting energy is **the largest component of total expenditure** in most people
  (diet-induced thermogenesis is only ~10%), so for a lightly-active person the
  basal formula dominates the day total.
  [NCBI Bookshelf](https://www.ncbi.nlm.nih.gov/books/NBK233774/)

So the high % error sits on the *small, active* slice. On a lazy day with little
exercise, Grace's "~1,600 total burn" is **mostly Apple's BMR formula** — i.e.
**the Watch total burn and the Mifflin seed are largely the same number wearing a
different hat.** That cuts two ways, and both cut against P-watch as the
*estimator*:

1. **The reassurance:** her lazy-day 1,600 is plausible precisely *because* it's
   formula-dominated — which is also why it's close to Mifflin × sedentary–light.
   Good as a **sanity bound.**
2. **The catch:** I could find **no doubly-labelled-water validation of Apple
   Watch *total daily* EE** to quote a clean error bar — *could not verify a
   specific total-EE accuracy figure for Apple Watch.* The defensible claim is
   directional, not numeric: **total-EE relative error < active-EE relative
   error, because the dominant basal term is formula-driven.** Anchoring
   maintenance to the Watch total therefore mostly re-imports Apple's BMR formula
   (fine, ~Mifflin) *plus* the noisy active slice (not fine) — you inherit the
   formula you could have computed yourself, contaminated by sensor noise, with
   *no* self-correction from real-world weight change.

There is also a physiological reason eating back measured burn is dubious even if
it were accurate: **energy compensation.** Total expenditure rises only ~72 kcal
per 100 kcal "burned" in exercise (constrained-energy effect), with large
individual variation — so a perfectly-measured active burn still over-credits the
day. [MacroFactor wearables](https://macrofactor.com/wearables/)

---

## 3. Energy-balance estimation — why it's the gold standard, and how it fails

**Why intake + weight-trend wins when adherent.** Body mass change over time is a
direct readout of cumulative energy balance (≈7,700 kcal/kg). If you know intake
and you know the weight trend, expenditure is the only unknown — you can solve for
it. Its quiet superpower: **it self-corrects consistent logging bias.** If a user
systematically under-logs by 15% but does so *every* day, the weight trend reveals
the true deficit and the inferred expenditure compensates — the *level* of intake
can be biased as long as the *bias is constant.*
[MacroFactor algorithms](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/)

**Its three failure modes — and which one bit Suppr:**

1. **Inconsistent / incomplete logging (the killer).** The self-correction holds
   only if bias is *consistent.* The instant some days are fully logged (1,900)
   and others are a single 520-kcal snack, the mean intake is no longer a biased
   estimate of true intake — it's a *blend of two different things*, and the
   solver reads the dilution as low expenditure. **This is exactly Suppr tonight:
   7 partial days dragged the mean down 306 kcal and the TDEE followed.** Note the
   physiological tell the gate-less math ignored: she *gained* +0.6 kg while
   "eating 1,369" — impossible at a true 1,314 maintenance.
2. **Water-weight / short-window noise.** Glycogen, sodium, hydration, menstrual
   phase move the scale ±1–2 kg in days. Over a short window a few noisy weigh-ins
   swamp the real trend. Mitigation everyone uses: **trend smoothing** + a minimum
   weigh-in count. Suppr's per-weigh-in α=0.1 EMA *over-* smooths sparse data
   (captured only 29% of the real move) — the forensic R2 defect.
3. **Lag.** Energy balance is intrinsically retrospective — it needs ~14–30 days
   to converge and reflects the *recent past*, not today. Apps absorb this with
   confidence ramps and carry-forward, not by pretending it's instant.

The decisive point for Suppr: **MacroFactor, Carbon and RP all run energy balance
and all three explicitly defend against failure mode #1** — Carbon gates on
self-reported adherence, MacroFactor trend-weights + carries forward high-
confidence values + tolerates gaps, RP works on weekly averages. **Suppr runs the
same estimator with none of the guards.** The bug is not the method; it's the
missing guard rail. That is the single most important finding in this survey.

---

## 4. Grace's conceptual question — is "maintenance" the lazy-day burn or the average burn?

Precisely: it depends which architecture you're inside, and **Suppr is already
committed to the lazy-day-base + per-day-bonus architecture — so for Suppr,
maintenance is the lazy-day (NEAT) burn.**

- **Classic textbook TDEE** = BMR × an activity multiplier that **already bakes
  habitual exercise in** (sedentary 1.2 → very active 1.9). Under that convention
  "maintenance" is the *average* day *including* typical training, and you do
  **not** add exercise again — doing so double-counts. MFP, Lifesum, Noom and
  Suppr's *formula seed* use this.
- **Component / add-back architecture** (Lose It!, Cronometer sync, **and Suppr's
  activity-bonus**) = a **NEAT-only base** (closer to BMR × ~1.2) **plus exercise
  added per-day** as it happens. Under this convention "maintenance" is the
  **lazy-day burn**, and workouts are explicitly *additive on top.*

Suppr's runtime is the second architecture: `computeActivityBonusKcal`
(`src/lib/nutrition/activityBonus.ts`) adds `max(0, projected_EOD_burn −
maintenance)` on active days, and returns 0 when `active === 0` precisely "to
avoid double-counting incidental movement already baked into maintenance." **That
only works if `maintenance` is the lazy-day/NEAT number.** So Grace's mental model
— *baseline ≈ lazy-day ~1,600, workout days 1,750–2,000 arrive as a per-day
bonus* — is the **correct definition for Suppr's existing machinery.** Her error
isn't the definition; it's the *source* she'd use to fill it (the Watch total
average) and the latent **double-count**:

> **Latent bug flagged for the parity/nutrition owner, not this doc to fix:** the
> formula seed uses Grace's **light (1.375)** multiplier (= 1,671), which *already
> includes* 1–3 workouts/week — *and then* the activity bonus adds workout burn on
> top. Base should be **sedentary (1.2 ≈ 1,458)** for the add-back model to be
> clean, or the bonus should be suppressed on the days the multiplier already
> assumes. The adaptive estimator sidesteps this (it learns the true all-in
> number from weight), which is a third reason to keep energy balance primary.

**Verdict on Q5:** maintenance in Suppr = **lazy-day NEAT burn**, workouts
additive — Grace is right on the *definition.* The base should therefore be the
**sedentary** formula or the **gated** energy-balance number, **not** the
light-multiplier seed and **not** the Watch's average-including-workouts total.

---

## 5. Architecture comparison against Suppr's actual reality

Suppr's reality, stated plainly: **solo user today is an Apple-Watch wearer with
imperfect, bursty logging; the target audience is Watch/Oura owners (device-rich)
who are MFP refugees (logging fatigue is real and permanent).** Completeness
*cannot* be assumed — it is the thing that broke tonight and it will break for the
refugee cohort by definition. So the deciding axis is: **which architecture
degrades gracefully when logging completeness can't be trusted?**

| Architecture | Behaviour under incomplete logging | Verdict for Suppr |
|---|---|---|
| **P-current** (energy balance, no gate) | **Fails hard** — partial days pull the mean straight into the estimate; produced 1,314 below her own sedentary floor | Reject as-is. The method is right, the implementation is unguarded |
| **MacroFactor-pure** (gated energy balance + trend-weight + carry-forward) | **Degrades gracefully** — bad/missing days are down-weighted or skipped; converges, then holds last high-confidence value through gaps | **The benchmark.** This is P-current *with the guards the forensic R1/R2 add* |
| **P-watch** (Watch total burn = maintenance) | **Degrades *too* gracefully — to the wrong number.** It's *immune* to logging because it ignores intake entirely; but it imports Apple's BMR formula + noisy active slice, never self-corrects to real weight change, and re-introduces the double-count in §4 | Reject as estimator. Keep as **plausibility bound + daily bonus** |
| **Cronometer-style user-choice** | Robust (user picks), but pushes the methodology decision onto a logging-fatigued refugee who just wants a number | Reject as default; maybe an **advanced override** later |
| **Recommended hybrid** (gated energy balance primary; Watch = seed-corroboration + bounds + daily bonus) | **Degrades gracefully by construction** — the gate removes the failure mode directly; the Watch bound catches any residual implausible output before it ships | **Adopt** |

The trap to name explicitly: P-watch *looks* like it solves the completeness
problem, because a number that ignores intake can't be polluted by bad intake. But
"can't be polluted" and "correct" are different claims. P-watch trades a
*fixable* failure mode (gate the logging) for a *permanent* one (the Watch's EE
error + no weight self-correction + the double-count). You'd be choosing the
architecture that can never be better than Apple's formula in exchange for never
having to gate logging — a bad trade when gating logging is ~30 lines.

---

## 6. Recommended architecture (one — with the reasoning chain)

**Adopt: gated adaptive energy balance as the estimator of record, with the Apple
Watch demoted to seed-corroboration, plausibility bounds, and the per-day activity
bonus it already powers.** Concretely, four layers:

1. **Seed (cold start, < gate):** Mifflin formula — but seeded at **sedentary
   (1.2)**, not the user's self-reported multiplier, because the add-back bonus
   layer supplies activity. Optionally corroborate the seed against the **Watch's
   median lazy-day total burn** — if the two agree within ~15%, raise initial
   confidence; if they diverge wildly, surface it rather than silently picking
   one. (This is the *only* role the literature supports for Watch burn in the
   maintenance number.)
2. **Estimator (the operating number):** adaptive energy balance — **but with the
   forensic R1 completeness gate and R2 trend fix applied.** A day enters the mean
   only if it's plausibly complete (`kcal ≥ max(1000, 0.8 × BMR)`, optionally ≥2
   entries); weight trend via least-squares slope (or time-aware EMA) with a
   sane cap. On Grace's own data this reads **~1,500–1,630**, inside her expected
   range.
3. **Plausibility bound (belt-and-braces):** before any adaptive value is
   displayed or fed to a retune, clamp/confidence-downgrade it if it falls outside
   ~0.85–1.30× the sedentary formula **and** is contradicted by the Watch's
   resting-energy floor. 1,314 < her 1,458 sedentary floor would have been caught
   tonight. The Watch's *resting* energy is a *better* lower-bound source than its
   active energy — that's where device data earns its keep.
4. **Daily bonus (unchanged):** keep the projected-EOD activity bonus
   (`activityBonus.ts`) for active days. This is where Watch *active* energy
   belongs — a single noisy day's bonus is low-stakes and self-limits, unlike a
   calcified maintenance number that drives every retune.

**The reasoning chain, compressed:**

> Wearable EE is the worst-validated signal in the stack (active-EE MAPE 15–150%;
> Shcherbina 27–93%) → so it must not *be* maintenance. Energy balance is the
> best-validated signal *when adherent* and uniquely self-corrects consistent
> logging bias → so it should be the estimator. Suppr's population guarantees
> *non-adherent* logging → so the estimator must be *gated*, which is exactly the
> forensic R1/R2 fix and exactly what MacroFactor/Carbon/RP already do. The Watch
> is genuinely good at *trends, steps, HR, and a formula-grade resting floor* → so
> it earns the *bound* and *daily-bonus* roles, not the headline number. Suppr's
> architecture is already a NEAT-base + add-back model → so maintenance is the
> *lazy-day* number (Grace's definition is right), best produced by gated energy
> balance seeded at sedentary, not by the Watch's workout-inclusive average.

**Confidence: 8/10.** High on "energy balance primary, gate it, Watch as
bound/bonus" — it's the convergent practice of every serious adaptive app plus the
direct fix for the observed bug. The 2 points of doubt are the *exact* gate
threshold and trend estimator (R1/R2 tuning), which want validation on more than
one user's series before the confidence ramp constants are locked.

---

## 7. What this means for the forensic doc's R1 / R2 / R3

| Forensic remediation | Survives? | Status after this survey |
|---|---|---|
| **R1 — completeness gate on logging days** | **Survives, promoted to load-bearing.** | This *is* the MacroFactor/Carbon guard the whole survey points to. It moves from "recommended root fix" to "the non-negotiable core of the recommended architecture." |
| **R2 — fix the weight-trend signal (least-squares / time-aware)** | **Survives, ship with R1.** | Failure mode #2 in §3; every adaptive app trend-smooths. Keep the forensic warning: **R2 alone makes Grace worse (1,198)** by removing the accidental cushion — R1 must land first/with it. |
| **R3 — plausibility clamp + formula blend** | **Survives as the *bound*, not the *blend*.** | The §6 layer-3 **clamp** is adopted (and upgraded: bound against the Watch *resting* floor, not just the formula). The **blend** half (mix `w·energyBalance + (1−w)·Mifflin`) is **demoted** — gating fixes the input so you don't need to permanently dilute the output; a blend would mask genuine metabolic adaptation, the very thing adaptive TDEE exists to capture. Keep clamp, drop standing blend. |

Net: the forensic doc's headline recommendation (**R1 + R2 together, R3 clamp as
belt-and-braces**) **survives intact** and is now backed by external evidence and
competitive practice, not just Grace's own series. Nothing in the survey overturns
it; the survey *strengthens* R1 and *narrows* R3 from "blend" to "bound."

---

## 8. Where this disagrees — FOR GRACE'S CALL

Marked because each is a judgement call, not a fact, and the founder owns the
product bet.

**Disagrees with Grace (P-watch).** The proposal to make maintenance ≈ *average of
actual Watch total burn* is **not** what any best-in-class adaptive app does, and
the evidence says why: the Watch's energy-expenditure error is the worst-validated
number in the pipeline (active-EE MAPE 15–150%; Shcherbina median 27–93%), the day
*total* is mostly just Apple's BMR formula re-skinned (so you gain little over the
Mifflin seed you already have), it never self-corrects to real weight change, and
anchoring to a workout-inclusive average **re-introduces the double-count** with
Suppr's per-day bonus. **Where Grace is right:** (a) the *definition* — maintenance
should be the **lazy-day/NEAT** burn with workouts additive, which is exactly
Suppr's architecture; (b) the Watch is a *legitimate and valuable* input — just as
a **plausibility bound (resting floor) and the daily activity bonus**, not as the
estimator. Net: adopt her *definition* and her *instinct that device data should be
used*, reject the Watch-total *as the maintenance number.*

**Disagrees with the prior blend sketch (P-blend).** The sketch made the **Watch
baseline the operating number** and demoted energy balance to a "slow drift
corrector." This survey **inverts that ordering**: energy balance should be
*primary* (it's the best-validated, self-correcting signal), and the Watch should
be the *corroborator/bound*. P-blend has the trust hierarchy backwards — it
promotes the noisiest signal to operating status and demotes the gold-standard one
to a footnote. Keep the *spirit* (formula seed + multiple signals), flip the
*hierarchy.*

**Disagrees with the current code (P-current).** Unchanged from the forensic doc:
the shipped estimator is right in *method* and wrong in *implementation* — no
completeness gate (the bug), an over-smoothing per-weigh-in EMA, no plausibility
floor, and a seed multiplier (light 1.375) that double-counts against the activity
bonus. None of these are "use a different algorithm"; all are "guard the algorithm
you have." Ship R1+R2+R3-clamp; do **not** rip out energy balance.

**The one genuinely open product call (for Grace):** whether to *also* expose a
Cronometer-style **manual override** ("use my device's daily burn") as an
*advanced* setting for power users who distrust the inference, while keeping gated
energy balance the *default*. The survey says: defensible as an escape hatch,
wrong as a default — but it's a roadmap decision, not an evidence one.

---

*Sources inline per claim. Could-not-verify items flagged in text: (1) a clean
doubly-labelled-water total-daily-EE accuracy figure for the Apple Watch
specifically — the total-EE-error-< active-EE-error claim is a reasoned inference
from basal-dominance + formula-derived resting energy, not a single measured
number; (2) MacroFactor's exact smoothing window/coefficients (not publicly
disclosed). Suppr code refs: `src/lib/nutrition/adaptiveTdee.ts`,
`activityBonus.ts`, `tdee.ts`, `resolveMaintenance.ts`. Companion forensic:
`docs/ux/research/2026-06-10-adaptive-tdee-review.md`.*
