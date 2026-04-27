# Decision log: launch checklist + App Store listing scaffold (P1-16, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P1 #16 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit asked for `docs/launch/checklist.md` (pre-deploy → deploy → post-deploy → marketing → legal → monitoring) and `docs/launch/app-store-listing.md` (subtitle → description → keywords → screenshots → privacy labels → rationale).

---

## Decision

Two new docs in a fresh `docs/launch/` directory:

1. **`docs/launch/checklist.md`** — operational sequence from "code complete" to "TestFlight cohort live" to "App Store / web public launch." Three phases (pre-cohort / pre-public / post-launch) plus pre-deploy + deployment + rollback flows. Every row links to the underlying decision doc, runbook, or audit artefact, and the Phase 2 row count maps 1:1 to the legal-finalization runbook + the open ops items.
2. **`docs/launch/app-store-listing.md`** — every field App Store Connect requires, with a draft, the rationale, and the constraint. Includes the four positioning angles for the subtitle (and recommends the "Honesty" angle since that's the audit's identified moat), a six-screenshot sequence keyed to Suppr's competitive principles, the privacy nutrition label table, IAP product IDs matched to the existing Stripe + RC config, and the App Review demo account spec.

Both docs are live artefacts — Grace edits in line as items close, they re-render in the prelaunch checklist's "outstanding" list.

The actual marketing copy in `app-store-listing.md` is scaffold + draft; Grace owns the final positioning. The structural fields (bundle ID, screenshot specs, privacy label categories, IAP product IDs) are written from the canonical source of truth in `apps/mobile/app.json`, the Stripe price envs, the RC offering config, and the audit's competitive principles — those don't need Grace's input to be correct.

## Rationale

The audit gave structure ("write a checklist"); the value-add is the cross-references. Each row in the checklist points at the decision doc, runbook, or audit section that defines what "done" looks like. When Grace's at "should I submit to App Store today?", the answer is "did all 25 Phase 2 rows go green per their own definition." No interpretation, no judgment call about completeness — explicit gates with explicit references.

The App Store listing scaffold is similarly mechanical. The hard part of an App Store submission isn't the prose; it's missing one of the eight categories under App Privacy or one of the four IAP products and getting rejected after a 72-hour review wait. The scaffold makes "missing field" the immediate-visual error mode.

## Alternatives considered

- **Single-doc launch checklist that includes the App Store listing inline.** Rejected. The two docs serve different audiences — the checklist is operational (Grace + claude pairing); the App Store listing is reviewable copy with a different lifecycle (editable post-launch, has its own promotional-text update cycle). Splitting matches reality.
- **Auto-generate the checklist from the punch list in the audit.** Rejected. The audit's P0/P1/P2 are correctness items; the launch checklist is the operational subset including ops, marketing, and review steps that aren't in the audit. They overlap but aren't identical.
- **Defer the App Store listing scaffold until entity decision is made.** Rejected. Most fields (bundle ID, screenshot specs, privacy label, IAP products) don't depend on the entity. The two fields that do (description team plurality, pricing values) are clearly marked as drafts.

## Implementation

- `docs/launch/checklist.md` — new. Three phases (pre-cohort 8 rows, pre-public 17 rows, post-launch 6 rows) + pre-deployment, deployment-flow (web + mobile), post-deployment confirmation, rollback flow, "when to re-open" trigger.
- `docs/launch/app-store-listing.md` — new. App identity table, 4 subtitle drafts, promotional text draft, full description outline, keywords, screenshot sequence, privacy nutrition label, IAP product IDs, App Review information, localization plan, submission flow, pre-submission checklist.
- New `docs/launch/` directory.

No code changes; pure documentation deliverable.

## Platforms affected

- **Ops (Grace):** new launch artefacts. The Phase 2 row #19 ("App Store listing assets shipped") is now a real ticket with clear scope.
- **Web / Mobile / Supabase:** none.

## Verification

- Cross-referenced every row in `checklist.md` to ensure the linked artefact exists and isn't broken (legal-finalization-runbook, RC webhook runbook, observability doc, audit punch list — all present).
- IAP product IDs in `app-store-listing.md` match the `STRIPE_PRICE_*` env names from `.env.example` and the RC offering naming convention.
- Screenshot sequence aligns with the six "Pillars" in `docs/competitive-principles.md`.

## Related artefacts

- [Launch checklist](../launch/checklist.md)
- [App Store listing](../launch/app-store-listing.md)
- [Opus 4.7 codebase review](../audits/2026-04-25-opus47-codebase-review.md)
- [Legal finalization runbook (P1-15)](../operations/legal-finalization-runbook.md)
- [RevenueCat webhook ops runbook (P0-7)](../operations/revenuecat-webhook-runbook.md)
- [observability.md](../observability.md)
- [competitive-principles.md](../competitive-principles.md)

## Revisit when

- App Store Connect changes a required field (e.g. new privacy category) — update the listing doc.
- A new launch phase becomes relevant (e.g. Android Play Store with separate review surface) — fork the checklist.
- The Phase 2 row count reaches zero — archive Phase 1 + 2, leave Phase 3 + repeat-runs sections live.
