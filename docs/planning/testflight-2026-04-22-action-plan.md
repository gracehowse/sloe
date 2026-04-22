# TestFlight 2026-04-22 pilot-round action plan

Pulled 123 submissions (117 screenshot + 6 crash) across builds 19–28. 89 already tracked as ✅/🟡. 34 new rows grouped into 11 clusters. This doc is the atomic next-step list per cluster — pick one up and ship it without re-investigating.

See [../testflight-feedback/tracker.md](../testflight-feedback/tracker.md) for the full ledger and [../testflight-feedback/resolved.md](../testflight-feedback/resolved.md) for per-fix narrative.

## ✅ C6 — Weight delta bogus when no recent log (SHIPPED this round)

**Submission:** `AOVuCyOCNB1p…` — "Up 0.9 this week is not correct as I have not logged weight in about a month".

**Root cause:** `computeWeightTrendCopy` (src/lib/nutrition/weightTrendTile.ts) produced a real delta from two historical entries regardless of how old they were, and rendered it under a "this week" label.

**Fix (F-56):** stale-data guard — if most recent weigh-in date is >14 days old, return `{delta: null, copy: "Log weight to see trend"}`. Test pinned in tests/unit/weightTrendTile.test.ts ("F-56: suppresses delta when most recent weigh-in is older than 14 days").

**Verify:** next build on Grace's device — Trend tile should read "Log weight to see trend", no kg delta.

**Siblings still open:** `AKuLcrQUR7pf…` + `AGM9xRpzTLnD…` ("weight graph still wrong/not clear"). C6 only fixes the stat tile; the chart itself needs a separate audit (see C6-chart below).

## C1 — Apple Health post-F50 still broken (HIGH — 4 submissions, urgent tone)

**Submissions:** `AEzcUFvXt…`, `AEWQ5gs3…`, `AAcIj2Vc…` (historical meals not pulling), `AGZq4O-Z…`.

**Context:** F-50 in build 27 consolidated the split-init into a single `initHealthKit` call with the union of body + dietary perms. This was correct in theory. Tester still reports sync works but historical MFP/Lose It meals don't backfill.

**Investigation findings:**
- Init is at apps/mobile/lib/healthSync.ts:978 `requestHealthPermissions` — single `initHealthKitPromise` call with `FoodCorrelation` + `HEALTH_DIETARY_IMPORT_PERMISSION_KEYS` (good).
- Nutrition backfill is `syncNutritionFromHealth` at apps/mobile/lib/healthSync.ts:1525; default lookback 120d, on-connect path calls with 730d (F-44).
- Food correlation fetch is `getFoodCorrelationSamplesSafe` at :796 — on any throw, returns `[]` silently.
- `getDietaryImportSamplesSafe` at :540 — same silent-empty-on-throw pattern.

**Most likely root cause:** iOS will not re-present the HealthKit auth sheet for types it already asked about. F-37 split-init previously asked for dietary types; when the user denied or left them off, the union-init in F-50 now silently keeps those types denied — `initHealthKit` resolves success (body perms were granted), nutrition query returns 0 samples. The user cannot fix this from within the app.

**Proposed fix (F-57):**
1. Add a UI signal: after a "successful" connect, if `foodCorrelationRows.length === 0` AND `dietary samples count === 0` across a 730d window, show an in-app banner: *"Health Connected, but Suppr doesn't have permission to read your food logs. Open iOS Settings → Privacy → Health → Suppr and enable 'All Categories' to backfill your historical meals."* + a deeplink button that opens `Linking.openURL("x-apple-health://")` (opens Health app; iOS settings path not programmatically reachable).
2. Ship a native-side perm-status probe (Swift `authorizationStatus(for:)`) exposed via RN bridge for *write* types on dietary (iOS allows querying write status) — use as a proxy signal the auth sheet has been presented.
3. Log `[healthSync] post-connect empty-dietary-window detected` to Sentry so we can confirm in prod.

**Owner:** mobile/integration. **Size:** M. **Risk:** low (UI + banner + one native bridge getter).

## C2 — Pro user shown as Free on Plans (HIGH — 3 submissions)

**Submissions:** `ADpuHU6O…`, `AIryDu7i…`, `AIm3KPwBY…`.

**Context:** F-43 (build 23) added RC + promo reconcile on Plan mount via `syncTierToSupabase`. Still failing.

**Investigation findings:**
- apps/mobile/app/(tabs)/planner.tsx:193 — useEffect runs on userId change; awaits `getCustomerInfo` then `syncTierToSupabase` then reads `profiles.user_tier`. If the RC block throws, falls through to the *old* profile read → stale tier wins.
- apps/mobile/lib/purchases.ts:196 `syncTierToSupabase` — correctly merges RC tier + promo tier by rank, writes `profiles.user_tier`.
- **Silent-catch hole:** planner.tsx:201 `catch { }` swallows ALL RC errors (including "not configured" in TestFlight if `configurePurchases` hasn't run with a Supabase userId yet). `configurePurchases` is called from app-level config; if it ran with `appUserID: undefined` (user not signed in at boot), the anonymous RC ID has no entitlements → RC returns `free` → promo compare + merge → if promo is also "free", profile gets overwritten to "free" even for a Pro user.

**Proposed fix (F-58):**
1. Before the RC call, **guarantee** RC is logged in as the current Supabase userId: `await ensurePurchasesUser(userId)` *then* `getCustomerInfo`. Currently the planner skips `ensurePurchasesUser` — trusts app-level configure. If user signed in after launch, RC is still anonymous.
2. Add guardrail in `syncTierToSupabase`: never *downgrade* an existing Pro profile when RC returns Free AND no promo is active. Write only the max of (current profile tier, merged RC+promo tier). This prevents a misconfigured RC from nuking a legitimately-Pro profile row.
3. Surface the catch visibly in dev: `console.warn("[Plan Pro reconcile]", err)` instead of silent.

**Owner:** mobile/monetisation. **Size:** S. **Risk:** low. Pin with a test that feeds a "Free" RC response + pre-existing Pro profile → expects tier stays Pro.

## C3 — Recipes still not seeded (3 submissions)

**Submissions:** `AEwoLmeE…`, `AKcZwsip…`, `AJr60qsyV…`.

**Context:** F-50 backfilled `author_id` for 20 seeded rows. `scripts/seed-discover-recipes.ts` now sets author_id.

**Investigation to-dos:**
1. Verify backfill ran on production Supabase: `select count(*) from recipes where author_id is null and is_public = true` — should be 0.
2. Confirm build 28 on tester's device reaches the Discover query. Check Discover query filters in apps/mobile/app/(tabs)/discover.tsx — specifically check whether a new filter (e.g. `image_url is not null` introduced by F-52) is the new hider.
3. If `image_url` is the hider, decide: seed script should populate image_url OR Discover query should fall back to gradient card when image_url is null.

**Proposed fix direction (F-59):**
- Option A: Seed script generates a placeholder `image_url` (deterministic from title hash, served from a Supabase storage public bucket).
- Option B: Relax Discover filter — render gradient card when image_url is null, as previously (before F-52).

Grace has been explicit about social-feed aesthetic — Option A is more correct; Option B is a hack.

**Owner:** nutrition-engine + data-integrity. **Size:** M (A) or S (B).

## C4 — Today calorie hero still too big (2 submissions)

**Submissions:** `AB6WOylB…`, `ADt-4U9u…`.

**Context:** F-47 shrank Today hero number 80→56. Tester says still too big.

**Investigation to-dos:**
1. Open apps/mobile/app/(tabs)/index.tsx (Today) and find current kcal number font size / line-height / container padding.
2. Open docs/ux/claude-design-bundles/prototype/*today* bundle and measure target size.
3. Compute gap; likely next shrink is 56→40 or 56→44 *plus* tightening the vertical spacing above and below the number.

**Proposed fix (F-60):** Likely Number 56→44 with trimmed padding. Preserve tap target min 44pt; use padding/hitSlop to keep accessibility.

**Owner:** visual-qa + ui-product-designer. **Size:** S.

## C5 — Household section doesn't make sense + prototype drift (4 submissions)

**Submissions:** `ALpppRnGz…`, `ALQQyjCH…`, `AKQGhg8w…`, `AGpLe8GO…`.

**Context:** F-32 shipped household card prototype language. Tester still says unclear + doesn't match prototype; earlier `AJ1AeYJ--fFF…` asked for a Netflix-style household-management model.

**Investigation to-dos:**
1. Re-read the prototype Household section at docs/ux/claude-design-bundles/prototype/ and the carve-out in project memory (Household doesn't match prototype for this page).
2. Compare to current household card at apps/mobile/components/**/household*.tsx (find exact path).
3. Grace's product note on `AJ1AeYJ--fFF…` is strategic: household *management* UX needs a rethink — create household → settings manage members → flexible per-meal-type sharing (dinners only, all meals, etc.) — don't share macros.

**Proposed fix direction:** This is a multi-week product workstream, not a one-commit fix. Route to:
- product-lead for the Netflix-model proposal
- ui-product-designer for the new household-management screens
- data-integrity for the sharing schema (what gets shared: meals only? filtered by slot?)

**Owner:** product-lead. **Size:** L. **Status:** design required before code.

## C6-chart — Weight graph still wrong / not clear (2 submissions — remainder of C6)

**Submissions:** `AKuLcrQUR7pf…`, `AGM9xRpzTLnD…`.

**Context:** F-24/F-27/F-31 addressed domain trim + since-date label + tone. Tester still unhappy with chart.

**Investigation to-dos:**
1. Find the chart component (apps/mobile/components/**/Weight*Chart*).
2. Compare to Apple Health / prototype weight chart: axes, tick density, zero-point, moving average line.
3. Consider adding a 7-day moving-average overlay (common request in nutrition apps) and a goal-line.

**Proposed fix direction:** Chart redesign to prototype — route to ui-product-designer.

**Size:** M.

## C7 — Discover feed cards should render like hero (2 submissions)

**Submissions:** `AEq5NTi0n…` (all cards should be bigger feed-style like the top 2), `APpAKhhR…` (images terrible).

**Context:** F-52 gave hero + More-ideas row image support. Tester wants *uniform* big-card rendering across the whole feed, not just the hero.

**Proposed fix direction (F-61):**
1. Promote the hero card style to the canonical Discover card. Drop the smaller "More ideas" row variant.
2. Image quality — audit image dimensions + compression. Seeded image_url likely a low-res thumbnail; bump to 1200px width.

**Owner:** ui-product-designer + performance-optimizer (image quality vs payload). **Size:** M.

## C8 — "No meals to import" shown when meals exist (2 submissions)

**Submissions:** `ABG0cZzo…`, `AELbM8VJ…`.

**Investigation to-dos:**
1. Grep repo for "no meals to import" / "no new meals" copy.
2. Find the emptiness check in the import flow; likely HealthKit food correlation count == 0 → "no meals" copy, but the count calculation skips samples that are owned by Suppr (bundle ID) — if ALL are Suppr-owned on a re-connect, the count is 0 even though the user sees their logged meals in HealthKit.
3. Confirm the bug: likely `skippedOwn` is being counted in the empty-state check.

**Proposed fix (F-62):** Empty-state copy should distinguish "no external meals to import (yours are already here)" from "HealthKit returned no dietary samples at all". Two different states, two different messages.

**Owner:** nutrition-engine. **Size:** S.

## C9 — Layout / spacing / prototype mismatch cluster (7 submissions)

**Submissions:** `AIC05bpyu…`, `AERuv07KI…`, `AJ8Fk6ud…`, `AAUNtlDI…`, `ALvjyW7w…`, `AHitOL0R…`, `AAtwbwVx…`.

**Context:** Grace has been granular across multiple surfaces. These are not one bug — they are 7 micro-audit items.

**Investigation to-dos:** Each submission needs the corresponding screenshot cracked open to identify the surface and the mismatch. The `data/feedback-2026-04-22-raw.json` pull includes screenshot download URLs (`included[].screenshots[].fileAssets.downloadUrl`). A companion script `scripts/download-testflight-screenshots.mjs` (to write — does not yet exist) would pull screenshots into `docs/testflight-feedback/data/screenshots/<id>.png` so we can match submissions to surfaces.

**Proposed fix direction:** Per-surface triage after screenshot download. Route to design-system-enforcer agent once we know which surface each belongs to.

**Owner:** design-system-enforcer (post-triage). **Size:** M (triage) + per-surface S.

## ✅ C10 — "Score doesn't mean anything remove"

**Submission:** `AHS6xzyU…`.

**Context:** `AA63DQ7xd…` already closed ✅ with the score removed. This submission is either:
- a repeat from before the fix shipped (tester screenshotting an old build), OR
- a different surface where the score still appears.

**Investigation to-do:** Grep `score` across mobile screens, identify which surface Grace is seeing. If found anywhere in product chrome, remove.

**If no remaining instances:** Close as duplicate of `AA63DQ7xd…`.

**Owner:** product-lead. **Size:** XS (verification).

## C11 — Edamam restaurant foods not showing (1 submission)

**Submission:** `ANfXXs6H…`.

**Investigation to-do:** Check whether Edamam integration is in fact live in build 28 — status of the Edamam API key, whether search.tsx calls the Edamam adapter, whether restaurant category is filtered out somewhere.

Likely outcome: Edamam was deferred / disabled (see user memory re: OpenFoodFacts and FatSecret tier decisions). If so, **do not promise Edamam** — remove any UI copy suggesting restaurant-foods-from-Edamam and set user expectation that restaurant foods come from FatSecret (or whichever provider we end up using).

**Owner:** nutrition-engine + product-lead. **Size:** XS–S.

## Meta submissions

- `AJNcZdalctgg…` — "Confirming build" → ✅ closed (no action).
- `AEaTIZJodtNQ…` — no comment → 🔍 (no context).

## Suggested order for future sessions

1. **C6-chart audit** (small, visible win)
2. **C2** (Pro entitlement — monetisation blocker, small fix)
3. **C1** (Apple Health UX banner — large visible impact)
4. **C10** (score — verify, close, tiny)
5. **C11** (Edamam — decide + remove misleading UI, tiny)
6. **C8** (import empty-state — small)
7. **C4** (Today hero — small)
8. **C3** (recipes seeded — M)
9. **C7** (Discover feed uniformity — M)
10. **C9** (screenshot-triage — M; depends on building the screenshot-download script)
11. **C5** (household — L, needs product design)

## Rules of engagement

- Every fix must update [../testflight-feedback/tracker.md](../testflight-feedback/tracker.md) with the submission ID → F-xx mapping and a narrative entry in [../testflight-feedback/resolved.md](../testflight-feedback/resolved.md).
- Every fix must ship with a regression test pinning it.
- Commit messages must include "closes {first-10-chars-of-ID}" so `git log --grep` can cross-reference.
- Before marking ✅, verify either (a) tester re-test, (b) pinning test, or (c) code-level argument the failure mode can't recur.
