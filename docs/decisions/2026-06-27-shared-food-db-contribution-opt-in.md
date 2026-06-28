# Shared food database — barcode "not-found" contribution opt-in

- **Date:** 2026-06-27
- **Area:** Product / Privacy / Barcode
- **Status:** Resolved (decisions ratified); feature implementation in progress (ENG-1247)
- **Decider:** Grace
- **Inputs:** ENG-1247 v3 conformance (audit: barcode not-found → "collapse to one route + community success card"); legal-reviewer agent review (2026-06-27); live-DB RLS verification.

## Context

The v3 prototype / audit proposed collapsing the barcode **not-found** flow to one
canonical route with a community-benefit success card ("saved for you and
everyone after you"). Before wiring that copy, we verified the actual backing.

### Finding (verified against the live DB)

- The not-found **"Enter manually"** path (`handleManualLog`,
  `apps/mobile/app/(tabs)/barcode.tsx`) writes **only** to the user's private
  `nutrition_entries` + HealthKit. It is a **private journal log** — it never
  touches a shared store.
- The shared food DB (`user_foods` → `verified_food_canonical`) is fed **only**
  by the found-product **correction** path (`submitFoodCorrection`,
  `apps/mobile/lib/verifyRecipe.ts:1742`), which upserts to `user_foods` as
  `pending`.
- Live RLS SELECT on `user_foods`:
  `(verification_status = 'verified') OR (submitted_by = auth.uid())`. So a fresh
  submission is readable **only by its submitter** until consensus promotes it to
  `verified` / a canonical row (the `recompute_verified_food_canonical` machinery
  in `supabase/migrations/20260512100000_user_foods_p0_hardening.sql`).

**Therefore the prototype's "everyone after you" copy is false for the not-found
path today** — that path is exactly the "private custom-food" case. Making the
community claim true requires *adding* a contribution write to that path.

## Decisions (Grace)

1. **Opt-in community share** (not "keep private", not "auto-share"). After the
   private manual log, offer an **explicit, default-OFF affirmative opt-in** that
   submits the entry to `user_foods` via `submitFoodCorrection`. The
   community-benefit success card shows **only** on the opt-in path; the private
   path stays "Logged to your tracker".
2. **Contribution age: 16+.** Contributing to the public dataset requires the
   user to be 16 or older, stated in the privacy policy + terms; no birthdate
   collection (rely on the stated threshold). Formal counsel confirms before
   launch broadens. (Private logging has no such restriction.)

## Approved copy (legal-reviewed, paste verbatim)

**Opt-in prompt** — headline: "Add this to Sloe's shared food database?";
sub-line: "Optional. The name and nutrition you just entered would be shared so
other people who scan this barcode can use it too — once it's confirmed. Nothing
else from your account is shared."; buttons: **Share it** / **Keep it private**;
plus a "How this is used" link → `/privacy#community-food-database`.

**Success card (opt-in path only)** — headline: "Saved — thank you"; body: "It'll
show up straight away on your next scan of this barcode. Once a couple of people
confirm the same numbers, it becomes the entry everyone sees when they scan it.
You can remove your version any time from your saved items."

If the plausibility gate (`src/lib/foodCorrection/plausibility.ts`) returns
`block`, do **not** show the success card — surface the inline "numbers look off"
reasons instead.

## Legal posture (from the legal-reviewer; verdict BLOCK-until-P0s)

- **P0-A — Privacy disclosure.** ✅ Done in this change: added a "Community food
  database" section + Legal-basis line to `app/privacy/page.tsx`
  (`#community-food-database`), so the consent link points somewhere honest.
  Re-review by the legal lens after this lands converts BLOCK → PASS.
- **P0-B — Contribution age.** ✅ Decided: 16+ (above).
- **P0-C — Discrete affirmative tap, default OFF, never bundled into "Log".**
  Implementation requirement for the feature (next change), flag-gated.
- **P1 fast-follows (tracked, not ship-blocking):** consent-audit record
  (`contributed_via`/`consent_at` or an analytics event); erasure-from-canonical
  completeness (deleting the last source row must re-source/drop the canonical);
  provenance-chip honesty on the *read* side (a `pending` community value must
  never render a "Verified" chip); web/mobile parity in the same feature change.

## Status — implemented on both platforms (flag OFF)

- Privacy disclosure (P0-A) + this decision record: shipped `085ae726`.
- Mobile opt-in (`apps/mobile/components/barcode/BarcodeShareOptIn.tsx` +
  `barcode.tsx`): shipped `b618950d`, sim-verified.
- Web opt-in (web `submitFoodCorrection` + `BarcodeShareOptIn` +
  `ShareCommunityDialog` + NutritionTracker wiring): shipped `949da69c`,
  pixel-verified. The web write is net-new and mirrors mobile (shared
  plausibility, RLS-scoped `user_foods` upsert, pending-until-verified).
- The feature is gated by `barcode_community_contribution`, default OFF on both.

## Legal re-review — PASS, clear to ramp (2026-06-28)

The legal lens re-reviewed all three P0s end-to-end and **lifted the BLOCK →
PASS**: P0-A/B/C satisfied; the plausibility gate confirmed as one genuinely
shared module (`metro.config` aliases `@suppr/shared` → `src/lib`); the RLS DELETE
policy (`20260425100000…`) backs the "remove your version" promise at the row
level. Two notes carried forward:

- **MUST-FIX BEFORE RAMP (consent integrity):** the "remove any time from your
  **saved items**" line (mobile + web success cards + the privacy section) must
  point at a *reachable* surface where the user can find and delete their own
  `user_foods` contribution. Either confirm "saved items" is that surface, rename
  the copy to the real one, or add a "Remove this contribution" affordance on the
  submitter's own provenance chip. **Do not ramp the flag until one is true and
  the copy matches.** Tracked as a Linear must-fix under ENG-1247.
- **Doc note:** `user_foods.submitted_by … on delete set null` (base migration)
  intentionally leaves any promoted `verified_food_canonical` value intact-but-
  orphaned on account deletion — by design, not a leak.

**Fast-follows (post-ramp, Linear):** P1-A consent-audit record · P1-B
erasure-from-canonical completeness (the promoted-value retraction case) · P1-C
provenance-chip precision (a `pending` own-row should read "not yet confirmed",
never "Verified").
