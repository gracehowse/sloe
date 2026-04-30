# Tab structure collapse — 6 → 4 (2026-04-27, Phase 2 / B1.1)

**Status:** Shipped 2026-04-27 (Phase 2 of the strategic redesign).
**Authority:** `docs/decisions/2026-04-27-strategic-direction.md`
D-2026-04-27-02 (tab collapse), D-2026-04-27-07 (streak as pip),
D-2026-04-27-08 (caffeine/alcohol off Today), D-2026-04-27-15
(canonical FAB).
**Spec:** `docs/specs/2026-04-27-production-design-spec.md` Surface A
(canonical Today) + Part 3 Phase 2 sequence.
**Owner:** executor (this doc) → sync-enforcer (parity sign-off) →
visual-qa (real-device check).

This document is the source of truth for the tab restructure: the new
shape, the deep-link map, intentional cross-platform deviations, and
the things explicitly deferred to later phases.

---

## Final tab set

The four primary tabs are, in canonical left-to-right order:

| # | Tab | Mobile route | Web sidebar leaf | Web bottom-tab leaf |
|---|---|---|---|---|
| 1 | **Today** | `/(tabs)/index` | `today` | `today` |
| 2 | **Recipes** | `/(tabs)/library` (default) | `library` (default) | `library` |
| 3 | **Plan** | `/(tabs)/planner` | `plan` (default) | `plan` |
| 4 | **You** | `/(tabs)/progress` (default) | `progress` (default) | `progress` |

Sub-tabs render below each primary entry where applicable:

| Primary | Sub-tabs |
|---|---|
| Today | (none) |
| Recipes | Library (default), Discover |
| Plan | This week (default), Shopping |
| You | Progress (default), Profile, Settings |

The previous 6-tab structure (Today / Discover / Library / Plan /
Progress / More) is retired. Discover, Progress, Settings, More are no
longer in the primary tab bar — they remain as routable screens
accessible via the corresponding sub-tab pill or via direct deep
links (so existing `router.push("/(tabs)/discover")` calls and
`useSafeBack("/(tabs)/more")` continue to resolve).

---

## Mobile implementation

**`apps/mobile/app/(tabs)/_layout.tsx`** exposes only four
`<Tabs.Screen>` entries with visible tab-bar buttons:

- `index` → label "Today", icon `Flame`.
- `library` → label "Recipes" (re-labeled), icon `BookOpen`. A
  custom `tabPress` listener routes the user to `/library` when they
  tap Recipes from `/discover` (so the primary tap is predictable —
  always lands on the Library default sub-tab).
- `planner` → label "Plan", icon `CalendarDays`.
- `progress` → label "You" (re-labeled), icon `CircleUser`. Same
  custom listener pattern as Recipes for the Settings + More
  siblings.

The remaining routes (`discover`, `more`, `settings`, `search`,
`barcode`, `notifications`) are kept as `<Tabs.Screen name="..."
options={{ href: null }} />` — they exist as routable screens but are
hidden from the tab bar.

Sub-tab pill bars live at the top of each grouped screen:

- `apps/mobile/components/tabs/RecipesSubTabHeader.tsx` — rendered at
  the top of `library.tsx` and `discover.tsx`.
- `apps/mobile/components/tabs/PlanSubTabHeader.tsx` — rendered at
  the top of `planner.tsx` and `shopping.tsx`. Tapping "Shopping"
  from Plan routes to `/shopping`; tapping "This week" from Shopping
  routes back to `/(tabs)/planner`.
- `apps/mobile/components/tabs/YouSubTabHeader.tsx` — rendered at the
  top of `progress.tsx`, `settings.tsx`, and `more.tsx`.

Each pill bar uses `router.replace()` (not `router.push()`) so the
sub-tab swap doesn't grow the back stack. Selection haptic on iOS;
no-op on Android per the existing `expo-haptics` posture.

### Active-tab highlight when on a sub-route

The Recipes tab in the bar highlights when the user is on
`/library` *or* `/discover`. The You tab highlights when on
`/progress`, `/settings`, or `/more`. This is implemented via the
`name="library"` and `name="progress"` Tab.Screen entries — Expo
Router highlights the entry whose name matches the active route, and
the sibling sub-routes inherit the same highlight because they are
hidden from the tab bar (`href: null`).

Tapping the Recipes tab while already on `/discover` invokes the
custom `tabPress` listener and replaces the route with `/library` so
the primary press always lands on the default sub-tab. Same for
You / `/settings` / `/more` → `/progress`.

### Centered raised Log button (2026-04-30 update)

The four-tab IA above is unchanged, but the tab bar itself is now
rendered by a custom `<SupprTabBar>` component (passed to `<Tabs>`
via the `tabBar={...}` prop). The custom bar renders the same four
primary tabs PLUS a centered raised Plus button between Recipes and
Plan — the canonical Log entry point.

Why custom: the `<LogFab>` previously sat at `right:18 / bottom:100`
on Today, overlapping right-edge meal cards + macro tile column.
Customer-lens flagged it as breaking iOS genre convention (Cal AI /
Lifesum / MyFitnessPal / Twitter X all converged on a centered raised
tab-bar button). Moving the button into the tab bar:

- preserves the four-tab IA (no fifth `Tabs.Screen`);
- makes the Log entry global to all tabs (the user can open the
  LogSheet from Recipes / Plan / You without backing out to Today
  first);
- removes the right-edge overlap on Today;
- matches the Cal AI / Lifesum genre.

Wire-up:
- `apps/mobile/components/tabs/SupprTabBar.tsx` — custom tab bar.
  Filters out hidden routes (`href: null`), renders 4 visible tabs,
  and injects `<LogTabBarButton>` between visible-index 1 (Recipes)
  and visible-index 2 (Plan).
- `apps/mobile/components/tabs/LogTabBarButton.tsx` — 56pt raised
  Plus, `top:-16` so it overflows above the tab bar fill line.
  `testID="today-log-fab"` retained from the old FAB so existing
  Maestro flows keep matching.
- The button's onPress calls `router.push({ pathname: "/(tabs)",
  params: { openLog: "1" } })`. `(tabs)/index.tsx` consumes
  `params.openLog === "1"` via a `useEffect` and opens the LogSheet
  (`setFabSheetOpen(true)`), then clears the param so a back-nav
  doesn't re-open the sheet.
- The legacy `<LogFab>` component file (`apps/mobile/components/
  today/LogFab.tsx`) is preserved for now (deferred deletion) but is
  no longer rendered in Today's composition root.

Web mobile-web is intentionally NOT in sync with this change yet —
its `LogFab` still ships at `right:18 / bottom:100` (deferred
follow-up; flagged to `sync-enforcer`).

---

## Web implementation

`src/app/components/suppr/desktop-sidebar.tsx` reshapes from a
two-group layout (Track + Recipes) to the canonical four primary
items + sub-tab strip.

`resolvePrimaryFromView(view: SidebarView)` is exported from the
sidebar module and maps any leaf SidebarView (e.g. `"library"`,
`"shopping"`, `"settings"`) to its primary group (`"today"` /
`"recipes"` / `"plan"` / `"you"`). The mobile-web bottom tab bar in
`src/app/App.tsx` uses the same helper so a user on `/home?view=
discover` still sees the **Recipes** entry highlighted.

Tapping a primary entry on the sidebar always routes to the entry's
default leaf (Recipes → library, Plan → plan, You → progress) so the
press is predictable.

---

## Deep-link redirect map

No legacy URLs were broken. All previously valid deep-links continue
to resolve to a real screen; the only behavioural change is the
visual entry point.

| Legacy URL / call | Resolves to | Notes |
|---|---|---|
| `router.push("/(tabs)/library")` | `/library` (Recipes group) | Sub-tab pill highlights Library |
| `router.push("/(tabs)/discover")` | `/discover` (Recipes group) | Sub-tab pill highlights Discover |
| `router.push("/(tabs)/progress")` | `/progress` (You group) | Sub-tab pill highlights Progress |
| `router.push("/(tabs)/more")` | `/more` (You group) | Sub-tab pill highlights More |
| `router.push("/(tabs)/settings")` | `/settings` (You group) | Sub-tab pill highlights Settings |
| `useSafeBack("/(tabs)/discover")` | unchanged | Discover screen still exists; back falls through |
| `useSafeBack("/(tabs)/more")` | unchanged | More screen still exists; back falls through |
| `useSafeBack("/(tabs)/progress")` | unchanged | |
| `router.replace("/(tabs)/discover")` (notifications-prompt) | unchanged | Still routes to Discover post-permission decision |
| `notifications-prompt.tsx` post-decision navigation | unchanged | |
| `import-shared.tsx` safeBack target | unchanged | |
| Web `?view=library` deep link | unchanged | App.tsx still accepts the leaf; sidebar resolves Recipes as the active primary |
| Web `?view=progress` deep link | unchanged | Same as above for You |

`router.push("/(tabs)/notifications")` and other hidden tab routes
also continue to resolve.

---

## Composition deltas on Today (B1.2 — canonical Today)

Phase 2 trims the Today composition root per Surface A of the
production design spec. The deltas below land in the same PR as the
tab restructure.

### Locked variant — kill the 3-variant picker

**Phase 2 (2026-04-27):** `TodayHero` accepted a new `hidePicker` prop;
the Today composition root passed `hidePicker` (true), pinning the
variant to `"ring"`. The `TodayHeroVariantPicker` modal and the corner
grid affordance were suppressed. The bar / number variant components
remained in the tree for legacy compatibility.

**Phase 3 (2026-04-28, this PR):** The variant infrastructure was
removed entirely. `TodayHero` is now a thin wrapper around
`TodayHeroRing` with no variant prop, no `hidePicker`, and no
`onVariantChange`. `TodayHeroBar.tsx`, `TodayHeroNumber.tsx`, and
`TodayHeroVariantPicker.tsx` were tombstoned (empty `export {};` files
pending `rm` — the Cowork session that landed the change couldn't
delete files in unsupervised mode). The dedicated picker test
(`apps/mobile/tests/unit/todayHeroVariantPicker.test.tsx`) was
likewise tombstoned. The `canonicalTodayPhase2` test now pins the
absence of all three props as the contract going forward. Reference:
`docs/ux/teardown-2026-04-28-daily-loop.md` Top-5 #1.

D-2026-04-27-03 quote: *"Three variants is design indecision dressed
as pluralism. With N=1 tester, 'user picks' is a hedge, not a
feature."*

### Streak ribbon → StreakPip

A new `<StreakPip>` primitive lives at:

- `apps/mobile/components/today/StreakPip.tsx`
- `src/app/components/suppr/streak-pip.tsx`

22pt height pill with lucide `Flame` glyph + tabular-num day count.
Renders even at zero days (label "Start your streak") so first-time
users understand what the surface tracks. Active styling kicks in at
≥ 2 days. Replaces the demoted streak ribbon (the legacy
`TodayStreakInsightCard` was already removed 2026-04-20; the pip
fills its slot with a calmer treatment).

Per V-4 in the production design spec, lucide `Flame` is the
canonical glyph; visual-qa to confirm rendering at 12pt on dark.

### TodayQuickLogStrip — removed from composition root

`TodayQuickLogStrip` is no longer rendered on Today (mobile or web).
The strip component file is kept in the tree for reference and the
existing unit test still passes against the component contract. The
canonical `<LogFab>` becomes the sole logging-entry affordance on
Today; Phase 3 wires it to the unified `<LogSheet>` (B2.1).

### Persistent Log FAB

A new `<LogFab>` primitive lives at:

- `apps/mobile/components/today/LogFab.tsx`
- `src/app/components/suppr/log-fab.tsx`

Position: `right: 18, bottom: 100`, 56pt circle, primary fill, lucide
`Plus` glyph, `Elevation.floatPrimary` shadow per the spec. Tap
behaviour:

- Mobile (this PR): wired to open the existing TodayFabSheet (search
  / barcode / voice / photo / quick-add / previous). The legacy FAB
  rendered by TodayFabSheet itself is hidden (`fabVisible={false}`)
  so there is exactly one visible FAB on Today. **This is a strict
  improvement over the spec's "no-op tap → 'Coming in Phase 3' alert"
  fallback** — keeping the FAB functional avoids stranding users
  without a logging path while we wait for Phase 3's unified
  `<LogSheet>`. Documented here so sync-enforcer doesn't flag the
  positive deviation.
- Web (this PR): no `onPress` is passed, so the placeholder
  `window.alert("Coming in Phase 3 …")` surfaces. The web mobile-web
  surface has multiple existing logging entries (search bar, barcode
  modal, etc.) so the FAB being a temporary no-op doesn't strand the
  user.

Hidden on desktop web (`md:hidden`) per D-2026-04-27-11 — daily
macro tracking is a phone activity.

### North-star block

**Deferred to Phase 3 (B2.2).** Phase 2 does *not* render a
placeholder slot for the north-star block on Today. The spec's
guidance to "render the gradient SupprCard shell at the right
vertical position" is rolled into the Phase 3 wire-up so the
suggestion engine is threaded through scoring before the visual
slot lands. This is the only Phase 2 acceptance criterion explicitly
descoped to Phase 3; sync-enforcer + visual-qa to flag if Phase 3
positions the block anywhere other than directly under the calorie
ring card.

---

## Caffeine + alcohol opt-in (B1.4)

Per D-2026-04-27-08, caffeine + alcohol are off Today by default and
behind a Settings opt-in. The implementation:

- New shared lib `src/lib/nutrition/trackingExtras.ts` defines the
  `TrackingExtras` shape (`{ trackCaffeine, trackAlcohol }`),
  defaults (both off), parse / serialise helpers, and the storage key
  `suppr.tracking-extras.v1`.
- AsyncStorage on mobile, localStorage on web. **No DB schema
  change** — the toggles are presentation prefs. Existing
  `extra_caffeine_by_day` / `extra_alcohol_g_by_day` data is
  preserved untouched.
- Settings ("Tracking extras" section) is the writer; the
  NutritionTracker host is the reader. Web adds a `storage`-event
  listener so cross-tab edits propagate.
- The hydration card's caffeine + alcohol rows hide via the existing
  `targets.caffeineMg === 0` / `targets.alcoholGWeekly === 0` rule
  — the host forces those targets to 0 when the corresponding
  toggle is off. The card also hides entirely when the user has no
  water target and both extras are off (no caffeine/alcohol logs
  contribute to the gate when their toggle is off).
- Hydration stays on by default per the strategic direction —
  hydration is a near-universal target.

---

## Cross-platform deviations (intentional)

| Surface | Mobile | Web | Reason |
|---|---|---|---|
| LogFab tap | Opens TodayFabSheet | Surfaces "Coming in Phase 3" alert | Mobile has the sheet primitive in-tree; web's logging entries are different surfaces. Phase 3 unifies behind `<LogSheet>` |
| LogFab visibility | Always on day-view | Mobile-web only (`md:hidden`) | Daily logging is a phone activity (D-2026-04-27-11) |
| Plan ↔ Shopping | Cross-route navigation (`router.push("/shopping")`) | State toggle within `<MealPlanner>` (existing pattern preserved) | Pre-existing parity gap; mobile shopping has its own back stack |
| Sub-tab haptic | Selection haptic on iOS | None | Web has no haptic API |

These mirror the deviations already documented in the production
design spec §Cross-platform deviations and the standing
parity-carveout memos
(`project_pricing_default_billing_period_divergence`,
`project_move_meal_web_gap`, etc.).

---

## What this PR does NOT change

Explicitly out of scope for B1.1 / B1.2 / B1.4:

- The north-star block (Phase 3 / B2.2).
- The unified Log sheet (Phase 3 / B2.1).
- Onboarding produces first plan (Phase 3 / B2.3).
- Trust posture sweep on every macro row (Phase 3 / B2.4).
- Progress story headline + adaptive TDEE always-on (Phase 4 /
  B3.1).
- Pricing collapse Free + Pro (B1.3) — landing in a separate PR.
- **Household demote (B2 of the deferred batch)** — left as a
  follow-up. Per D-2026-04-27-02 sub-decision: "Phase 2.5". Existing
  household surface stays exactly as is. The next batch demotes
  household behind a Settings flag.

---

## Test pins

- `tests/unit/desktopSidebar.test.tsx` — pins the four-primary
  structure, the `resolvePrimaryFromView` mapping, sub-tab render
  rules, and badge logic.
- `apps/mobile/tests/unit/tabStructurePhase2.test.tsx` (new) — pins
  the four-tab order in the mobile `_layout.tsx` and the sub-tab
  pill components' value/onChange contracts.
- `apps/mobile/tests/unit/canonicalTodayPhase2.test.tsx` (new) —
  pins the `<StreakPip>` rendering rules and the `<LogFab>`
  placement / no-op behaviour.
- `tests/unit/streakPip.test.tsx` (new) — web parity to the mobile
  StreakPip behaviour.
- `tests/unit/trackingExtras.test.ts` (new) — pins the parse /
  serialise behaviour and the `shouldRenderHydrationCard` gate
  rules.
- `apps/mobile/tests/unit/trackingExtrasOptIn.test.tsx` (new) —
  integration test for the Settings → Today opt-in flow.

---

## Notion mirror actions (pending)

- Roadmap row "B1.1 — Tab collapse 6 → 4" → Status: Shipped.
- Roadmap row "B1.2 — Today canonical, kill 3 variants" → Status:
  Shipped (north-star block excluded, marked as Phase 3).
- Roadmap row "B1.4 — Caffeine + alcohol behind Settings" → Status:
  Shipped.
- New Roadmap row "B2.5 — Household demote behind Settings" →
  Status: Open (next phase).
- New Tasks: "B2.1 LogSheet wiring" + "B2.2 North-star block" +
  "B2.3 Onboarding produces first plan" + "B2.4 Trust posture
  sweep" — all linked to the Phase 3 batch in the strategic
  direction doc.

If the Notion MCP isn't connected at the time of this commit, Grace
should re-run the above when next online.
