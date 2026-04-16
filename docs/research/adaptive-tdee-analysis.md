# Adaptive TDEE Analysis: MacroFactor vs Suppr

> Research date: 2026-04-16

## 1. How MacroFactor's Algorithm Works

### Core Principle: Back-Calculated Energy Balance

MacroFactor rearranges the CICO equation:

```
Calories Out = Calories In - Change in Stored Energy
```

Instead of *predicting* TDEE from height/weight/age/activity (Mifflin-St Jeor), MacroFactor *observes* what actually happened -- your logged intake and your actual weight change -- and solves for what your expenditure must have been.

### Data Inputs

| Input | How used | Required frequency |
|-------|----------|-------------------|
| Daily calorie intake (logged food) | Numerator of energy balance | 6 of 7 days minimum |
| Scale weight | Weight trend via EMA smoothing | 1+ per week (daily ideal) |
| Step count (optional modifier) | Speeds up expenditure updates during activity shifts | Passive via phone/wearable |
| Menstrual cycle (optional) | Personal reference only (future: cycle-aware analytics) | Manual toggle |

MacroFactor does **not** use wearable calorie estimates directly. Steps are used only as a signal modifier to increase responsiveness, not to assign calorie values to activity.

### Weight Trend Smoothing

- Exponential moving average (EMA) that prioritizes recent weigh-ins
- Linear interpolation fills gaps (e.g., no weigh-in Tuesday between Monday 151 lb and Wednesday 150 lb -> assumes 150.5 lb)
- Smoothing removes water/glycogen noise that causes day-to-day swings of 1-3 lb

### The Calculation

```
weight_change_rate = (smoothed_weight_end - smoothed_weight_start) / days
energy_from_weight_change = weight_change_rate * 7700 kcal/kg
expenditure = avg_daily_intake - energy_from_weight_change
```

This is fundamentally identical to what Suppr already implements in `computeAdaptiveTDEE()`.

---

## 2. Recalibration Frequency

### MacroFactor: Continuous with Weekly Coaching

- **Expenditure estimate**: Updates continuously as new data arrives (not just weekly)
- **Coaching check-in**: Weekly -- adjusts calorie/macro targets based on updated expenditure
- **Convergence timeline**: ~2-3 weeks for initial accuracy; 1-2 weeks to detect notable expenditure changes after that
- **V3 improvement**: 19% more responsive than V2 with similar stability, and 20% more stable with similar responsiveness

### Missing Data Tolerance (V3)

- Algorithm pauses only if >3 days of missing nutrition data in a 7-day period
- V2 required ~85% completeness; V3 is more forgiving
- This tolerance is a key reason users feel less pressure and stick with logging

---

## 3. What Makes Their Expenditure Calculation Superior

### Beyond Basic Energy Balance

MacroFactor's V3 algorithm adds layers that a naive implementation (like Suppr's current version) lacks:

1. **Intelligent smoothing layer**: Prevents over-corrections when expenditure fluctuates temporarily
2. **Flux range detection**: Identifies periods of notable expenditure movement vs. noise, and navigates through them intelligently
3. **Stability-responsiveness tradeoff optimization**: Explicitly tuned to be responsive to real metabolic changes while ignoring transient weight fluctuations
4. **Expenditure modifiers**:
   - *Step-informed updates*: Uses step trend changes (not absolute values) to accelerate expenditure updates when activity shifts
   - *Predictive goal adjustment*: Applies forward-looking correction when user changes goals (e.g., switching from cut to maintain)
5. **Prediction-error feedback loop**: The algorithm treats itself as a prediction engine. When predicted weight != actual weight, the difference quantifies how wrong the estimate was and drives correction magnitude

### Accuracy Claims (MacroFactor's own data)

- After 3-4 weeks of use: recommendations are 120-170% more accurate than static TDEE formulas
- The error that static formulas produce (200-400 kcal/day) is what causes most diet stalls

---

## 4. UX That Builds Trust

### Transparency as Core Philosophy

MacroFactor explicitly shows users their calculated expenditure because "we don't want our algorithms to be an inscrutable black box -- you deserve to know where your recommendations come from."

### Key UX Elements

| UX Feature | What it does | Trust effect |
|------------|-------------|-------------|
| **Expenditure graph** | Shows expenditure trend over weeks/months | Users see their metabolism responding to reality |
| **Weight trend line** | Smoothed EMA overlaid on raw scale weights | Users understand fluctuations are noise, trend is signal |
| **Energy balance widget** | Intake overlaid with expenditure/targets | Clear visual of surplus/deficit relationship |
| **Flux range indicator** | Shows when expenditure is actively shifting | Reduces anxiety during metabolic adaptation |
| **Weekly coaching modules** | Curated feedback on logging quality, common errors | Educates users; feels like having a coach |
| **Adherence-neutral messaging** | "We adjust to what you did, not what you should have done" | Removes guilt; encourages continued logging |

### The "Adherence-Neutral" Philosophy

This is MacroFactor's single most praised design decision. The app does not require users to hit their macro targets perfectly. Instead, it observes what users *actually ate* and recalculates from there. This means:

- Missing a day doesn't "break" the system
- Overeating doesn't trigger punishment messaging
- The algorithm works *with* the user's real behavior, not against an idealized plan

This is the opposite of Carbon Diet Coach, which requires stricter adherence and feels "too rigid" to many users.

---

## 5. What Users Specifically Praise

### From Reviews, Forums, and Comparisons

1. **"The only tracker that actually adjusts to reality"** -- Users describe the experience of watching their expenditure number change as their activity or diet shifts. This makes the app feel alive and responsive rather than a static calculator.

2. **Speed and polish** -- "Ultra quick to find foods, copy from previous days, move foods around." When logging multiple times daily, micro-interactions matter enormously.

3. **Verified food database** -- NCC-derived, not user-submitted. No "chicken breast = 2 calories" errors. This upstream data quality makes the entire TDEE calculation more trustworthy.

4. **Weight trend visualization** -- Smoothed trend line over raw weigh-ins helps users avoid emotional reactions to daily fluctuations. Users report this single feature changed their relationship with the scale.

5. **No plateau panic** -- When weight loss stalls, the app detects metabolic adaptation (expenditure dropping) and automatically adjusts targets downward. Users don't have to manually troubleshoot.

6. **Reverse dieting support** -- Users trust the app to guide them from a deficit back to maintenance because the expenditure tracks upward as they eat more, confirming their metabolism is recovering.

7. **Scientific credibility** -- Backed by Stronger by Science (Greg Nuckols, Eric Trexler). Algorithm details published openly. Users feel they're using something evidence-based, not marketing-driven.

---

## 6. What Suppr Currently Has

### Existing Implementation

**`src/lib/nutrition/adaptiveTdee.ts`** -- Core algorithm:
- Uses the same fundamental energy balance equation as MacroFactor
- EMA smoothing of weight data (alpha = 0.1)
- 28-day default window
- Requires 7+ logging days and 3+ weigh-ins to produce a result
- Confidence tiers: low (<14 days), medium (14+ days, 5+ weigh-ins), high (21+ days, 7+ weigh-ins)

**`src/lib/nutrition/refreshAdaptiveTdee.ts`** -- Persistence layer:
- Fires after journal insert/delete (web) and nutrition_entries upsert (mobile)
- 6-hour throttle to limit DB reads
- Only persists medium/high confidence results
- Stores `adaptive_tdee`, `adaptive_tdee_confidence`, `adaptive_tdee_updated_at` on profiles

**`src/lib/nutrition/tdee.ts`** -- `getEffectiveTDEE()`:
- Single source of truth: returns adaptive TDEE if medium/high confidence, else falls back to Mifflin-St Jeor
- Used in NutritionTracker for maintenance TDEE / burn calculations

**`src/lib/weightProjection.ts`** -- Weight trend analysis:
- Tukey IQR fences for outlier removal
- Journey baseline calculation (peak when losing, trough when gaining)
- Goal timeline estimation from recent trend
- No EMA smoothing of its own (uses raw day-map entries)

**Database**: Migration `20260414130000_adaptive_tdee.sql` adds three columns to profiles.

### What's Missing from Current Implementation

The algorithm exists but is **not surfaced to users in any meaningful way**. There is:
- No expenditure graph or trend visualization
- No weekly coaching check-in or target auto-adjustment
- No communication to the user that their TDEE has been updated or what it means
- No weight trend line (smoothed EMA) shown alongside raw weigh-ins
- No energy balance visualization (intake vs expenditure)
- No adherence-neutral messaging or philosophy
- No missing-data tolerance logic (the algorithm simply returns null if data is insufficient)
- No step-informed or activity-informed modifiers
- No flux range or stability/responsiveness tuning
- No interpolation for missing weight days

---

## 7. Gap Analysis: Suppr vs MacroFactor

| Capability | MacroFactor | Suppr | Gap |
|-----------|------------|-------|-----|
| Energy balance TDEE calculation | Yes (V3, sophisticated) | Yes (basic, correct math) | Algorithm exists but lacks smoothing layers |
| Weight trend EMA | Yes, with interpolation for gaps | Partial (EMA in adaptiveTdee.ts only) | Not shown to users; no interpolation |
| Recalibration frequency | Continuous + weekly coaching | On journal save, 6h throttle | Need continuous updates + weekly target adjustment |
| Expenditure visualization | Rich graph with flux range | None | **Critical gap** -- users can't see the adaptive system working |
| Weight trend visualization | Smoothed line over raw data | Raw data only (weight-tracker) | Need to surface EMA trend line |
| Energy balance widget | Intake vs expenditure overlay | None | Missing entirely |
| Weekly coaching check-in | Automated modules with feedback | None | Missing entirely |
| Adherence-neutral philosophy | Core design principle, reflected in copy | Not implemented | Need messaging + algorithm tolerance |
| Auto-adjust targets | Weekly based on updated expenditure | Never auto-adjusts targets | **Critical gap** -- the adaptive TDEE is computed but never acts on targets |
| Missing data tolerance | V3: pauses only if >3 days missing/week | Returns null if <7 days total | Need graceful degradation |
| Step-informed modifier | Optional, uses trend not absolute | None | Lower priority but differentiating |
| Predictive goal adjustment | Modifier for goal changes | None | Medium priority |
| Verified food database | NCC-derived, curated | Mix of USDA + user/recipe data | Different approach but worth noting |
| Convergence communication | Shows when estimate is still settling | None | Users need to know "still learning" vs "confident" |

---

## 8. What Suppr Needs to Build to Match (or Beat) MacroFactor

### Phase 1: Make the Existing Algorithm Visible (2-3 weeks)

The adaptive TDEE math already works. The immediate priority is surfacing it.

1. **Expenditure trend card/graph** -- Show the user their computed TDEE over time (weekly data points). Even a simple line chart with "Your estimated daily burn: 2,340 kcal" is transformative vs. showing nothing.

2. **Weight trend line** -- Overlay the EMA-smoothed weight on the weight tracker's raw data points. Label it "Trend" vs. individual weigh-ins. This alone changes how users relate to the scale.

3. **"Adaptive" badge on calorie target** -- When `isAdaptive === true`, show a small indicator: "Based on your actual data" vs. "Estimated from profile." This builds trust incrementally.

4. **Confidence indicator** -- Show "Still learning (7 days logged)" / "Getting accurate (14 days)" / "Dialed in (21+ days)" so users understand the system is working even before it's confident.

### Phase 2: Auto-Adjusting Targets (3-4 weeks)

This is the make-or-break feature. Computing TDEE adaptively but never updating the user's calorie target means the math is wasted.

1. **Weekly target recalibration** -- Every 7 days (or on a user-chosen day), if confidence is medium+, recalculate calorie target from adaptive TDEE + goal adjustment. Present the change to the user: "Your metabolism has adapted. New target: 2,150 kcal (was 2,250)."

2. **Opt-in with transparency** -- Let users approve or dismiss the adjustment. Show before/after and the reasoning. Never silently change targets.

3. **Adherence-neutral recalculation** -- Recompute from *actual intake*, not *target intake*. This is the philosophical shift that MacroFactor users love. The algorithm should say "you averaged 2,400 kcal and lost 0.3 kg/week, so your TDEE is ~2,730" regardless of whether the target was 2,200.

4. **Plateau detection** -- When weight trend flattens despite a deficit target, surface a notification: "Your weight has been stable for 2 weeks. Your body may have adapted. [Adjust targets] [Keep current plan]."

### Phase 3: Polish and Differentiation (4-6 weeks)

1. **Energy balance visualization** -- Daily/weekly view showing intake bars vs. expenditure line. Makes energy balance tangible.

2. **Weekly coaching summary** -- "This week: you logged 6/7 days, averaged 2,180 kcal, trend weight dropped 0.2 kg. Your estimated burn is 2,580 kcal. On track for your goal by [date]."

3. **Missing data interpolation** -- For weight: linear interpolation between known points (as MacroFactor does). For intake: gracefully handle gaps without breaking the algorithm.

4. **Improved smoothing** -- Add an intelligent smoothing layer that detects flux ranges (rapid expenditure shifts) vs. noise. Consider implementing a Kalman filter or similar for better stability-responsiveness balance.

5. **Step-informed modifier** -- If HealthKit step data is available, use step trend changes (not absolute values) to accelerate expenditure updates when activity level shifts.

### Suppr's Potential Advantages Over MacroFactor

- **Recipe-integrated nutrition** -- MacroFactor's strength is food logging; Suppr's is recipe import with verified nutrition. Accurate intake data is the foundation of adaptive TDEE. If Suppr's recipe pipeline produces better per-ingredient nutrition than manual logging, the adaptive algorithm gets better inputs.
- **Price** -- MacroFactor is $11.99/month or $71.99/year. Suppr can undercut significantly while offering the same core algorithm.
- **HealthKit weight sync** -- Suppr already syncs weight from Apple Health. This passive data collection means users don't need to manually log weight, reducing friction and increasing the data density that feeds the algorithm.
- **Mainstream accessibility** -- MacroFactor targets experienced lifters/dieters. Suppr can make adaptive TDEE accessible to casual users with simpler UX and less jargon.

---

## Sources

- [MacroFactor: Best Energy Expenditure Calculator](https://macrofactorapp.com/energy-expenditure-calculator-app/)
- [MacroFactor's Algorithms and Core Philosophy](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/)
- [An In-Depth Look at MacroFactor's New V3 Expenditure Algorithm](https://macrofactor.com/expenditure-v3/)
- [How Accurate is MacroFactor's Expenditure Algorithm?](https://macrofactor.com/algorithm-accuracy/)
- [An Examination of MacroFactor's Expenditure Modifiers](https://macrofactorapp.com/expenditure-modifiers/)
- [How Should I Interpret Changes to my Energy Expenditure?](https://help.macrofactorapp.com/en/articles/26-how-should-i-interpret-changes-to-my-energy-expenditure)
- [Why is my Expenditure Different From a TDEE Calculator?](https://help.macrofactorapp.com/en/articles/126-why-is-my-expenditure-in-macrofactor-different-from-the-output-of-a-tdee-calculator)
- [Logging Frequency for Expenditure Algorithm](https://help.macrofactorapp.com/en/articles/110-how-frequently-do-i-need-to-log-my-nutrition-for-the-expenditure-algorithm-and-weekly-coaching-updates)
- [MacroFactor vs Carbon Diet Coach (FeastGood)](https://feastgood.com/macrofactor-vs-carbon-diet-coach/)
- [MacroFactor Review (Outlift, 2026)](https://outlift.com/macrofactor-review/)
- [MacroFactor Review (FeastGood, 2024)](https://feastgood.com/macrofactor-review/)
