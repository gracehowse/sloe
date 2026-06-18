# Quick-wins burn-down — 2026-06-17

**Last updated:** 2026-06-18 (post-#476; #477 in flight)  
**Strategy shift (Grace, 2026-06-17):** stop strict gate-order sequencing; burn
down small, agent-buildable, in-repo items in batches. Prefer S/M effort (≤2h),
no Grace-ops/legal/Supabase-dashboard, no schema migrations. Commit + push +
watch CI per batch; Linear comment + state on each closed item.

**Current branch:** `main` (batches 1–3 + batch-4 Codex slice merged via #471, #472, #475, #476).  
**In flight:** none — next slice: ENG-889 L5 dark verify (`314:2`) or next Core-5 partial from migration tracker.

## Merge history (reference)

| PR | Branch | What landed |
|----|--------|-------------|
| [#470](https://github.com/gracehowse/Suppr/pull/470) | `claude/wave-4-trust-cohesion` | Gate 1.5 closeout (ENG-1184/1065/895, L1 skeleton, M5 streak, library grid, WORKS WITH import) |
| [#472](https://github.com/gracehowse/Suppr/pull/472) | `claude/wave-4-trust-cohesion` | Batch 3: recent imports, S5 Fresh start, import-success integration, ENG-1166, partial-day Plan slots |
| [#475](https://github.com/gracehowse/Suppr/pull/475) | `agent/cursor/eng-1100-empty-meal-slot-row` | ENG-1100 `EmptyMealSlotRow` extract (web + mobile) — **Linear Done** |
| [#476](https://github.com/gracehowse/Suppr/pull/476) | `agent/cursor/eng-901-trust-strip` | ENG-901 trust strip + Sloe upgrade dialog + pricing dedupe; ENG-889 coach-in-hero + mobile L1 skeleton — **Merged** · **ENG-901 Linear Done** |
| [#471](https://github.com/gracehowse/Suppr/pull/471) | Codex maintenance batch | ENG-1168 silent-deferral sweep · ENG-848 `web_macro_detail_panel` · ENG-1090 Storybook `EEXIST` fix — **Merged** · **Linear Done** |
| [#477](https://github.com/gracehowse/Suppr/pull/477) | `agent/cursor/eng-889-visual-verify-docs` | ENG-889 visual-verify rows + backlog hygiene (batch 4 Done table) — **Merged** |

---

## Triage table — batch 1 (merged)

| Issue | Title | Effort | Agent? | Status | Notes |
|-------|-------|--------|--------|--------|-------|
| ENG-1149 | Delete stale `KNOWN APPROXIMATION` header in `measureToGrams.ts` | S | ✅ | **Shipped** | Comment-only; ENG-701 already re-ordered food-specific-before-generic. |
| ENG-1156 | Delete orphaned `onboarding/finalStep.ts` | S | ✅ | **Shipped** | Zero runtime importers; deleted file + test. |
| ENG-1152 | Harden SSRF string-layer | M | ✅ | **Shipped** | `canonicaliseIpv4` + all-zeros handling in `ssrfAllowlist.ts`. |
| ENG-1159 | Vendor/logging cleanups | M | ✅ | **Shipped (batch 2)** | Edamam dead code (batch 1); caption truncation + `food_search` source (batch 2). |
| ENG-1166 | Root docs reference missing `apps/mobile/AGENTS.md` | S | ✅ | **Shipped (Option C)** | `.claude/CLAUDE.md` canonical; tracked root `AGENTS.md` via `npm run sync:agent-docs`. Decision `docs/decisions/2026-06-17-agent-docs-claude-canonical.md`. **Linear Done.** |

**Batch 1 result:** ENG-1149, ENG-1156, ENG-1152 shipped on `claude/wave-4-trust-cohesion`; ENG-1159 + ENG-1166 completed in batch 2/3 (#472).

---

## Triage table — batch 2 (merged)

| Issue | Title | Effort | Agent? | Status | Notes |
|-------|-------|--------|--------|--------|-------|
| ENG-1159 (b) | Caption-truncation notice | S | ✅ | **Shipped** | `prepareCaptionForExtraction`; web + mobile preview banners. |
| ENG-1159 (c) | `food_search` analytics source | S | ✅ | **Shipped** | `FoodLoggedSource` + parity call sites. |
| ENG-1153 | Defence-in-depth on `claim_web_push_subscription` | S | ✅ | **Shipped** | `isValidWebPushEndpoint` guard; scoped unsubscribe DELETE. |
| ENG-1151 | Sentry PII denylist — health fields | S | ✅ | **Shipped** | Extended `PII_KEY_PATTERN` in `sentryRedaction.ts`. |
| ENG-1075 / ENG-1145 | Mobile OFF barcode via `/api/off/barcode` proxy | S | ✅ | **Shipped** | Authed proxy; direct OFF fetch removed. |
| CI (ENG-896) | DiscoverFeed `text-[17px]` off type scale | S | ✅ | **Shipped** | `text-[18px]` on-scale fix. |

---

## Triaged-but-skipped (not quick wins / out of policy)

| Issue | Why skipped |
|-------|-------------|
| ENG-1144 | Sync mobile `database.types.ts` — touches generated types; regen needs Supabase. |
| ENG-1154 / ENG-845 | `search_path` pins on SECURITY DEFINER fns — SQL migration (forbidden via MCP). |
| ENG-558 / ENG-541 / ENG-1158 | Grace-ops / dashboard toggles / cost-breaker decision — not code. |
| ENG-1138 | Web focus-visible rings — visible change; feature-flag overhead, defer to a UI batch. |

---

## Triage table — batch 3 (Core-5 Figma partials)

**Scope:** agent-buildable Layer-3 slices on Wave-4 parent tickets ENG-889/896/897/898/901.
Parent issues stay **In Progress** until screenshot wall closes them — batch 3 closes
individual partial rows only.

| Issue | Partial | Status on `main` | Residual (parent still open) |
|-------|---------|------------------|------------|------------------------------|
| **ENG-901** | Trust strip · upgrade dialog · web pricing dedupe | M5 + M6 (#472); frame `284:2` trust + Sloe upgrade dialog + dedupe (#476) — **Linear Done** | — |
| **ENG-896** | Discover seamless slab cards | **Verified** web + iOS (#472 / batch 3) | 9 other Recipes/Cookbook partials on parent |
| **ENG-897** | Signup email-step pixel (`296:33`) | Test pin `authChooserFigma.test.ts` (#472) | Live `/signup` screenshot needs signed-out session |
| **ENG-898** | Recent imports + caption trust | **Shipped** — `recentImports.ts`, web list, mobile refactor (#472) | 7 other Import partials on parent (source tiles, L4 error, etc.) |
| **ENG-889** | Today partials | L1 (#472/#476); S5 (#472); coach-in-hero (#476); TD1/TD2 unit-pinned | L5 dark, TD3/TD4, pixel deltas, populated-account screenshot wall |
| **ENG-1100** | Plan empty-slot unification | **Done** — partial-day canonical rows (#472) + `EmptyMealSlotRow` extract (#475) | **Linear Done** — no follow-up in this queue |

### Batch 3 visual verify (2026-06-18)

| Surface | Web (~390px / desktop) | iOS sim | Notes |
|---------|------------------------|---------|-------|
| Import idle (ENG-898) | ✅ `/import --auth` | ✅ `import-shared` | WORKS WITH row; empty recent-imports list is correct |
| Discover slabs (ENG-896) | ✅ `/discover --auth` | ✅ | Mediterranean/Greek hero + seamless slab card |
| Today S5 (ENG-889) | ✅ `/today --auth` | ✅ hero | Fresh start, honest zeros, food-forward coach |
| Today coach-in-hero (ENG-889) | ✅ populated account (~390px) | ⏳ | Shipped #476 — iOS sim verify pending |
| Paywall trust (ENG-901) | ✅ `/pricing` post–`use client` fix (#476) | ⏳ | Shipped #476 — iOS sim verify pending |
| Auth email step (ENG-897) | ✅ unit pin | — | Live screenshot needs signed-out session |

### Batch 3 — what's left

1. **ENG-889** — L5 dark verify (`314:2`); TD3/TD4 if gaps in migration tracker; pixel deltas.
2. **ENG-896 / ENG-898 / ENG-897** — next high-severity partial from `docs/ux/redesign/figma-migration-tracker.md`.

## Triage table — batch 4 (maintenance / hygiene)

| Issue | Title | Status on `main` | Notes |
|-------|-------|------------------|-------|
| **ENG-1168** | Silent-deferral re-sweep | **Done** (#471) | Linear Done 2026-06-18 |
| **ENG-848** | Web `MacroDetailPanel` wire-or-delete | **Done** (#471) | Wired via default-on `web_macro_detail_panel`; see `docs/technical/components.md` |
| **ENG-1090** | Storybook `EEXIST` copyDir flake | **Done** (#471) | Linear Done 2026-06-18 |
| ENG-1147 / ENG-986 | Shared macro-icon mapping SSOT | Open | Single-source icon map for macro tiles |
| ENG-1096 / ENG-984 | Dead TodayMealsFigmaLayout / eat-again banner | Open | Confirm still unrendered before delete PR |

**Removed from queue (was stale):** ENG-1100 empty-slot extract / partial-day rows — shipped #472+#475, Linear **Done**.

---

## Companion docs (keep in sync)

| Doc | When to update |
|-----|----------------|
| `docs/planning/2026-06-17-gate-15-closeout.md` | After each Core-5 partial merge |
| `docs/planning/2026-06-14-backlog-priority-order.md` | Gate 1.5 table rows for ENG-889/896/897/898/901 |
| `docs/planning/2026-06-17-gate-0-1-agent-audit.md` | "Recommended next slices" after batch 3 |
| `docs/planning/linear-agent-workflow.md` | In-flight branch / conflict table |
| `docs/testing/figma-vs-simulator.md` | New Today/paywall verify rows (**#477 merged**) |
