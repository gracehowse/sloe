# Decision log: FatSecret licence page sweep — already done (P1-18, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — was already shipped before P1-18 surveyed it
**Trigger:** P1 #18 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit said the licence page still claimed a "commercial licence" for FatSecret post the 2026-04-25 [Basic-tier confirmation](./2026-04-25-fatsecret-tier-confirmation.md). Sweep needed before launch.

---

## Decision

**No code change required.** The licence page (`app/licences/page.tsx:39`) already reads `"FatSecret Platform terms (Basic developer tier — non-caching)"` — corrected in commit `072cb31` (T19 Path B, 2026-04-25). The audit's claim that the page still said "commercial licence" was stale.

The only remaining `commercial licence` string on the page is for **Edamam** (line 38), which is genuinely correct — Edamam ships under their commercial licence per their pricing tier and our usage.

## Rationale

This is an audit correction rather than a code change. P1-18 is closed because:

1. The user-facing wording on `/licences` is already accurate per the Basic-tier confirmation.
2. The data cleanup migration `20260503100900_fatsecret_basic_tier_zeroing.sql` was applied to the linked Supabase project on 2026-04-25 per Grace's `supabase db push --linked` confirmation; cached FatSecret macros are zeroed on existing rows.
3. The runtime guard (`fatsecretCacheGuard.ts`) scrubs at ingest so future inserts don't violate the Basic-tier ToS.
4. The runtime re-fetch on recipe-detail load (when `fatsecret_food_id IS NOT NULL && is_verified=false`) re-resolves macros at request time — compliant.

All four pieces of the T19 / [Basic-tier confirmation](./2026-04-25-fatsecret-tier-confirmation.md) plan are live.

## Audit correction

`docs/audits/2026-04-25-opus47-codebase-review.md` row T19 has been amended to reflect "fully shipped" status. The audit's stale wording has been replaced with the actual current state.

## Related artefacts

- [FatSecret tier confirmation (2026-04-25)](./2026-04-25-fatsecret-tier-confirmation.md) — the parent decision
- [`app/licences/page.tsx:39`](../../app/licences/page.tsx) — the user-facing wording
- [`src/lib/nutrition/fatsecretCacheGuard.ts`](../../src/lib/nutrition/fatsecretCacheGuard.ts) — runtime scrubber
- [`src/lib/fatsecret/client.ts`](../../src/lib/fatsecret/client.ts) — `scope: "basic"` request (correct for the tier)
- [`supabase/migrations/20260503100900_fatsecret_basic_tier_zeroing.sql`](../../supabase/migrations/20260503100900_fatsecret_basic_tier_zeroing.sql) — applied
- [Opus 4.7 codebase review §1 T19 row](../audits/2026-04-25-opus47-codebase-review.md) — corrected

## Revisit when

- Grace upgrades to FatSecret Premier — flip `scope` to `"premier"` in the OAuth client, re-allow caching in code, update the licence-page wording to "FatSecret Platform terms (Premier developer tier — caching permitted)".
- A new third-party data source ships — add a row to the licence table, confirm tier wording matches the actual contract.
- FatSecret changes their tier names — update the licence-page wording in lockstep.
