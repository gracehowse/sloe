# Canonical competitor set + MFP exodus moment

**Date:** 2026-05-03
**Status:** Active strategic context — supersedes any narrower competitor framing for the next ~90 days
**Owner:** Grace

## The 8 competitors Suppr benchmarks against

This is the canonical set going forward. Any audit, parity review, or "are we yet best-in-class?" question should refer to these 8 unless explicitly scoped tighter.

| App | Persona / moat | Why it's on the list |
|---|---|---|
| **MyFitnessPal** | Calorie tracking, 200M+ users, 14M-entry food DB | Market leader. **Mass exodus underway as of 2026-05-03 — capturing those refugees is the headline near-term goal.** |
| **Lose It!** | Beginner-friendly calorie tracking, 50M+ users | Soft-onboarding alternative for users intimidated by MFP/MacroFactor. |
| **Cronometer** | Clinical-grade micronutrient tracking, 10M+ | Owns the "I want every micronutrient tracked" persona. |
| **MacroFactor** | Adaptive macro coaching, 1M+ | "Math has the moment" pattern — paid coaching wrapped in adaptive expenditure. |
| **Cal AI** | AI photo-log first product | Growth built on free taste-of-AI before paywall. Photo accuracy is their moat. |
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
| Cal AI | Photo a plate, see macros fast | **Match on gateway + macro tracker behind it (their gap)** |
| MacroFactor | Adaptive TDEE has a visible moment | **Match the moment, not the math.** Need years-deep algorithm credibility we don't have yet |
| Paprika | Recipe servings 4→2 scales ingredients + steps | **Match cross-platform** via PR #72 + #84 stepper |
| MyFitnessPal | Find staple food, keep history | **Partial.** CSV import + add-custom-food fallback land. Catalogue still trails. |
| Recime | Discover feels populated | **Partial.** 50 recipes / 5 clusters crosses "looks real" threshold; fails second-search test (keto Indian, low-FODMAP) |
| Honeydew | Household real-time | **Skipped per N=1 rule** (correct call) |

**Match-or-beat on persona-blocking moment: 4/6.**

## Where Suppr leads (positioning, not feature)

Only product where weekly TDEE recompute + photo-log free taster + recipe servings scaling + Discover + macro tracker all coexist with no ads and no barcode paywall. **That's the "integration of the loop" lead.**

## Single biggest residual gap

**Trust in the nutrition number.** Cal AI fakes confidence. MFP outsources to user-generated chaos. MacroFactor sidesteps with the algorithm. Suppr is the only product *showing* uncertainty (the 4-segment confidence meter) — but hasn't yet earned the right to be trusted on accuracy at scale.

Closing this means:
- Visible match-source attribution on every logged item
- A "why this number" users actually open
- A feedback loop where corrections improve future matches

Without this, every other feature is decoration.

## Operational rule

**When evaluating a new feature, ask "does this catch an MFP refugee in their first 90 seconds?" before any other competitor parity question.** Other parity is secondary while the exodus is active.

## Reference docs

- `docs/competitor-intelligence-report.md` — full April 2026 landscape report
- `docs/competitor_feature_catalog_scout.md` — feature-level catalogue
- `docs/competitor_feature_catalog_sentiment.md` — user-sentiment catalogue
- `docs/audits/2026-05-03-48hr-activity-report.md` — what shipped in the 2026-05-03 sprint
- `docs/audits/2026-04-27-competition-bar-multicategory.md` — the multicategory competition framing this supersedes for near-term use
