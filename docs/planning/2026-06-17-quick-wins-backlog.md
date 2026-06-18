# Quick-wins burn-down — 2026-06-17

**Strategy shift (Grace, 2026-06-17):** stop strict gate-order sequencing; burn
down small, agent-buildable, in-repo items in batches. Prefer S/M effort (≤2h),
no Grace-ops/legal/Supabase-dashboard, no schema migrations. Commit + push +
watch CI per batch; Linear comment + state on each closed item.

**Branch:** `claude/wave-4-trust-cohesion` — **9 commits ahead of `main`** (batches
1–2 + partial Core-5 slices). **PR #470 merged** (2026-06-17); rebase onto
`origin/main` before the next push. Batch 3 Figma partials continue on this
branch until rebased clean, then optionally cut `claude/quick-wins-batch-3`.

## Triage table — batch 1

| Issue | Title | Effort | Agent? | Status | Notes |
|-------|-------|--------|--------|--------|-------|
| ENG-1149 | Delete stale `KNOWN APPROXIMATION` header in `measureToGrams.ts` | S | ✅ | **Shipped** | Comment-only; ENG-701 already re-ordered food-specific-before-generic (verified at resolver lines ~210–225/260–266). No behaviour change. |
| ENG-1156 | Delete orphaned `onboarding/finalStep.ts` (dead code, banned "staged for follow-up") | S | ✅ | **Shipped** | Zero runtime importers (only its own test). Deleted file + `onboardingFinalStepPhase3.test.ts`; re-anchored prose comments in `state.ts` / `onboardingSeeds.ts` to `NORTH_STAR_LIBRARY_MIN`. |
| ENG-1152 | Harden SSRF string-layer: block `0.0.0.0` + integer/octal/hex IPv4 encodings | M | ✅ | **Shipped** | Added `canonicaliseIpv4` (inet_aton-style) + all-zeros handling to `ssrfAllowlist.ts`; loopback widened to `/8`. 9 new test cases; DNS backstop in `ssrfGuard.ts` untouched. Client-bundle-safe (no Node builtins). |
| ENG-1159 | Vendor/logging cleanups (edamam dead code · caption truncation · `food_search` source) | M | ✅ | **Shipped (batch 2)** | (a) dead edamam code removed in batch 1. (b) `CAPTION_MAX` + `captionTruncated` in `extractSocialRecipe.ts`, wired to web `RecipeUpload` + mobile `import-shared` preview banners. (c) `food_search` added to `FoodLoggedSource`; `foodSelectionAnalyticsSource` + mobile food-search log sites updated for parity. |
| ENG-1166 | Root docs reference missing `apps/mobile/AGENTS.md` | S | ✅ | **Shipped (Option C)** | `.claude/CLAUDE.md` canonical; root `AGENTS.md` tracked mirror (`npm run sync:agent-docs`) so Codex/Cursor see rules on clone. Decision `docs/decisions/2026-06-17-agent-docs-claude-canonical.md`; test `agentDocsCanonical.test.ts`. |

**Batch result:** 3 issues fully shipped (ENG-1149, ENG-1156, ENG-1152) +
ENG-1159 materially advanced (dead-code half) + ENG-1166 triaged-and-blocked
(gitignore policy decision, see row). All shipped code landed via commit
`991f1087` on `claude/wave-4-trust-cohesion` (swept into a concurrent agent's
quick-wins commit — same branch, parallel sessions).

## Triage table — batch 2

| Issue | Title | Effort | Agent? | Status | Notes |
|-------|-------|--------|--------|--------|-------|
| ENG-1159 (b) | Caption-truncation notice (`CAPTION_MAX` + `captionTruncated`) | S | ✅ | **Shipped** | `prepareCaptionForExtraction` helper; API + web `RecipeUpload` + mobile `import-shared` preview banners. |
| ENG-1159 (c) | `food_search` analytics source (web + mobile parity) | S | ✅ | **Shipped** | `FoodLoggedSource` union + `foodSelectionAnalyticsSource` + mobile `handleFoodSearchSelect` call sites. |
| ENG-1153 | Defence-in-depth on `claim_web_push_subscription` endpoint | S | ✅ | **Shipped** | `isValidWebPushEndpoint` guard before RPC; unsubscribe DELETE scoped by `user_id` when available. Code-only (no migration). |
| ENG-1151 | Sentry PII denylist — health fields | S | ✅ | **Shipped** | Extended `PII_KEY_PATTERN` in `sentryRedaction.ts` (weight/measurements/sex-at-birth); unit test pinned. |
| ENG-1075 / ENG-1145 | Mobile OFF barcode via `/api/off/barcode` proxy | S | ✅ | **Shipped** | `lookupBarcode` in `verifyRecipe.ts` routes through authed proxy; direct `world.openfoodfacts.org` fetch removed. |
| CI (ENG-896) | DiscoverFeed `text-[17px]` off type scale | S | ✅ | **Shipped** | `text-[18px]` on-scale fix in `DiscoverFeed.tsx`. |

**Batch 2 result:** 5 Linear issues closed (ENG-1159 fully, ENG-1153, ENG-1151,
ENG-1075, ENG-1145) + CI type-scale unblock. Commit on `claude/wave-4-trust-cohesion`.

**Validation (batch 2):** `npm run check:type-scale` green; scoped web
`typecheck && lint && test` on touched units; mobile `typecheck && test` on
`verifyRecipe` / `offPlausibilityGateParity` / `index` food-search wiring.

## Triaged-but-skipped (not quick wins / out of policy)

| Issue | Why skipped |
|-------|-------------|
| ENG-1144 | Sync mobile `database.types.ts` — touches generated types; regen needs Supabase. |
| ENG-1154 / ENG-845 | `search_path` pins on SECURITY DEFINER fns — SQL migration (forbidden via MCP). |
| ENG-558 / ENG-541 / ENG-1158 | Grace-ops / dashboard toggles / cost-breaker decision — not code. |
| ENG-1138 | Web focus-visible rings — visible change; feature-flag overhead, defer to a UI batch. |

## Triage table — batch 3 (Core-5 Figma partials)

**Scope (Grace, 2026-06-17):** remaining agent-buildable Layer-3 slices on the
five Wave-4 parent tickets that Gate 1.5 left partial. Parent issues stay
**In Progress** until screenshot wall / device verify closes them — batch 3
closes individual partial rows only.

**Branch:** `claude/wave-4-trust-cohesion` — **uncommitted** session work (ENG-1166,
ENG-898 recent imports, ENG-889 S5) atop 9 commits ahead of `main`. Rebase +
commit before push.

| Issue | Partial | Effort | Status | Residual |
|-------|---------|--------|--------|----------|
| **ENG-901** | M6 import-success overlay (web) | S | **On branch** + unit + integration test (`recipeImportSurface`) | Visual: import-success path needs live import+save (not idle shot) |
| **ENG-896** | Discover seamless slab cards | S | **Verified web + iOS** | — |
| **ENG-897** | Signup email-step pixel (`296:33`) | S | **On branch** + test pin | `/login`/`/signup` web-drive redirects when session exists — verify in incognito or signed-out |
| **ENG-898** | Recent imports + caption-preview trust | S | **Shipped code** — shared `recentImports.ts`, web list, mobile refactor | Empty list hides section (correct); caption banner already live |
| **ENG-889** | Today S5 Fresh start | S | **Verified web + iOS** — Fresh start chip de-tint, honest zeros, coach line | Populated-account wall (optional) |
| **ENG-1100** | Plan partial-day canonical slots | S | **Shipped (mobile)** — `orderedPlanDaySlotEntries` + 3 unit tests; **web** — `EmptyMealSlotRow` extract (`empty-meal-slot-row.tsx`) wired Today + Plan | Mobile row extract still open |

### Batch 3 visual verify (2026-06-18)

| Surface | Web (~390px / desktop) | iOS sim | Notes |
|---------|------------------------|---------|-------|
| Import idle (ENG-898) | ✅ `/import --auth` | ✅ `import-shared` | WORKS WITH row; no recent imports (empty account — expected) |
| Discover slabs (ENG-896) | ✅ `/discover --auth` desktop + mobile | ✅ `batch-3-discover-ios-loaded.png` | Mediterranean/Greek hero + seamless slab card + macro row |
| Today S5 (ENG-889) | ✅ `/today --auth` | ✅ hero | Fresh start, 0 eaten, food-forward coach |
| Auth email step (ENG-897) | ✅ test-pinned (`authChooserFigma.test.ts`) | — | Unit pin passes; live `/signup` needs signed-out session for screenshot |

**Batch 3 execution order (remaining):** commit session (batch 3 + ENG-1166 Option C + Linear sync scripts + ENG-1100 partial) → rebase `origin/main` → scoped `npm run ci` → push → Linear partial-row comments.

## Deferred — batch 4+ (non-Figma quick wins)

1. **ENG-1168** — silent-deferral re-sweep: open a Linear issue per surviving untracked gap comment.
2. **ENG-1100** — Plan empty-slot unification: **partial-day canonical rows shipped (mobile)**; shared `EmptyMealSlotRow` web extract still open.
3. **ENG-1147 follow-ups / ENG-986** — shared macro-icon mapping (single source of truth).
4. **ENG-1090** — CI flake: storybook build `EEXIST` mkdir race in static-asset `copyDir`.
5. **ENG-1096 / ENG-984** confirm closed; **ENG-848** — wire or delete `MacroDetailPanel` on web.
