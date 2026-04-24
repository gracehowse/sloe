# Consolidated backlog — docs, testing, parity (audits through 2026-04-24)

Single checklist distilled from documentation system audit, testing system audit, Vitest run review, and web/mobile parity work. **Not** a commitment to complete every row in one sprint — use severity and dependencies.

**Related:** [web-mobile-parity-scope.md](../product/web-mobile-parity-scope.md) · [PARITY_PRODUCT_QUEUE.md](../product/PARITY_PRODUCT_QUEUE.md) (agent closure / product follow-up) · [testing/SYSTEM.md](../testing/SYSTEM.md) · [genesis/README.md](../genesis/README.md) · [DOCUMENTATION_HUB.md](../DOCUMENTATION_HUB.md) · [qa/SCREEN_TEST_MATRIX.md](../qa/SCREEN_TEST_MATRIX.md)

---

## P0 — Correctness / trust / ship gates

*All P0 rows below were completed **2026-04-24** (API + security docs, integration tests, ship-verdict reconciliation).*

| ID | Task | Source |
|----|------|--------|
| ~~D-P0-1~~ | ~~**API reference:** extend [`docs/api/endpoints.md`](../api/endpoints.md) …~~ | Done |
| ~~D-P0-2~~ | ~~**Security table:** [`docs/security/auth.md`](../security/auth.md) …~~ | Done |
| ~~T-P0-1~~ | ~~**Tier / RLS / journal:** … [`docs/decisions/2026-04-full-sweep-ship-verdict.md`](../decisions/2026-04-full-sweep-ship-verdict.md) …~~ | Done |
| ~~T-P0-2~~ | ~~**HTTP integration tests** …~~ | Done |

---

## P1 — Documentation accuracy & QA execution specs

| ID | Task | Source |
|----|------|--------|
| ~~D-P1-1~~ | ~~**Rewrite [`docs/testing/test-plan.md`](../testing/test-plan.md):** …~~ | Done |
| ~~D-P1-2~~ | ~~**Update [`docs/mobile_qa_uat_test_plan.md`](../mobile_qa_uat_test_plan.md):** …~~ | Done |
| ~~D-P1-3~~ | ~~**Update [`docs/technical/components.md`](../technical/components.md):** …~~ | Done |
| ~~D-P1-4~~ | ~~**Update [`docs/data/schema.md`](../data/schema.md)** …~~ | Done |
| ~~D-P1-5~~ | ~~**Update [`docs/product/overview.md`](../product/overview.md)** …~~ | Done |
| ~~D-P1-6~~ | ~~**Update [`docs/product-roadmap.md`](../product-roadmap.md)** …~~ | Done |
| ~~D-P1-7~~ | ~~**Rolling parity doc** …~~ — **Not sprint backlog:** quarterly SOP in [`web-mobile-parity-scope.md`](../product/web-mobile-parity-scope.md) § *D-P1-7*; agent rules in [`PARITY_PRODUCT_QUEUE.md`](../product/PARITY_PRODUCT_QUEUE.md). **Last cross-check:** 2026-04-25 | Done |
| ~~D-P1-8~~ | ~~**Genesis INDEX:** …~~ | Done |

---

## P1 — Testing quality & CI signal

| ID | Task | Source |
|----|------|--------|
| ~~T-P1-1~~ | ~~**Playwright:** …~~ — [`tests/e2e/journeys/today-authenticated.spec.ts`](../../tests/e2e/journeys/today-authenticated.spec.ts) | Done |
| ~~T-P1-2~~ | ~~**Vitest harness:** … `DialogOverlay` …~~ — `forwardRef` on [`src/app/components/ui/dialog.tsx`](../../src/app/components/ui/dialog.tsx) | Done |
| ~~T-P1-3~~ | ~~**Vitest isolation:** … `landingParity` …~~ — shared `@supabase/supabase-js` mock | Done |
| ~~T-P1-4~~ | ~~**Mobile `mealPlanAlgo` …~~ | Done |
| ~~T-P1-5~~ | ~~**Maestro release discipline:** …~~ — [`apps/mobile/.maestro/README.md`](../../apps/mobile/.maestro/README.md) | Done |
| ~~T-P1-6~~ | ~~**Optional PR template** …~~ — [`.github/pull_request_template.md`](../../.github/pull_request_template.md) | Done |

---

## Product-owned follow-up (not open audit rows)

**P-P2-1** and **P-P2-2** are **closed** in this audit: engineering delivered maps + DoD + test pointers in [`web-mobile-parity-scope.md`](../product/web-mobile-parity-scope.md). Optional product work (tickets, copy spec, sign-off) is tracked in [`docs/product/PARITY_PRODUCT_QUEUE.md`](../product/PARITY_PRODUCT_QUEUE.md). **Agents:** do not list P-P2-1 / P-P2-2 here as “deferred” or “blocked”—update the queue file instead.

---

## P2 — Parity, product, and UX

| ID | Task | Source |
|----|------|--------|
| ~~P-P2-1~~ | ~~**Discover / Plan / Profile visual parity (prep)**~~ — surface map + DoD in [`web-mobile-parity-scope.md`](../product/web-mobile-parity-scope.md); optional product tickets → [`PARITY_PRODUCT_QUEUE.md`](../product/PARITY_PRODUCT_QUEUE.md) | Done |
| ~~P-P2-2~~ | ~~**Voice / photo parity spec (prep)**~~ — UI map + DoD in same doc; API/tests in repo; optional product spec → [`PARITY_PRODUCT_QUEUE.md`](../product/PARITY_PRODUCT_QUEUE.md) | Done |
| ~~P-P2-3~~ | ~~**Discover save counts:** … `getCachedDiscoverRecipes` …~~ — cache writes **enriched** rows; fallback path calls `fetchPublicRecipeSaveCounts` when possible (`apps/mobile/lib/recipes.ts`) | Done |
| ~~P-P2-4~~ | ~~**Discover RPC perf:** …~~ — `public_recipe_save_counts_batch(uuid[])` migration + `fetchPublicRecipeSaveCounts` uses one RPC per 500 ids | Done |
| ~~P-P2-5~~ | ~~**FatSecret / image import** mocked integration tests~~ — [`verify-ingredients-fatsecret-mock.test.ts`](../../tests/integration/verify-ingredients-fatsecret-mock.test.ts), [`recipe-import-image-route.test.ts`](../../tests/integration/recipe-import-image-route.test.ts) (`@vitest-environment node` + stub `fetch`) | Done |
| ~~P-P2-6~~ | ~~**`docs/planning/archive` …**~~ — [`archive/README.md`](./archive/README.md) | Done |

---

## P3 — Hygiene & nice-to-have

| ID | Task | Source |
|----|------|--------|
| ~~D-P3-1~~ | ~~**Hub “Recently shipped” rows:** …~~ — compact **2026-04-24** hub row + journeys link in Sections | Done |
| ~~D-P3-2~~ | ~~**Journey gaps:** …~~ — [`docs/journeys/README.md`](../journeys/README.md) gap table + matrix link | Done |
| ~~T-P3-1~~ | ~~**Midscene / AI E2E:** … `testing/overview.md` …~~ | Done |
| ~~T-P3-2~~ | ~~**Exploratory / chaos:** … `testing/SYSTEM.md` …~~ | Done |

---

## Completed in-thread (reference — do not re-do)

- Genesis spec + task completion gates (docs + tests) · [`docs/genesis/`](../genesis/README.md), hub, README  
- Testing SYSTEM + overview CI/mobile accuracy · [`docs/testing/SYSTEM.md`](../testing/SYSTEM.md)  
- Discover **Popular** parity + `fetchPublicRecipeSaveCounts` + unit tests · code + `web-mobile-parity-scope.md` rewrite + QA note  
- `SCREEN_TEST_MATRIX` / `test-plan` pointers to SYSTEM  
- **2026-04-24 execution batch:** D-P0-1, D-P0-2, T-P0-1 (reconciliation § in ship verdict), T-P0-2 (`voiceLogRoute`, `photoLogRoute`, `stripeCheckoutRoute`, `householdJoinLeaveRoute` integration tests), D-P1-1 … D-P1-6, D-P1-7 (later **closed** as process—see queue doc), D-P1-8, T-P1-1 … T-P1-6, P-P2-3 (Discover cache + counts), P-P2-6, D-P3-1, D-P3-2, T-P3-1, T-P3-2 — see strikethrough rows above for file pointers.
- **2026-04-23 follow-up:** P-P2-4 batched save-count RPC (`supabase/migrations/20260423140000_public_recipe_save_counts_batch.sql`, `fetchPublicRecipeSaveCounts.ts`, schema + types).
- **P-P2-5:** FatSecret verify branch mocks + `POST /api/recipe-import/image` gate tests and OpenAI-mocked happy path (estimation-only nutrition).
- **2026-04-25:** D-P1-7 quarterly checklist + **P-P2-1 / P-P2-2** backlog sections (surface maps, definition of done) in `web-mobile-parity-scope.md`.
- **Agent loop fix:** ~~D-P1-7~~, **P-P2-1**, **P-P2-2** removed from “blocked forever” state — [`PARITY_PRODUCT_QUEUE.md`](../product/PARITY_PRODUCT_QUEUE.md) + consolidated § *Product-owned follow-up*.

---

## How to use this list

1. **Triage** P0 with security/product before large releases.  
2. **Batch** P1 docs in one PR (terminology + test-plan inventory) to avoid drift.  
3. **Link** PRs to this file or copy row IDs into Linear/GitHub issues.  
4. **Re-audit** quarterly: mark done, add rows, bump “Last confirmed” on parity scope. **D-P1-7 / P-P2-1 / P-P2-2:** follow [`PARITY_PRODUCT_QUEUE.md`](../product/PARITY_PRODUCT_QUEUE.md)—do not resurrect as open rows without new audit scope.
