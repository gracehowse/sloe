# User Journey: Discover & Library (Browse, Save, Cook)

**Audience:** Product / Design / Engineering

## One-line purpose

The Recipes tab end to end: how a user gets from "I have nothing saved" to
"I'm cooking this tonight" — Library (the personal cookbook), Discover (the
browse-for-inspiration feed), Recipe Detail (the trust surface), Cook Mode
(the guided cook), Batch Cook, and a brief look at Creator profiles.

## Scope

**In scope:** the Recipes tab shell (Library ↔ Discover sub-tabs, the
empty-library redirect, the `/recipes` alias); the Library grid (filters,
provenance, sort, collections, the free-save cap); the Discover feed (seed
recipes, creator rail, Following scope, eating-out search, clipboard import,
the two deferred sections); Recipe Detail (hero through cook-mode launch);
Cook Mode (timers, scale, mise-en-place, history, completion); Batch Cook;
and a short pointer into Creator profile browsing.

**Out of scope (see linked docs instead):**
- Parsing/importing a recipe from a URL, social share, or photo →
  [import-recipe.md](./import-recipe.md) — this doc picks up where that one
  leaves off (a saved recipe rendering in Library/Discover)
- Correcting/verifying ingredient matches → [verify-ingredients.md](./verify-ingredients.md)
- Writing a recipe from scratch → [create-recipe.md](./create-recipe.md)
- Generating/adjusting a weekly plan → [meal-planning.md](./meal-planning.md)
- The shopping list itself (aisle groups, sync, household sharing) →
  [shopping-list.md](./shopping-list.md) — this doc forward-links there for
  "Add to shopping list" and Batch Cook's shopping hand-off
- Logging food to the daily journal → [food-tracking.md](./food-tracking.md)
- The full creator/social plane (follow graph, attribution, DMCA/report,
  and the not-yet-built real-creator onboarding path) →
  [creator-platform.md](./creator-platform.md). ENG-1535 removed the
  fabricated creator population; the rail now hides until genuine rows exist.

## Where this sits in the loops

This doc is the **read/render side** of two loops and the **tail** of a third:

1. **Discover → Save → Cook (Browse & Build Library Loop)** — the primary
   loop this doc narrates end to end: empty Library → Discover → Recipe
   Detail → save/collection → Cook Mode → back to Today.
2. **Import → Verify → Save → Cook/Log** — this doc is the tail: once
   [import-recipe.md](./import-recipe.md) saves a recipe, it becomes a row
   in the exact same `recipes` table Library and Discover cards render from.
   There's no separate "imported recipes" surface — Library's provenance
   filter (§2) is how an imported recipe stays findable as itself.
3. **Plan the Week → Shop → Cook** — this doc is the **read side**: Recipe
   Detail is what a planner's "cook this" action opens, and Cook Mode /
   Batch Cook are what it lands on. Plan-side generation/adjustment lives in
   [meal-planning.md](./meal-planning.md); this doc doesn't repeat it.

```
              ┌─ import-recipe.md ─┐
              │  (parse → verify → save)
              ▼
Library/Discover cards (THIS DOC §1–3)
              │
              ▼
     Recipe Detail (THIS DOC §4) ──▶ Add to shopping list ──▶ shopping-list.md
              │
              ▼
      Cook Mode (THIS DOC §5) ──▶ auto-log servings ──▶ food-tracking.md
              │
              ▼
      Batch Cook (THIS DOC §6) ──▶ shopping-list.md (Known bug)

meal-planning.md "cook this" ──────────────────────────▶ Recipe Detail (§4)
```

---

## §1 — Recipes tab shell (Library ↔ Discover)

**Why this exists:** the 2026-04-27 strategic direction collapsed 6 tabs to
4 (Today / Plan / Recipes / Progress); "Recipes" groups what used to be two
separate tabs (Library + Discover) under one bottom-bar entry, with Library
and Discover as sibling sub-tabs inside it.

**Entry point:** bottom tab "Recipes" (mobile, glyph `Utensils`, testID
`tab-recipes`) or the desktop sidebar "Recipes" entry (web). Also reachable
via deep link (`/library`, `/discover`, `/recipes`), the header "Recipe
library" button on mobile-web, and onboarding's `?from=onboarding` param.

**What the user sees:** Library is the default leaf. Discover is a sibling
sub-tab reached via the in-screen `RecipesTabChrome` pill row — **not** a
separate bottom-bar tab.

**Empty-library auto-redirect (2026-05-16):** if the user has 0 saved
recipes, landing on Recipes redirects straight to Discover instead of
showing a blank cookbook. The reasoning: the first impression of the
Recipes tab should demonstrate the product, not show an empty state — the
first save is what turns Library into the more useful landing spot. After
the first save, the normal Library landing takes over. The redirect is
guarded on a `ready`/`!loading` settle signal so a cold-load race (auth
session, cloud saves, and authored recipes all resolving async) can't
transiently read 0 and wrongly bounce a user who actually has recipes — an
earlier, unguarded version of this redirect was sending roughly 40% of
`/library` loads to Discover before the guard was added.

- **Web:** `useLibraryDiscoverRedirect` (`src/app/components/library/useLibraryDiscoverRedirect.ts`),
  keyed on `libraryDataReady` from `AppDataContext`.
- **Mobile:** a `useFocusEffect` in `apps/mobile/app/(tabs)/library.tsx`,
  guarded on `!loading`.

**`/recipes` alias:** `/recipes` is a friendly alias that 307-redirects to
`/library` on web (`app/recipes/page.tsx`) — kept as a redirect rather than a
view mount so there's exactly one canonical path per view. Mobile has the
equivalent `apps/mobile/app/(tabs)/recipes.tsx` route (hidden from the tab
bar via `href: null`, since the visible tab is `library.tsx`).

**Web ↔ mobile parity:** identical behaviour — same redirect and guard
rules, same alias convention. **Structural note, not drift:** mobile Discover is a
real hidden Expo route; web Discover is a view switch inside the same
single-page `App.tsx` (no route push). This is the same structural split that
governs Recipe Detail in §4 — see that section for why it matters.

**What comes next:** §2 (Library) if the user has recipes, §3 (Discover) if
they don't — or if they tap the sub-tab explicitly either way.

---

## §2 — Library (the personal cookbook)

**Why this exists:** recipes are the retention + viral hook — the personal
library is what makes an imported Reel worth returning to Suppr for. This is
the "prove there's already something here" surface once the user has saved
anything at all.

**Entry point:** Recipes tab default leaf; deep links `/library`, `/recipes`;
the empty-Discover "My Library" jump rail (§3); onboarding.

**What the user sees:** a 2-column photo grid, union of the user's `saves`
rows and recipes they authored (`recipes.author_id = me`). Real surfaces on
both platforms:

- **Search + category filter pills** — All / Breakfast / Lunch / Dinner /
  Dessert / Quick 30 / Under 500 / High protein / Soup / Pasta / Chicken /
  Salad.
- **Provenance segmented row** — All / Saved / Created / Imported, so a
  user can find "the thing I imported from that TikTok" as its own bucket,
  not lost inside everything else they've saved.
- **Sort sheet** — Recent / Calories / Protein.
- **Editorial "shelves" header** and a count line.
- **Bookmark-to-remove** (two-step confirm) and long-press remove.
- **"Go public"** on the user's own drafts.
- **A `+` create/import sheet.**

Each card: serif title, a `MacroIconRow` (kcal suppressed when ≤0 — never a
fake zero), and honest saves-count/time meta. **A recipe with no image
renders a deterministic cuisine-tinted fallback, never a substituted stock
photo** — this matters for trust: a fake "this looks like your dish" photo
would be worse than no photo.

**Free-tier save cap:** Free is capped at `FREE_SAVE_LIMIT` = **10** saved
recipes (`src/context/appData/constants.ts`), enforced client-side (toast:
"Free plan is limited to 10 saved recipes.") **and** server-side via a
Postgres RLS trigger (`supabase/migrations/20260426100000_saves_free_tier_cap.sql`)
— so a client bypass can't defeat the limit. Recipes already saved above the
cap (e.g. after a downgrade) stay saved and editable; the user just can't add
new ones until back at 10 or fewer, or on Pro.

**Collections (2026-07-03):** user-created named folders (e.g. "Weeknight",
"Bulk") — Paprika/Plan to Eat-style organisation. A collections bar above
the grid filters to one collection; each card's overlay adds/removes
membership. Ships behind the `recipe_collections_v1` feature flag,
currently default-off — it isn't in `REDESIGN_DEFAULT_ON`
(`src/lib/analytics/track.ts` on web, `apps/mobile/lib/analytics.ts` on
mobile), held back pending a mobile simulator pass before it ramps. It
degrades silently (no create/query UI) on an environment where the
`recipe_collections` migration hasn't been applied yet.

**Web ↔ mobile parity:** strong — shared predicates (`libraryEntryKind`,
`recipeCategoryFilters`, `recipeSearchMatch`, `libraryShelves`) and, for
collections, one shared CRUD module (`src/lib/recipes/recipeCollections.ts`,
imported by mobile as `@suppr/shared/recipes/recipeCollections`) mean the
filter/sort/collection logic can't drift between platforms by construction.
Same free-save cap on both. Mobile reads via a `useSavedLibraryRecipes` hook
with an offline cache + timeout race; web reads via `AppDataContext`.
Behaviourally equivalent.

**Web:** `src/app/components/Library.tsx`, `src/app/components/library/LibraryShelvesHeader.tsx`,
`src/app/components/library/LibraryCollectionsBar.tsx`, `src/app/components/library/AddToCollectionMenu.tsx`.
**Mobile:** `apps/mobile/app/(tabs)/library.tsx`, `apps/mobile/components/library/LibraryShelvesHeader.tsx`,
`apps/mobile/components/recipe/RecipeCollectionsBar.tsx`.

**What comes next:** tap a card → §4 (Recipe Detail). Tap `+` → the
create/import sheet ([create-recipe.md](./create-recipe.md) /
[import-recipe.md](./import-recipe.md)). Tap "Explore Discover" or the empty
state → §3.

---

## §3 — Discover (the browse feed)

**Why this exists:** per the seed-content module's own header comment,
"Discover must feel alive or import users have no reason to return." At
solo-tester scale (N=1), a curated static seed plus whatever real content
exists is the honest way to avoid an empty feed without faking personalisation
that makes no sense yet.

**Entry point:** the Discover sub-tab pill; the empty-Library auto-redirect
(§1); a recipe deep link (`?recipe=` on web routes into `/discover`);
onboarding.

**What the user sees, top to bottom (real, shipped):**

1. **A photographic first viewport on iOS and mobile-web.** After search,
   the default Discover feed opens with Quick weeknight cards using each
   recipe's real image. Creator, filter, and import chrome follows the food
   rather than displacing it below the fold. Desktop retains its wider
   featured-hero composition. This cross-platform behaviour is default-on
   behind `discover_photographic_first_view_v1`; disabling it restores the
   previous tint-only Quick weeknight cards and their original feed position.
   Missing or failed media still uses the shared deterministic recipe fallback
   and never substitutes an unrelated stock photo.
2. **Seed recipes (`SEED_RECIPES_V2`)** — 18 founder-approved Sloe Kitchen
   recipes across three populated clusters (Mediterranean, East & Southeast
   Asian, Mexican-inspired), always prepended ahead of published community
   rows. The previous 50-recipe Unsplash set is retired. Every current hero is
   a selected first-party generated image hosted in the public
   `recipe-images/sloe-kitchen/v1` storage path. Card macros are calculated
   from the weighed recipe ingredients by `verifyIngredients`; the committed
   verification manifest rejects any below-floor ingredient instead of
   publishing a hand estimate. Saving a seed still materialises a private,
   editable copy and keeps the normal log-time ingredient pipeline.
   The shared catalogue-readiness gate also applies to every seed, live
   community row, and mobile offline-cache row before it can enter Discover:
   it requires a usable non-placeholder title, a real HTTP(S) photo, positive
   servings and calories, numeric non-negative macros, and a positive prep or
   cook duration. Incomplete authored/imported recipes remain recoverable in
   Library; they are hidden only from the public editorial surface. Web and
   mobile both use `discoverRecipeReadiness.ts`, so stale cached duds cannot
   reappear on one platform.
3. **Category pills** + a **"Following" feed-scope toggle** (filters to
   creators the user follows — see §7).
4. **"Recipe ideas" hero cards** + a "More ideas" compact list, v3 editorial
   blocks (Quick weeknight, Collections tiles, cuisine cluster carousels).
5. **A permanent "Import from a link" card.**
6. **Creator rail** + a **Following post feed** (flag `discover_creator_rail_v1`).
7. **Eating out** — an Edamam-backed restaurant/branded search, fires at ≥3
   typed characters.
8. **Clipboard auto-detect** — on focus, checks the clipboard for a recipe
   URL and offers to import it ("We noticed a recipe link on your clipboard.
   Would you like to import it?").
9. **"My Library" jump rail** at the bottom.
10. A slow-load hint after 5s with retry, and a seed-only fallback on
   timeout/error — Discover is never allowed to render fully empty.

**Two sections are explicitly deferred, not built — do not describe these as
coming soon:**
- **"Popular collections" carousel** (Figma `528:61`) — no wired data
  source for curated collections yet.
- **"Recipes in action" Reels rail** (Figma `528:105`) — no wired
  short-form video data source yet.

Both are marked in-code as "DEFERRED — Figma-only builds (not built this
pass)" (`apps/mobile/app/(tabs)/discover.tsx` ~L701). Whether these are
still planned or should be cut from the roadmap is an open question — see
Known limitations below.

**The seed-content ramp-down** is also unresolved: the seed module is honest
today (macros are explicitly labelled estimates, and the code comment frames
the seed as a stopgap "until Discover feels alive"). But nothing in the code
or docs defines a trigger for *removing or demoting* the seed once real
community/creator content exists at volume. At today's single-tester scale
this is fine; once real users arrive, the seed catalog will sit permanently
ahead of community rows with no de-seed mechanism unless one is designed —
worth deciding before that becomes the default rather than after.

**Web ↔ mobile parity:** strong — the same seed module, popular-qualification
logic, category filters, creator rail, Following feed, and Edamam eating-out
search exist on both. Two honest carve-outs, present in-code on both
platforms: a computed "fit %" badge is calculated but **not rendered**
(removed after tester feedback; the computation is dead code, not a bug); the
TrustChip was removed entirely because the signal behind it was fabricated
(see §4's note on `is_verified`).

**Web:** `src/app/components/DiscoverFeed.tsx`, `src/lib/recipes/seedRecipesV2.ts`,
`src/lib/recipes/discoverPopularQualification.ts`.
**Mobile:** `apps/mobile/app/(tabs)/discover.tsx`, `apps/mobile/components/discover/DiscoverClusterCarousels.tsx`,
`apps/mobile/components/discover/CreatorRail.tsx`, `apps/mobile/components/discover/FollowingFeed.tsx`.

**What comes next:** tap a card → §4 (Recipe Detail). Tap a creator byline →
§7 (Creator profile) — full picture in [creator-platform.md](./creator-platform.md).
Tap the import card / clipboard prompt → [import-recipe.md](./import-recipe.md).

---

## §4 — Recipe Detail

**Why this exists:** this is where trust is earned or lost. Per the trust
posture in `.claude/agents/_project-context.md`, nutrition is always
estimated and confidence must be visible — Recipe Detail is the surface that
either honours that or breaks it.

**Entry point:** card tap in Library, Discover, Creator profile, Plan, or
Notifications; a deep link (mobile: real route `/recipe/[id]`; web: `?recipe=`
overlay on `/discover`); the return trip from a Cook Mode auto-log.

**What the user sees (top to bottom, real and shipped):**

- **Hero image** (honest fallback if none — see §2's cuisine-tint rule)
- **Title + byline** — deep-links to the creator profile when the recipe is
  curated (creator-attached recipes only; imports/user creations don't carry
  a `creator_id`)
- **Macro strip**
- **"Fits your day" verdict banner** — a tri-state (success/warning/
  destructive) SOLID banner computed by `computeFitsYourDayVerdict` against
  the user's remaining macros for the day
- **Ingredient grid** — each line shows a verification tier, tap-to-open info
  sheet, and a **Verify CTA** for anything not yet confidently matched
- **Method steps**
- **Servings stepper** (1–99, debounced) — scales ingredient amounts *and*
  the downstream logged portion together, so what you see is what gets logged
- **"Add to today"** — logs either the structured recipe or a portion of it
- **"Add to shopping list"** — see [shopping-list.md](./shopping-list.md) §3
  for the full mechanics (merge-not-replace, count↔weight folding)
- **Cook Mode launch** (§5)
- **Share**, an **Edit sheet** (owner), **"Go public,"** **"Report an
  issue,"** a **regulated-allergen callout line**, a **net-carbs lens**
  toggle, and an owner **"mark official"** claim

On load, an auto-verify pipeline calls `/api/nutrition/verify-recipe` to
hydrate macros. A **FatSecret Basic-tier cache guard** zeros macros for
FatSecret-sourced rows to respect FatSecret's ToS on cached display. Seed
recipes (§3) short-circuit to their static preview data; **logging always
goes through the real ingredient pipeline regardless of source** — the seed
shortcut is presentational only, never a logging shortcut.

**`is_verified` provenance:** an earlier version of the import path wrote
`is_verified: (calories ?? 0) > 0` — meaning *any* successful LLM extract
counted as "verified," which fed a fabricated "USDA verified" TrustChip.
This has since been fixed: the shared `isStructuredSource` gate
(`src/lib/nutrition/structuredSourceGate.ts`) now requires the macro to
actually trace to a structured catalog match (USDA / OFF / FatSecret /
Edamam) before `is_verified` is set true; LLM extracts, `"AI photo"`/`"AI
voice"` sources, and unsourced rows are correctly unverified. The TrustChip
itself stays removed from Discover/Library cards (§3) — raw macro numbers
still display, but the fabricated-confidence chip that used to sit next to
them does not. Per-recipe match-source provenance is live in production;
see `persistImportedRecipe.ts:308` and `:489`.

**STRUCTURAL DIVERGENCE (documented, not drift): mobile route vs. web
component swap.** Mobile Recipe Detail is a full Expo route,
`/recipe/[id].tsx`. Web Recipe Detail is an **in-page component swap** inside
`Library`/`Discover` — there is no route push. This is why the shared-element
card→detail morph (the "demo moment," spec §1.1) is currently **dormant on
web** (the View Transition API needs either a real route push or an explicit
`document.startViewTransition()` wrap around the in-page swap — neither has
shipped) and **deferred on mobile** (Reanimated 4 dropped `sharedTransitionTag`,
the API the spec assumed). Full detail, including the three viable mobile
replacement paths and their tradeoffs:
[recipe-transitions-2026-04-27.md](./recipe-transitions-2026-04-27.md).

**Stale in-code comment:** `apps/mobile/app/recipe/[id].tsx` comments the
`recipe_detail_v3_conformance` flag as "default-OFF." It isn't — a
2026-06-29 flag-collapse moved it into `REDESIGN_DEFAULT_ON`, so it resolves
**true** by default today (see `apps/mobile/lib/analytics.ts`). Not a
behaviour bug, just a code comment that's drifted from the flag registry and
is worth correcting.

**Dev/QA harness route (web-only, not user-reachable):**
`app/dev/recipe-detail-redesign/page.tsx` (`/dev/recipe-detail-redesign`) is
a static before/after mock built to validate the 2026-05-05 polish patch
(C1–C6 below) before it shipped — two iPhone-14-Pro-frame renders side by
side of a mock recipe ("Spicy Feta Chicken Crunch"), no fetch, no PII, no
real recipe data. It follows the general `app/dev/*` harness pattern in
[mobile-visual-validation.md](../development/mobile-visual-validation.md).
Same gate as every other `/dev/*` route: `middleware.ts`'s `isDevPreview()`
keeps it out of the public allowlist once `VERCEL_ENV === "production"`, so
on `suppr.club` an unauthenticated visitor hitting the URL cold is
redirected to `/login` like any other in-product page — it is **not** a hard
404, and a signed-in session can still load it (harmless either way: no
writes, no real data). Reachable with no auth in local dev, CI, and Vercel
previews. All six changes it documents — C1 gradient hero fallback at 140pt
(the only one that ported to web), C2 dropping the duplicate mid-page day-%
pill, C3 a pencil-icon servings edit, C4 `Servings to view` → `Servings`,
C5 dropping `serves N` from the subtitle, C6 demoting the macro-tile
caption — have since shipped to the real screen described above; the full
before/after record, validation screenshots, and the rejected "Hard NO
list" are preserved in the decision record for that patch (see Related
documents). Has no mobile counterpart (`apps/mobile/app/dev/` ships no recipe-detail
harness) — C2–C6 were mobile-only edits validated directly in-sim, not via
a parallel dev screen. Kept in the repo as a historical record of that one
patch, not maintained forward; a future Recipe Detail change does not need
to touch this page.

**Web:** `src/app/components/RecipeDetail.tsx`, `app/recipe/[id]/page.tsx`.
**Mobile:** `apps/mobile/app/recipe/[id].tsx`, `apps/mobile/app/recipe/verify.tsx`,
`apps/mobile/components/recipe/RecipeIngredientGrid.tsx`, `apps/mobile/components/recipe/RecipeMethodSteps.tsx`.

**Web ↔ mobile parity:** feature set at parity via shared helpers
(`recipeLogPortion`, `verifyRecipeResponse`, `officialRecipeClaim`,
`netCarbs`, `importSourceDisclaimer`) — only the route-vs-component-swap
structure above genuinely differs.

**What comes next:** "Cook Mode" → §5. "Add to today" → the recipe's macros
land in `nutrition_entries` and feed the Today ring — see
[food-tracking.md](./food-tracking.md). "Verify" on a low-confidence
ingredient → [verify-ingredients.md](./verify-ingredients.md). Byline tap →
§7 (Creator profile).

---

## §5 — Cook Mode

**Why this exists:** the guided, hands-busy cooking surface — Paprika/Recime
parity is the bar (the "delight" surface per the recipe redesign spec), and
timers/scale/history are the specific competitor gaps a prior competitive
review identified as missing.

**Entry point:** Recipe Detail's footer CTA (`buildCookModeHref`); Batch
Cook's "cook" action (`/recipe/[id]?cook=1`); a Plan-tab "cook this" action,
which routes into the same `?cook=1` path. **Mobile** is a dedicated `/cook`
route; **web** is an inline overlay inside `RecipeDetail` (mirrors the same
route-vs-swap structural split as §4).

**What the user sees (real, shipped):**

- Progress bar + per-step text
- **Recipe-scale segmented control** (0.5× / 1× / 1.5× / 2× / 4×), persisted
  per (user, recipe) — AsyncStorage on mobile, localStorage on web — that
  rewrites visible amounts via the shared `scaleAmountText` helper. Time,
  temperature, and step-number tokens are deliberately **not** scaled
  ("bake 25 minutes," "350°F," "Step 1:" stay untouched)
- **Parsed-duration timers** from the step text, plus a manual stopwatch and
  a concurrent multi-timer stack
- **"For this step" ingredient chips**
- **Mise-en-place checklist**
- **Swipe between steps**
- A **"Watch original"** pill on video imports
- A **"Last time"** card + median-duration preview, pulled from
  `recipe_cook_history`
- A **completion card**: duration, 1-tap rating, a per-cook note (persisted
  to `recipe_cook_history`), and a Save action

**Screen-awake stays on for the whole cook session, on both platforms.** Web
uses `navigator.wakeLock.request("screen")`. Mobile's standalone `/cook`
route uses `useKeepAwake()`; the **inline** cook overlay inside
`recipe/[id].tsx` also calls `useKeepAwake()` in both of its mounted phases
(`CookMiseEnPlace`, `CookStepSwipeSurface`), so the inline path matches the
standalone route. A dedicated source-level parity test
(`apps/mobile/tests/unit/cookKeepAwakeParity.test.ts`) strips comments
before asserting the call exists, so a doc-comment mention alone can't fake
the assertion.

**"Add to my regulars" is mobile-only, and it isn't a documented carve-out.**
The completion card's "Add to my regulars" action (`handleAddToRegulars` →
`createSavedMeal`, writing a `user_saved_meals` row so the cooked recipe
becomes a one-tap Quick-Add target) exists only in
`apps/mobile/app/cook.tsx`. `src/app/components/CookMode.tsx` (web) has no
equivalent — no reference to "regulars" or `createSavedMeal` anywhere in the
file. The original design for cook-mode scaling described scale flowing
through to "Add to my regulars" without scoping the action to mobile-only,
which suggests the intent was originally cross-platform. Whether this
should ship on web too, or mobile-only is the deliberate, final shape,
hasn't been decided.

**The in-cook "handsfree" voice toggle is a dark shell, not a shipped
feature.** Mobile-only. `apps/mobile/lib/cookHandsfree.ts` ships a
persisted opt-in preference and a pure keyword-match helper (maps a
transcript fragment to next/previous/repeat/pause/resume) — but there is no
audio capture behind it. `COOK_HANDSFREE_FEATURE_ENABLED` defaults to
`false` (only flips via an explicit
`EXPO_PUBLIC_COOK_HANDSFREE_ENABLED=true` env override), so the in-cook
header toggle doesn't even render by default. The file's own header comment
points to a decision record for the real listener,
`docs/decisions/2026-05-01-cook-voice-handsfree.md` — that file doesn't
exist in the repo, so the shell references a record that was either never
written or was lost. Web has no handsfree concept at all, not even a shell.
Handsfree should not be described as a shipped or in-progress feature in
customer-facing copy; it's an inert seam for a future listener. Whether the
shell-now, listener-later approach is still the right one, or whether the
dead toggle should come out until v2 is properly scoped, is undecided.

**Stale in-code comments:** `apps/mobile/app/cook.tsx` comments five flags
(`cook_step_ingredients_v1`, `cook_swipe_steps_v1`,
`cook_ingredient_checklist_v1`, `cook_multi_timers_v1`,
`cook_text_size_control_v1`) as "Default-OFF." All five are in fact in
`REDESIGN_DEFAULT_ON` in `apps/mobile/lib/analytics.ts` — the same class of
drift as §4's `recipe_detail_v3_conformance` comment. Not a behaviour bug;
the code ships correctly, the comment is just stale.

**Web:** `src/app/components/CookMode.tsx`, `src/app/components/cook/CookMiseEnPlace.tsx`.
**Mobile:** `apps/mobile/app/cook.tsx`, `apps/mobile/components/cook/CookLogServingsSheet.tsx`,
`apps/mobile/lib/cookHandsfree.ts`, `apps/mobile/hooks/useCookRunningTimers.ts`.

**Web ↔ mobile parity:** scale/timers/history are at parity via shared logic
(`recipeScale`, `recipeTimers`, `recipeCookHistoryClient`, `stepIngredients`)
and the same `recipe_cook_history` table. The three items above (regulars,
handsfree, and the stale-flag comments) are the genuine divergences —
documented here rather than left only as code comments.

**What comes next:** on finish, Cook Mode can auto-log servings eaten back to
the recipe and Today via `?autoLog=1&logServings=<n>` on the return URL —
see [food-tracking.md](./food-tracking.md) for what that write looks like on
the journal side. "Add to my regulars" (mobile) → the saved meal becomes a
Quick-Add target, also covered in [food-tracking.md](./food-tracking.md).

---

## §6 — Batch Cook

**Why this exists:** meal-prep parity — batch cooking multiple portions
ahead is a core meal-prepper persona behaviour.

**Entry point:** **Mobile** — a standalone pushed screen, `suppr:///batch-cook`,
off the Planner. **Web** — a sheet inside the v3 Plan surface (`PlanToolsV3`).
This is a genuinely different entry shape, not drift: it's really a
Plan-area feature that reaches into Recipes/Cook, and the two platforms'
Plan surfaces differ in whether a full screen or a sheet is the right
container.

**What the user does:** picks a saved recipe that yields multiple servings,
chooses a batch multiplier, and the app scales the recipe's ingredients into
the shopping list (pantry staples filtered out) and can jump straight into
Cook Mode (§5) at that scale.

**Known bug — do not describe the shopping hand-off as working.** Batch
Cook's "scale to shopping" write path persists to the **legacy JSON blob
table**, not the relational `shopping_items` table the shopping screen
actually reads — so the scaled items silently never appear in the shopping
list on mobile, and appear to work only transiently (in-memory) on web before
vanishing on reload. This is a real, open, unresolved bug — full root-cause
detail, the exact file:line evidence, and the fix direction live in
[shopping-list.md](./shopping-list.md#known-bug--batch-cook-scale-to-shopping-writes-to-a-dead-table).
This doc intentionally does not duplicate that writeup — go there for the
authoritative account.

**Web:** `src/app/components/plan/BatchCookSheet.tsx`, `src/lib/planning/batchCook.ts`.
**Mobile:** `apps/mobile/app/batch-cook.tsx`, `apps/mobile/components/plan/BatchCookSurface.tsx`.

**Web ↔ mobile parity:** the scaling logic itself is at parity (both call
the same shared `batchCook.ts` + `generateShoppingList`); only the entry
container differs (standalone screen vs. sheet), and the shopping hand-off is
broken identically in intent, differently in visible symptom, on both.

**What comes next:** Cook Mode (§5) at the chosen scale, or — once the known
bug is fixed — the scaled ingredients landing correctly in
[shopping-list.md](./shopping-list.md).

---

## §7 — Creator profile browsing (brief)

**Why this exists:** the creator/social strategy — a followed creator's
recipes surface in Discover's Following scope (§3), closing a follow →
more-of-their-content loop.

**Entry point:** tap a creator byline on a Discover hero card or a curated
Recipe Detail (§4) — only recipes carrying a real `creator_id` link to a
profile; imports and user-authored recipes don't.

**What the user sees:** a read-only profile — avatar, display name, @handle,
verified tick, bio, follower + recipe counts (a true head-count via a
separate `head: true` query, not the loaded-row count), an optimistic
Follow/Following toggle, and a newest-first recipe list with "Load more"
pagination (page size 24, `creatorRecipePagination.ts`, shared across
platforms). Honest empty ("No recipes yet") and not-found states — never
placeholder content.

**Web ↔ mobile parity:** at parity — same page size, ordering, load-more,
and follower/recipe head-counts; optimistic follow with rollback on both.
Phase 2b (a sort toggle, a popularity ribbon, a stats RPC) is deferred on
both, documented in the file header, not silently dropped.

**Web:** `app/creator/[id]/page.tsx`, `src/app/components/creator/CreatorRecipeList.tsx`.
**Mobile:** `apps/mobile/app/creator/[id].tsx`.

**This is a brief pointer, not the full picture.** The complete creator/
social loop — attribution requirements on imported recipes, DMCA/report
paths, the follow graph, and the (not yet built) real-creator-publishing
plane — lives in [creator-platform.md](./creator-platform.md). ENG-1535
removed the five fabricated launch personas: the rail now self-hides until
the RPC returns a genuine creator row.

**What comes next:** tap a recipe → back to §4 (Recipe Detail). Tap
Follow → the creator's recipes start appearing in Discover's Following scope
(§3).

---

## Known limitations & open questions

**Discover's deferred sections.** The "Popular collections" carousel and
"Recipes in action" Reels rail are marked deferred in-code with no wired
data source behind either (§3). Whether they're still planned or should be
cut from the roadmap is unresolved.

**No seed-content de-seed trigger.** `SEED_RECIPES_V2` is a verified
first-party editorial collection, but nothing defines when it should be
demoted once real community content exists at volume — see §3 for the full
picture.

**"Add to my regulars" is mobile-only.** The action exists on mobile's
completion card but has no web equivalent, and nothing in the product
documents this as a deliberate carve-out — see §5. It should either ship on
web or be written down as an intentional mobile-first choice.

**Cook-mode handsfree voice is an inert shell.** The mobile-only toggle has
a persisted preference and keyword-matching helper but no audio capture
behind it, and the decision record its code comment points to doesn't exist
in the repository (§5). The shell-now, listener-later posture needs
confirming — or the missing decision needs writing, or the dead toggle
needs removing.

**Recipe collections haven't ramped.** `recipe_collections_v1` stays
default-off pending a mobile simulator pass, with no committed ramp date
yet (§2).

**Real creator onboarding is not built.** The Discover rail now stays absent
until genuine creator rows exist, but there is still no write/claim path for a
real user to become one. Full detail lives in
[creator-platform.md](./creator-platform.md).

**A handful of stale in-code flag-default comments.** `recipe_detail_v3_conformance`
(§4) and five `cook_*` flags (§5) are commented "default-OFF" in mobile
source but are actually in `REDESIGN_DEFAULT_ON` today. This doesn't affect
behaviour, but it's worth a cleanup pass so future readers of the code
aren't misled.

## Related documents

- [import-recipe.md](./import-recipe.md) — the loop stage immediately
  before this doc (parse → verify → save); this doc is the tail (a saved
  recipe rendering in Library/Discover)
- [verify-ingredients.md](./verify-ingredients.md) — the ingredient-match
  correction flow reached from Recipe Detail's ingredient grid (§4)
- [create-recipe.md](./create-recipe.md) — writing a recipe from scratch,
  the adjacent-but-different flow to import
- [meal-planning.md](./meal-planning.md) — where a planner's "cook this"
  action originates before landing on Recipe Detail (§4)
- [shopping-list.md](./shopping-list.md) — "Add to shopping list" (§4) and
  the Batch Cook known bug (§6) both hand off here; this doc does not
  duplicate that content
- [food-tracking.md](./food-tracking.md) — where a recipe's macros actually
  land once logged from Recipe Detail (§4) or auto-logged from Cook Mode (§5)
- [recipe-transitions-2026-04-27.md](./recipe-transitions-2026-04-27.md) —
  full detail on the shared-element card→detail morph referenced in §4
  (dormant on web, deferred on mobile)
- [`docs/decisions/2026-07-03-eng1126-recipe-collections.md`](../decisions/2026-07-03-eng1126-recipe-collections.md) — Library collections (§2)
- [`docs/decisions/2026-05-05-recipe-detail-polish-patch.md`](../decisions/2026-05-05-recipe-detail-polish-patch.md) — the C1–C6 polish patch (§4) and its `/dev/recipe-detail-redesign` before/after harness
- [Mobile visual validation](../development/mobile-visual-validation.md) — the general `app/dev/*` / `apps/mobile/app/dev/*` internal harness pattern referenced in §4's recipe-detail dev page
- [`docs/decisions/2026-04-30-cook-screen-paprika-parity.md`](../decisions/2026-04-30-cook-screen-paprika-parity.md) — Cook Mode scaling + history (§5)
- [creator-platform.md](./creator-platform.md) — the full creator/social
  loop (§7): follow graph, import attribution/DMCA/report, and the real-only
  creator-onboarding posture
- [`docs/specs/2026-04-27-b5-discover-phase2.md`](../specs/2026-04-27-b5-discover-phase2.md) — the original build spec §7 is based on
- [`docs/ux/redesign/recipes.md`](../ux/redesign/recipes.md) — the design-level spec this journey doc narrates the shipped behaviour of
