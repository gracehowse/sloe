# Log sheet — canonical log entry path

**Status:** Evergreen — actively maintained (last content update 2026-06-27).
Renamed from `log-sheet-2026-04-27.md` to `log-sheet.md` on 2026-07-18 per the
Genesis evergreen-doc convention (`docs/genesis/README.md` §4): this doc
describes a permanent product primitive (the canonical `<LogSheet>` entry
point), not a dated event, so it drops the date suffix. All history below —
Phase 3 / B2.1 shipped 2026-04-27, updated 2026-04-28 (search-first refactor),
2026-04-30 (inline-search refactor), 2026-05-30 (log-time meal-slot selector),
2026-06-07 (Sloe DS reskin + S13 logged-confirmation), 2026-06-10 (history-first
search), 2026-06-11 (favourites in search), 2026-06-17 (describe-review
slot anchoring), and 2026-06-27 (LogHub quick-action row) — is preserved
unchanged; this is a rename, not a rewrite.
**Audience:** `(Developer)` / `(Internal)` — engineering + QA reference for the
`<LogSheet>` component, its wiring contract, and its cross-platform parity.
**Authority:** the "one canonical log path" decision in
`docs/decisions/2026-04-27-strategic-direction.md`.
**Spec:** `docs/specs/2026-04-27-production-design-spec.md` Surface B

## Scope

**In scope:** the `<LogSheet>` component itself — its search-first
composition (real text input, right-edge scan/voice/photo icons, Recent/Saved
browse toggle, the LogHub quick-action row, the meal-slot selector, and the
S13 "Logged to {slot}" confirmation card), its wire-up contract (inline vs
legacy tap-to-open search, the `confirmation` prop, the `slot` prop), its
state coverage, and web/mobile parity.

**Out of scope (linked, not duplicated):** the Today host screen that mounts
the sheet, the shared food-search ranking/de-dupe internals, and the
server-side AI voice/photo verification pipelines — all covered in
[`food-tracking.md`](./food-tracking.md). This doc covers how the sheet
surfaces those flows and hands off to them, not how they compute their own
results.

## Loop membership

The `<LogSheet>` is the entry-point component for two product loops (full
loop definitions live in [`food-tracking.md`](./food-tracking.md); this doc
covers only the sheet's role):

- **Daily Logging Loop (Log a Meal)** — the core, highest-frequency retention
  loop: open Today → tap the Log button/FAB → this sheet → search / scan /
  voice / photo / quick-add → portion picker → commit → the Today macro spine
  updates → repeat. This sheet is the loop's single entry point (see "What it
  is" below for why the 8+ legacy entry points were collapsed into it). The
  loop's re-log shortcuts — Quick Add (Usual/Recent/Frequent/Favourites), Copy
  meal / duplicate day, and the saved-usual-meal pill — are documented in
  `food-tracking.md`'s "Quick add" and "Save a usual meal" sections; this
  sheet's LogHub row (below) is a fast path into the same re-log actions.
- **AI-Assisted Logging & Trust Loop (barcode / voice / photo)** — every
  AI-assisted entry point in this sheet (the scan / voice / photo right-edge
  icons) hands off to a dedicated modal (`<BarcodeScannerModal>`,
  `<VoiceLogSheet>`, `<PhotoLogSheet>`) whose results route through the shared
  `verifyIngredients` / plausibility pipeline before they can touch the macro
  spine — low-confidence results are always surfaced, never silently guessed.
  See `food-tracking.md`'s "Scan", "Voice log (Pro, Batch 5.13)", and "Photo
  log (Pro, Batch 5.13)" sections for the trust-pipeline detail this sheet's
  icons hand off to. This doc's "Wire-up notes" section below covers only the
  handoff contract (callback props), not the pipelines themselves.

## What it is

The `<LogSheet>` is the single canonical entry point for every log
flow in Suppr. It replaces the legacy 8+ entry-point splay (Quick
Add, search, barcode, voice, photo, recipe-detail-log,
planned-meal-log, household, copy-meal, usual-meal) with one sheet
opened by a persistent Log button.

The Log button itself moved from a side-positioned FAB to a centered
raised tab-bar button on 2026-04-30 (mobile only — see "Where it
lives" below). The button is purely UI, not a 5th screen route, so
the app's 4-tab navigation structure is preserved.

Above the browse tabs, the sheet also renders an optional **LogHub
quick-action row** (flag `loghub_quick_actions_v1`, default OFF —
`Log usual` / `Copy yesterday` / `Duplicate day`, only the resolvable
buttons render). It is not covered in `food-tracking.md` — see the
"2026-06-27 — LogHub quick-action row" section below for the full
behaviour, gating, and test coverage.

### Original Phase-3 shape (superseded)

Six sub-tabs, named exactly as in §1.7 CTA voice:

1. **Search foods** — typeahead + result rows
2. **Scan barcode** — full-bleed camera + 0-kcal manual fallback
3. **Recent** — Today + Earlier-this-week
4. **Saved meals** — templates
5. **Voice log** — 88×88 mic (Pro-gated upstream)
6. **Photo log** — full-bleed shutter (Pro-gated upstream)

### 2026-04-28 — search-first refactor

The 6-tab strip read as a "power-user feature menu": first-time users
had to read six labels before logging anything. We replaced it with a
search-first composition:

- A single **search row** at the top (primary input).
- Three small **right-edge icons** in the search row for scan / voice
  / photo — they tap-to-open the dedicated modals.
- A **Recent / Saved** 2-pill toggle below the search row for the
  default browse content.
- A footer **"Or add manually"** link as escape hatch into the
  manual-quick-add form.

In this refactor the search row was a tap-to-open `Pressable` styled
like an input. Tapping it CLOSED the LogSheet and OPENED a separate
`<FoodSearchModal>` that was the real input. Two modals stacked.

### 2026-04-30 — inline-search refactor (current, mobile + web)

Customer-lens flagged the nested-modal pattern as 1-star UX vs Cal AI
(real text input you type into immediately). We lifted the entire
`<FoodSearchModal>` body — search results list, preview portion
picker, fit-this-in hint, custom-foods CRUD — into a shared
`<FoodSearchPanel>` component. Now:

- The LogSheet's search row is a real `<TextInput>` (mobile) or
  `<Input>` (web) with `autoFocus`. The user opens the sheet and
  starts typing immediately.
- As the user types, results render INSIDE the same sheet via the
  mounted `<FoodSearchPanel mode="compact">`. No nested modal.
- When the user picks a portion + quantity, the existing logging
  pipeline runs (`handleFoodSearchSelect` in
  `app/(tabs)/index.tsx` on mobile; `commitFoodSearchSelection` in
  `NutritionTracker.tsx` on web).
- When the input is empty, the Recent / Saved 2-pill toggle stays
  visible — empty-query state shows the user their browse content.
- `<FoodSearchModal>` (mobile) / `<FoodSearch>` (web) is now a thin
  wrapper around `<FoodSearchPanel mode="full">` — kept around for
  the still-active "search instead" path inside
  `<TodayAddFoodForm>` and the verify-ingredient flows
  (`recipe/verify.tsx`, `create-recipe.tsx`, `import-shared.tsx` on
  mobile; `RecipeDetail.tsx` on web).

On mobile the sheet wraps in a `<KeyboardAvoidingView>` so the
inline results region scrolls above the iOS software keyboard. On
web the vaul `Drawer` already handles viewport-resize correctly.
Right-edge icons (scan / voice / photo) keep their existing
tap-to-open behaviour on both surfaces.

A `search.onSelect` host callback activates inline mode; a host that
wires only `search.onOpen` keeps the legacy tap-to-open Pressable /
button (backwards compat for any non-Today host that hasn't
migrated yet). On Today, both surfaces wire `onSelect` directly.

### 2026-05-30 — log-time meal-slot selector (flag-gated)

Grace TF (build-47, open feedback): _"items keep getting added to
fields by time of day rather than for the meal i am trying to add
them to … i click + for breakfast but its the afternoon it adds it
as snack."_ The target meal slot was a hidden, clock-inferred guess
the user could only correct via a long-press edit **after** logging.

The fix surfaces it. A 4-segment **Breakfast / Lunch / Dinner /
Snacks** radio row renders directly under the LogSheet header. The
active slot is still seeded from time-of-day on open, but it is now
visible and one-tap overridable **before** logging. The chosen slot
is the one every commit path writes — no pick-handler re-derives it
from the clock (the build-47 fix; the pick-handlers already read the
host's active slot, this only makes that slot user-visible).

**Flag-gated** (CLAUDE.md visual-change rule): the picker row is new
structure, so it ships behind `log-sheet-slot-selector`
(`isFeatureEnabled` from `@/lib/analytics` on mobile,
`../../lib/analytics/track` on web). Flag-OFF renders no row and
behaviour is identical to before this change — the host still
threads its active slot (`activeMealSlot` on mobile, `mealSlot` on
web) through every commit path regardless of the flag; only the
visible picker is gated. Ramp via the PostHog dashboard; once it
holds 100% for two weeks with no regression the gate is removed in a
cleanup PR.

**Selection language:** soft primary tint (`Accent.primarySoft`,
`rgba(88,140,228,0.10)` / web `bg-primary/10`) + primary border +
**foreground** label — NOT solid indigo. White-on-`#588CE4` and
primary-text-on-tint both measure ~3.34:1, which fails WCAG AA 4.5:1
for the 12–13px bold label; the foreground label on the soft tint
clears AA comfortably. This matches the canonical mobile segmented
control (`apps/mobile/components/onboarding/segmented.tsx`,
2026-05-22 comment) rather than the web onboarding segmented (still
solid `bg-primary` — a pre-existing platform divergence, not one
this change introduces). The mobile `TodayEditMealModal` slot pills
are the other outstanding instance of the failing solid-`#588CE4` +
white pattern; this component deliberately did **not** reuse them.
That modal's contrast issue is a separate, already-known gap — not
one this change introduces or leaves open.

**a11y:** the row is a `radiogroup` labelled "Meal to log to"; each
pill is a `radio` carrying its selected state — web via
`role` / `aria-checked`, mobile via `accessibilityRole` +
`accessibilityState={{ selected }}`. Per-slot testIDs
`log-sheet-slot-{breakfast,lunch,dinner,snacks}` + a
`log-sheet-slot-row` handle exist on both surfaces for Maestro /
Playwright.

**Ladder unification (ships UN-gated — it is the parity bug fix, not
a new surface).** The seed-from-clock helper had drifted: `index.tsx`
(mobile) and `NutritionTracker.tsx` (web) each carried a local
`slotForHour` with **10/14/17** cutoffs, while the shared recipe-log
path (`src/lib/nutrition/recipeJournalSlot.ts`) used **11/15/17**. The
same clock time bucketed a 10–11am or 2–3pm log into _different_ meals
depending on entry path. Both local copies are deleted; both hosts now
import the shared `slotForHour` (single source of truth, canonical
ladder **breakfast <11, lunch <15, snacks <17, dinner ≥17**).
Net user-visible seed change: a 10:30am open now seeds **Breakfast**
(was Lunch) and a 2:30pm open seeds **Lunch** (was Snacks) — both
still one-tap overridable. This half ships un-gated because it is a
correctness fix, not a visual surface.

### 2026-06-07 — Sloe DS reskin + S13 logged-confirmation

The Log surfaces were the last 0/19 area still on the pre-Sloe visual
grammar while the rest of the app moved to the Sloe design system. This
pass is **presentation-only** — no logging, search, or persistence path
was touched. The app's search-first composition (canonical since
2026-04-30) is preserved; only the skin moved to the Sloe language.

Reskinned (web `log-sheet.tsx` + mobile `today/LogSheet.tsx`, plus the
voice/photo sheets):

- **Sheet shape:** 24px top corner (`rounded-t-[24px]` web /
  `borderTopLeftRadius: 24` mobile, the `--radius-card-lg` Sloe sheet
  corner) over the prior 16/20px.
- **Header:** "Log a meal" now reads in the Newsreader **serif** in
  brand **plum** (`text-foreground-brand` web / `Type.title` +
  `navPrimary` mobile) — the same editorial heading grammar as the
  Today section headers.
- **Search slab + browse toggle:** pill-soft cream slabs (`rounded-xl` /
  `Radius.xl`).
- **PRO badges:** the voice + photo right-edge gate badges moved from
  the clay primary to **damson** (`var(--accent-win)` web /
  `Accent.purple` mobile) — the canonical Pro / achievement accent,
  visually distinct from the clay content CTA. The voice/photo **sheet
  headers** carry the same damson glyph + plum serif title.
- **Empty states + CTAs (button system, 2026-06-12 — supersedes the prior
  outline / off-white treatment):** the sheet's commit CTAs — the
  manual-entry **"Log it"** and the S13 **"Done"** — are the SOLID-plum
  `SupprButton variant="primary"` (white label, full pill, no shadow; the
  solid fill is the affordance on the flat cream sheet). The empty-state
  **"Browse recipes"** and the S13 **"Undo"** are `variant="ghost"`
  (transparent, plum label, no border) — they replace the old aubergine
  outline and the off-white `colors.card` / `bg-secondary` fill. One primary
  per sheet view; the sheet keeps its sanctioned overlay elevation while the
  buttons inside carry none (see the button-system decision doc linked
  under "Related documents"). Recent / Saved / Library empty blocks keep
  the Sloe `rounded-xl` slab.

**S13 logged-confirmation (Figma 202:2 — the "highest-impact gap").** A
new presentation-only success state shown **after** the host commits a
log. The LogSheet still owns nothing about persistence; the host passes
a `confirmation` prop and the sheet swaps its content for a calm "Logged
to {slot}" card:

- A sage **success check** in a soft sage tint (calm, not loud).
- A plum **serif** "Logged to {slot}" headline (falls back to "Logged"
  when no slot is supplied).
- A cream item card with the logged title + provenance dot + **"Est. {n}
  kcal"** (trust posture — nutrition is always estimated, never
  absolute).
- A SOLID-plum primary **"Done"** (`SupprButton variant="primary"` — the
  one primary action) + an optional ghost **"Undo"**
  (`variant="ghost"`, rendered only when the host wires `onUndo`). Button
  system 2026-06-12 — was a clay/aubergine-outline Done + quiet-text Undo.

`confirmation?: { title; kcal; slot?; source?; onDone; onUndo? } | null`
is mirrored byte-for-byte across both platforms, rendered by a dedicated
`LoggedConfirmation` component, and tagged `log-sheet-confirmation` for
Maestro / Playwright. It is **not** flag-gated: it is purely additive
presentation a host opts into by passing the prop (no existing path
shows it until a host wires it), and the Sloe redesign flags are already
default-ON project-wide (Grace 2026-06-01: "turn everything on; never
flag-gate again"). Wiring the host to surface S13 after each commit is
the only remaining step beyond presentation — scoped minimally and left
to the host so this pass touches zero persistence code.

### 2026-06-17 — describe review active-slot anchoring

The mobile natural-language describe path now threads the Today host's
`activeMealSlot` into `LogSheetDescribeFlow` as `slotLabel`. The review
summary therefore says the concrete target slot (for example "Lunch")
instead of falling back to generic "Meal" while the user is reviewing AI
matches. This is parity with the existing voice-log sheet path, which
already passed its active slot label into the same review surface.

### 2026-06-10 — history-first search ("Past logged" group)

MFP grammar, the one Grace flagged with a side-by-side screenshot: when a
user types a query in the food-log search, the foods they have **logged
before** that match it surface **first**, as a visually-distinct **"Past
logged"** group **above** the database (FatSecret / USDA / OFF) results. Each
row is one-tap loggable. Empty query keeps the existing behaviour (the
"Recent" strip on mount).

How it works:

- **Shared matcher** (`src/lib/nutrition/foodHistorySearch.ts`, imported by
  both panels via `@suppr/shared/...` on mobile and `@/lib/...` on web — pure,
  no React / Supabase / `Date`): `matchHistoryFoods(history, query)` ranks the
  user's logged-food history (newest-first, from `computeRecentMeals`) by
  **relevance** (the stemmed, diacritic-insensitive `searchMatchScore`,
  floored by a raw substring hit so `sour` → `Sourdough`), then **recency-
  weighted frequency** (a more-often + more-recently logged staple wins ties),
  then title. The group is **de-duped** by the canonical `${title}|${kcal}`
  key (a staple logged 20× shows once) and **capped** at `HISTORY_MATCH_CAP`
  (6).
- **De-dupe vs database (history wins):** a database catalogue row whose
  **name** exactly matches a "Past logged" row is suppressed, so the item
  appears once (in the history group). Cross-source identity is the *name*,
  not the kcal — catalogue kcal is per-100g and never matches the per-serving
  history kcal. Conservative: only an exact normalized-name collision de-dupes
  (`Sourdough` suppresses the catalogue `Sourdough` but never `Sourdough
  crackers`).
- **One-tap log:** a "Past logged" row commits as a per-serving food
  (`macrosPer100g: null`, `macrosPerServing` = the prior totals, `quantity: 1`,
  source discriminator `"history"` → labelled neutrally, never misattributed to
  a database source). Same payload shape as the empty-query "Recent" strip
  (extracted to one `onSelectHistoryItem` callback per platform — the two
  history surfaces can't drift in what they commit).
- **Filter scope:** the group renders only on the **All** filter (web) /
  **All** or **Recents** (mobile) — Branded / Generic / Custom intents are
  explicitly "search-result shape" and aren't topped with history.

Wiring: hosts thread the user's history (newest-first, a 50-row window, with
`count`) into the panel via the new `search.recentFoods` field on `<LogSheet>`
(→ inline `<FoodSearchPanel>`) and the `recentFoods` prop on `<FoodSearch>`
(web) / `<FoodSearchModal>` (mobile). HealthKit-import fallback rows are
stripped (parity with the Recent tab). When no history is wired the group
simply doesn't render — no behaviour change for those hosts.

Not flag-gated: the group is purely additive (it only appears when a typed
query has history hits) and history is the user's own data, so there's no
visual regression risk on the existing DB-results path (Grace 2026-06-01: "turn
everything on; never flag-gate again"). Mirrored byte-for-byte across web +
mobile; the shared matcher guarantees the two surfaces rank, de-dupe, and cap
identically.

### 2026-06-11 — favourites surfaced in search + star toggle

The `user_favorite_foods` model already existed and powered the Today
QuickAddPanel, but it never reached the place people actually search for
food. MFP / Lifesum / Yazio refugees arrive with "where are my saved
foods?" muscle memory. This wires favourites **into the one search surface**
— no new tab.

What changed:

- **A "Favourites" group above "Past logged".** When the typed query matches a
  starred food, it surfaces in a **Favourites** group rendered **above** the
  "Past logged" history group (the curated set leads the recall set). A food
  that's both a favourite and in history shows **once**, in Favourites
  (favourites win) — de-duped by the canonical `${title}|${kcal}` key.
- **Favourites-first in the empty-query Recent strip.** On mount (empty query),
  starred foods lead the Recent strip, then the rest of recents in their
  existing recency order. On **mobile** this is applied in the panel's recent
  strip; on **web** the empty-query recent strip lives in the LogSheet `recent`
  browse tab, so the ordering is applied at the host there (same shared helper).
- **A star toggle on every history-style row** (Recent strip + Favourites +
  Past logged). Filled amber (`Accent.warning` / `--accent-win`) = starred,
  outline = not; disabled + dimmed while a toggle is in flight (no
  double-submit). One shared mobile component (`FavoriteStarButton`) and one web
  helper (`FavoriteStar`, a `role="button"` span so it nests validly inside the
  row button). Tapping a star is `stopPropagation`'d so it never also logs the
  row.

How it works:

- **Shared matcher / orderer** (`src/lib/nutrition/favoriteFoodsSearch.ts`,
  imported by both panels — pure, no React / Supabase / `Date`):
  `matchFavoriteFoods(favourites, query)` ranks by the same stemmed scorer the
  history group uses (floored by a raw substring hit), de-dupes by `favoriteKey`,
  caps at `FAVORITE_MATCH_CAP` (5). `orderRecentWithFavoritesFirst(recent, keys)`
  lifts starred rows to the front, stable within each partition.
  `favoriteFoodKeySet` / `isFavoriteRow` drive per-row star state with **no
  per-row Supabase call** (the key set matches the DB unique index exactly).
- **Optimistic toggle:** the host owns the add/remove + Supabase write + revert
  (mirrors the QuickAddPanel `toggleFavorite` and the same `favoriteFoods.ts`
  CRUD). On mobile `apps/mobile/app/(tabs)/index.tsx`; on web
  `src/app/components/NutritionTracker.tsx`. The host loads favourites once
  (`listFavorites`) and guards double-submit via a `favoritePendingKeys` set
  threaded down through `<LogSheet>` → `<FoodSearchPanel>`.
- **Filter scope:** the Favourites group renders only on the **All** filter
  (web) / **All** or **Recents** (mobile), same gate as the history group.

Wiring: hosts thread `search.favoriteFoods`, `search.onToggleFavorite`, and
`search.favoritePendingKeys` through `<LogSheet>` to the inline
`<FoodSearchPanel>` (also forwarded by `<FoodSearchModal>` on mobile). When no
favourites are wired the group + star simply don't render — no change for those
hosts. Not flag-gated (purely additive, the user's own data). Mirrored across
web + mobile via the shared matcher.

### 2026-06-27 — LogHub quick-action row (flag-gated)

The v3 prototype's `LogHub` (`docs/ux/redesign/v3/Sloe-App.html`) shows a
three-button quick-action row above the browse tabs:
**Log {usual} / Copy yesterday / Duplicate day**. Implemented cross-platform
behind `loghub_quick_actions_v1` (default OFF — registered in
`KNOWN_DEFAULT_OFF_FLAGS` on both `src/lib/analytics/track.ts` and
`apps/mobile/lib/analytics.ts`). **This row is not covered in
`food-tracking.md`** — this is the canonical doc for it.

- **Log usual** — logs the user's "usual" **saved meal** for the active slot.
  Selection lives in the shared pure helper
  `selectUsualSavedMeal(meals, activeSlot)`
  (`src/lib/nutrition/savedMealsLogic.ts`): filter to the active slot's
  `defaultMealSlot` → highest `logCount` → tie-break latest `lastLoggedAt`;
  if nothing matches the slot, fall back to the overall highest-`logCount`
  saved meal. The button label is **"Log {meal name}"** (read against the live
  active slot, so a manual slot change re-labels it) and re-resolves at tap
  time. Commits via the existing `logSavedMealFromPanel` (mobile) /
  `logSavedMeal` (web) path. **Hidden when the user has 0 saved meals.**
- **Copy yesterday** — reuses the existing `handleCopyYesterday` flow; same
  gate as the legacy standalone row (viewing today, today still empty,
  yesterday had ≥1 meal). When the flag is ON the standalone `CopyYesterdayRow`
  (mobile) / `copy-yesterday-row` (web) is suppressed so the action never ships
  twice; when OFF, the standalone row is the live path (the `else`).
- **Duplicate day** — opens the existing `DuplicateDaySheet` (mobile) /
  `DuplicateDayDialog` (web). Shown only when today has ≥1 logged meal.

The row renders **only the resolvable buttons** (no dead buttons); when none
resolve, it renders nothing. Vocabulary is "saved meal" throughout — the
prototype's "Routine" wording is intentionally NOT adopted.

The presentational component is extracted to its own file on each platform to
hold the screen-line budget:
`apps/mobile/components/today/LogHubQuickActions.tsx` and
`src/app/components/suppr/log-hub-quick-actions.tsx` (shared
`LogHubQuickActionsProps` shape). Hosts thread the flag-gated `quickActions`
prop through `<LogSheet>`; selection + gating live at the host
(`apps/mobile/app/(tabs)/_today/TodayScreen.tsx`,
`src/app/components/NutritionTracker.tsx`). Tokens only (card pill, `Radius.xl`,
`Spacing` gutters, `Type.captionStrong` label on mobile; matching Tailwind
token classes on web). `PressableScale` (`haptic="selection"`) on mobile;
hover + `:focus-visible` ring + `active:scale` on web.

## Where it lives

- Web: `src/app/components/suppr/log-sheet.tsx` (vaul-driven drawer
  on mobile-web; centred 480×640 modal on desktop). Hosted from
  `src/app/components/NutritionTracker.tsx` behind `logSheetOpen`.
  Web's Log button is still a side FAB at `right:18 / bottom:100`
  on mobile-web only (`md:hidden`); desktop has no FAB by design.
  Mobile-web tab-bar redesign is a follow-up.
- Mobile: `apps/mobile/components/today/LogSheet.tsx` (RN `Modal`
  pattern, 92% height, 36×4 drag handle). Hosted from
  `apps/mobile/app/(tabs)/index.tsx` behind the existing
  `fabSheetOpen` state (preserved name to avoid 30+ call-site edits).
  Mobile's Log button is the centered raised Plus inside
  `<SupprTabBar>` (`apps/mobile/components/tabs/SupprTabBar.tsx` +
  `apps/mobile/components/tabs/LogTabBarButton.tsx`). It routes
  Today with `?openLog=1`, which a `useEffect` consumes to set
  `setFabSheetOpen(true)` and clear the param.

## Wire-up notes

The LogSheet is intentionally callback-driven. It does NOT own the
barcode scanner or the voice/photo providers — the caller passes in
handlers that route into `<BarcodeScannerModal>`, `<VoiceLogSheet>`,
`<PhotoLogSheet>`.

For search, the 2026-04-30 refactor introduced a richer wiring shape:

- **Inline mode** (preferred): the host wires `search.onSelect` plus
  optional budget context (`macroTargets`, `macroConsumed`) and
  custom-foods context (`supabase`, `userId`). The LogSheet's search
  row becomes a real `<TextInput>`, results render inline via
  `<FoodSearchPanel>`, and the host's `onSelect` fires when the user
  confirms a portion. Today uses inline mode.
- **Legacy tap-to-open mode**: the host wires only `search.onOpen`.
  The search row stays as a tap-to-open `Pressable` and the host
  closes the LogSheet + opens its own `<FoodSearchModal>` — same as
  the 2026-04-28 shape.

Either way, the LogSheet doesn't rebuild nutrition logic — it just
hands selection events to the host's logging pipeline.

## Spec deviation: bottom-sheet primitive

The production design spec calls for `@gorhom/bottom-sheet` with
snap points 50% / 92%. That dependency is not yet in the project.
Rather than introduce it for one component (which would require
linking reanimated wrappers that already exist), we ship the RN
`Modal` pattern that all other Suppr sheets use. Snap behaviour is
approximated via a fixed 92% height + the "drag down to close" the
Modal already provides.

If user testing surfaces friction with the 92%-only height (e.g.
"need a peek-state for one-handed search"), revisit by adding the
gorhom dependency in a dedicated PR. Not blocking ship.

## State coverage

Per spec Surface B §State:

- **Loading** — 4 skeleton rows in Search / Recent / Saved tabs.
- **Empty** — Search "No matches for '{query}'", Recent "Your
  recent foods will appear here", Saved "No saved meals yet".
- **Error** — Search "Couldn't search. Try again →" with WifiOff.
- **Partial** — Barcode 0-kcal product opens the inline manual-entry
  form with portion + macros editor (closes Top Broken Journey #5).
- **Permission denied** — Voice / Photo / Barcode each surface a
  "Grant access" empty state.
- **Offline** — Search shows "You're offline. Searching cached
  foods only." caption.
- **First-run** — Voice + Photo show a 2-line tip card; dismissable
  upstream.

## Trust posture (B2.4 link)

Every result row in the Search / Recent / Saved tabs renders a
`<SourceDot size={6}>` next to the kcal value. The barcode 0-kcal
fallback renders a `<TrustChip variant="manual">` above the manual
form. See `docs/specs/2026-04-27-production-design-spec.md` §1.6.

## Tests

- `tests/unit/logSheetPhase3.test.tsx` — web (25 tests; 7 added
  2026-04-30 for inline-search mode: real Input rendering,
  query-empty-vs-non-empty branching, legacy `onOpen` fallback,
  query reset on close, right-edge icons in inline mode).
- `apps/mobile/tests/unit/logSheetPhase3.test.tsx` — mobile mirror
  (27 tests; 6 added 2026-04-30 for inline-search mode: real
  TextInput rendering, query-empty-vs-non-empty branching,
  legacy `onOpen` fallback, query reset on close, right-edge
  icons in inline mode).
- `apps/mobile/tests/unit/logSheetEntryPointConsolidation.test.ts`
  — source-pin tests that fail if a future contributor re-imports
  `<TodayFabSheet>` or splays the entry points back out.
- `apps/mobile/tests/unit/foodSearchPagination.test.ts` — F-10
  pagination state pinned in `<FoodSearchPanel>` (was modal pre-
  2026-04-30).
- `apps/mobile/tests/unit/foodSearchPrimaryServingParity.test.ts`,
  `foodSearchModalFitThisIn.test.tsx`, `offMicrosPullThroughParity.test.ts`
  — all updated to read the panel as the canonical mobile source.
- **Meal-slot selector:**
  - `tests/unit/logSheetSlotSelector.test.tsx` (web) +
    `apps/mobile/tests/unit/logSheetSlotSelector.test.tsx` (mobile) —
    render harness: mounts `<LogSheet slot={…}>`, asserts no row when
    the prop is omitted (flag-OFF path), all four `log-sheet-slot-*`
    radios when wired, only the current slot announces selected, and a
    tap forwards the tapped slot to `onChange` (5 tests each).
  - `apps/mobile/tests/unit/logSheetSlotHonoured.test.ts` +
    `tests/unit/logSheetSlotHonouredWeb.test.ts` — source-pins for the
    build-47 pick-handler fix, the un-gated ladder unification
    (11/15/17, no local `slotForHour`), and the flag-gate wrapper.
  - `tests/unit/logSheetWebMobileParity.test.ts` — web↔mobile
    structural parity for the `slot?` prop shape, per-slot testID
    template, radiogroup/radio roles, and the `log-sheet-slot-row`
    handle.
  - `tests/unit/recipeJournalSlot.test.ts` — the canonical 11/15/17
    ladder, bucket-by-bucket.
- **2026-06-07 Sloe reskin + S13 logged-confirmation:**
  - `tests/unit/logSheetPhase3.test.tsx` (web) +
    `apps/mobile/tests/unit/logSheetPhase3.test.tsx` (mobile) — a new
    "S13 logged-confirmation" describe block (5 tests each): the
    confirmation card renders the slot-aware headline + estimated kcal,
    falls back to a bare "Logged" with no slot, suppresses the
    search/browse composition while confirming, `Done` fires `onDone`,
    and `Undo` renders + fires only when `onUndo` is wired.
  - `tests/unit/logSheetWebMobileParity.test.ts` — a new parity block
    pinning the `confirmation?` prop shape, the `log-sheet-confirmation`
    handle, the dedicated `LoggedConfirmation` component, the `Est.`
    estimate copy (trust posture), and the Done/Undo actions across both
    platforms.
  - `src/app/components/suppr/log-sheet.stories.tsx` — added
    `SloeEntrySheet` (full reskinned sheet with Pro-locked icons) and
    `LoggedConfirmation` (S13) stories for pixel + a11y review.
- **2026-06-10 history-first search:**
  - `tests/unit/foodHistorySearch.test.ts` — the shared matcher/ranker
    (20 tests): substring + case/diacritic insensitivity, recency-weighted-
    frequency ordering, exact-match-outranks-partial, `${title}|${kcal}`
    de-dupe (collapse staples, keep same-title-different-kcal distinct), cap,
    and the history-wins-over-DB de-dupe (`historyMatchNameSet` +
    `dedupeDbAgainstHistory`, never dropping an un-keyable DB row).
  - `tests/unit/foodSearchPastLogged.test.tsx` (web) +
    `apps/mobile/tests/unit/foodSearchPastLogged.test.tsx` (mobile) —
    component pins: the "Past logged" group renders under its eyebrow above
    the DB results for a query with history hits, is absent when none match
    or the query is empty, sits ABOVE the database section (web document-order
    assertion), and a one-tap commits the per-serving payload with the
    `"history"` source discriminator.
- **2026-06-27 LogHub quick-action row:**
  - `tests/unit/savedMealsLogic.test.ts` — `selectUsualSavedMeal` (9 tests,
    shared/platform-agnostic): empty/nullish → null, slot-match preference,
    case-insensitive slot, highest-`logCount` within a slot, `lastLoggedAt`
    tie-break (incl. missing-timestamp loses), overall fallback when no slot
    matches, empty/missing slot → overall max, untagged meals → fallback only.
  - `apps/mobile/tests/unit/logHubQuickActions.test.tsx` (mobile) +
    `tests/unit/logHubQuickActions.test.tsx` (web) — render harness (10 tests
    each): no row when neither prop is wired, all three buttons when resolvable,
    the "Log {name}" label, each conditional hide (0 saved meals → no Log usual;
    absent copy-yesterday; absent duplicate-day), empty-`quickActions` renders
    nothing, each handler fires, and the standalone copy-yesterday row does NOT
    double-render when `quickActions` is wired (plus the flag-off path still
    renders it alone).
  - `tests/unit/logSheetWebMobileParity.test.ts` — new parity block pinning the
    `LogHubQuickActions` component on both platforms (row testID,
    `loghub-quick-${key}` template, the three action keys) and that both sheets
    render the component above the browse tabs.

## Cross-platform parity

- Mobile uses RN Modal; web uses vaul Drawer. Both render the same
  search-first composition (search row + right-edge scan/voice/photo
  icons + Recent / Saved toggle + manual footer) with the same
  accessibility labels.
- Desktop web renders the LogSheet as a centred 480×640 modal
  (configurable via the `desktop` prop) per spec.
- 2026-04-30 (FAB): mobile retired the side FAB at
  `right:18 / bottom:100` in favour of a centered raised tab-bar
  button (Cal AI / Lifesum / MyFitnessPal convention). Web mobile-
  web still ships the side FAB at the same coordinates; desktop
  web hides any FAB by design. Aligning mobile-web with the new
  raised tab-bar pattern remains an open follow-up.
- 2026-04-30 (inline search): both surfaces now mount the shared
  `<FoodSearchPanel>` inline. Mobile lifted first (commit
  `1968953`); web parity landed in the same dated batch. The web
  panel lives at `src/app/components/food-search/FoodSearchPanel.tsx`
  and matches the mobile prop signature (`query`, `onSelect`,
  `mode`, `macroTargets`, `macroConsumed`, `supabase`, `userId`,
  `initialAmount`, `initialUnit`, `originalDescription`) so the two
  implementations can be compared shape-for-shape in parity reviews.
- 2026-05-30 (meal-slot selector): both surfaces declare the same
  optional `slot?: { current: string; options: readonly string[];
  onChange: (slot: string) => void }` prop, render the same
  radiogroup-of-radios with the `log-sheet-slot-row` +
  `log-sheet-slot-${slot}` handles, and gate the row behind the same
  `log-sheet-slot-selector` flag in their respective hosts
  (`NutritionTracker.tsx` / `app/(tabs)/index.tsx`). Both hosts seed
  the slot from the shared `slotForHour` (11/15/17) — no local clock
  ladder survives on either platform. Parity pinned by
  `tests/unit/logSheetWebMobileParity.test.ts`.
- 2026-06-07 (Sloe reskin + S13): both surfaces moved to the Sloe DS in
  lockstep — 24px sheet corner, plum serif header, cream search/browse
  slabs, damson Pro badges — and both declare the identical
  `confirmation?` prop rendered by a shared-shape `LoggedConfirmation`
  component (sage success mark, plum serif "Logged to {slot}", estimated
  kcal, clay Done + quiet Undo). Web uses CSS tokens
  (`text-foreground-brand`, `var(--accent-win)`, `rounded-[24px]`),
  mobile the matching theme constants (`navPrimary`, `Accent.purple`,
  `Type.title`, 24px radius). Parity pinned by the new
  `logSheetWebMobileParity.test.ts` S13 block. Verified on web via the
  `SloeEntrySheet` + `LoggedConfirmation` Storybook stories
  (`screenshots/web-drive/log-sheet-sloe-entry.png`,
  `log-sheet-sloe-confirm.png`); iOS verified via `suppr:///?openLog=1`.

## Migration

The legacy `<TodayFabSheet>` (mobile) is retired. Its file remains
on disk for any deep test references but is no longer imported by
the Today composition root. The existing entry points it routed
into (search, barcode, photo, voice, quick-add, previous) have
been migrated:

| Legacy entry          | New path                                         |
|-----------------------|--------------------------------------------------|
| Quick Add inline expand | LogSheet "Recent" tab                          |
| Standalone barcode    | LogSheet "Scan barcode" tab                      |
| Voice / Photo Pro entry | LogSheet "Voice log" / "Photo log" tabs        |
| Copy-meal / usual-meal | LogSheet "Saved meals" tab                      |
| Search modal           | LogSheet "Search foods" tab + onAdd → search modal |

The web `LogFab` placeholder alert ("Coming in Phase 3") is gone —
the FAB now opens the canonical sheet.

## Related documents

- [`food-tracking.md`](./food-tracking.md) — the Today host that mounts this
  sheet; the Daily Logging Loop and the AI-Assisted Logging & Trust Loop in
  full (Search, Scan, Voice log, Photo log, Quick add, Save a usual meal
  sections).
- [`docs/journeys/README.md`](./README.md) — journey doc index + automated
  coverage map.
- `docs/decisions/2026-04-27-strategic-direction.md` — the "one canonical
  log path" decision this doc implements.
- `docs/specs/2026-04-27-production-design-spec.md` Surface B — the original
  design spec (§State, §1.6 trust posture, §1.7 CTA voice).
- `docs/decisions/2026-06-12-button-system-solid-primary.md` — the
  primary/ghost CTA system used throughout the sheet since 2026-06-07.
