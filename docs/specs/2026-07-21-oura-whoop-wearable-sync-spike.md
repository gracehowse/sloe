# Discovery doc: Oura / Whoop direct wearable sync spike (ENG-1636)

**Date:** 2026-07-21
**Owner:** Engineering (research only at this stage)
**Status:** Discovery complete — deferred until a demand trigger fires
**Effort estimate (full execution):** M–L (aggregator path: ~1–2 weeks single engineer; direct-dual-provider path: ~3–4 weeks, plus provider approval latency outside engineering control)
**Recommendation:** **DEFER / conditional GO.** When a trigger fires, build against a wearable-data aggregator (Vital), not direct Oura + Whoop integrations.

---

## TL;DR

Suppr's Apple Health (HealthKit) integration is not a substitute for direct Oura/Whoop sync, even for iOS users who already have HealthKit permission granted. Both platforms **deliberately withhold their proprietary composite scores from HealthKit**:

- **Whoop** writes resting HR, HRV, SpO2, respiratory rate, and per-workout Strain to HealthKit — but the **Recovery Score and daily Strain Score never reach Apple Health**. Whoop's algorithm output has no standardized HealthKit type to land in.
- **Oura** writes sleep, HR, steps, active energy, respiratory rate, workouts, and mindful minutes — but the **Readiness Score stays Oura-app-only**. The underlying HRV/RHR is present, but Suppr would have to approximate the score, not read the real one.

So there are three distinct affected groups, not one:

1. **Android users** — no Apple Health exists at all. Already tracked separately: `docs/specs/2026-04-27-b6-google-fit-health-connect-spike.md` (ENG-202, Post-iOS platform project). This doc does not re-litigate that spike.
2. **iOS users who never grant Suppr the HealthKit permission.**
3. **Every Oura/Whoop user, regardless of platform, for recovery/readiness/strain specifically** — unreachable by any amount of Apple Health or Health Connect work. Only a direct relationship with Oura/Whoop closes this gap.

Group 3 is the reason this is its own spike rather than a line item on the Android doc: it's a platform-agnostic data gap, not a platform-parity gap.

**Confidence: 7/10.** The API facts (data availability, OAuth, rate limits, approval friction) are verified against each provider's current developer docs. The aggregator-vs-direct recommendation is a judgment call that would flip with information Grace has and I don't (see "Open decisions" below).

## Current Suppr shape (verified 2026-07-21)

- No existing code references Oura, Whoop, Fitbit, or Garmin outside of competitor-research and UX-benchmarking docs (`docs/competitor_feature_catalog_scout.md`, `docs/product-roadmap.md`, design-review docs citing Oura's Today-tab layout or Whoop's Life Score as UX references). Zero data-integration code exists.
- No Linear ticket existed for this before ENG-1636 — confirmed via search across "Oura," "Whoop," and "wearable."
- The existing iOS HealthKit adapter (`apps/mobile/lib/healthSync.ts`) and the planned Android adapter (`apps/mobile/lib/healthSync.android.ts`, per ENG-202) are both **OS-health-platform** adapters: permission-based, not OAuth-based. A wearable-partner integration is architecturally a different thing — token-based, provider-hosted consent, webhook- or poll-driven — and should not be squeezed into that adapter shape (see "Adapter boundary" below).
- `apps/mobile/app/health-sync.tsx` is the existing Settings surface for the Apple Health card; the natural UI home for a future "Connect Oura" / "Connect Whoop" card is alongside it, not a new screen.

## Data availability by path

| Data | Apple Health (HealthKit) | Direct Oura/Whoop API |
|---|---|---|
| Sleep stages, duration | Yes (from Oura) | Yes |
| Resting HR, HRV, SpO2, respiratory rate | Yes | Yes |
| Workouts (type, duration, calories) | Yes | Yes |
| **Whoop Recovery Score** | **No** | Yes |
| **Whoop Strain Score** (daily) | **No** (per-workout strain value does sync) | Yes |
| **Oura Readiness Score** | **No** | Yes |
| Oura Sleep Score | No | Yes |
| Body measurements (Whoop) | Partial | Yes |

The bolded rows are the entire reason this spike exists. Everything else is already covered by the existing HealthKit path (and will be covered on Android by ENG-202 when that ships).

## Path A: Direct partner APIs (Oura Cloud API v2, Whoop Developer Platform v2)

Both are OAuth2, both have real friction before reaching real users beyond a handful of testers:

| | Oura API v2 | Whoop API v2 |
|---|---|---|
| Auth | OAuth2 (personal access tokens deprecated Dec 2025 — new integrations must use OAuth2) | OAuth2, authorization-code flow |
| Scopes | `personal`, `daily` (readiness + activity), `heartrate`, `workout`, `session`, `spo2`, `ring_configuration` | Scopes as constants (`READ_SLEEP`, `READ_CYCLES`, `READ_WORKOUT`, `READ_RECOVERY`, etc.) |
| Dev-tier cap | **10 users**, unlimited after Oura approves the app | **10 users**, unlimited after Whoop approves the app |
| Approval process | Application review, no fixed cadence documented | **Monthly review cadence** — "can take several weeks," requires brand-guideline-compliant screens submitted via the Developer Dashboard |
| Rate limit | 5,000 requests / 5 minutes, enforced per-token **and** per-application | Tiered rate limiting; standard `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers |
| Delivery | Webhooks recommended (polling discouraged; sync lag up to several hours without them) | Webhooks (v2 keyed by sleep UUID, not cycle ID — v1 webhooks are fully retired) |
| Consent | Per-data-type user consent required at connect time | Per-scope consent shown to the member at OAuth time |

Cost: no platform fee for either — but two providers means two OAuth flows, two webhook handlers, two token-refresh paths, and two schemas that drift independently forever. Neither company's proprietary-score algorithm is contractually stable; expect field/shape changes without much notice.

## Path B: Wearable aggregator (Terra, Vital, Rook)

One API surface normalizes Oura, Whoop, Garmin, Fitbit, Polar, and others behind a single OAuth/webhook contract:

| | Vital | Terra |
|---|---|---|
| Pricing | $0.50/user/month, $300/mo minimum → **$3,600/yr floor** (covers ~600 users before marginal cost) | $399–499/mo base (100k credits) → **~$4,800–10,800/yr** at 500–1,000 active users, tiered overage beyond |
| Coverage | Oura, Whoop, Garmin, Fitbit, Polar, and more | Oura, Whoop, Garmin, Fitbit, Polar, Apple, Eight Sleep, Withings, Peloton, Freestyle Libre, and more |
| What it removes from Suppr's plate | OAuth hosting, webhook normalization, token refresh, per-provider schema drift | Same |
| What it adds | A subprocessor touching health data (privacy policy / DPA implication), a recurring platform cost, vendor dependency | Same |

Both aggregators cover Garmin/Fitbit/Polar too — relevant because the existing UX-research backlog (ENG-937) already frames "Whoop **and** Oura both anchor retention" as a category pattern, not an Oura/Whoop-specific one. An aggregator doesn't just solve this spike; it removes the marginal cost of adding a third or fourth wearable later.

## Recommendation and reasoning

**Build against Vital, not direct Oura + Whoop integrations, when triggered.**

- Two direct integrations is a solo-founder-scale maintenance tail with no natural ceiling: every future wearable brand is a from-scratch OAuth + webhook build. An aggregator is a one-time integration cost regardless of how many providers get added later.
- The dev-tier 10-user cap plus Whoop's monthly, multi-week approval cadence means a **direct** build can't reach a real beta cohort without weeks of calendar lead time baked in before any product code ships. That risk sits with the aggregator vendor instead.
- $3,600/yr (Vital's floor) is small next to the engineering time saved, and it absorbs schema/algorithm churn on Oura's/Whoop's side, which happens often for proprietary scores specifically.
- The recurring cost is the honest tradeoff, and it's the one place this recommendation could flip: if Grace has current MRR/user-count data that makes the per-user aggregator fee material, or if adding a third-party subprocessor for health data is a hard legal no rather than a preference, direct-build becomes the better call. I don't have either input — flagging it rather than deciding it.

## Trigger to re-evaluate

Do not build either path until one of these fires (same discipline as ENG-202):

- App Store reviews or support tickets naming Oura or Whoop cross a real threshold (e.g. ~10% of a sampled window), or
- A specific, validated use case makes the aggregator cost floor worth it for the user base at the time.

No trigger has fired as of this writing. This is speculative scope, flagged so it isn't silently lost, not a build-now recommendation.

## Adapter boundary recommendation (for when this is built)

**A new `apps/mobile/lib/wearableSync.ts` (or per-aggregator-SDK equivalent), not a branch inside `healthSync.ts` or `healthSync.android.ts`.**

Why: OS health platforms (HealthKit, Health Connect) are permission-based and platform-suffixed by design. A wearable-partner integration is OAuth-token-based, provider-hosted-consent-based, and platform-agnostic (the same Oura/Whoop connection works whether the user is on iOS or Android). Squeezing it into the OS-adapter shape would force platform branching into logic that has nothing to do with the OS.

Shared surface it should still respect:
- Write into the same `profiles.*_by_day` maps and a new `readiness`/`recovery` field set — Today/Progress should not fork per data source.
- Reuse the existing Settings pattern (`apps/mobile/app/health-sync.tsx`, `AppleHealthCard.tsx`) for a sibling "Connect Oura" / "Connect Whoop" card rather than a new screen.

## UX + product checklist for the future implementation ticket

- Settings card(s) alongside the existing Apple Health card, each opening the aggregator's hosted OAuth/consent screen.
- Decide whether recovery/readiness data feeds into an existing surface (e.g. an activity-bonus or coaching nudge) or is purely informational — this is a product-lead call, not an engineering one, and shouldn't be pre-decided here.
- Sync-status / last-synced UI matching the existing Health Sync diagnostic pattern.
- Feature-flagged rollout per the visual/structural-change rule (`.claude/CLAUDE.md` Feature flags section) once this reaches UI.

### Revenue / tier gating

**Not decided here.** HealthKit *writes* are Pro-gated; this integration is read-only (neither Oura nor Whoop accepts nutrition writes back from a third-party app), so the existing write-gating precedent doesn't directly apply. Whether reads are free or Pro-gated needs a monetisation-architect pass before shipping.

### Legal / trust

- Aggregator path: privacy policy + DPA update naming the aggregator as a subprocessor (legal-reviewer sign-off required per the non-negotiable trust-surface rule).
- Direct path: no new subprocessor, but still requires a privacy policy update naming Oura/Whoop as data sources and describing what's read.

## Risks / pressure test

- **Approval-latency risk (direct path only):** Whoop's monthly review cadence plus multi-week turnaround means a direct build can silently slip a quarter waiting on a third party. Mitigation: aggregator path avoids this entirely, since the aggregator already holds approved integrations with each provider.
- **Proprietary-metric drift risk:** Recovery/Readiness/Strain are unstable, vendor-controlled algorithms with no schema contract. Mitigation: treat these as display-only, opaque numbers Suppr passes through — do not derive Suppr-side logic (e.g. calorie-target adjustments) from them without an explicit product decision, and re-verify field shapes on any provider API-version bump.
- **Vendor dependency risk (aggregator path):** Suppr's wearable data becomes dependent on Vital's uptime and pricing stability. Mitigation: keep the adapter's public interface aggregator-agnostic (mirroring the `healthSync.ts` / `healthSync.android.ts` shared-surface pattern) so swapping aggregators later is an implementation detail, not a rewrite.
- **Cost-scaling risk (aggregator path):** per-user fee could become material at scale in a way a one-time direct build wouldn't. Mitigation: this is exactly the input Grace should weigh before greenlighting — flagged under "Open decisions," not resolved here.
- **Silent-deferral risk:** this entire spike could be forgotten the way the pre-ENG-1432 nutrition gaps were. Mitigation: ENG-1636 in the new **Deferred work backlog** project, with an explicit trigger condition, is the fix.

## Open decisions for Grace (not resolved in this doc)

1. Aggregator (Vital) vs. direct Oura + Whoop build — flips on cost-per-user data or a hard subprocessor constraint I don't have visibility into.
2. Free vs. Pro-gated reads.
3. Whether recovery/readiness data should ever feed Suppr-side logic (calorie targets, coaching nudges) or stay purely display — a product call, not an engineering one.

## Sources checked

- Suppr code: `apps/mobile/lib/healthSync.ts`, `apps/mobile/app/health-sync.tsx`, `apps/mobile/components/AppleHealthCard.tsx`, repo-wide grep for `oura|whoop|fitbit|garmin`.
- `docs/specs/2026-04-27-b6-google-fit-health-connect-spike.md` (ENG-202) — Android-platform parity, not re-litigated here.
- Oura API Documentation (2.0): https://cloud.ouraring.com/v2/docs
- Oura API error handling / rate limiting: https://developer.ouraring.com/docs/oura-api-error-handling
- Oura API member-care overview: https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API
- Oura Apple Health integration: https://support.ouraring.com/hc/en-us/articles/360025438734-Apple-Health-Integration
- WHOOP Developer Platform: https://developer.whoop.com/docs/introduction/
- WHOOP App Approval: https://developer.whoop.com/docs/developing/app-approval/
- WHOOP API Rate Limiting: https://developer.whoop.com/docs/developing/rate-limiting/
- WHOOP v1→v2 migration guide: https://developer.whoop.com/docs/developing/v1-v2-migration/
- WHOOP Apple Health integration support article: https://support.whoop.com/hc/en-us/articles/4413142119195-Apple-Health-Integration
- Terra API pricing/integrations: https://tryterra.co/integrations, "The Real Cost of Wearables Integration in 2025: Build vs Buy Analysis" (themomentum.ai)
- Vital API pricing (per-user model, cited via build-vs-buy comparison above)
- Linear: ENG-937 ("Whoop and Oura both anchor retention" — category-pattern framing), confirmed no prior Oura/Whoop/wearable ticket existed before ENG-1636.

## What this discovery deliberately does NOT cover

- Android/Health Connect parity — separate scope, already covered by ENG-202.
- Garmin, Fitbit, Polar, or other wearables specifically — the aggregator recommendation happens to cover them if this is ever extended, but this doc doesn't scope that work.
- Any UI design for the recovery/readiness surface — deferred to a product/design pass if and when this is triggered.
- A final aggregator-vendor selection — Vital is the lean based on pricing transparency and floor cost; a real vendor bake-off (including Rook) belongs in the implementation ticket, not this spike.
