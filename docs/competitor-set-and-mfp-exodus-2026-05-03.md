# Canonical competitor set + MFP exodus moment

**Date:** 2026-05-03
**Status:** Active strategic context — supersedes any narrower competitor framing for the next ~90 days
**Owner:** Grace

> **⟳ Retest 2026-06-20 (ENG-1112) — premise confirmed, thesis HOLDS and sharpens.**
> **MyFitnessPal acquired Cal AI** (deal closed Dec 2025, announced 2 Mar 2026; both are Francisco Partners assets). Cal AI stays a standalone app — founders + ~7 staff retained — but is integrated with MFP's ~20M-food DB, so MFP now has Cal-AI-grade AI photo logging. **The catch: it's paywalled on both sides.** MFP moved AI photo, barcode, recipe-URL import and voice logging behind Premium ($19.99/mo) / Premium+ ($24.99/mo) in May 2026; Cal AI is trial-gated ($9.99/mo or $29.99/yr) and was **pulled from the App Store Apr 2026** for deceptive paywall design. The MFP-refugee gap did **not** close — it moved behind a ~$20/mo wall, which *reinforces* the exodus grievance. The "Cal AI" rows below are kept for the historical record, but **Cal AI is no longer an independent competitor — treat it as part of the MyFitnessPal profile.** Revised wedge: see the canonical differentiation statement under "Where Suppr leads" and the re-tested first-90-seconds rule at the bottom. Fact-check + ≥3 sources (TechCrunch, GlobeNewswire, Fitt Insider, eWeek, TNW): ENG-1112 Linear comment (2026-06-20).

## The 8 competitors Suppr benchmarks against

This is the canonical set going forward. Any audit, parity review, or "are we yet best-in-class?" question should refer to these 8 unless explicitly scoped tighter.

| App | Persona / moat | Why it's on the list |
|---|---|---|
| **MyFitnessPal** | Calorie tracking, 200M+ users, 14M-entry food DB | Market leader. **Mass exodus underway as of 2026-05-03 — capturing those refugees is the headline near-term goal.** |
| **Lose It!** | Beginner-friendly calorie tracking, 50M+ users | Soft-onboarding alternative for users intimidated by MFP/MacroFactor. |
| **Cronometer** | Clinical-grade micronutrient tracking, 10M+ | Owns the "I want every micronutrient tracked" persona. |
| **MacroFactor** | Adaptive macro coaching, 1M+ | "Math has the moment" pattern — paid coaching wrapped in adaptive expenditure. |
| **Cal AI** *(acquired by MyFitnessPal, Mar 2026 — no longer independent; fold into the MFP row)* | AI photo-log first product | **Now part of MyFitnessPal.** Was "free taste-of-AI before paywall"; post-acquisition the photo logging is hard-paywalled (trial → $9.99/mo or $29.99/yr) and Cal AI was App-Store-pulled Apr 2026 for paywall dark patterns. The standalone moat folded into MFP — the set is effectively 7 + Cal-AI-inside-MFP. |
| **Paprika** | Recipe management | URL import + servings scaling are their moats. Decade-deep on recipe library tooling. |
| **Recime** | Recipe discovery | Large catalogue, social-style browse. |
| **Honeydew** | Household real-time meal plan + shopping | "Two phones at Tesco" moment. Deferred for Suppr until household > 1 user. |

## The MFP exodus — why this matters now

As of 2026-05-03, MyFitnessPal is hemorrhaging users. The exodus is the largest available pool of switchers in the calorie-tracking category right now. **Catching MFP refugees is Suppr's highest-leverage near-term growth move.**

What MFP refugees actually look for in their first 90 seconds (per existing audits + the post-2026-05-03-sprint specialist verdict):

1. **"Will my staple foods be in the database?"** — they search for a specific brand/restaurant SKU. If it's missing, they bounce unless the recovery path is obvious.
2. **"Can I keep my history?"** — 18 months of MFP data is the switching-cost we have to neutralise. CSV import (PR #84) is the unlock, but it's invisible until they go looking. **Surface "bring your MFP history" inside the first 90 seconds of onboarding, not buried in Settings.**
3. **"No ads, no barcode paywall, no nag screens"** — Suppr's experience is materially better than MFP's; this is a real differentiator if the user gets far enough to feel it.

## Match-or-beat verdict after 2026-05-03 sprint

Specialist verdict (`product-lead` + `competitor-intelligence`, 2026-05-03):

| Competitor | 60-second test | Verdict |
|---|---|---|
| Cal AI *(now MyFitnessPal — acquired Mar 2026)* | Photo a plate, see macros fast | **Photo logging is now paywalled on both MFP and Cal AI (~$20/mo wall).** Don't fight photo head-on — the wedge re-points to attributed Reel/recipe import + make-it-fit-your-macros + adaptive TDEE on free (see the revised differentiation statement). |
| MacroFactor | Adaptive TDEE has a visible moment | **Match the moment, not the math.** Need years-deep algorithm credibility we don't have yet |
| Paprika | Recipe servings 4→2 scales ingredients + steps | **Match cross-platform** via PR #72 + #84 stepper |
| MyFitnessPal | Find staple food, keep history | **Partial.** CSV import + add-custom-food fallback land. Catalogue still trails. |
| Recime | Discover feels populated | **Partial.** 50 recipes / 5 clusters crosses "looks real" threshold; fails second-search test (keto Indian, low-FODMAP) |
| Honeydew | Household real-time | **Skipped per N=1 rule** (correct call) |

**Match-or-beat on persona-blocking moment: 4/6.**

## Where Suppr leads (positioning, not feature)

**Canonical differentiation statement (revised 2026-06-20, ENG-1112 — single source of truth. Other docs reference this; do not restate divergently.):**

> Suppr gives you attributed Reel/recipe import → make-it-fit-your-macros, adaptive TDEE, and honest estimated-nutrition — on free, with no ads and no barcode/photo paywall. The wedge is no longer "we have AI photo" — it's "we don't paywall the basics, and we turn the Reel you saw into a meal that fits your day."

*Supersedes the prior lead ("weekly TDEE recompute + photo-log free taster + recipe servings scaling + Discover + macro tracker coexist with no ads and no barcode paywall — the integration-of-the-loop lead"). Now that MFP (with Cal AI) bundles AI photo logging, the photo-taster leg is no longer the differentiator — but it survives only behind their ~$20/mo paywall, so "no photo/barcode paywall on free" is a **sharper** switching reason, not a weaker one. The genuinely uncopyable axis is **attributed Reel/recipe import → make-it-fit-your-macros + adaptive TDEE on free**, which MFP does not offer free (recipe-URL import is paywalled) and does not offer at all in the "import the Reel you saved → fit it to today" form.*

## Single biggest residual gap

**Trust in the nutrition number.** Cal AI (now part of MyFitnessPal, acquired Mar 2026) fakes confidence. MFP outsources to user-generated chaos. MacroFactor sidesteps with the algorithm. Suppr is the only product *showing* uncertainty (the 4-segment confidence meter) — but hasn't yet earned the right to be trusted on accuracy at scale.

Closing this means:
- Visible match-source attribution on every logged item
- A "why this number" users actually open
- A feedback loop where corrections improve future matches

Without this, every other feature is decoration.

## Operational rule

**When evaluating a new feature, ask "does this catch an MFP refugee in their first 90 seconds?" before any other competitor parity question.** Other parity is secondary while the exodus is active.

### Re-test of the first-90-seconds rule vs an MFP-that-now-has-AI-photo (2026-06-20, ENG-1112)

The rule still holds — the answer just re-points. Pre-acquisition the 90-second hook was framed partly as a "photo taster," and an MFP with Cal-AI-grade photo logging looks like it closes that. It does **not**, because **MFP's AI photo (plus barcode, recipe-URL import and voice) is paywalled at ~$20/mo and Cal AI is trial-gated** — so a refugee's first 90 seconds on *free* MFP still has no AI photo, no barcode, and ads. Suppr's 90-second hook therefore shifts off "we have AI photo" and onto the axes a refugee can feel for free immediately: **import the Reel/recipe you already saved → make-it-fit-your-macros, adaptive TDEE, the nutrition-trust meter, and no ads / no barcode-or-photo paywall.** **Conclusion: the rule is intact and the thesis sharpens** — the gap moved behind a paywall rather than closing, so the exodus grievance is stronger, not weaker.

## Reference docs

- `docs/competitor-intelligence-report.md` — full April 2026 landscape report
- `docs/competitor_feature_catalog_scout.md` — feature-level catalogue
- `docs/competitor_feature_catalog_sentiment.md` — user-sentiment catalogue
- `docs/audits/2026-05-03-48hr-activity-report.md` — what shipped in the 2026-05-03 sprint
- `docs/audits/2026-04-27-competition-bar-multicategory.md` — the multicategory competition framing this supersedes for near-term use
