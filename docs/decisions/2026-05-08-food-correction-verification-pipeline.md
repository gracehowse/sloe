# Food correction + verification pipeline — design

**Date:** 2026-05-08
**Status:** Tentative — proposal awaiting Grace's ratification on scope/sequencing
**Area:** Product / Data / Trust
**Trigger:** Grace's F-138 follow-up — "we have to be clearly building out our own database so we aren't 100% reliant on other APIs. We should probably have some sort of method of verifying uploads (although as a team of 1 I can't verify everything — look into that)"

---

## Why now

We have **three live problems** that this proposal addresses together:

1. **F-138 (UX)** — When a user taps "Save Correction" on the barcode product sheet, the form silently closes. No confirmation. Tester said it felt like nothing happened.
2. **Strategic (data)** — Today we are 100% reliant on Open Food Facts for branded barcode lookups. OFF data quality varies wildly by region. Rate-limited. We have to be building our own DB to stop that being a single point of failure.
3. **Trust (legal/UX)** — The pre-fix Correct-Product subtitle said "your correction helps everyone." That is technically not yet true: there is no review pipeline producing `verified` rows. Shipping that copy without the workflow is overpromising.

## Current state — what exists, what doesn't

**What exists in the schema (already in prod):**
- `user_foods` table with `verification_status` (pending/verified/rejected), `verified_by`, `verified_at`, `upvotes`, `downvotes`, `source`, `brand`, `category`, `image_url`, full micros (sugar, sodium, saturated fat) — migrations `20260414180000_create_user_foods_table.sql`, `20260414200001_user_foods_verification.sql`, `20260430100000_user_foods_micros.sql`
- `user_food_votes` table with full RLS for vote tracking
- `lookupBarcode` (in `apps/mobile/lib/verifyRecipe.ts:1463`) reads `user_foods` first, prefers `verified` > top-upvoted > most recent, falls back to OFF

**What's missing (the gap to "real verified DB"):**

| Gap | Severity | Source |
|---|---|---|
| No automated nutrition-plausibility check at submit time | P0 | nutrition-engine spec |
| RLS lets any user read any other user's `pending` row → vandalism + bad data leak | P0 | data-integrity |
| `lookupBarcode` lex-sorts `verification_status` (pending < rejected < verified) — wrong direction; rejected rows can leak through | P0 | data-integrity |
| Owner can self-promote pending → verified via UPDATE (no admin gate on state transitions) | P0 | data-integrity |
| Upsert preserves `verified` status even when macros change (vandalism vector) | P0 | data-integrity |
| No numeric sanity constraints (calories: 99999 accepted today) | P0 | data-integrity |
| No canonical `verified_food_canonical` row per barcode (every read picks the best at runtime — fragile, no FK target) | P0 | data-integrity |
| Submit success state silently dismisses → no user feedback | P0 (UX) | F-138 |
| No vote UI on the product sheet — schema exists, client doesn't call it | P1 | data-integrity |
| No admin verification path (no way for Grace to triage `pending`) | P1 | data-integrity |
| No cross-submission consensus auto-verification logic | P1 | data-integrity |
| No `submission_method` column to weight trust by origin (manual vs scan vs vision) | P1 | data-integrity |
| No label-photo evidence trail | P1 | competitor-intel + data-integrity |
| No submission rate-limiting (per user / per hour) | P1 | data-integrity |
| No flag-as-bad-data path | P1 | data-integrity |
| No audit log of who-changed-what | P1 | data-integrity |
| No submitter trust score / auto-promotion for repeat-good submitters | P2 | competitor-intel |

## The proposed pipeline

**End state:** every barcode submission goes through three automated gates before any human touches it. ~80%+ of submissions resolve without Grace's involvement.

```
                ┌─────────────────────────────────────┐
                │      submitFoodCorrection           │
                └──────────────┬──────────────────────┘
                               │
                ┌──────────────▼──────────────────────┐
                │  1. Plausibility gate (server-side) │
                │     - Atwater within 15%            │
                │     - sugar ≤ carbs, satfat ≤ fat   │
                │     - calories ≤ 900 kcal/100g      │
                │     - sum-of-macros ≤ 100g/100g     │
                │     - OFF baseline drift < 50%      │
                └──────┬─────────────┬────────────────┘
                       │ block       │ pass/warn
                       ▼             ▼
                 ┌──────────┐   ┌────────────────────────────┐
                 │ reject   │   │  2. Cross-submission        │
                 │ to user  │   │     consensus check         │
                 │ "looks   │   │     (find other pending     │
                 │  off,    │   │     rows for same barcode   │
                 │ check    │   │     within tolerance)       │
                 │ label?"  │   └────┬───────────┬────────────┘
                 └──────────┘        │ match     │ no match
                                     ▼           ▼
                            ┌──────────────┐  ┌──────────────────┐
                            │ AUTO-VERIFY  │  │ 3. Trust-tier    │
                            │ (promote +   │  │    auto-promote  │
                            │ this row +   │  │    if submitter  │
                            │ matching     │  │    has 5+ verified│
                            │ peer)        │  │    submissions    │
                            └──────┬───────┘  └────┬─────────┬───┘
                                   │               │         │
                                   ▼               ▼         ▼
                            ┌──────────────┐  ┌──────────┐ ┌──────────────┐
                            │ verified     │  │ verified │ │ pending      │
                            │              │  │          │ │ (await admin │
                            │              │  │          │ │  triage or   │
                            │              │  │          │ │  2nd user    │
                            │              │  │          │ │  consensus)  │
                            └──────────────┘  └──────────┘ └──────────────┘
```

## Phasing

### Phase 0 — Immediate (this PR)

UI-only, no schema change, no overpromising:
- F-138 success state: replaces the form with a "Correction saved" card after submit
- Subtitle copy: honest about *current* effect ("applies to your scans straight away")
- Success body: forward-looking but not claiming a live review process
- Static-pin tests in `correctionSubmitSuccessState.test.ts`

### Phase 1 — P0 schema hardening (1–2 days)

Cannot claim "real verified DB" without these:

1. **Numeric constraint pack** — `calories 0..2000`, `protein 0..100`, `carbs 0..100`, `fat 0..100`, `sodium_mg 0..50000`, `sugar_g <= carbs`, `saturated_fat_g <= fat`, `fiber_g <= carbs`
2. **RLS hardening** — `select` becomes `verification_status = 'verified' OR submitted_by = auth.uid()`; `update` blocks self-promotion via trigger checking `auth.uid()` against `admin_users`
3. **Upsert resets `verified` on macro change** — trigger that flips back to `pending` + clears `verified_at`/`verified_by` when any nutrition column changes
4. **Lex-sort fix in `lookupBarcode`** — replace `order by verification_status asc` with `case when verification_status='verified' then 0 ... end`; filter `verification_status <> 'rejected'`
5. **`verified_food_canonical` table** — one row per barcode with the chosen consensus values + FK to source `user_foods.id`. Server-side `recompute_canonical(barcode)` function.

### Phase 2 — Plausibility + consensus (2–3 days)

Where 80% of automated work happens:

6. **Server-side plausibility gate** — edge function `check-food-correction` runs the nutrition-engine ruleset on submit; returns `{ verdict: 'block'|'warn'|'pass'|'auto_verify', reasons }`. Block → 4xx response with user-facing reason. Pass/warn → row inserted. Auto_verify → row inserted with `verification_status = 'verified'`.
7. **Cross-submission consensus job** — `pg_cron` every 10 min runs `detect_consensus()` (sketched in data-integrity report) — if two pending rows for same barcode agree within 5% on calories + 15% on macros, promote both to `verified`. Same query runs as `after insert` trigger for instant auto-verify when a new submission matches an existing one.
8. **Atwater + structural front-end checks** — also run client-side so user sees the "double-check the label?" prompt before they hit submit (fast feedback). Server is the authority.

### Phase 3 — Vote UI + flagging (2 days)

9. **Vote pressables on product sheet** — wire `user_food_votes` insert/delete from the barcode result card. "12 users confirmed these numbers" line with thumbs-up. Bumps `upvotes`/`downvotes` via trigger that recomputes on vote change.
10. **`user_food_flags` table + 3-flag auto-reject** — flag-as-bad-data UI. When a row reaches 3 flags from distinct users, auto-set `verification_status = 'rejected'`.
11. **`evidence_url` column** — optional photo of the nutrition label captured at submission time. Stored in private `food-evidence` Supabase bucket.

### Phase 4 — Admin verification + audit (2 days)

12. **Admin triage page** — `/admin/food-corrections` (gated by `admin_users` JWT claim). Lists pending rows with current values vs OFF baseline; one-click verify/reject. Optional daily email digest of the queue size.
13. **`food_corrections_log` audit table + trigger** — append-only history of every change to `user_foods`. Required for vandalism rollback.
14. **Per-user submission rate limit** — trigger that raises if `(count of inserts by user_id in last hour) > 30`.

### Phase 5 — Trust score + Claude-vision auto-verify (3 days)

15. **`submission_method` column** — `enum('manual','barcode_scan','vision_label','vision_meal','import_off','import_admin')` to weight trust differently in consensus rules.
16. **Submitter trust score view** — count of user's `verified` submissions. Users with 5+ verified → new submissions auto-promote (with `verified_by = 'auto_trusted_submitter'`). Grace becomes the trust seed: her first submissions are admin-blessed, after which she auto-verifies.
17. **Claude-vision label-photo auto-verify pilot** — when user attaches a label photo at submit, edge function calls Claude vision: "Does this nutrition label match: kcal X, P Y, C Z, F W per S grams?" Pass → auto-verify with `verified_by = 'vision_auto'`. Fail → flag to admin queue. Cost ~$0.005/call, ~$5/month at our projected volume.

## What we *do not* build

- **Manual review queue at scale** — Cronometer's model. Solo founder cannot staff this; vision + plausibility + trust-tier should resolve >90% automatically.
- **Brand-direct partnerships** — Nutritionix's moat. Not at our stage.
- **GPT-vision per-meal estimation as primary path** — Cal AI's model. We're a tracker that respects the database; vision is a *fallback* for missing barcodes, not the primary surface.

## Cost / time estimate

| Phase | Days (focused) | Cost (infra) |
|---|---|---|
| 0 (this PR) | 0.25 | £0 |
| 1 (P0 schema) | 1–2 | £0 |
| 2 (plausibility + consensus) | 2–3 | £0 |
| 3 (vote UI + flagging) | 2 | £0 |
| 4 (admin + audit) | 2 | £0 |
| 5 (trust + vision) | 3 | ~£5/mo (Claude vision) |
| **Total** | ~10–12 days | ~£5/mo |

## Open questions for Grace

1. **Verification cadence ambition** — do we want the auto-verify pipeline live before broadening the tester pool, or is "Grace + small invitee group" OK while we build it?
2. **Claude-vision pilot priority** — happy to commit ~£5/mo to label-photo auto-verify, or wait until we have data on where consensus fails first?
3. **Public contributor leaderboard / "you helped N people"** — adopt the OFF / Discogs gamification pattern, or keep it quiet for now?
4. **Photo-of-label requirement** — make it optional in v1 (encourages submission), or required (raises quality, reduces volume)?

## Mirror / handoff

- This proposal supersedes the original framing of F-138 as a UX-only fix.
- Decision-log entry to file once Grace ratifies direction (currently Tentative).
- Roadmap rows to add (per-phase) once direction is locked.
- Tracker entry for F-138 will close on Phase 0 ship and reference this doc for the longer arc.

## Specialist sources

This proposal consolidates input from three specialist agents (2026-05-08):
- `competitor-intelligence` — patterns from MFP / Cronometer / MacroFactor / OFF / Cal AI / Nutritionix / Wikipedia / Discogs; specific UX copy to crib; what to avoid
- `nutrition-engine` — concrete plausibility ruleset (block / warn / pass / auto_verify) with pseudocode + tolerance rationales
- `data-integrity` — full schema audit of `user_foods` + `user_food_votes`, prioritised P0/P1/P2 migration backlog, specific RLS + lookupBarcode bugs
