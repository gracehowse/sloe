# Web / mobile parity & navigation scope

**Status:** Active product decisions (engineering follows; do not “fix” as unscoped parity bugs).

**Last confirmed:** 2026-04-25

**D-P1-7 maintenance (2026-04-25):** No new **intentional** divergences were recorded this cycle. Optional product follow-up (tickets, copy spec) for visual / voice-photo parity lives in [`PARITY_PRODUCT_QUEUE.md`](PARITY_PRODUCT_QUEUE.md), not as “open” audit rows. Re-open **exceptions** in this document (or `docs/decisions/`) only when product signs a new intentional divergence.

### D-P1-7 — Rolling maintenance (do each quarter or before a major release)

1. Skim **merged PRs** that touched only one platform’s UI; confirm each either has a matching change, a filed follow-up, or a new row in the summary table above with rationale.  
2. Skim [`PARITY_PRODUCT_QUEUE.md`](PARITY_PRODUCT_QUEUE.md) for P-P2-1 / P-P2-2 closure updates (optional).  
3. Bump **Last confirmed** (this document); if you maintain the consolidated audit log, align its historical *Last cross-check* note for D-P1-7 when you complete the pass.  
4. If product **signs** a new intentional divergence: add a short bullet under the right table row (or a `docs/decisions/` note) and link it from the consolidated checklist.

## Cross-platform completion gate (non-negotiable)

Any change that **ships, removes, improves, or fixes** a user-visible feature on **one** platform must:

1. **Identify** the corresponding surface on the **other** platform (screen, API consumer, shared helper).
2. **Decide** parity: match behaviour, match copy, or **document an intentional** platform-only difference (with rationale in this file or `docs/decisions/`).
3. **Update** shared logic in `src/lib/**` when the behaviour is meant to be identical; then wire **both** clients.
4. **Update** tests (Vitest parity / Maestro / Playwright) and **journey or parity notes** here when behaviour changes.

**A change is not complete until both platforms have been reviewed** — see also [Testing system — task completion gate](../testing/SYSTEM.md#task-completion-gate-non-negotiable) and [Genesis §2](../genesis/README.md#2-task-completion-gate-non-negotiable).

---

## Current parity summary (high level)

| Area | Status | Notes |
|------|--------|--------|
| **Shared nutrition / planning math** | **Aligned** | `src/lib/nutrition/**`, meal plan algo, verify pipeline, TDEE helpers consumed by both. |
| **Quick Add / usual meals** | **Aligned (logic)** | Helpers in `src/lib/nutrition/foodHistory.ts`, `favoriteFoods.ts`, `savedMeals.ts`, `savedMealsLogic.ts`; web `quick-add-panel` + mobile `QuickAddPanel` are wrappers — divergent behaviour is a **regression**. |
| **Discover quick filters** | **Aligned (Popular)** | Both load global save counts after the community recipe list fetch (`fetchPublicRecipeSaveCounts` → `public_recipe_save_counts_batch` + `DISCOVER_POPULAR_MIN_SAVES`); **Popular** = saves ≥ threshold. Web `DiscoverFeed` + mobile `discover.tsx` use the same constant. Mobile offline cache stores **enriched** rows (counts included) and re-fetches counts when hydrating from cache if Supabase is reachable (P-P2-3). |
| **Stripe vs IAP** | **Intentionally different billing rails** | Documented in [`subscriptions-stripe-and-iap.md`](subscriptions-stripe-and-iap.md); entitlements must match in **`profiles.user_tier`**. |
| **Apple Health / Apple Sign-In** | **Mobile-first / native** | Web has manual steps / different OS capabilities — **intentional**. |
| **Fasting timer** | **Aligned (web expanded 2026-05-14)** | [`../decisions/2026-04-fasting-web-scope.md`](../decisions/2026-04-fasting-web-scope.md) — web ships ring + milestones + projected end + history + landing card; remaining deliberate deltas are long-press End Fast (mobile only), long-press delete history row (mobile only), push notifications (mobile only, web notifications deferred). |
| **Discover / Plan / Profile chrome** | **May diverge visually** | Styling and density may differ until a **product pass** tickets explicit UI parity. |

---

## Discover / Plan / Profile — screen-by-screen audit

- **Discover, Plan (meal planner), and Profile** may still differ between web and mobile in **styling, density, and minor feature placement**.
- Closing those gaps is a **manual product pass** (screen-by-screen review, acceptance criteria, then ticketed work).
- **No standing engineering mandate** to drive repo-wide alignment from an automated audit alone.

## Photo / voice parity and tier gating

- **Photo logging and voice logging** remain **partial parity** where copy and UX naturally overlap other work.
- **No new** subscription **tier gating**, paywall surfaces, or **mobile-only** logging flows are in scope until product runs a dedicated initiative.
- Do not expand scope (e.g. new Pro gates, exclusive mobile entry points) without an explicit product spec.

## Library navigation

- **Library is not a bottom tab** by design.
- Discovery path: **header shortcut** to Library plus the **hidden `view=library` route** (and equivalent deep links where applicable).
- Treat “Library missing from tab bar” as **intentional information architecture**, not a defect, unless product reopens navigation.

## Quick Add panel (Favourites / Frequent / Recent / Usual meals)

**Rule (audit H1, 2026-04-18):** Quick Add panel logic lives in
`src/lib/nutrition/foodHistory.ts`, `favoriteFoods.ts`, `savedMeals.ts`,
and `savedMealsLogic.ts`. The mobile `apps/mobile/components/QuickAddPanel.tsx`
and web `src/app/components/suppr/quick-add-panel.tsx` are render-only
wrappers around those helpers. Divergent behaviour — different tab order,
different empty-state copy, different AI-source detection, etc. — is a
regression, not a stylistic choice. The AI-source detection rule itself
lives in `isAiSourcedFoodHistoryItem(item)` and is imported by both
components; if the rule changes, change it once there.

---

## Backlog: P-P2-1 — Discover / Plan / Profile visual parity (product)

Engineering **does not** treat styling-only drift as bugs until product defines acceptance. Use this map to run a **screen-by-screen** review (density, typography, empty states, filter placement).

| Surface | Web (primary) | Mobile (primary) | Automation hints |
|---------|---------------|------------------|------------------|
| Discover feed + filters | [`src/app/App.tsx`](../../src/app/App.tsx) (`DiscoverFeed`), [`src/app/components/DiscoverFeed.tsx`](../../src/app/components/DiscoverFeed.tsx) | [`apps/mobile/app/(tabs)/discover.tsx`](../../apps/mobile/app/(tabs)/discover.tsx) | Maestro `apps/mobile/.maestro/11_discover.yaml` |
| Meal planner | [`src/app/components/MealPlanner.tsx`](../../src/app/components/MealPlanner.tsx) | [`apps/mobile/app/(tabs)/planner.tsx`](../../apps/mobile/app/(tabs)/planner.tsx) | `03_meal_plan.yaml` |
| Profile | [`src/app/components/Profile.tsx`](../../src/app/components/Profile.tsx) | [`apps/mobile/app/profile.tsx`](../../apps/mobile/app/profile.tsx) | `04_profile_settings.yaml`, `34_profile_targets.yaml` |

**Definition of done (product):** written acceptance per row (or “explicitly allow divergence”) + tracked tickets; then engineering can align components without guesswork.

## Backlog: P-P2-2 — Voice / photo parity spec (product)

**Tier gates and API behaviour** are already covered by server routes and integration tests — this backlog is **copy, entry points, empty states, and cross-platform messaging** so both apps feel like one product.

| Concern | Web | Mobile | Engineering verification (already in repo) |
|---------|-----|--------|-----------------------------------------------|
| Voice log UI | [`src/app/components/suppr/voice-log-dialog.tsx`](../../src/app/components/suppr/voice-log-dialog.tsx) | [`apps/mobile/components/VoiceLogSheet.tsx`](../../apps/mobile/components/VoiceLogSheet.tsx) | [`tests/integration/voiceLogRoute.test.ts`](../../tests/integration/voiceLogRoute.test.ts), [`src/lib/nutrition/aiLogging.ts`](../../src/lib/nutrition/aiLogging.ts) |
| Photo log UI | [`src/app/components/suppr/photo-log-dialog.tsx`](../../src/app/components/suppr/photo-log-dialog.tsx) | [`apps/mobile/components/PhotoLogSheet.tsx`](../../apps/mobile/components/PhotoLogSheet.tsx) | [`tests/integration/photoLogRoute.test.ts`](../../tests/integration/photoLogRoute.test.ts) |
| Paywall / tier copy | [`src/app/components/suppr/ai-paywall-dialog.tsx`](../../src/app/components/suppr/ai-paywall-dialog.tsx) | Same product rules; entry from Today / FAB in [`apps/mobile/app/(tabs)/index.tsx`](../../apps/mobile/app/(tabs)/index.tsx) | Tier assertions in route tests above |

**Definition of done (product):** a short spec (Notion/Linear) listing matched strings, Pro vs Free behaviour, and error toasts; link that spec from this section when it exists.

## Related

- Product queue & agent closure rules: [`PARITY_PRODUCT_QUEUE.md`](PARITY_PRODUCT_QUEUE.md)  
- Maestro and Playwright setup: `apps/mobile/.maestro/README.md`, `tests/e2e/README.md`.  
- Testing gate: [`docs/testing/SYSTEM.md`](../testing/SYSTEM.md).
