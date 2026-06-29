# Suppr navigation sitemap (agent / sim-testing map)

Canonical map of the **iOS app's navigable surface** for agent-driven testing
(idb, `simctl`, Maestro) — so the *iOS Simulator Testing* section in
`.claude/CLAUDE.md` has a real map to point at. Screen list is derived from the
Expo Router tree under `apps/mobile/app/` (file-based routing), not guessed.

- **Bundle id:** `com.supprclub.supprapp`
- **Scheme:** `suppr://` — open any route with `xcrun simctl openurl booted "suppr:///<path>"`
  (Expo dev client may first need `exp+suppr://expo-development-client/?url=http://localhost:8081` if Metro was cold-started)
- **Naming:** the in-app wordmark now reads **"Sloe"** (the in-flight redesign,
  see `SLOE`/`Sloe Phase 0` comments, 2026-06), but the **scheme, bundle id, and
  Expo slug are still `suppr`** — deep links and `simctl` targets use `suppr`/
  `com.supprclub.supprapp`. Same app; rebrand name not yet finalised.
- **Deep-link form (verified 2026-06-04 in sim):** use the **bare route-file
  path** — `suppr:///library`, not `suppr:///(tabs)/library`. Expo Router strips
  the `(tabs)` route group from URLs (the grouped form is *tolerated* but
  non-canonical). Paths that match a real route file resolve directly and
  reliably; see the `/plan` caveat in §6.
- **Routing internals:** root stack + providers in `apps/mobile/app/_layout.tsx`;
  tab bar in `apps/mobile/app/(tabs)/_layout.tsx`; deep-link decision logic in
  `apps/mobile/lib/deepLinkRouting.ts` (path aliases) and
  `apps/mobile/lib/siriDeepLinks.ts` (Siri/Shortcuts).

> **Scrolling:** `simctl` **cannot scroll**. Below-the-fold sections (see *Today*
> below) require `idb ui swipe`. Derive tap/swipe coordinates per build from
> `idb ui describe-all` — never hardcode them.

---

## 1. Primary navigation — 4 tabs + centre FAB

Tab bar order (left → right). The **＋** is a UI-only raised button in
`SupprTabBar`, *not* a 5th route — it deep-routes Today into the Log sheet.

| Tab | File | Deep link / how to reach | Notes |
|-----|------|--------------------------|-------|
| **Today** | `apps/mobile/app/(tabs)/index.tsx` | `suppr:///` (home) ✓ | Default home — greeting, calorie ring, macros, below-fold cards |
| **Plan** | `apps/mobile/app/(tabs)/planner.tsx` | `suppr:///planner` (use this, not the `/plan` alias — see §6) | Meal planner; hosts **Shop** sub-tab |
| **＋ (Log FAB)** | — (button in `apps/mobile/components/tabs/SupprTabBar.tsx` → `LogTabBarButton.tsx`) | Tap centre plum **+**, or `suppr:///?openLog=1` | Opens the canonical `LogSheet` on Today (UI element, no own route) |
| **Recipes** | `apps/mobile/app/(tabs)/library.tsx` | `suppr:///library` ✓ (`/recipes` redirects here) | Saved cookbook/library; hosts **Discover** sub-tab |
| **Progress** | `apps/mobile/app/(tabs)/progress.tsx` | `suppr:///progress` | Trends, weight, weekly insights, digest |

**Settings is NOT a tab** — reached via the **avatar (top-right of Today)**.
Route: `apps/mobile/app/(tabs)/settings.tsx` → `suppr:///settings`.

<sub>✓ = pixel-verified via `simctl openurl` on 2026-06-04.</sub>

### Sub-tabs (in-screen pills, swap without leaving the tab)

| Group | Default | Sibling | Mechanism |
|-------|---------|---------|-----------|
| Recipes | Library (`(tabs)/library.tsx`) | Discover (`(tabs)/discover.tsx`) | `RecipesSubTabHeader` — being on `/discover` still highlights the Recipes tab |
| Plan | Plan (`(tabs)/planner.tsx`) | Shop / shopping list | `PlanSubTabHeader` (standalone route also at `suppr:///shopping`) |

---

## 2. Today — below-the-fold sections (require `idb ui swipe`)

Today renders a long scroll; only the hero (greeting + calorie ring + macro
tiles) is above the fold. Swipe up to reach:

| Section | Component | Reach |
|---------|-----------|-------|
| Today's Planned | `apps/mobile/components/today/TodayPlannedMealsCard.tsx` | `idb ui swipe` up ~1× |
| Meals (logged) | `apps/mobile/components/today/TodayMealsSection.tsx` | `idb ui swipe` up ~1–2× |
| Weekly Insight | `apps/mobile/components/today/WeeklyInsightCard.tsx` | `idb ui swipe` up ~2× |
| Activity & energy | `apps/mobile/components/today/TodayActivityCard.tsx` (+ `TodayActivityBonusCard.tsx`) | `idb ui swipe` up ~2–3× |

---

## 3. Stack / pushed screens

All resolve via `suppr:///<path>` unless a tap path is noted. File paths are
under `apps/mobile/app/`.

| Screen | File | Deep link / how to reach | Params / notes |
|--------|------|--------------------------|----------------|
| Recipe detail | `recipe/[id].tsx` | `suppr:///recipe/<id>` | `id`, `portion`, `autoLog` |
| Recipe verify | `recipe/verify.tsx` | `suppr:///recipe/verify?id=<id>` | `id`; nutrition-verification loading screen |
| Recipe verify (fixture) | `recipe/verify.tsx` | `suppr:///recipe/verify?fixture=1` | **Dev/agent only** — three matched ingredient rows with Swap pills (ENG-1066 / F-173); no DB |
| New recipe (wizard) | `recipe/create.tsx` | `suppr:///recipe/create` (linked from Recipes/Library tab) | Guided step-by-step "create from scratch" |
| New recipe (form) | `create-recipe.tsx` | `suppr:///create-recipe` (Settings row + share handoff) | `autoPhoto`; long single-screen form/edit |
| Creator profile | `creator/[id].tsx` | `suppr:///creator/<id>` | `id` |
| Cook mode | `cook.tsx` | `suppr:///cook?recipeId=<id>&title=…&steps=…` | `recipeId`, `title`, `steps`, `servings`, `sourceVideoUrl`/`sourceUrl` |
| Meal nutrition | `meal-nutrition.tsx` | `suppr:///meal-nutrition?id=<mealId>` | `id`, `slot`, `date`; title "Nutrition" |
| Macro detail | `macro-detail.tsx` | `suppr:///macro-detail?macro=protein` | `macro` = protein\|carbs\|fat\|fiber, `date` |
| Burn / activity detail | `burn-detail.tsx` | `suppr:///burn-detail?date=YYYY-MM-DD` | `date`; "Activity Bonus" |
| Targets | `targets.tsx` | `suppr:///targets` (Settings/Profile) | Calorie + macro targets editor |
| Weight tracker | `weight-tracker.tsx` | `suppr:///weight-tracker` | Title "Weight & trends" |
| Progress metric | `progress-metric.tsx` | `suppr:///progress-metric?metric=weight` | `metric` = weight\|calories; title "This week" |
| Weekly recap | `weekly-recap.tsx` | `suppr:///weekly-recap` (StreakPip tap / weekly push) | Back → Today |
| Apple Health sync | `health-sync.tsx` | `suppr:///health-sync` | Title "Apple Health" |
| Fasting | `fasting.tsx` | `suppr:///fasting` | Fasting-window timer |
| Nutrition sources | `nutrition-sources.tsx` | `suppr:///nutrition-sources` | Data-source attribution |
| Household | `household-settings.tsx` | `suppr:///household-settings` | Household members / servings |
| Shopping list | `shopping.tsx` | `suppr:///shopping` (or Plan → Shop) | — |
| Batch cook | `batch-cook.tsx` | `suppr:///batch-cook` (or Plan → Batch cook) | — |
| Profile | `profile.tsx` | `suppr:///profile` | — |
| Import (shared link) | `import-shared.tsx` | `suppr:///import-shared?url=<url>` (share-sheet / clipboard) | `url`, `captionText`; IG/TikTok/YouTube/Pinterest → recipe |
| Import (meal plan) | `plan-import.tsx` | `suppr:///plan-import` | Document/photo plan import |
| Import (cookbook) | `cookbook-import.tsx` | `suppr:///cookbook-import` | Bulk PDF/photo cookbook import |
| Paywall | `paywall.tsx` | `suppr:///paywall` | `from` (entry-point attribution) |
| Notifications prompt | `notifications-prompt.tsx` | `suppr:///notifications-prompt` | Push-permission primer |
| What's new | `whats-new.tsx` | `suppr:///whats-new` | Auto-surfaces on build-number bump |
| Login | `login.tsx` | `suppr:///login` (auto when signed out) | Apple Sign In only |
| Onboarding | `onboarding.tsx` | `suppr:///onboarding` (auto when incomplete) | Canonical wizard |
| Onboarding (legacy) | `onboarding-v2.tsx` | `suppr:///onboarding-v2` | Thin redirect → `/onboarding` |
| Not found (404) | `+not-found.tsx` | any unmatched path | "recipe may have been deleted" |

---

## 4. Hidden tab routes & redirects

Registered under `(tabs)` with `href: null` — routable by deep link / in-app
nav, but not shown in the tab bar.

| Screen | File | Deep link | Notes |
|--------|------|-----------|-------|
| Discover | `(tabs)/discover.tsx` | `suppr:///discover` | Recipe discovery feed (Recipes sub-tab) |
| Barcode | `(tabs)/barcode.tsx` | `suppr:///barcode` ✓ | Camera barcode scanner |
| Notifications | `(tabs)/notifications.tsx` | `suppr:///notifications` | In-app inbox |
| More (legacy) | `(tabs)/more.tsx` | `suppr:///more` | Redirect → Settings (pre-4-tab IA) |
| Recipes (label) | `(tabs)/recipes.tsx` | `suppr:///recipes` | Redirect → Library |

---

## 5. Dev screens

| Screen | File | Deep link |
|--------|------|-----------|
| Calorie-ring states | `dev/calorie-ring-states.tsx` | `suppr:///dev/calorie-ring-states` |
| Health-import labels | `dev/health-import-labels.tsx` | `suppr:///dev/health-import-labels` |
| Edit meal + Time eaten | `dev/edit-meal-states.tsx` | `suppr:///dev/edit-meal-states` | ENG-772 fixture — edit modal with `Time eaten` forced on |
| Import queue states | `dev/import-queue-states.tsx` | `suppr:///dev/import-queue-states` |

---

## 6. Deep-link reference

### Query params on Today (`(tabs)/index.tsx`)

| Param | Example | Effect |
|-------|---------|--------|
| `date` | `suppr:///?date=2026-06-04` | Select that calendar day |
| `openLog` | `suppr:///?openLog=1` | Open the Log sheet (same as ＋ FAB) |
| `editMealId` | `suppr:///?editMealId=<id>` | Open a logged meal for edit |
| `firstRun` / `onboarding_complete` | set by onboarding/notification flows | Post-onboarding first-run polish |

### Path aliases (`lib/deepLinkRouting.ts`, ENG-800)

| Alias | Intended target | Sim-testing note |
|-------|-----------------|------------------|
| `suppr:///plan` | Plan tab (`(tabs)/planner.tsx`) | ⚠️ **Unreliable via `simctl openurl`** — observed 404 (2026-06-04). `/plan` has no route file, so Expo Router renders `+not-found` and only the in-app forwarder's `router.replace` can rescue it (a race it can lose on a warm link). **For sim navigation use `suppr:///planner`.** The alias is meant for in-app / push / Siri forwarding, not cold `openurl`. |

> Paths that already match a route file (`settings`, `more`, `progress`,
> `library`, `discover`, `planner`, …) resolve via Expo Router directly and are
> reliable — no alias needed.

### Siri / Shortcuts deep links (`lib/siriDeepLinks.ts`)

| URL | Action |
|-----|--------|
| `suppr://log/water?ml=<n>` | Queue "log water", route to Today |
| `suppr://fast/start?hours=<n>` | Queue "start fast", route to Today |
| `suppr://today/remaining` | Open Today's remaining macros |

### Share-to-import (no manual URL)

iOS share sheet → Suppr from Instagram / TikTok / YouTube / Pinterest forwards
the link to `import-shared.tsx` (via `expo-share-intent` + clipboard fallback,
wired in `_layout.tsx`).

---

## 7. Web parity (Playwright / local dev)

| Surface | URL |
|---------|-----|
| App (desktop) | `http://localhost:3000` |
| App (mobile web) | `http://localhost:3000` @ ~390×844 viewport |

Run web: `npm run dev` from repo root.

---

## 8. Agent workflow (summary)

> Preferred driver is the **`ios-simulator` MCP server** (`launch_app`, `ui_tap`,
> `ui_swipe`, `ui_describe_all`, `screenshot`…) per `.claude/CLAUDE.md` →
> *iOS Simulator Testing*. The `simctl` / `idb` shell commands below are the
> equivalent fallback when MCP is unavailable.

1. **Metro:** `npm run mobile:dev` (or `mobile:dev:maestro` on port 8081).
2. **Boot sim + dev client:** `npm run ios:simulator` (first time / native changes).
3. **Navigate:** deep link first (`xcrun simctl openurl booted "suppr:///…"`),
   else `idb ui tap` / `idb ui swipe` (coords from `idb ui describe-all`).
4. **Read state:** `idb ui describe-all`; **screenshot** `xcrun simctl io booted
   screenshot /tmp/x.png` then **Read the image** — never trust text alone.
5. **Module-level changes** (fonts, ring size, `Dimensions` constants): Fast
   Refresh won't pick these up — `terminate` then `launch` or you judge a stale bundle.

---

_Source of truth: the Expo Router tree under `apps/mobile/app/`. Regenerate the
screen list with `find apps/mobile/app -name '*.tsx'` and re-grep
`useLocalSearchParams` for params. Update this file when routes are added,
renamed, or removed._

**Cross-references**
- Executable deep-link list: `apps/mobile/.maestro/00z_sweep_deeplinks.yaml`
  (run `npm run mobile:test:sweep:deeplinks`) — keep this map and that sweep in step.
- Agent install + MCP/idb tool names: `docs/testing/agent-eyes-and-hands.md`.
