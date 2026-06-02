# Julienne deep-dive — lessons learned

**Date:** 2026-06-02
**Source:** `user-sentiment` + `competitor-intelligence` specialist deep-dive on **Julienne** ("A Smarter Cookbook", Afternoon Labs / @regyperlera)
**Status:** Resolved — conclusions ratified into positioning + roadmap
**Related:** [competitive-principles.md](competitive-principles.md) · [competitor-intelligence-report.md](competitor-intelligence-report.md) · [growth/tiktok-instagram-viral-plan.md](growth/tiktok-instagram-viral-plan.md) · Linear ENG-851 / GROW-20 / ENG-852

---

## TL;DR

Julienne is **product-quality with no distribution and no retention hook**. It is the cleanest available proof that *aesthetics + AI import is not a business* in the recipe-saver category — those are now table-stakes, trivially matched. The one thing the category cannot copy without becoming a different product is exactly Suppr's wedge: a **reason to return** (the macro/goal/health layer) and a **reason to spread** (attributed Reel-import). This deep-dive **validates the whole strategy** rather than prompting a pivot.

---

## What we verified about Julienne

| Claim everyone repeats | What the deep-dive actually found |
|---|---|
| "4.8★ — clearly loved" | 4.8★ from only **~24 US ratings**. Friends-and-family scale, not reputation. The star-average is the trap; **the denominator is the story.** |
| "Polished, no complaints" | The *only* non-rave reviews both report **data loss on the core loop** — edits don't save, crash-on-import loses recipes. Fatal class of bug for a recipe keeper. |
| "Growing" | **iOS-only** (every Product Hunt request was Android). PH launch ~115 upvotes, **0 reviews.** Absent from the category's own "best recipe app" roundups. |
| "Has a brand" | **No growth loop, near-zero social.** Marketing ran through the founder's personal X; brand IG is small and posts about *the app*, not cook-able content. No creator angle, no attribution. |
| "Monetises well" | Sprawling price ladder ($2.99/$3.99 mo, $19.99/$29.99 yr, $59.99 lifetime) **pre-PMF**, and **cloud sync (data durability) is paywalled** — charging users not to lose their own data, while having data-loss bugs. Trust own-goal. |

**Diagnosis:** product quality without distribution *or* a retention hook. Recipe-savers are a crowded, structurally **low-retention** category — a library app gives no reason to open daily. Aesthetics and AI import are commoditised.

---

## Why it matters for Suppr — the strategy this validates

The recipe-saver category **can** copy our look and our import mechanic. It **cannot** copy, without becoming a different product:

1. **Reason to return → the macro/goal/health layer.** "Fit the foods you love into your goals." This turns a library (open occasionally) into a daily tracker (open every meal). See [positioning](#) — diet apps kill food joy; recipe apps ignore goals; Suppr is the bridge.
2. **Reason to spread → attributed Reel-import.** The "messy Reel → clean, macro-aware recipe card" before/after **is** the shareable content Julienne never packaged. The import isn't just a feature; it's the growth loop and the marketing asset in one.

These two are the uncopyable wedge. Everything else in the recipe-saver space is table-stakes.

---

## The avoid list (Julienne's mistakes, as guardrails for us)

1. **Never ship the core loop with persistence bugs.** Guard the log-meal / import-recipe persist path ruthlessly. Our persistence-path guardrails work already covers this — do not regress it. (See `feedback_persist_path_guardrails` memory.)
2. **Never paywall data durability.** Monetise coaching / goals / advanced import volume. Keep users' own data safe and synced for free. Charging to *not lose data* is a trust own-goal — especially with data-loss bugs in the wild.
3. **Never make marketing founder-account-dependent.** Build a content engine that ships cook-able / relatable output (the import before/afters), not posts *about* the app.
4. **Never trust a high star-average on a tiny base.** Always read the denominator. 4.8★/24 ≠ reputation.
5. **Never over-engineer pricing pre-PMF.** A clean Free + Pro model beats a sprawling ladder. (This is why the roadmap triage rejected ad placements — they conflict with the clean model.)

---

## Roadmap consequences (already actioned)

From the Julienne Q2-feature scan, triaged **as intel, not a to-do list** (commit `2691545c`, PR #373):

- **Adopted** (3 net-new fits → Phase D + Linear): recipe reviews, IG Stories share, collaborative collections.
- **Already shipped:** TikTok/Reel import — our lead viral hook.
- **Rejected — wrong geography:** Instacart grocery (US chains; we're UK/EU-first).
- **Rejected — model conflict:** ad placements (breaks the clean Free + Pro model).

Linear: **ENG-851**, **GROW-20**, **ENG-852**.

---

## Routing (who owns the follow-through)

- **feature-scout** — creator-attribution + the shareable import card.
- **growth-strategist** — attributed Reel-import *as the loop*, not just a feature.
- **brand-manager** — the "beautiful AND numerate" identity (Julienne is beautiful but not numerate; pure trackers are numerate but not beautiful).
- **legal-reviewer** — documented recipe-import posture (Julienne's shrewd move: take the facts, generate own images to sidestep photo copyright, attribute + link + disclaim). Memo with counsel, not in-repo.

---

## The one-line lesson

> A beautiful recipe app with AI import is a feature, not a company. The moat is the reason to come back (goals) and the reason to tell a friend (attributed import) — and those are exactly the two things the recipe-saver category can't copy without becoming Suppr.
