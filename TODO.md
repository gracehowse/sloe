# Suppr — Master TODO

**The single worklist.** Consolidated 2026-04-19 from 6 scattered lists (see [Sources](#sources) at bottom). Work from this file. Update as items land. Historical source files are at [docs/planning/archive/](docs/planning/archive/).

Orchestrator/executor queue is separate and lives at [docs/planning/sweep-2026-04-executor-backlog.md](docs/planning/sweep-2026-04-executor-backlog.md) — that's an agent-driven queue, not a Grace worklist.

Legend: `[G]` Grace-only (dashboard / human decision) · `[E]` executor / code · `[SP]` specialist review required · 🔴 ship-blocker · 🟠 P0 · 🟡 P1 · 🟢 P2 / tech debt

**Code decoder** (for items that still carry internal shorthand):
- `ASC` = App Store Connect (the Apple dashboard where TestFlight feedback is logged). IDs like `AKvgjnb` are feedback ticket IDs.
- `P0-N` / `P1-N` = priority ticket N from the 2026-04-18 TestFlight pass.
- `B-N` = backlog item N from the 2026-04-19 build-13 follow-up pass.
- `DI-P0-N` = diversity-and-inclusion audit finding, priority N.
- `DMCA-1 / LEGAL-1 / TM-1 / OFF-1 / FS-1 / PRIV-1 / MARK-1 / CI-1 / STORE-1` = items from the 2026-04-19 IP-counsel clearance memo.
- `T1..T9` = tasks from the Weekly Recap Push rewrite plan (section below).
- `A1, A2` = the two product decisions from 2026-04-19 session on Progress/Digest (tier-gating, maintenance recalibrate CTA).
- `F2` = the 2026-04-19 Progress redesign decision that retires the Reports nav row.
- `H-2..H-5` = tracks from the build-13 engineering sweep.
- `RG-N` = Release-Gate tasks from the 2026-04-18 gate sign-off.

---

## ⚠️ Hard deadlines

- [ ] **2026-05-03 — Weekly recap push: ship per-user content or kill the feature.** The Sunday mobile notification currently fires a generic placeholder body for everyone. Rewrite it to send a per-user summary of the previous week (calories vs target, weight trend, streak, plus a Digest suggestion headline), or turn the whole feature off. A weekly generic push trains users to ignore notifications — worse than not pushing. See [§ Weekly recap push rewrite](#weekly-recap-push-rewrite) below. **Target first real push: Sunday 2026-04-27.** Route: `vercel.json` cron → [app/api/push/weekly-recap/route.ts](app/api/push/weekly-recap/route.ts) → Expo → APNs.
- [x] **2026-05-18 — Retire legacy weekly-recap analytics events.** Resolved 2026-04-20 by killing the mobile-local scheduler (T11). The `currentWeekKey` off-by-one lived only in the mobile-local scheduling site; with that call site removed, the `weekly_recap_push_sent` / `_scheduled` emits are now server-only and already use the correct previous-week `weekKey` (T6 server fix, 2026-04-19). 30-day rename-cycle can retire the legacy event names as planned.
- [ ] **2026-06-14 — Share button review (8 weeks from Progress redesign decision).** Kill-or-invest gate: if recap-share-tap rate stays >5% of recap views for 4 sustained weeks → invest in a real visual share artifact; if <1% sustained → remove the share button entirely.

---

## 🔴 Ship-blocking (pre-next-deploy gate)

### Pre-ship checklist (rounds 1–6 landing-parity sweep)

_Code landed as of 2026-04-20 — working tree clean, all 8 release-gate chunks committed (see `git log` 2026-04-19..20). Vercel main-branch auto-deploy is the vector; `STRIPE_TAX_ENABLED` defaults to `false` so deploys are safe without the dashboard flip._

Remaining pre-flip:

- [ ] **[G] Apply 3 Supabase migrations to prod** (order-agnostic). Use `supabase db push --linked` (NOT MCP `apply_migration` — CLAUDE.md non-negotiable):
  - `supabase/migrations/20260419110000_profiles_stripe_customer_id.sql`
  - `supabase/migrations/20260426100000_saves_free_tier_cap.sql`
  - `supabase/migrations/20260426100100_recipes_publish_tier_gate.sql`
- [ ] **[G] Stripe dashboard — activate Stripe Tax.**
- [ ] **[G] Stripe dashboard — set `tax_behavior: inclusive`** on all 4 Price objects (BASE_MONTHLY, BASE_ANNUAL, PRO_MONTHLY, PRO_ANNUAL). Existing subscribers aren't re-charged; takes effect next renewal.

### Flip `STRIPE_TAX_ENABLED=true` (after Stripe dashboard confirmed live)

- [ ] **[G] Set `STRIPE_TAX_ENABLED=true`** in production env (Vercel).
- [ ] **[G] Live UK checkout smoke test** — displayed price matches charged; `paywall_viewed` fires with `{ from, tier, surface, platform }`; webhook writes `stripe_customer_id` to `profiles`.
- [ ] **[G] Monitor** Stripe `checkout.session.completed` for tax line within 24h. Rollback path = flag back to `false`.
- [ ] **[G] TestFlight smoke** — mobile paywall copy unchanged (mobile is flag-independent; Apple IAP handles VAT natively).
- [ ] **[E] Update** [docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md](docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md) with flip date + NETP/OSS numbers once known.

### IP / legal pre-launch blockers

- [ ] **🔴 [G] DMCA-1 — Register Suppr designated agent** with US Copyright Office ([copyright.gov/dmca-directory](https://www.copyright.gov/dmca-directory/)). Fee $6; renew every 3 years. Without this, Suppr is a direct infringer for user-uploaded content. **~30 min.** Depends on founder legal name + postal address.
- [ ] **🔴 [G] LEGAL-1 — Confirm legal entity name + update filings.** Once entity formed, update [terms](app/terms/page.tsx), [dmca](app/dmca/page.tsx), [privacy](app/privacy/page.tsx), [landing footer](app/(landing)/LandingPage.tsx), [licences](app/licences/page.tsx) + vendor DPAs (Stripe, Supabase, RevenueCat, Expo, PostHog, Sentry, OpenAI, Edamam, FatSecret). Depends on jurisdiction decision. **1–4 weeks wall-clock.**
- [ ] **🔴 [G] TM-1 — Formal trademark clearance search for "Suppr" / "Suppr Club".** Preliminary scan flagged **HIGH risk**: (1) phonetic equivalence SUPPR ≈ SUPPER, (2) live in-category competitor "Supper Club!" (App Store 6496848191, supperclubapp.com), (3) crowded category ("Supperhero", "Simple Suppers"). **Budget £1,200–2,500** for search + opinion; budget separately for rebrand if opinion points that way. **Trigger:** BEFORE paid-marketing, App Store public release outside TestFlight, or expansion into classes 29/30/43.

---

## 🚧 In flight — waiting for agent output

_None._ All in-flight work landed 2026-04-19.

**Recently shipped (2026-04-20 session — push pre-flight + housekeeping):**
- ✅ T8 customer-lens re-permission audit (no formal re-permission needed; permission copy reconciled across 3 sites in parity — web + mobile onboarding-v2 + legacy notifications-prompt).
- ✅ T9 docs + cleanup closed (no stale generic-body literals in server-cron path).
- ✅ Ship-blocking 8-chunk commit plan confirmed fully landed (working tree clean); stale checklist removed.
- ✅ PostHog wizard report landed in `docs/planning/posthog-setup-2026-04-20.md` + TODO.md tick (RevenueCat account created).
- ✅ T10 journey-architect cron-timing audit: WARNING (not blocker) — UK-heavy base OK at 18:00 UTC = 19:00 BST. Interim fix scoped as T12.
- ✅ T11 mobile-local fallback KILLED per product-lead decision — see `docs/decisions/2026-04-20-weekly-recap-mobile-local-killed.md`. Server cron is sole weekly-push path. 2026-05-18 weekKey off-by-one hard-deadline resolved as a side-effect.
- New follow-up: T12 (tz-aware fan-out interim — optional for first Sunday).

**Recently shipped (2026-04-19 session — Progress + Push deep dive):**
- ✅ A2 schema migration (5-value enum `target_calories_source` + `set_at`), all 9 write sites stamped truthfully, backfill applied
- ✅ T7 cascade module (`weeklyDigestSuggestion.ts`) — 5-rule first-match-wins, 47 tests
- ✅ T2 push body formatter + `with_suggestion` variant (composes cascade headline + recap summary, ≤178 char APNs budget, intelligent truncation)
- ✅ T3 per-user nutrition data fetch in `app/api/push/weekly-recap/route.ts` (dedupe-before-compute, silent-skip on per-user fail, no generic fallback)
- ✅ T4 wire formatter+cascade into route — body composition live
- ✅ T5 `weekly_recap_push_opened` event + tap listener via `HandleWeeklyRecapPushOpen` in `_layout.tsx`
- ✅ T6 server-side `weekly_recap_push_sent` analytics with `bodyVariant` + `suggestionRule` (also fixes `weekKey` off-by-one for the server path; mobile-local emit still drifted — separate ticket)
- ✅ Action 5 + Action 13 — 18 Progress accuracy fixes with shared helpers (`weightTrendTile`, `measurements`, `formatMacroAdherenceBar`, `formatAvgCaloriesLabel`, `formatMaintenanceRecapLine`, `selectClosestToTargetDay`, etc.)
- ✅ Live DB: 8 unapplied migrations applied via Supabase MCP — but with the wall-clock-version drift the agent-investigation flagged afterward
- ✅ Migration drift fix — CLAUDE.md non-negotiable rule + memory + new `scripts/check-migration-drift.ts` reconciler wired into `prelaunch-checklist`; ship-checklist.md hardened to forbid MCP/Dashboard apply paths
- ✅ Total: 1932/1932 tests green, typecheck clean, all session work captured in commit per 2026-04-19 push.

---

## Weekly recap push rewrite

(Internally: the "Sunday push rewrite". T-numbers are the task IDs from the 2026-04-19 planner audit.)

**Why this exists:** the weekly recap push currently fires the same generic body for every user every Sunday. It needs to become per-user content (their stats + a suggestion) or be killed. See [Hard deadlines](#hard-deadlines) 2026-05-03.

**Planner recommendation (2026-04-19):** Option (a) Build to deadline. 80% confidence. Core ~2 dev days. Infra already in place (cron in `vercel.json`, route in [app/api/push/weekly-recap/route.ts](app/api/push/weekly-recap/route.ts), schema for push tokens, `expoPush` helper, server-safe `buildWeeklyRecap`). Only application logic was missing.

**Critical path:** cascade module (in flight above) → commit working-tree T3/T4/T6 → deploy → first real push fires **Sunday 2026-04-27**.

Remaining tasks:

- [x] **[E] T3 — Per-user nutrition data fetch** in the route. Shipped 2026-04-19. `entriesToByDay` + `previousWeekDescriptor` + `parseWeightKgByDay` + `parseFreezeLedger` live in `src/lib/push/weeklyRecapPayload.ts`. Per-user compute failure → silent skip + structured log; no generic-body fallback (would mask real bugs). 20 unit tests in `tests/unit/weeklyRecapPayload.test.ts`. Cascade Rule 1 structurally suppressed in the server-fanout path (would need a `saved_meals` per-user fetch — out of scope; Rules 2–5 fire normally).
- [x] **[E] T4 — Wire real body formatter into route.** Shipped 2026-04-19. New `with_suggestion` variant on `formatWeeklyRecapPushBody`. Push payload `data` now carries `bodyVariant` alongside `weekKey`. ≤178 char APNs ceiling enforced with intelligent recap truncation (drop calories first, keep weight; collapse to days-only if needed). 8 new test cases in `tests/unit/weeklyRecapPushBody.test.ts`.
- [x] **[E] T6 — Server-side delivery analytics.** Shipped 2026-04-19. New `serverTrack` helper at `src/lib/analytics/serverTrack.ts` (direct PostHog `/capture/` POST, no SDK). Fires `weekly_recap_push_sent { userId, weekKey, bodyVariant, suggestionRule }` per success. Server emit uses recap-window `weekKey` — fixes off-by-one against `weekly_recap_push_opened` for users on the cron path. (Mobile-local off-by-one at `apps/mobile/app/(tabs)/progress.tsx:625-627` still open — see §"Push analytics off-by-one bug" above.) 6 unit tests in `tests/unit/serverTrack.test.ts`; 12 new route-integration tests in `tests/unit/weeklyRecapPushRoute.test.ts`.
- [x] **[SP customer-lens] T8 — Re-permission audit.** Shipped 2026-04-20. Verdict: formal re-permission NOT needed, but onboarding permission copy was factually stale — promised "evening protein nudge, off weekends" which contradicts the Sunday recap. Fixed copy on both onboarding-v2 permission steps (web `src/app/components/onboarding-v2/steps/permissions.tsx:110` + mobile `apps/mobile/components/onboarding-v2/steps/permissions.tsx:32`) and legacy `apps/mobile/app/notifications-prompt.tsx:155` to: "Gentle reminders only — an evening nudge when you're off-target, plus a Sunday recap of your week." Parity across all 3 sites.
- [x] **[E] T9 — Docs + cleanup.** Shipped 2026-04-20. Grep confirmed no stale generic-body string literals in the server-cron path. Mobile-local fallback at `apps/mobile/lib/weeklyRecapPush.ts:134` still carries the legacy body "Tap to see your weekly recap…" — fires only for installs without a synced Expo token (small minority, tracked as separate cleanup below). TODO comment at `progress.tsx:628-636` is a legitimate deadline-bearing deferred item (wire `weekly_recap_push_delivered`, T-2026-05-18) — NOT stale, left in place.
- [x] **[SP journey-architect] T10 — Sunday cron timing user-local audit.** Verdict 2026-04-20: **WARNING, not a ship-blocker.** UK (19:00 BST), US East (14:00 EDT), US West (11:00 PDT), CEST (20:00) are all fine. NZST lands at 06:00 Mon (borderline). UTC+7..+10 (AWST, Singapore) lands at 02:00 (genuinely bad for those few users). Recommended interim fix: add `profiles.tz_utc_offset_minutes integer null` column + client write on login/foreground + route band-filter (skip users whose local hour falls outside 08:00–22:00; null = include conservatively). Long-term: migrate to `profiles.tz_iana text null` + hourly cron that matches on user-local 18:00. See [2026-04-20 journey-architect memo in session notes]. → Spawned as T12 (schema + client + route) if shipping interim before Sunday 2026-04-27.
- [ ] **[E] T12 — Ship tz-aware fan-out interim** (journey-architect-recommended, optional for first Sunday). Add `profiles.tz_utc_offset_minutes integer null` migration (signed integer, minutes east of UTC — e.g. BST=+60, EDT=-240, AWST=+480). Mobile + web clients write `-(new Date().getTimezoneOffset())` on auth-state-change and on app-foreground. Route `app/api/push/weekly-recap/route.ts` adds a band filter: compute `localHour = ((18 + (offset/60)) % 24 + 24) % 24`; skip the user if `localHour < 8 || localHour >= 22`; null offset = include (conservative, preserves existing UK-heavy behaviour). Tests + decision doc + docs. Ship before Sunday 2026-04-27 if bandwidth permits; if not, deliberately accept the warning and ship the kill+copy reconcile as the 2026-04-27 payload. Reconsider after first-fire analytics.
- [x] **[SP product-lead, E] T11 — Kill mobile-local fallback.** Shipped 2026-04-20. Product-lead decision: option (C) KILL (see `docs/decisions/2026-04-20-weekly-recap-mobile-local-killed.md`). `apps/mobile/lib/weeklyRecapPush.ts` reduced to `cancelWeeklyRecapPush` + `handleWeeklyRecapNotificationResponse`. Scheduling useEffect in `progress.tsx` removed (off-by-one `weekKey` bug subsumed). `more.tsx` toggle becomes DB-only; OFF still cancels stale OS queue. `_layout.tsx` calls `cancelWeeklyRecapPush()` once on boot for pre-kill install cleanup. Tests: `weeklyRecapPushSuppression.test.ts` deleted; new `weeklyRecapPushModuleShape.test.ts` (4 tests) pins the post-kill surface. Docs updated (journeys/progress, mobile_qa_uat_test_plan).

**Timeline:** 2026-04-19..20 cascade module lands → 2026-04-21..23 commit + test working-tree T3/T4/T6 → 2026-04-24..25 integration test → 2026-04-26 deploy + buffer → 2026-04-27 target Sunday firing. If not deployed by Sat 2026-04-26 18:00 UTC, one more generic push fires that Sunday (acceptable); hard line stays May 3.

**Option (b) — kill the feature** (fallback if timeline slips): 2-hour task. Remove the two cron entries from `vercel.json`, return 200 no-op from the route, clear any locally-scheduled notification on next app launch, add a `push_killed_at` comment in the route so a future engineer knows how to re-introduce it cleanly.

---

## 🗝️ Grace-only (dashboard / account work)

### Pricing + billing (Pattern A: Stripe web + RC iOS) — **launch-blocking**

- [x] **[G]** Create RevenueCat account; connect Stripe under Integrations. (Confirmed 2026-04-20.)
- [ ] **[G]** App Store Connect — 4 iOS subscription products under bundle `com.supprclub.supprapp`:
  - `base_monthly` $4.99 / £3.99 · `base_annual` $37.99 / £29.99
  - `pro_monthly` $9.99 / £7.99 · `pro_annual` $74.99 / £59.99 (7-day free trial)
- [ ] **[G]** RC dashboard — provision entitlements `base` and `pro` (lowercase, hardcoded in `apps/mobile/lib/purchases.ts`). One "current" offering with all 4 packages. See `classifyPackage()` in `apps/mobile/app/paywall.tsx`.
- [ ] **[G]** RC API key — generate iOS key → set `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` in EAS Secrets.
- [ ] **[G]** Stripe dashboard — create 4 GBP prices (`STRIPE_PRICE_BASE_MONTHLY` £3.99/mo, `STRIPE_PRICE_BASE_ANNUAL` £29.99/yr, `STRIPE_PRICE_PRO_MONTHLY` £7.99/mo, `STRIPE_PRICE_PRO_ANNUAL` £59.99/yr). Set all 4 in Vercel (production + preview).
- [ ] **[G]** UK VAT registration — NETP with HMRC (£1 threshold for non-established digital suppliers).
- [ ] **[G]** EU non-Union OSS registration — digital services to EU consumers (€1 threshold).
- [ ] **[G]** US state sales tax — revisit at economic-nexus thresholds (~$100k / 200 txns per state). Not urgent.
- [ ] **[G]** Add UK + EU registrations to Stripe Tax dashboard once live.
- [ ] **[G]** App Store privacy "nutrition label" (Apple submission form) — Health & Fitness (r+w), Identifiers, Contact Info (email), Usage Data, Diagnostics, User Content.
- [ ] **[G]** Vercel production env — confirm `EDAMAM_APP_ID` / `EDAMAM_APP_KEY` set (otherwise `/api/edamam/search` returns empty silently).

### TestFlight ops (Grace dashboard access required)

- [ ] **[G]** Set ASC creds in `.env.local` (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`, `ASC_APP_ID`) per [testflight-feedback/README.md](docs/testflight-feedback/README.md); rerun `npm run testflight:feedback` 24h after build-13 install.
- [ ] **[G]** Retrieve 5 tester screenshots for `AF7bS2DQrH_wZWxGosBJ3K8` from ASC — blocks P1-2 (weight redesign).
- [ ] **[G]** Request follow-up screenshot for `AMsdTaWai1sJijvuX1VQJg4` and `AISAWnLgU9cjRBOuEY-HuJU` (blocked on context).
- [ ] **[G]** Request recipe ID + import URL for `ABwH6OVJ-kJxC5LdcL3iEzc`.

### Rebrand external-system audit (platemate → suppr)

- [ ] **[G]** GitHub — repo name, description, org, old issue templates.
- [ ] **[G]** Vercel — project name, domain aliases, deploy protection.
- [ ] **[G]** PostHog — project name, event-property schemas.
- [ ] **[G]** Sentry — project slug, release tags.
- [ ] **[G]** Stripe — product/price nicknames, receipt descriptors.
- [ ] **[G]** Transactional email "from" address — verify all outbound uses `@suppr.club`.
- [ ] **[G]** Delete duplicate local clone at `/Users/graceturner/suppr/` after mirroring its `.env.local`.

### Content seeding

- [ ] **[G]** Seed 200–500 curated recipes via existing import pipeline under a "Suppr Picks" platform account. `scripts/seed-recipe-urls.txt` currently has 10 URLs; all prior demo content was deleted by migration `20260421180000`. New users see near-empty Discover until this runs.

---

## 🟠 P0 (code / product)

### Push + analytics

- [x] **[E]** `weekly_recap_push_sent` / `weekly_recap_push_scheduled` `weekKey` off-by-one — resolved 2026-04-20 via T11 mobile-local kill (the off-by-one only existed on the mobile-local emit site, which is now deleted).

### Weekly Digest + Progress redesign (follow-up actions owed from 2026-04-19 product decisions)

Two decisions landed on 2026-04-19 — labelled A1 and A2 in session notes:
- **A1 — Digest tier-gating:** gate the Weekly Digest at the CTA level (not the whole surface). All tiers see full text + data; only the protein-nudge CTA is locked behind Base+.
- **A2 — Maintenance recalibrate CTA shape:** two-tap apply with inline diff + no undo toast, 21-day cooldown, `high` adaptive-TDEE confidence floor only.

The following actions are required to actually ship those decisions:

- [ ] **[E]** Add `progress_digest` to `PaywallViewedFrom` enum in `src/lib/analytics/events.ts:297-308` AND `normalisePaywallFrom` in `app/pricing/page.tsx`. Note: pre-existing failing test `analyticsEvents.test.ts` will fail until this lands — that failure is now intentional.
- [ ] **[E]** Server-side tier gate: API returns `tierRequired: "base"` flag on the protein-nudge CTA destination. Client renders locked state from flag + server session. Pattern mirrors 2026-04-26 RLS migrations.
- [ ] **[SP legal-reviewer]** Locked CTA copy + upsell slot copy + `from=progress_digest` paywall surface (renewal terms, selected tier, cancel-anytime).
- [ ] **[E]** Suggestion text must NOT be conditionally omitted from API response for Free users — text is the value, CTA is the gate.
- [ ] **[E]** New shared helper `src/lib/nutrition/applyMaintenanceRecalibration.ts` — re-checks `resolveMaintenance`, aborts if `source !== "adaptive"` or `|delta| < 100`, calls `recomputeTargetsFromMaintenance(maintenanceKcal, profile)` so all 4 target columns + macros stay consistent. Returns `{ before, after, deltaKcal, macroDeltas }`. Mobile mirrors via `apps/mobile/lib/` re-export.
- [ ] **[E]** `budgetSafety` check before write — if recomputed budget is `caution`/`warning`, re-prompt with existing safety language (`tdee.ts:100-107`).
- [ ] **[SP analytics-engineer]** 4 new events: `digest_suggestion_shown`, `digest_suggestion_accepted`, `digest_suggestion_dismissed`, `maintenance_recalibrated`.
- [ ] **[E]** Suggestion gate refinement — Rule 2 reads `resolveMaintenance(profile)?.source === "adaptive"`, NOT raw `adaptive_tdee_confidence` column (resolver encodes confidence + freshness + 14-day stale rejection at `resolveMaintenance.ts:128-148`).
- [ ] **[SP legal-reviewer]** Disclosure copy in recalibrate dialog: "This is an estimate from your logged intake and weight changes. It's not a clinical metabolic measurement. If you're managing a medical condition, check changes to your calorie target with your clinician." Inline-but-quiet.

### D&I P0s (from 2026-04-19 audit)

- [ ] **🟠 DI-P0-01 — Allergen surfacing on recipes.** New `allergens[]` column; auto-populate from ingredients; surface "Contains" on every recipe detail; never paywalled. Needs `nutrition-engine` (confidence), `data-integrity` (schema + RLS), `legal-reviewer` (FDA-compliant "Contains"/"May contain"). Safety-critical.
- [ ] **🟠 DI-P0-02 — Separate gender identity + pronouns fields.** Add `profiles.gender text null` + `profiles.pronouns text null`. Settings exposure + optional onboarding step. Pronouns must propagate through every addressed-user surface (pin with a test). Needs `data-integrity`, `journey-architect`, `copy-reviewer`, `sync-enforcer`. Open product-lead Q: optional in onboarding vs settings-only launch.
- [ ] **🟠 DI-P0-03 — Hide weight / trends-only mode on Progress.** Add `profiles.weight_surface_mode` (`show`/`hide`/`trends_only`), gate Weight Card + Projection Card + Trend tile on both platforms. Open product-lead Q: what metric replaces Trend tile in Hide mode (logging consistency, fibre, hydration?).

### TestFlight build-7 P0s (logged from earlier tester feedback — still open)

"ASC" = App Store Connect feedback ID. "P0-N" = priority-zero ticket N from the 2026-04-18 TestFlight pass.

- [ ] **🟠 P0-1 — Push token is never actually registered.** ASC `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`. Today `apps/mobile/app/notifications-prompt.tsx` calls `requestPermissionsAsync` but does nothing with the result — no `getExpoPushTokenAsync` call anywhere in the app. Users grant permission, the OS accepts it, but the server never learns their device address so no push is ever delivered. Fix: on grant, call the token API, persist to `profiles.expo_push_token` (needs a migration), set an AsyncStorage flag so the prompt never re-shows. Server uses the stored token in the weekly-recap fan-out above. Owner: `executor`. Review: `qa-lead`. **Blocks the whole weekly-recap push feature.**
- [ ] **🟠 P0-2 — HealthKit dietary import inflates macros for bulk-sync apps like MyFitnessPal.** ASC `AJHZNp8NHTiFNk9TjQfdYBk`. `apps/mobile/lib/healthSync.ts:syncNutritionFromHealth` correlates energy samples with macro samples by `minute|bundleId` key. Apps that bulk-sync (MFP writes a whole day in one shot) land multiple foods at midnight with the same `bundleId` — so their macros all get summed into one entry, dramatically over-reporting. Fix: detect the bulk-sync pattern and de-correlate via `HKFoodCorrelation` child UUIDs instead of wall-clock minute buckets. Owner: `nutrition-engine`. Review: `qa-lead`, `data-integrity`. **Nutrition correctness — non-negotiable per project rules.**
- [ ] **🟠 P0-3 — Goal calorie target differs between web and mobile for the same user.** `src/lib/nutrition/tdee.ts:calculateBudget` (web) applies a pace-aware deficit — 275 / 550 / 825 / 1100 kcal for relaxed / steady / accelerated / vigorous. `apps/mobile/lib/calcTargets.ts:goalCalorieAdjustment` (mobile) ignores pace entirely and applies a flat −500 / 0 / +300 kcal. Same account on two devices = two different calorie targets. Fix: align mobile to the shared pace-aware table. Owner: `data-integrity`. Review: `nutrition-engine`, `qa-lead`. **Violates the non-negotiable web/mobile parity rule.**

### Parity bug

- [ ] **[SP sync-enforcer]** Web vs mobile planner-source field drift. Web writes `time_label: "Planned"` (`src/app/components/MealPlanner.tsx:480-490`); mobile writes `source: "Meal plan"` (`apps/mobile/app/(tabs)/index.tsx:2616-2631`). Neither maps to canonical `FoodLoggedSource` enum in `src/lib/analytics/events.ts:297-308`. **Blocks plate-loop v2.**

---

## 🟡 P1 (code / product)

### Onboarding v2 follow-ups (post Stage F sign-off, 2026-04-19)

Phase 2 of the onboarding redesign shipped behind the `onboarding_v2`
PostHog flag with full sign-off from `nutrition-engine`,
`legal-reviewer`, and `diversity-inclusion`. Decision doc:
[2026-04-19-onboarding-redesign-scope.md](docs/decisions/2026-04-19-onboarding-redesign-scope.md).
The following are tracked separately so they don't block the flag flip
to an internal cohort:

- [ ] **OB2-1 — Targets persistence.** Stage E adds the flag + redirect
      but `app/onboarding/v2/page.tsx` does NOT yet write to
      `daily_targets` or `profiles` on completion. Required before the
      flag flips to a non-internal cohort. Owner: `executor`. Review:
      `data-integrity`, `release-gate`.
- [ ] **OB2-2 — Pace "extended range" disclosure flow.** `lose` slider
      currently capped at 0.75 kg/week per `diversity-inclusion`
      Stage F. The deferred design lets users tap a secondary
      affordance to unlock 0.9 kg/week after a fresh consent
      gesture. Owner: `ui-product-designer` → `executor`. Review:
      `legal-reviewer`, `diversity-inclusion`.
- [ ] **OB2-3 — Account-creation age gate.** `legal-reviewer` flagged
      under-18 exclusion as an open question for formal counsel before
      Phase 2 leaves an internal cohort. Owner: Grace (formal counsel
      decision) → `executor`.
- [ ] **OB2-4 — UK / EU regulatory check on sub-floor calorie targets.**
      Tied to the existing non-established-supplier VAT posture.
      Required before flag flip to UK / EU traffic. Owner: Grace
      (formal counsel) → revisit this row.
- [ ] **OB2-5 — Pace clinician-mode toggle.** Deferred per decision
      doc — would suppress the danger banner entirely for users with
      explicit medical guidance. Needs legal review before
      implementation. Owner: `legal-reviewer` → `executor`.

### TestFlight build 7 P1s

- [ ] **P1-1 TDEE explainability** — onboarding activity preview + Today activity-bonus-card Maintenance tile + info popover. Owner: `executor`. Review: `ui-product-designer`, `qa-lead`.
- [ ] **P1-2 Weight section redesign (mobile)** — ASC `AF7bS2DQrH_wZWxGosBJ3K8`. **Blocked** on Grace retrieving 5 tester screenshots. Owner: `ui-product-designer` → `executor`. Review: `qa-lead`, `customer-lens`.
- [ ] **P1-3 Grocery list auto-regenerates with plan** — `MealPlanner.tsx:handleRegenerate` must call `handleGenerate` directly. Web-only. Owner: `executor`. **Quick win.**
- [ ] **P1-4 Plan macro summary row** — avg daily kcal/P/C/F vs targets above day grid in `MealPlanner.tsx`. Web-only. Depends on P1-3. Owner: `executor`. Review: `ui-product-designer`, `qa-lead`. **Quick win.**

### TestFlight build-13 P1s (product gaps surfaced during the build-13 follow-up pass)

"B-N" = backlog item N from the 2026-04-19 TestFlight follow-up doc.

- [ ] **B-1 — Web Recipe Detail is missing the source card.** Mobile already renders three modes (both-source-url-and-name / url-only / name-only); web renders nothing. Bring web to parity and flip the `recipeSourceCardParity.test.ts` pinned-gap assertion. Owner: `executor`. Review: `sync-enforcer`, `copy-reviewer`.
- [ ] **B-2 — Mobile Today screen's Activity Bonus area shows two redundant macro views.** After the H-5 fix added an explicit "Day total · X / Y kcal · P / C / F" line, the pre-existing P/C/F/Fi pill row with `+/-` arrows is partly duplicative. `ui-critic` decides: either add fibre to the new line and drop the pills, or keep both with clearer labelling. Owner: `ui-critic` → `executor`. Review: `visual-qa`, `copy-reviewer`.
- [ ] **B-3 — Web Plan view has the same two-views-of-the-same-thing redundancy.** Web per-day card now shows the compact text line + `DailyRing` + `MacroCard`. `ui-product-designer` picks which is the canonical read ("how close am I to goal?") and drops the other. Owner: `ui-product-designer` → `executor`.
- [ ] **B-4 — Food search row shows redundant per-100g reference.** Rows with per-serving data now show an accent "per serving" badge + serving label but still carry a subdued `· {kcal} kcal / 100 g` reference suffix. Once testers acclimate to per-serving, this becomes noise. Drop the suffix (silent or A/B). Metric: tester "defaults to 100g" quotes stop appearing. Owner: `executor`. Review: `customer-lens`, `copy-reviewer`.

### Specialist review needed before implementation

- [ ] **[SP analytics-engineer]** Register/reject + final payload shapes for paywall v2 events: `paywall_tier_viewed`, `paywall_period_changed`, `paywall_skipped_already_entitled`, `checkout_started`/`checkout_completed` from mobile. Running as of 2026-04-19. No funnel broken by absence; `paywall_viewed` still fires.
- [ ] **[SP legal-reviewer]** Mobile paywall disclosure copy ("7 days free, then {price} per year, automatically renewing until cancelled in App Store settings. Price includes any applicable VAT. 7-day refund policy: support@suppr-club.com") + web disclosure rewrite ("Price shown includes any applicable VAT" replacing "excludes any applicable taxes"). **Pre-launch sign-off.**
- [ ] **[SP legal-reviewer]** Full review of [app/terms/page.tsx](app/terms/page.tsx) — refund section landed but broader terms content still needs counsel.
- [ ] **[SP ui-critic]** Paywall §15 open questions: header kicker copy (retire entirely?), Base-upgrader delta chip on Pro card (£X/mo — currency fragility), `from=meal_planner` default focus (Pro hero vs Base context-accuracy).

### D&I P1s

- [ ] **DI-P1-01 — Streak-visibility Settings toggle.** Add `profiles.streak_display_enabled boolean default true`; gate `TodayStreakInsightCard`, Progress streak tile, `WeeklyRecapCard` streak line. Consider flipping default to `false` once toggle exists.
- [ ] **DI-P1-02 — Soften onboarding projection headline (Lose branch).** `apps/mobile/app/onboarding.tsx:872-902` renders "*You could reach [weight] by [date]*" at 28pt. Rewrite to factual "At [pace] pace, this plan reaches your goal around [date]." Owner: `copy-reviewer` + `ui-product-designer`.
- [ ] **DI-P1-03 — Web Progress parity for hide-weight mode.** Tied to DI-P0-03. Same gating on `src/app/components/ProgressDashboard.tsx`.

### Progress redesign — build queue

Specs ready (designer brief in session memory + `project_progress_direction.md`). Needs `executor` once tier-gating + recalibrate land.

- [ ] **[E] New Progress page IA** — Header → 2x2 stat hero → Digest body (4 blocks) → end. Remove all cards below. Both `src/app/components/ProgressDashboard.tsx` and `apps/mobile/app/(tabs)/progress.tsx`.
- [ ] **[E] `progressCardThreshold.ts`** — new shared contract + `evaluateFloor` helper. Per-card floors (Adaptive TDEE: 7d + 3 weigh-ins; Weight sparkline: 2 weigh-ins → hide; Journey projection: 5 days; etc.).
- [ ] **[E] `WeeklyRecapCard` → `WeeklyDigestCard`** — rename, strip card chrome, restructure to 4 blocks. Delete old files. Both platforms.
- [ ] **[E] Drill-down enum extension** — `Metric`/`ProgressMetric` → add `weight | maintenance | steps | nutrients`. Web + mobile parity.
- [ ] **[E] Build new drill-down screens** — Weight, Maintenance, Steps, Nutrients. Card grammar (IconBox + label / hero / caption / one optional element). Reuse `--density-card-progress` token.
- [ ] **[E] Body Fat removal** — kill dashboard card, fold into Weight drill-down as collapsed secondary row, add Settings row for body composition.
- [ ] **[E] Inline deep-links** — every metric phrase in Digest narrative is tappable → correct drill-down. Subtle tint always visible; underline on hover (web).
- [ ] **[E] Retire the "Reports" nav row** — per the 2026-04-19 Progress redesign direction (decision F2: the Weekly Digest IS the Progress tab; no separate Reports surface).
- [ ] **[SP analytics-engineer]** New events: `progress_card_suppressed`, `progress_drill_down_opened` (with `metric` + `source: "hero"|"digest_inline"|"footer"`), `progress_digest_cta_tapped`.

### Plate-loop view

- [ ] **[E] v1 (ships now, honest):** "This week you cooked from your library N times. Top recipe: X (M nights)." Suppress when count <2. Uses `normaliseRecipeTitle` helper vs `saves`. Needs `ui-product-designer` brief.
- [ ] **[SP data-integrity] v2 (deferred, schema work):** `nutrition_entries.plan_meal_id` FK + canonical `source` enum + web/mobile planner-source drift fix (see above) + date-anchor planner. Enables plan-adherence + cook-vs-eat-out splits.
- [ ] **[E] v3 (after v2):** Explicit "log restaurant meal" path on Today screen → cook-vs-eat-out split.

### Architectural fixes (from TestFlight recurring-themes review)

- [ ] **B-5 — Add a "where did this number come from?" info chevron to every derived fitness number** (steps, active energy, resting energy, total burn, daily calorie intake). Tapping opens a pane that shows `HealthKit → {typeId} · {N} samples · range {first}–{last} · summed {value}`. Neutral copy, no accusation of wrongness. **Why it matters:** testers keep reporting "this number is wrong for this day" without a reference, and we can't diagnose without their raw HealthKit data. With the chevron, they screenshot the pane and we can tell which assumption doesn't match. Needs a shared `{value, provenance}` wrapper type + a pane component applied to ~6 surfaces. Owner: `executor`. Review: `ui-product-designer`, `data-integrity`.
- [ ] **B-6 — Test every numeric claim on the landing page against a single-source-of-truth constant.** Extend `src/lib/landing/content.ts` coverage so numbers like "10-recipe free limit", "7-day refund policy", "7 logging days + 3 weigh-ins" all read from a canonical source or are CI-tested against one. Fail CI if a literal number appears in `app/(landing)/**` without a matching SSOT reference. **Why:** landing copy has drifted from product reality twice already. Owner: `executor`. Review: `sync-enforcer`, `copy-reviewer`.
- [ ] **B-7 — ESLint rule banning relative `fetch()` URLs in mobile code.** React Native has no origin, so `fetch("/api/foo")` silently returns nothing — bug `AAegi1DJ` was exactly this. A custom rule (or a grep-style CI test) fails the build when a mobile file calls `fetch("/…"`. Owner: `executor`. Review: `code-quality`.

---

## 🟢 P2 / tech debt

### IP P1/P2

- [ ] **[E] OFF-1 OFF ODbL — implement Option A (cache-only).** Per [docs/decisions/2026-04-19-off-odbl-architecture.md](docs/decisions/2026-04-19-off-odbl-architecture.md). Treat OFF as pass-through: cache at edge (Upstash Redis, short TTL); snapshot macros to private `meal`/`journal` rows on log; do NOT write to `foods`/`user_foods`. Touches `src/lib/openFoodFacts/fetchProductByBarcode.ts`, `src/lib/openFoodFacts/searchProducts.ts`, `src/context/AppDataContext.tsx`, migration `20260408170000_food_db_unification.sql`. **1–3 eng-days** + prune migration. Trigger: before `foods` table growth argues "substantial part" of OFF.
- [ ] **[G] FS-1 FatSecret caching — decide tier.** Confirmed 2026-04-19: `src/app/components/RecipeUpload.tsx:909-919` + `verifyIngredients.ts:706` write full macros alongside `fatsecret_food_id`. Options: (A) confirm Platform Premier tier, document in `docs/environment.md` + `/licences`, no code change; (B) rework to persist only `fatsecret_food_id`, re-fetch macros on display (1 eng-day).
- [ ] **[E] PRIV-1 Cookie/tracking-tech disclosure banner** on first web visit (PostHog cookies, Sentry replay). GDPR/UK PECR expects banner/layered consent, not just privacy-policy mention.
- [ ] **[G] PRIV-2 Publish international-transfer safeguards** (SCCs, UK IDTA) on request. Needs internal record of signed DPAs with OpenAI, Stripe, Upstash, RevenueCat, Expo, Edamam, FatSecret.
- [ ] **[E] MARK-1 Replace `DEFAULT_UPLOADED_RECIPE_IMAGE`** (Unsplash food photo) with first-party illustration; remove `images.unsplash.com` from `next.config.ts` remotePatterns.
- [ ] **[E] CI-1 OSS licences artefact in CI** — generate `notices.json` via `npx license-checker --production --json`. **0.5 day.**

### D&I P2

- [ ] **DI-P2-01 — Expand religious dietary preferences.** Add `jain`, `hindu-vegetarian`, `buddhist-vegetarian` to `src/constants/dietaryPreferences.ts`. Fasting windows (Ramadan, Lent) deferred.
- [ ] **DI-P2-02 — Explain BMR safety floor for unspecified sex.** `tdee.ts:100-107` uses 1350 kcal midpoint with no explanation. Surface "Adjust safety floor" or one-line explanation. Owner: `nutrition-engine`.
- [ ] **DI-P2-03 — "Why we ask" helper under Biological sex step.** Rewrite to "We use this to estimate your resting metabolic rate. You can skip this or change it anytime in Settings. If you pick 'Prefer not to say' we use a midpoint estimate."
- [ ] **DI-P2-04 — Household push payload outing-risk pre-ship check.** When meal-add / shared-list notifications ship, payload must not include other members' `display_name`. Add to `release-gate` checklist.

### Cleanup / follow-ups

- [ ] **[E]** TODO comment at `apps/mobile/app/(tabs)/progress.tsx:628-632` references missing delivery listener (`addNotificationReceivedListener`). T5 wired the tap listener; delivery-rate listener still open. Scope first via `planner`.
- [ ] **[SP code-quality]** Mobile Trend tile — adopt `computeWeightTrendCopy` helper (currently uses own 90-day code path).
- [ ] **[SP qa-lead]** Mobile Steps card RNTL test — lock 3 sync states (`pending`/`success`/`failed`). testIDs already exposed.
- [ ] **[SP sync-enforcer]** Macro Adherence parity test — explicit web/mobile snapshot pairing at 200% to belt-and-brace.
- [ ] **[SP code-quality]** `weight-tracker.tsx` consolidation — replace inline `kgToLb`/`fmtW` (lines 113-118) with shared `formatWeightForUnit`.
- [ ] **[E]** Pre-existing failing test `tests/unit/analyticsEvents.test.ts` — `from=meal_planner` regex vs `app/pricing/page.tsx`. Not this session's work.
- [ ] **[E]** `tests/unit/weeklyRecapPushRoute.test.ts:194` expects `{ deepLink, kind }`; prod emits `{ deepLink, kind, weekKey }`. `product-lead` call on whether deep-link carries week key.
- [ ] **[E]** `saveVerifiedIngredients` atomicity (`apps/mobile/lib/verifyRecipe.ts:~1005`) — writes totals first then loops per-ingredient; failure = inconsistent state. Needs Supabase RPC wrapping both in a transaction. Review: `data-integrity`.
- [ ] **[E]** Residual `catch {}` at `apps/mobile/lib/verifyRecipe.ts:843` + others — route to Sentry.
- [ ] **[SP ui-product-designer]** Onboarding divergence — web 4 steps vs mobile 11 steps (`app/onboarding/page.tsx#L270` vs `apps/mobile/app/onboarding.tsx#L71`). Needs spec first.
- [ ] **[E]** Household feature regressions — enumerate edge cases + regression tests before marketing.
- [ ] **[E]** Food diary CSV export — low priority, strong trust signal.
- [ ] **[SP product-lead]** First community surface — pick one loop (ratings vs leaderboard vs follows), not all three.
- [ ] **[E]** Mobile Base-tier purchase E2E (Detox/Maestro) — once RC offerings provisioned.
- [ ] **[SP ui-critic]** Paywall §15 "kicker retirement" sanity check.
- [ ] **[SP repo-auditor]** Data-floor inventory — confirm `progressCardThreshold` floors per existing card before build.
- [ ] **[SP repo-auditor]** `WeeklyRecapCard` deletion safety — confirm no other surface embeds it before delete.
- [ ] **[SP customer-lens]** Notification-trust check — if generic body fires >4 weeks, plan re-permission moment, not just copy swap.
- [ ] **[SP customer-lens]** "Closest to target" copy — verify reads as positive-affirming, not corrective.

### Region-aware pricing (post-launch)

- [ ] **[SP product-lead + monetisation-architect + legal-reviewer + integration-manager]** Multi-specialist project. Detect user region (Accept-Language / IP geolocation), pick currency (USD/GBP/EUR/…) + tax disclosure at render time. Acknowledged-as-bug-vs-intent (memory: `project_region_aware_pricing.md`). When: after launch, or earlier if tickets land about "why £ when I'm in the US?".

### `/account/billing` + pricing UX polish

- [ ] **[E]** `/login?redirect=` not wired — login UI drops the `?redirect=` hint on auth completion. Affects `/account/billing` + `app/pricing/CheckoutButton.tsx` post-auth flow.
- [ ] **[E]** `/account/billing` UI polish — current page is redirect-only. Minimal billing overview (current plan, next charge, upgrade/cancel CTAs) could reduce bounces to Stripe portal.
- [ ] **[SP product-lead]** Mobile Base-tier IAP offering — paywall is Pro-only; Base user must use web. Intentional today per RC simplification; worth revisiting.
- [ ] **[E]** `PRICING_TIERS` leaf extraction — if mobile ever needs `ROADMAP`/`FAQS`/`HOW_IT_WORKS`, repeat leaf pattern.

### Data-integrity sweeps

- [ ] **[SP data-integrity + security-reviewer]** Supabase migration/RLS audit — thorough review since rebrand sweep (memory priority).
- [ ] **[E]** Pre-existing mobile test flakiness — `weightChartRangeFilter.test.ts`, `mealPlanAlgo.test.ts`, `progressSkeletonFirstPaint.test.tsx`, `todayActivityBonusCardMaintenanceTile.test.tsx` (rolling7 enum), `weeklyRecapPushRoute.test.ts` (weekKey field).

### TestFlight follow-on

- [ ] **B-8** Refresh TestFlight feedback pulls (blocked on Grace ASC creds above).
- [ ] **[SP qa-lead] B-9** E2E Maestro coverage for Progress tab skeleton — tap Progress → header <X ms → charts <Y ms.
- [ ] **B-10** Supabase audit + local-clone cleanup (see Grace-only above + data-integrity sweeps above).
- [ ] **[SP product-lead] B-12** Household share-flexibility extension — generalise `households.share_lunch boolean` to `households.shared_meals text[]` with multi-select UI.
- [ ] **[SP performance-optimizer] P2-1** Progress page slow to load (ASC `AEb7NcjnvK4PpVPHaaVUeI0`). Audit both mobile + web; produce named cause + fix before executor touches code.

---

## ⏳ Waiting on others (don't pull — will unblock automatically)

### TestFlight verified-by-tester (🟡 → ✅ once build-13 installs and tester stops reporting)

| ASC feedback ID | Track | What we shipped |
|----|-------|------|
| `AKvgjnb` | build-13 track H-2 | Food-search row now shows per-serving headline in the primary kcal column (not per-100g). |
| `APGJJlg` | build-13 track H-2 | Same fix as `AKvgjnb`. |
| `AAtW7dYcCBP` | build-13 track H-3 regression | Runtime crash on onboarding activity step — fixed in build-11 (F-3), regression tests now pin it. |
| `AEb7NcjnvK` | build-13 track H-4 | Progress tab slow load — now paints skeleton immediately, defers chart renders. |
| `AH8csBqt` | build-13 track H-5 | Plan view missing per-day total — now shows "Day total · X / Y kcal" line. |
| `AI-CNKcmy` | build-11 track F-5 regression | Recipe import was losing the source URL — now persists `source_url`. |
| `AB75VswCe` | build-11 track F-16 regression | Household join crash on multiple-member match — fixed with `.maybeSingle()` + unique-member migration. |
| `AGzhQaCDvr` | external (Supabase dashboard) | Sign-in-with-Apple failure — fixed by configuring the Supabase Apple provider. User confirmed 2026-04-19. |
| `AJFZ1hi` | external (Supabase dashboard) | Same root cause as `AGzhQaCDvr`. |

No action needed unless tester re-reports on build-13+.

### Unverifiable (🔍)

- `AN8GJ1Dr3M` — "Steps and total burn wrong for this day" — no reference source from tester. HK-provenance UI (B-5 above) would have prevented this dead-end.

### Post-ship / post-launch

- [ ] **[E] Update the PostHog paywall-views funnel** (internally known as the "F2 funnel" — paywall_viewed → checkout_started → checkout_completed) to include 5 new `from` attribution values: `recipes_library`, `shopping_list`, `profile`, `recipe_create`, `recipe_import`. Any dashboard still filtering on the old enum list will silently drop events. **Do within 7 days of shipping the landing-parity sweep.**
- [ ] **[SP growth-strategist] A/B test the web default billing period (monthly vs annual).** The 2026-04-19 decision kept web + mobile intentionally divergent (web defaults to monthly as a cold-traffic anchor; mobile defaults to annual because trial SKU is annual-only). Test whether making web also default to annual lifts paid conversion without tanking trial-start. See [docs/decisions/2026-04-19-pricing-default-billing-period-divergence.md](docs/decisions/2026-04-19-pricing-default-billing-period-divergence.md).
- [ ] **[SP integration-manager]** Confirm Edamam API credentials (`EDAMAM_APP_ID` / `EDAMAM_APP_KEY`) are set on Vercel Production env — otherwise `/api/edamam/search` returns empty silently. Already listed under Grace-only above; cross-linked here because integration-manager reviews.

### RevenueCat / IAP dependency chain (blocks mobile purchase E2E test + live trial flow)

The App Store Connect IAP products + RevenueCat offerings provisioning (listed under Grace-only → Pricing + billing) is the upstream blocker for: automated mobile Base-tier purchase E2E (Detox/Maestro), sandbox trial flow verification, and RC dashboard parity tests.

---

## ❓ Decisions pending

- [ ] **OFF ODbL final architecture** — Option A (cache-only) recommended; needs engineering scope + legal sign-off. See [docs/decisions/2026-04-19-off-odbl-architecture.md](docs/decisions/2026-04-19-off-odbl-architecture.md).
- [ ] **FatSecret tier** — Premier (no code change) vs rework to id-only (1 eng-day, adds latency). Needs product/finance call. See [docs/decisions/2026-04-19-fatsecret-caching.md](docs/decisions/2026-04-19-fatsecret-caching.md).
- [ ] **DI-P0-02 pronouns** — optional in onboarding vs settings-only launch? Product-lead.
- [ ] **DI-P0-03 hide-weight** — replacement Trend tile in Hide mode (consistency, fibre, hydration)? Product-lead.
- [ ] **Edamam food/restaurant search** (TestFlight P2-2, ASC `AOI9xgY88Dx-uphiXI8IzEk`) — in scope this milestone? If yes, Discovery (browse) or Add Meal (log)? Route: `product-lead`.
- [ ] **B-12 household share granularity** — scope decision before generalising `share_lunch` → `shared_meals text[]`. Route: `product-lead`.
- [ ] **Push re-permission audit** — does generic-body firing >4 weeks warrant re-permission moment, not just copy swap? Route: `customer-lens`.
- [ ] **TODO comment at `progress.tsx:628-632`** — scope delivery-rate listener or remove comment? Route: `planner`.
- [ ] **Kicker retirement (Paywall §15)** — keep `SUPPR PRO` / `CHOOSE YOUR PLAN` or retire entirely? Route: `ui-critic`.

---

## ✅ Completed 2026-04-19 (reference only)

**IP / legal (2 BLOCKERs + 8 HIGHs + most MEDIUMs + all LOWs):** HealthKit permission strings, ToS content licence, `/dmca` page, OFF ODbL attribution, SupprBot UA unified, Instagram/TikTok Whisper transcription removed, Edamam classifier + attribution, mobile paywall "Secured by Apple" removed + T&C links, `/privacy` sub-processor table, Unsplash avatars → silhouette SVG, BBC Good Food hotlink removed, USDA copy rewrite, sign-up positive-assent tick-box, `/licences` + `ATTRIBUTIONS.md` rewrite, footer entity "Suppr" pending incorporation, 4 stale prototype JSX + 4 React-logo PNGs + default_shadcn_theme.css deleted.

**Landing-parity sweep rounds 1–6:** shopping-list tier gating, renewal disclosure rewrite, voice-log Pro-only server-enforced (100/day), VAT posture decided, pricing default billing period divergence documented, pricing v1, Pattern A billing architecture, mobile paywall full redesign, VAT-inclusive disclosure fix, photo-log Pro gate server-side, PRICING_TIERS leaf-extracted.

**D&I audit — 6 fixes:** P0 household dead-name live-join, default sex `unspecified` for skippers, onboarding back-button label, `prefers-reduced-motion` on landing + mobile, 44pt touch target on unit toggle, landing streak-FAQ honesty rewrite. Plus `diversity-inclusion` specialist agent added.

**Progress Action 5 (executor #1):** Weekly Insight card removed (web + mobile); web today-bar dim bug; Avg Calories honest label on partial weeks; Maintenance line on WeeklyRecapCard; usualMealInsight gate loosened.

**Progress Action 13 (executor #2):** Web Trend tile `?? Infinity` + duplicate-IIFE drift; Macro Adherence cap parity (150%); Web Daily Calories denominator; Mobile Trend + Weight imperial-unit drift; Daily projection floor (≥5 days); "Closest to target" replaces "Best day"; Mobile Steps sync-failed state; Snapshot fallback dashed border; Maintenance weekly-loss caveat; Recap weight delta relabel; Adaptive TDEE confidence badge / formula pill split; Days-to-goal "More than 1 year" fallback.

**A1 Digest tier-gating decided:** gate at CTA-level (not whole Digest); per-suggestion gating defined (re-log/maintenance/streak/weight = Free; protein = Base+); reserved upsell slot (soft, no whitespace); no fake Pro for trial users; locked CTA copy rule (name the actual feature + tier).

**A2 Maintenance recalibrate CTA decided:** Option C — two-tap apply with inline diff, no undo toast. 21-day cooldown. Confidence floor: `high` only.

**H-track / build-13 follow-up commit:** mobile vitest testTimeout 5s → 10s; `maintenanceTdeeKcal` prop in `TodayCompleteDayModal`; stale test name rename; tracker + DOCUMENTATION_HUB pointer committed.

---

## Sources

This file consolidates (archived to [docs/planning/archive/](docs/planning/archive/)):

- `TODO.md` (2026-04-19 original) — sprint + Sunday push
- `docs/planning/ongoing-backlog.md` — Grace-owned ops + D&I backlog + tech debt
- `docs/planning/ip-followups-2026-04-19.md` — IP / compliance
- `docs/product/open-items.md` — pre-ship gate
- `docs/planning/testflight-followups-2026-04-19.md` — build-13 follow-ups
- `docs/planning/testflight-build-7-remaining.md` — earlier-build open items

Open action items also pulled from:

- [docs/decisions/2026-04-19-off-odbl-architecture.md](docs/decisions/2026-04-19-off-odbl-architecture.md)
- [docs/decisions/2026-04-19-fatsecret-caching.md](docs/decisions/2026-04-19-fatsecret-caching.md)

Kept separate (not consolidated):

- [docs/planning/sweep-2026-04-executor-backlog.md](docs/planning/sweep-2026-04-executor-backlog.md) — orchestrator-driven executor queue
- [docs/planning/analytics-dashboards-plan-2026-04-18.md](docs/planning/analytics-dashboards-plan-2026-04-18.md) — analytics plan (reference)
- [docs/planning/post-feature-expansion-audit-2026-04-18*.md](docs/planning/) — audit snapshots (reference)
- [docs/planning/supabase-migration-drift-inventory.md](docs/planning/supabase-migration-drift-inventory.md) — data state
- [PARITY_AUDIT.md](PARITY_AUDIT.md), [docs/deployment/ship-checklist.md](docs/deployment/ship-checklist.md), [docs/mobile_qa_uat_test_plan.md](docs/mobile_qa_uat_test_plan.md) — reference docs
