# Competitor teardown — cross-app summary (2026-06-08)

Single reference synthesising the code/UX teardowns of Julienne, MyFitnessPal, Yazio, Lifesum (+ live MFP probe). Method = reading public shipped web bundles + a logged-in MFP session. Per-app detail:
- `docs/research/2026-06-08-julienne-strengths.md` · `2026-06-08-julienne-nutrition-method.md` · `2026-06-07-julienne-image-system.md`
- `docs/research/2026-06-08-mfp-teardown.md` · `2026-06-08-yazio-teardown.md` · `2026-06-08-lifesum-teardown.md`

## The one-line read
**Every competitor has a real strength paired with a real flaw, and none has Suppr's full combination: real-DB nutrition accuracy + recipe-import + a goals/health retention layer + a viral loop.** The teardowns make the wedge concrete and hand us a prioritised borrow list.

## Strength × flaw, per app
| App | Real strength (verified) | Documented flaw (our opening) |
|---|---|---|
| **MyFitnessPal** | hundreds-of-millions real, **verified** food DB + server-side ranking; 21-entitlement premium engine; BFF architecture; **TrueMed HSA/FSA payments** | crowdsourced → duplicates/wrong entries + **Mar-2024 data-corruption incident**; ads; **barcode paywalled**; dated SSR; no recipe-import/viral loop |
| **Julienne** | **best-in-class import**: 2-stage architecture (per-platform adapter → normalise → single extraction), **bulk queue + 6-stage progress UX**, step-centric data model | crude **hardcoded** nutrition (cottage-cheese→cheese bug); **no goals/retention layer**; loud **data-loss + crash-on-import** complaints; client-side Whisper token leak |
| **Yazio** | goal-branched **paid-acquisition onboarding funnel** w/ GLP-1 branch + **explicit competitor-switch capture** (`app_choice.{mfp,loseit,...}`); Stripe+Braintree dual-rail | growth is expensive paid acq (no viral loop); EU-skewed/duplicate DB + paywalled, user-flagged-inaccurate AI photo log; **barcode behind PRO**; leaks `oauthClientSecret` to browser |
| **Lifesum** | warm-coaching skin (60M users); **Life Score** (health-not-just-calories) | mobile-only (no web product); aggregated DB + buggy 2025 multimodal AI (cashews→shrimp); **punitive free tier, no real trial**; no recipe-import/viral loop |

## BORROW — prioritised
1. **Julienne's staged-progress + queue import UX** *(highest leverage, pure front-end)*. A `RecipeImportScheduler` with slot concurrency + live queue position + a persistent drawer (cancel/retry) + a human-readable state machine (`confirming → extracting → organizing → generating`). Fixes the 30–60s dead-air on Suppr's **lead viral hook**. Extends existing `recipeImportPipelineTrace.ts` + `importErrorCopy.ts`.
2. **Julienne's 2-stage import architecture** — per-platform *acquisition* adapter → normalise to one `scrapedData` shape → **single** server extraction call (the LLM never sees a URL; new source = new adapter). Plus **pre-flight quality gates** (refuse an LLM call on thin content, with a teaching error). Evaluate **Supadata** (their scrape+transcript vendor) vs our own scraping — a real build-vs-buy call.
3. **Step-centric recipe schema** — ingredients live *inside* each step `{name,quantity,unit}`; flat list derived. Enables inline amount-chips in cook mode + pantry-aware shopping (have vs missing) + allergen→substitution + AI per-step tips.
4. **Yazio's onboarding funnel concept** — goal-branched AI-plan reveal + a GLP-1 on-ramp + **competitor-switch capture** → wire "coming from MFP?" straight into our CSV import (we already have the adapter framework).
5. **MFP's BFF + entitlements pattern + full micro data-model**, and **TrueMed HSA/FSA** payments (a US pre-tax-dollars conversion lever) → route to `monetisation-architect`.
6. **Lifesum's Life Score** — a weekly "health, not just calories" number that reinforces the "love food AND have goals" positioning (keep ours **always-on**, unlike Lifesum which disables it on meal plans).

## BEAT — already ours, lean in
- **Nutrition accuracy.** Real multi-source DB + scored confidence + 0.55 accept floor + Atwater plausibility + count-to-weight. Beats Julienne's substring table, MFP's crowdsourced duplicates, Yazio/Lifesum's aggregated+buggy AI. The cottage-cheese demo is screenshot-able proof.
- **The recipe-import → goals viral loop.** Julienne imports but has no goals/retention; the trackers have goals but barely import. Only Suppr does both → reason to spread *and* return.
- **Honest AI-image provenance** (visible label) vs Julienne's silent SynthID gen — a launch-defensible EU-AI-Act posture.
- **No ads; don't paywall barcode/import.** MFP/Yazio/Lifesum all gate the basics — the loudest MFP-refugee complaint and our acquisition opening.

## DON'T COPY (anti-patterns seen)
- Julienne: client-side Whisper **bearer token in the bundle**; hardcoded nutrition; no durability (data-loss/crash).
- Yazio: **`oauthClientSecret` shipped to the browser**.
- MFP: ads; barcode paywall; crowdsourced data-quality drift.

## DEFENSIVE — they can do this to us
The Yazio teardown read their (encrypted) flag payload; the MFP teardown read 126 BFF routes + entitlements. **We leak the same way** — route our PostHog flags/experiments through a **first-party proxy** and keep secrets server-side so a competitor can't trivially map our roadmap + gates. (Suppr already keeps model calls server-side — good — but check flag/experiment-name exposure.)

## Ticketable (proposed, not yet filed)
Import-progress staged UX + queue · step-centric recipe schema · MFP→CSV competitor-switch capture · evaluate Supadata (build-vs-buy) · TrueMed HSA/FSA (US) · Life-Score-style weekly health number · first-party flag proxy (defensive). → confirm with Grace, then `planner`/Linear.
