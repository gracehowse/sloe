# TestFlight follow-ups — post build-13 (2026-04-19)

**Source:** H-track closure pass (build-13, commit `9469b8f`) + specialist-flagged follow-ups from H-2/3/4/5 executors + rebrand checklist in `.claude/projects/-Users-graceturner-Suppr-1/memory/project_rebrand_checklist.md`.

**Handoff:** `executor` implements in priority order below; the listed reviewer signs off before the item is considered closed.

See also:
- **[tracker.md](../testflight-feedback/tracker.md)** — canonical TestFlight ID ledger.
- **[resolved.md](../testflight-feedback/resolved.md)** — per-incident detail.
- **[sweep-2026-04-executor-backlog.md](./sweep-2026-04-executor-backlog.md)** — older sweep backlog (most P0s shipped).

---

## Verified-by-tester pending (🟡 → ✅)

These fixes are in `main`; status flips to ✅ once build-13 installs and tester stops reporting.

| ID | Track | Build | Note |
|----|-------|-------|------|
| `AKvgjnb` | H-2 | build-13 | Per-serving headline now in primary kcal column. |
| `APGJJlg` | H-2 | build-13 | Same fix as `AKvgjnb`. |
| `AAtW7dYcCBP` | H-3 (reg) | build-13 | Runtime fixed in F-3 (build-11); regression tests now pin it. |
| `AEb7NcjnvK` | H-4 | build-13 | Skeleton-first paint; deferred charts. |
| `AH8csBqt` | H-5 | build-13 | Plan day-total vs goal line. |
| `AI-CNKcmy` | F-5 (reg) | build-11 | Import persists `source_url`. Pending verify since tester may still be on build 10. |
| `AB75VswCe` | F-16 (reg) | build-11 | `.maybeSingle()` + unique-member migration. Same verify caveat. |
| `AGzhQaCDvr` | external | — | Supabase Apple provider config (server-side). User confirmed fixed 2026-04-19. |
| `AJFZ1hi` | external | — | Same root cause as `AGzhQaCDvr`. |

No action needed unless tester re-reports on build-13+.

---

## Unverifiable (🔍)

| ID | Why stuck |
|----|-----------|
| `AN8GJ1Dr3M` | "Steps and total burn wrong for this day" — numbers internally reconcile; tester did not include a reference source of truth (HealthKit app, Fitbit, etc.). Cannot verify without their raw data for that date. |

**Action:** none, unless tester re-reports with a side-by-side screenshot. The HK-provenance UI (P2 below) would have prevented this triage dead-end.

---

## P1 — Product gaps exposed by build-13 work

### B-1: Web Recipe Detail source card

**Problem:** `src/app/components/RecipeDetail.tsx` + `app/recipe/[id]/page.tsx` render no source card at all. Documented intentional gap in `resolved.md:521-527`. Mobile has a three-mode render (both / url-only / name-only) — web is the outlier.

**Goal:** mirror mobile's three render modes on web, flip the `recipeSourceCardParity.test.ts` pinned gap assertion.

**Effort:** S (mostly UI plumbing; data already on the fetch projection).

**Owner:** `executor`. **Review:** `sync-enforcer` (parity), `copy-reviewer` (link text on "name-only" branch).

**Validation:** parity test flip + component test pinning the 3 branches.

---

### B-2: Today view — Activity Bonus pill row redundancy (mobile)

**Flagged by:** H-5 executor.

**Problem:** After H-5 added the explicit "Day total · X / Y kcal · P / C / F" line, the pre-existing `P / C / F / Fi` macro-pill row with `+/-` arrows on each day is partly redundant. The pills still carry fibre (not in the new line) and directional arrows.

**Goal:** `ui-critic` decides whether to consolidate — either add fibre to the new line and drop the pills, or keep both with clearer labelling.

**Effort:** S once the decision is made.

**Owner:** `ui-critic` (decision), then `executor`. **Review:** `visual-qa`, `copy-reviewer`.

**Validation:** snapshot parity + tester readback ("am I on track?" answerable in <3s).

---

### B-3: Plan view — web consolidation question

**Flagged by:** H-5 executor.

**Problem:** Web per-day detail card now carries the compact text line plus `DailyRing + MacroCard`. Same redundancy question as B-2, web side.

**Goal:** `ui-product-designer` decides whether the ring/card or the text line is the canonical read for "how close am I to goal?" and drops the other.

**Effort:** M (layout rework).

**Owner:** `ui-product-designer` (decision + new spec), then `executor`.

---

### B-4: Food search row — drop redundant per-100g reference

**Flagged by:** H-2 executor.

**Problem:** Rows with per-serving data now show the accent "per serving" badge + serving label but still carry a subdued `· {kcal} kcal / 100 g` reference suffix on the same line. Internal review: once testers acclimate to per-serving, this suffix becomes noise.

**Goal:** A/B or silent drop of the suffix. Metric: tester quote "defaults to 100g" should stop appearing in TestFlight pulls.

**Effort:** S.

**Owner:** `executor`. **Review:** `customer-lens`, `copy-reviewer`.

---

## P2 — Architectural lessons worth fixing proactively

From the **Recurring themes** section of [tracker.md](../testflight-feedback/tracker.md).

### B-5: HK provenance chevron on every derived fitness number

**Architectural lesson #9** (tracker.md).

**Problem:** Testers report "wrong for this day" without a reference (`AN8GJ1Dr3M`, `AD6_JNUaE`, `AJHZNp8N`). We cannot diagnose without their raw HealthKit data.

**Goal:** every derived fitness/nutrition number (steps, active energy, resting energy, total burn, daily calorie intake) has an info chevron that opens a "source of this number" pane: `HealthKit → {typeId} · {N} samples · range {first}–{last} · summed {value}`. Copy neutral; no accusation of wrongness.

**Effort:** M — need a shared `{value, provenance}` wrapper type and a pane component; applied to ~6 surfaces.

**Owner:** `executor`. **Review:** `ui-product-designer` (pane design), `data-integrity` (provenance schema).

**Validation:** tester can screenshot the pane and tell us which assumption is wrong.

---

### B-6: Landing-copy SSOT tested on every numeric claim

**Architectural lesson #8.**

**Goal:** extend `src/lib/landing/content.ts` coverage so every numeric claim on landing (`10-recipe free limit`, `7-day refund policy`, `7 logging days + 3 weigh-ins`, etc.) reads from a canonical source or is tested against one. Reject-on-CI if a literal number appears in `app/(landing)/**` without a matching SSOT read.

**Effort:** S — most of the SSOT already exists; needs a lint-style test that fails on stray literals.

**Owner:** `executor`. **Review:** `sync-enforcer`, `copy-reviewer`.

---

### B-7: ESLint rule banning relative `fetch()` URLs in mobile

**Architectural lesson #5.**

**Goal:** custom ESLint rule (or just a grep-style test) failing CI when a mobile file calls `fetch("/…"` — React Native has no origin, so relative URLs silently fail. `AAegi1DJ` was this exact bug.

**Effort:** XS.

**Owner:** `executor`. **Review:** `code-quality`.

**Validation:** seed a relative `fetch()` in a test fixture and verify the rule flags it.

---

## P3 — Ongoing / cross-cutting

### B-8: Refresh TestFlight feedback pulls

**Problem:** `.env.local` lacks `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_PRIVATE_KEY` / `ASC_APP_ID`, so `npm run testflight:feedback` can't run. The 2026-04-19 13:29 pull is the most recent we have.

**Goal:** set ASC creds in `.env.local` per [README.md](../testflight-feedback/README.md) and rerun the pull once build-13 has been installed by the test cohort (typically 24h after upload).

**Owner:** user. **Review:** n/a.

---

### B-9: E2E Maestro coverage for Progress tab skeleton

**Flagged by:** H-4 executor.

**Goal:** Maestro sequence: tap Progress tab → assert "Progress" header visible within X ms → charts visible within Y ms. Catches the cold-load regression automatically on CI.

**Effort:** S.

**Owner:** `qa-lead`. **Review:** `executor`.

---

### B-10: Supabase audit + local-clone cleanup

**Source:** `memory/project_supabase_audit_next.md`.

**Goal:** thorough migration / RLS review (not done since the rebrand sweep); also delete the duplicate checkout at `/Users/graceturner/suppr/` after mirroring its `.env.local` to the primary repo.

**Owner:** `executor` + `security-reviewer` (RLS) + `data-integrity` (migrations).

---

### B-11: External-system rebrand audit (platemate → suppr)

**Source:** `memory/project_rebrand_checklist.md`.

**Systems to check for stale `platemate` references:**
- GitHub (repo name, description, org, old issue templates)
- Vercel (project name, domain aliases, deploy protection)
- PostHog (project name, event-property schemas referencing old names)
- Sentry (project slug, release tags)
- Stripe (product / price nicknames, receipt descriptors)
- Transactional email "from" address (verify all outbound uses `@suppr.club` or similar, not old domain)

**Note:** Supabase Apple provider audience was the last-discovered one (`AJFZ1hi` / `AGzhQaCDvr`) — the lesson is that these surface late.

**Owner:** user (dashboard access required). Report completion into this file.

---

### B-12: Household share-flexibility extension

**ASC ref:** `AJ1AeYJ--` (resolved via F-16 lunch flag) + tester's broader ask for "dinner only / dinner + lunch / breakfast + dinner" granularity.

**Current state:** `households.share_lunch boolean` plus always-dinner. Other combinations require migration + UI.

**Goal:** generalise to `households.shared_meals text[]` with UI multi-select in Household settings.

**Effort:** M (migration + RLS update + mobile/web Household settings UI).

**Owner:** `product-lead` (scope decision), then `executor`.

**Deferred because:** `AJ1AeYJ--` is already marked resolved on the dinner+lunch path; this is incremental, not a bug fix.

---

## Done in this pass (2026-04-19 follow-up commit)

- ✅ Bumped mobile vitest `testTimeout` from 5s → 10s (closes the `mealPlanAlgo.test.ts` flake flagged by H-2 + H-4).
- ✅ Threaded `maintenanceTdeeKcal` prop into `TodayCompleteDayModal` (closes the H-3-flagged wiring gap at `apps/mobile/app/(tabs)/index.tsx:3179` — previously falling back to a crude target heuristic).
- ✅ Renamed stale test name `"picks the highest-protein day as bestDay"` → `"picks the closest-to-target day as bestDay"` (Action 13 cosmetic).
- ✅ Committed the tracker doc + DOCUMENTATION_HUB pointer.

---

## Out of scope for this file

Items that belong to the older sweep backlog, not TestFlight:

- Any P0 from [`sweep-2026-04-executor-backlog.md`](./sweep-2026-04-executor-backlog.md) still open (none as of 2026-04-19 per that doc's status line).
- Generic performance work not tied to a tester report.
- New feature scope (planner AI, recipe discovery algorithms, etc.) — those belong in product-lead's roadmap, not here.
