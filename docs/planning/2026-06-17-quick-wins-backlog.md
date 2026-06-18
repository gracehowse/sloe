# Quick-wins burn-down — 2026-06-17

**Strategy shift (Grace, 2026-06-17):** stop strict gate-order sequencing; burn
down small, agent-buildable, in-repo items in batches. Prefer S/M effort (≤2h),
no Grace-ops/legal/Supabase-dashboard, no schema migrations. Commit + push +
watch CI per batch; Linear comment + state on each closed item.

**Branch:** `claude/wave-4-trust-cohesion` (PR #470 still open — not merged, so
this batch rides on the current branch per the standing instruction; new
`claude/quick-wins-*` branch only once #470 merges).

## Triage table — batch 1

| Issue | Title | Effort | Agent? | Status | Notes |
|-------|-------|--------|--------|--------|-------|
| ENG-1149 | Delete stale `KNOWN APPROXIMATION` header in `measureToGrams.ts` | S | ✅ | **Shipped** | Comment-only; ENG-701 already re-ordered food-specific-before-generic (verified at resolver lines ~210–225/260–266). No behaviour change. |
| ENG-1156 | Delete orphaned `onboarding/finalStep.ts` (dead code, banned "staged for follow-up") | S | ✅ | **Shipped** | Zero runtime importers (only its own test). Deleted file + `onboardingFinalStepPhase3.test.ts`; re-anchored prose comments in `state.ts` / `onboardingSeeds.ts` to `NORTH_STAR_LIBRARY_MIN`. |
| ENG-1152 | Harden SSRF string-layer: block `0.0.0.0` + integer/octal/hex IPv4 encodings | M | ✅ | **Shipped** | Added `canonicaliseIpv4` (inet_aton-style) + all-zeros handling to `ssrfAllowlist.ts`; loopback widened to `/8`. 9 new test cases; DNS backstop in `ssrfGuard.ts` untouched. Client-bundle-safe (no Node builtins). |
| ENG-1159 | Vendor/logging cleanups (edamam dead code · caption truncation · `food_search` source) | M | ⚠️ | **Part (a) shipped — open** | (a) Removed dead `edamamNutritionAnalysis`/`edamamAnalysisMacros` + types + their tests. (b) 4000-char caption-truncation notice and (c) `food_search` analytics source each touch web **and** mobile log/preview paths — doing (c) web-only would create `food_logged.source` parity drift, so they're tracked on the open ticket (not quick wins). |
| ENG-1166 | Root docs reference missing `apps/mobile/AGENTS.md` | S | ⚠️ | **Blocked — needs Grace decision** | `AGENTS.md` is gitignored repo-wide (`.gitignore:32`); root `AGENTS.md` is itself a locally-generated, untracked artifact. A tracked `apps/mobile/AGENTS.md` therefore can't ship as a normal commit. Created the pointer file locally (resolves the reference on-machine), but the durable fix is Grace's call: either un-ignore + force-track `AGENTS.md` files, or accept `apps/mobile/CLAUDE.md` (already tracked, already referenced by `.claude/CLAUDE.md`) as canonical and adjust the generator. |

**Batch result:** 3 issues fully shipped (ENG-1149, ENG-1156, ENG-1152) +
ENG-1159 materially advanced (dead-code half) + ENG-1166 triaged-and-blocked
(gitignore policy decision, see row). All shipped code landed via commit
`991f1087` on `claude/wave-4-trust-cohesion` (swept into a concurrent agent's
quick-wins commit — same branch, parallel sessions).

**Validation:** `vitest.unit.config.ts` scoped run — 136 passed across
ssrfProtection / ssrfGuard / recipeImportSsrfGuardCallsites / edamamClient /
foodSelectionToMeal / measureToGrams(+Categories). `npm run typecheck` green.
No lint findings on touched files.

## Triaged-but-skipped (not quick wins / out of policy)

| Issue | Why skipped |
|-------|-------------|
| ENG-1144 | Sync mobile `database.types.ts` — touches generated types; regen needs Supabase. |
| ENG-1154 / ENG-845 | `search_path` pins on SECURITY DEFINER fns — SQL migration (forbidden via MCP). |
| ENG-558 / ENG-541 / ENG-1158 | Grace-ops / dashboard toggles / cost-breaker decision — not code. |
| ENG-1138 | Web focus-visible rings — visible change; feature-flag overhead, defer to a UI batch. |

## Top next quick wins for tomorrow (candidates)

1. **ENG-1159 (b)** — caption-truncation notice: `CAPTION_MAX` const +
   `captionTruncated` flag in `extractSocialRecipe.ts`, wired into web +
   mobile import preview (mirror the `imageUsed?` return-shape pattern).
2. **ENG-1159 (c)** — `food_search` analytics source: add to `FoodLoggedSource`,
   update `foodSelectionAnalyticsSource`, **and** the mobile food-search log
   call site together (parity), update `foodSelectionToMeal.test.ts`.
3. **ENG-1075 / ENG-1145** — route mobile OFF barcode through `/api/off/barcode`
   proxy (web parity).
4. **ENG-1149-style sweep — ENG-1168** silent-deferral re-sweep: open a Linear
   issue per surviving untracked gap comment.
5. **ENG-1153** — defence-in-depth on `claim_web_push_subscription` endpoint-only
   DELETE (code-level).
6. **ENG-1151** — extend Sentry PII redaction denylist to health fields
   (weight/measurements/sex-at-birth) — config + test.
7. **ENG-1100** — Plan empty-slot unification: extract shared `EmptyMealSlotRow`.
8. **ENG-1147 follow-ups / ENG-986** — shared macro-icon mapping (single source
   of truth) to prevent glyph drift.
9. **ENG-1090** — CI flake: storybook build `EEXIST` mkdir race in static-asset
   `copyDir` (CI hygiene).
10. **ENG-1096 / ENG-984** confirm closed; **ENG-848** — wire or delete
    `MacroDetailPanel` on web (parity decision).
