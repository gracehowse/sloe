# Spec: B4 Phase 3b — condensed Today hero (ring + macros side-by-side) — design

**Date:** 2026-04-27
**Owner:** Design → Engineering hand-off
**Status:** Specced (design unblocks Phase 3b)
**Parent PRD:** `docs/specs/2026-04-27-b4-today-screen-phase3.md`

---

## Executive summary

- **Side-by-side composition is single-card, not two cards.** The hero card grows to host the ring (left, fixed 132pt diameter) AND a 2-row × 2-col macro grid (right, flexes). Stops the visual fragmentation of "ring card sitting next to macro card" which the prototype never tried.
- **Ring shrinks, doesn't change.** `CalorieRing` `SIZE` constant goes from 140 → 132 on the side-by-side layout (still ≤200pt total card height after padding). No changes to ring math, stroke widths, or expand-on-tap behaviour. Long-press toggle and centre kcal-remaining label stay exactly as they are.
- **Macro tiles in side-by-side mode are 2×2, not 4×1 stacked.** A 4-row vertical stack would force tile width <120pt and break the existing "big number + label + bar + caption" tile layout. 2×2 keeps each tile at ~100pt × ~80pt — readable, and the eye reads it as a single "macros block" anchored to the ring.
- **The 320pt SE-class fork keeps the legacy stacked layout untouched.** No new code paths for SE other than the `useWindowDimensions()` width gate at the composition root. Engineering ships one new layout, not two.
- **Web `lg:` right-rail is unchanged.** Phase 3b is mobile + mobile-web (single-column) only. Web desktop already has the calmer composition this phase is trying to reach. Engineering's parity work is: mobile-web (`<lg:` viewports on `NutritionTracker.tsx`) gets the same side-by-side variant when width ≥ 375px; below that, the existing single-column stack persists.

---

## 1. Design intent

The condensed hero exists because the first viewport on a 6.1" iPhone is over-spent on a 280pt-tall hero card that says one thing (calories) twice (ring + tiles below). Phase 3b reclaims ~80pt of vertical space by composing ring + macros into a single horizontal block. Tone: calm, denser, premium-but-not-cramped. The ring stays the visual anchor; the macros stop being a second ceremony and become a quiet readout on its right shoulder.

---

## 2. ASCII wireframes

### Viewport A — 320pt (SE-class) — STACKED LEGACY, no change

```
┌──────────────────────────── 320pt ───────────────────────────┐
│  Date header                                                 │
│  Eat-again banner (when present)                             │
│  ┌────────────────── hero card (legacy) ──────────────────┐  │
│  │                                                        │  │
│  │                  ╭─────────╮                           │  │
│  │                 ╱           ╲                          │  │
│  │                │   1,247    │   ← ring 140pt           │  │
│  │                │  REMAINING │     (unchanged)          │  │
│  │                 ╲           ╱                          │  │
│  │                  ╰─────────╯                           │  │
│  │                of 1,800 kcal                           │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌──────────────── macro tiles (legacy) ─────────────────┐   │
│  │  PROTEIN 🥩       │  CARBS 🌾                         │   │
│  │  92 / 140g        │  180 / 220g                       │   │
│  │  ████░░ 46g rem   │  ████░░ 40g rem                   │   │
│  ├────────────────────┼────────────────────              │   │
│  │  FAT 💧            │  FIBRE 🌿                         │   │
│  │  ...              │  ...                              │   │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  Total card stack height: ~280pt + 8pt gap + ~200pt = 488pt │
└──────────────────────────────────────────────────────────────┘
```

### Viewport B — 375pt (6.1" iPhone) — SIDE-BY-SIDE NEW

```
┌─────────────────────────────── 375pt ────────────────────────────────┐
│  Date header                                                          │
│  Eat-again banner (when present)                                      │
│  ┌──────────── condensed hero card (height ≤ 200pt) ──────────────┐   │
│  │ ┌─ 132pt ─┐  Spacing.lg gap   ┌──── macro grid (flex) ─────┐    │   │
│  │ │ ╭─────╮ │                   │ ┌─ tile ─┐  ┌─ tile ─┐    │    │   │
│  │ │╱      ╲│                    │ │PROTEIN │  │ CARBS  │    │    │   │
│  │ ││ 1247 ││                    │ │92/140g │  │180/220g│    │    │   │
│  │ ││REMAIN││                    │ │████░   │  │████░   │    │    │   │
│  │ │╲      ╱│                    │ │46g rem │  │40g rem │    │    │   │
│  │ │ ╰─────╯ │                   │ └────────┘  └────────┘    │    │   │
│  │ │ of 1800 │                   │ ┌─ tile ─┐  ┌─ tile ─┐    │    │   │
│  │ │  kcal   │                   │ │  FAT   │  │ FIBRE  │    │    │   │
│  │ └─────────┘                   │ │…       │  │…       │    │    │   │
│  │                               │ └────────┘  └────────┘    │    │   │
│  │                               └────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Card height target: 196pt (132 ring + 32 padding + 32 buffer)        │
│  Replaces: legacy 488pt → ~196pt = 292pt reclaimed                    │
└───────────────────────────────────────────────────────────────────────┘
```

Annotated dimensions for viewport B:
- Card outer width: 375 − (2 × Spacing.xl=20) = 335pt
- Card padding: `Spacing.md` (12) vertical, `Spacing.lg` (16) horizontal → inner width 303pt
- Ring column width: 132pt (= ring SIZE)
- Gap between ring and macro grid: `Spacing.lg` (16pt)
- Macro grid width: 303 − 132 − 16 = 155pt
- Tile width inside grid: (155 − Spacing.sm gap of 8) ÷ 2 = 73.5pt → set `flexBasis: "48.5%"` like the legacy 2-col grid (already does this)
- Tile padding: `Spacing.md` (12) — DOWN from legacy `Spacing.lg − 2` (14). The smaller tiles need less air, and font sizes step down (see §3 below).
- Vertical alignment: ring centre is vertically centred against the **midline** of the 2-row macro grid (`alignItems: "center"` on the row container).

### Viewport C — ≥768pt (web `lg:` right-rail) — UNCHANGED

```
┌──────────────────────────────── 1024pt+ web ──────────────────────────────────┐
│  Date / nav                                                                    │
│  ┌─ main column (lg:col-span-2) ──────────────┐ ┌─ right rail (lg:col-1) ──┐  │
│  │  Eat-again banner                          │ │  TodayHeroRing            │  │
│  │  Condensed hero card (single col, mobile-  │ │  (existing, 160pt ring)   │  │
│  │  web only when width ≥ 375 → SAME side-by- │ │                            │  │
│  │  side variant as iPhone)                   │ │  TodayDashboardMacroTiles  │  │
│  │  Streak / fasting / steps row              │ │  (existing 2-col grid     │  │
│  │  Week strip                                │ │   stacked under the ring) │  │
│  │  Meals section                             │ │                            │  │
│  └────────────────────────────────────────────┘ └────────────────────────────┘  │
│                                                                                │
│  Phase 3b changes nothing in the right rail. lg: layout is already calm.       │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Layout grid spec (named tokens)

| Element | Value | Token |
|---|---|---|
| Hero card outer radius | 16pt | `Radius.lg` |
| Hero card border | 1px | n/a (literal) |
| Hero card padding (vertical) | 12pt | `Spacing.md` |
| Hero card padding (horizontal) | 16pt | `Spacing.lg` |
| Ring SIZE (side-by-side variant) | 132pt | new const `RING_SIZE_COMPACT` in `CalorieRing.tsx` |
| Ring STROKE (unchanged) | 8pt | existing `STROKE` |
| Ring column total width | 132pt | = ring SIZE; no extra wrapper |
| Gap: ring column → macro grid | 16pt | `Spacing.lg` |
| Macro grid: row gap | 8pt | `Spacing.sm` |
| Macro grid: column gap | 8pt | `Spacing.sm` |
| Macro tile inner padding | 12pt | `Spacing.md` (down from `Spacing.lg - 2`) |
| Macro tile radius | 16pt | `Radius.lg` (unchanged) |
| Macro tile label font size | 10pt | down from 11pt |
| Macro tile big-value font size | 18pt | down from 22pt |
| Macro tile target-text font size | 11pt | down from 12pt |
| Macro tile bar height | 4pt | down from 5pt |
| Macro tile caption font size | 10pt | down from 11pt |
| Vertical align: ring vs macro grid | `center` | `alignItems: "center"` on flex row |
| Total target card height | ≤196pt | meets ≤200pt acceptance |

Width gate at composition root (`apps/mobile/app/(tabs)/index.tsx`):

```ts
const { width: vw } = useWindowDimensions();
const isCompactDevice = vw < 375;
// isCompactDevice → render legacy stacked HeroRing + MacroTiles
// !isCompactDevice → render new <TodayHeroCondensed /> wrapper
```

---

## 4. Macro tile micro-layout — 2×2 chosen over 4×1, justified

**Decision: 2 rows × 2 columns.**

Why not 4 rows × 1 column (single tall stack next to ring):
- Tile width would be 155pt − padding 24pt = 131pt usable. The big-value typography (currently 22pt with 1 decimal) plus "/ 220g" target text + caption frequently overflows 131pt without aggressive truncation. We'd lose the target denominator on long values like `180 / 220g`.
- Visual weight: 4 stacked tiles next to a circular ring reads as "list next to graphic", not as "compound dashboard". The 2×2 reads as a unified block balancing the ring.
- Ring vertical centre at 132/2 = 66pt aligns naturally to the midline between row 1 and row 2 of a 2×2 grid (each row ~78pt tall). A 4-row stack pushes the ring to be vertically anchored to row 2 of 4 — visually awkward.

Order in the 2×2 (reading order top-left, top-right, bottom-left, bottom-right):
1. Protein
2. Carbs
3. Fat
4. Fibre (or whichever is 4th in `trackedMacros`)

This matches the existing `trackedMacros` array order from settings — no IA change.

If `trackedMacros.length > 4` (user has sugar/sodium/water enabled): the 5th–7th tiles flow into a second 2-col grid **below the hero card**, not inside it. The hero card commits to exactly four tiles. Engineering hint: split `trackedMacros` into `headlineMacros = trackedMacros.slice(0, 4)` and `extraMacros = trackedMacros.slice(4)`; render extras via existing `TodayDashboardMacroTiles` below.

If `trackedMacros.length < 4`: empty slots render as transparent placeholders (`flexBasis: "48.5%", opacity: 0`) so the 2×2 grid keeps its shape and the ring stays vertically centred. **Do not collapse the grid** — that would make the ring float off-axis.

---

## 5. State coverage

### Loading
- Ring: existing track-only state (no progress arc). Centre text shows "—" instead of the kcal number. Centre label "Loading".
- Macro tiles: each tile renders skeleton — label + Icon visible, big-value replaced with a 60pt × 18pt skeleton bar (use `colors.border` at 60% opacity), bar at 0%, caption skeleton 80pt × 10pt.
- No spinner. Skeletons only. Animation: subtle 1200ms opacity pulse 0.5 → 1.0 → 0.5 (use existing skeleton convention if one exists; otherwise plain).

### Empty (no meals logged today, all targets > 0)
- Ring: full track, no progress, centre text "1,800" / label "REMAINING" / line "of 1,800 kcal".
- Macro tiles: render with `0 / 140g`, `140 g remaining` caption. Bar at 0% — but **render the bar track**, not skipping it. Empty-state should look like a calm starting line, not a broken layout.
- No "log your first meal" CTA inside the hero. The FAB and meals section already carry that affordance.

### Over-budget (consumed > target)
- Ring: progress arc renders in **amber** (`Accent.warning` `#e8a020`), NOT destructive red. Per project memory rule "over-budget = amber".
  - Engineering note: `CalorieRing.tsx` line 179 currently uses `Accent.destructive`. Phase 3b changes this to `Accent.warning`.
  - This is a global rule — applies to legacy stacked layout too.
- Centre text colour follows ring tone: amber when in `remaining` mode and over (currently red).
- Centre label: "OVER" (existing copy via `RING_LABELS.over`).
- Affected macro tile (e.g. carbs over): bar fills to 100%, caption reads `40 g over` (existing logic), and the bar fill colour stays the macro's own (not amber) — over-budget amber lives on the ring, not on the per-macro bars (current behaviour, retained).

### Under-budget (default healthy state)
- Ring: progress in `Accent.success` green (existing).
- Macro tiles: bars fill to current %, caption "X g remaining".

### Partial
- Some macros tracked but some have `target = 0` (user disabled goal): tile shows value only, `pct = 0`, caption "tracking only" (new microcopy — currently the layout would render "0 g remaining" which is wrong).
- New microcopy string: `tracking only` — add to `src/lib/copy/today.ts`.

### Stale (data more than 60s old, e.g. mid-sync)
- No new visual treatment in Phase 3b. The existing offline banner above the hero already covers sync state. Hero data renders last-known.

### Offline
- Existing offline banner above the hero remains as-is. Hero numbers render from last-cached `byDay`. No badge on the ring or tiles.

---

## 6. Animation / transitions

**On viewport rotation or breakpoint cross (320 ↔ 375):**
- Layout switch is **not** animated. The `useWindowDimensions()` value changes instantaneously on rotation; React re-renders the alternative layout. A cross-fade or interpolation here would (a) introduce layout-thrash bugs, (b) be invisible to the user (they rotated the phone — they expect a different layout). Engineering: simple conditional render.

**On ring expand-tap (existing behaviour, retained):**
- Ring tap toggles macro rings (concentric inner rings) — existing `expanded` state, 800ms `Easing.out(cubic)` per `MacroRing` (existing). No change.

**On long-press (existing behaviour, retained):**
- Cycles `displayMode` between "remaining" and "consumed". Centre text changes instantly (no animation). Existing.

**On a meal being logged (numbers tick up):**
- Out of scope for Phase 3b. Existing `withTiming` on the ring's progress arc remains. Macro tile bars use `transition-[width] duration-700` on web (existing); mobile renders `<View style={{ width: pct% }} />` with no animation today — this is a known parity gap, **not** to be fixed in Phase 3b.

**Tiles do not re-flow stacked → side-by-side mid-session.** Either the device is < 375pt or it isn't; this won't change while the user is on the screen. The only realistic mid-session path is rotation (e.g. iPhone SE landscape → 568pt width). In that case we re-render side-by-side but **do not animate the transition** — a calm instant switch reads as "the layout adapted", an animated one reads as "the app is doing something".

---

## 7. Ring centre content

**Decision: keep the ring centre exactly as it is today.** Three lines:

```
   1,247           (kcal value, 28pt bold tabular-nums when collapsed; 22pt when expanded)
  REMAINING        (label, 10pt bold tracked, secondaryColor)
  of 1,800 kcal    (budget line, 10pt secondaryColor — hidden when expanded)
```

Why no change:
- The tester critique that triggered this phase was "ring is too tall", not "ring is too cluttered". The `expanded`-vs-collapsed gesture still works at 132pt (verified — there's no overlap; the inner macro rings shrink proportionally because they're radius-derived).
- Removing the budget line would force users to look at the macro tiles for the kcal target — but the macro tiles intentionally do NOT show kcal (they show protein/carbs/fat/fibre). We'd orphan the goal value.
- The `RING_LABELS.remaining`/`logged`/`over` copy is well-tested. No change.

One ratification: when `expanded === true` AND the ring is in compact (132pt) mode, visually verify the inner macro rings (radii `R-12`, `R-22`, `R-32`) don't collide with centre text. At SIZE=132 → R = (132-8)/2 - 2 = 60. Macro radii: 48, 38, 28. The innermost ring (radius 28pt) leaves an inner clear zone of 28×2 = 56pt — wide enough for the 22pt "expanded" centre value but **tight**. Engineering check: render the expanded state with mocked data and confirm the value+label fit within 56pt diameter without clipping. If clipping occurs, the fix is `MACRO_R = [R - 14, R - 25, R - 36]` (push macro rings outward 2pt each), not changing the centre typography.

---

## 8. Component delta — file-by-file

### `apps/mobile/components/charts/CalorieRing.tsx`
- Add prop: `size?: number` (defaults to existing 140). When passed 132, recompute `CX`, `R`, `MACRO_R` from the prop, not the module-level constant.
- No other behaviour changes.
- Change line 179: `stroke={isOver ? Accent.warning : Accent.success}` (was `Accent.destructive`). This is the project-wide "over-budget = amber" rule.
- Change line 225/235 destructive-amber: same swap.

### `apps/mobile/components/today/TodayHeroRing.tsx`
- Add prop: `compact?: boolean` (defaults to false). When true: pass `size={132}` to `CalorieRing` and render no card padding gap (the parent compact wrapper handles padding).
- Add prop: `hideCard?: boolean` (defaults to false). When true: render the `CalorieRing` without the bordered `View` wrapper — the parent `TodayHeroCondensed` owns the card chrome.
- Backward compat: existing call sites passing none of the new props get the existing legacy stacked layout. Untouched.

### `apps/mobile/components/today/TodayHeroCondensed.tsx` (NEW)
- New file. Composition: a flex row with `<TodayHeroRing compact hideCard />` on the left and a 2×2 grid of `<TodayDashboardMacroTiles compact />` (or a new prop pass-through) on the right, wrapped in the bordered card. Owns the card chrome. ~80 lines.
- Props: same shape as `TodayHeroRing` + `TodayDashboardMacroTiles` props, merged. (Engineering may prefer to pass children rather than re-plumb props — either is fine; the wireframe doesn't care.)

### `apps/mobile/components/today/TodayDashboardMacroTiles.tsx`
- Add prop: `compact?: boolean` (defaults to false). When true: typography scales (10/18/11/4/10) per §3, padding `Spacing.md`, **caps render to 4 tiles only**, returns `null` for 5th+.
- Add prop: `slice?: "headline" | "extras" | "all"` (defaults to "all"). When `"headline"`, render `trackedMacros.slice(0, 4)`. When `"extras"`, render `trackedMacros.slice(4)`. When `"all"`, current behaviour.
- Internal: when `compact && trackedMacros.length < 4`, pad with transparent placeholder tiles to hold 2×2 shape.

### `apps/mobile/app/(tabs)/index.tsx` (composition root)
- Add `useWindowDimensions()` import.
- Compute `isCompactDevice = width < 375`.
- Replace the current `<TodayHeroRing /> ... <TodayDashboardMacroTiles trackedMacros={trackedMacros} ... />` block with:
  - If `isCompactDevice`: existing legacy block, unchanged.
  - Else: `<TodayHeroCondensed ... />` followed by `<TodayDashboardMacroTiles slice="extras" trackedMacros={trackedMacros} ... />` (extras render below the hero in their own card row).

### `src/app/components/suppr/today-hero-ring.tsx` (web)
- Add prop: `size?: number` (defaults to 160). When passed 132, ring renders at compact size.
- Add prop: `compact?: boolean`. When true: omit the surrounding `<div className="flex flex-col items-center mb-4">` and the helper text; parent owns layout.
- Same amber swap as mobile if the web `daily-ring.tsx` uses destructive — confirm.

### `src/app/components/suppr/today-hero-condensed.tsx` (NEW)
- Web mirror of `TodayHeroCondensed.tsx`. Tailwind classes:
  - `flex items-center gap-4 rounded-2xl bg-card border border-border p-3` (outer card)
  - Left col: `<TodayHeroRing compact size={132} ... />`
  - Right col: `flex-1 grid grid-cols-2 gap-2`, hosts `<TodayDashboardMacroTiles compact slice="headline" ... />`

### `src/app/components/suppr/today-dashboard-macro-tiles.tsx` (web)
- Same `compact` + `slice` props as mobile. Compact: `text-[10px]` label, `text-[18px]` value, `text-[11px]` target, `h-[4px]` bar, `p-3` padding (was `p-3.5`).

### `src/app/components/NutritionTracker.tsx` (web composition root)
- For mobile-web (`<lg:` viewport), apply the same width gate. Use `useEffect` + `window.innerWidth` (or a `useMediaQuery` hook if one exists) to gate compact vs legacy. `lg:` desktop right-rail layout is unchanged — keep existing render branch.

---

## TestIDs to preserve (engineering checklist)

The spec mandates "every existing TestFlight TestID on Today still resolves". Engineering must keep these resolvable through the refactor. Where they currently live on the legacy hero ring or macro tiles, the corresponding `TodayHeroCondensed` wrapper must forward them through.

Engineering: before starting, run `grep -nE "(testID|data-testid)=" apps/mobile/app/\(tabs\)/index.tsx apps/mobile/components/today/Today*.tsx src/app/components/suppr/today-*.tsx src/app/components/NutritionTracker.tsx` and snapshot the list. Each one in the affected hero/macro region must be re-attached to the equivalent element in the new composition. Suggested rule:

- `today-hero-ring` testID → on the `CalorieRing` Pressable in compact mode (unchanged location semantically, just inside a different wrapper).
- `today-macro-tile-{macro}` testID → on each compact tile Pressable. Same scheme as legacy.
- Any test asserting card height or specific layout structure must be updated; tests asserting *presence and content* should pass without change.

If no testIDs are present today on these components, this section becomes a no-op — but the grep is still required as a sanity check before merging Phase 3b.

---

## Cross-platform deviations (intentional)

| Surface | Mobile | Web | Why |
|---|---|---|---|
| Width gate | `useWindowDimensions()` | `window.innerWidth` matchMedia or `useMediaQuery` | Platform-native. |
| Compact ring size | 132pt | 132px | Identical numerical value. |
| Card chrome | RN `View` border + `Radius.lg` | `rounded-2xl border` | Same visual; tokens map. |
| `lg:` right-rail | n/a | unchanged | Mobile has no `lg:` analogue. |
| Animation on rotation | none | none | Same. |
| Macro bar fill animation | none | `duration-700` (existing) | Pre-existing parity gap; **not Phase 3b scope**. Flag for a follow-up F-ticket. |

---

## Acceptance criteria (numbered, testable)

1. On a 6.1" iPhone (375pt width), Today's hero card height is ≤ 200pt (measure: snapshot test or detox layout assertion).
2. On a 320pt simulated viewport (iPhone SE 1st gen), Today renders the legacy stacked layout — ring above tiles, no horizontal composition.
3. The `CalorieRing` over-budget colour is `Accent.warning` (`#e8a020`), not `Accent.destructive`. Verified by visual snapshot at `consumed=2000, goal=1800`.
4. In side-by-side mode, the ring's vertical centre is within 4pt of the macro grid's vertical midline (`alignItems: "center"` resolves this; just confirm).
5. Macro tile big-value text in compact mode renders at 18pt font-size, not 22pt.
6. When `trackedMacros.length === 5`, the hero card renders 4 tiles in 2×2; the 5th renders below the hero card in its own row. No 5th tile inside the hero.
7. When `trackedMacros.length === 3`, the hero card renders 3 visible tiles + 1 transparent placeholder (2×2 shape preserved). The 4th slot is `opacity: 0` not removed from the layout.
8. Every testID present on the Today screen pre-Phase-3b resolves to an element post-Phase-3b. No orphaned tests.
9. Web `lg:` right-rail layout (`NutritionTracker.tsx` → right column) is byte-identical to pre-Phase-3b. Diff must show zero changes in the `lg:` branch.
10. `npm run ci` green on first push.
11. Visual snapshot test for the new condensed hero card exists under `apps/mobile/__tests__/visual/` (or equivalent) covering: empty / under-budget / over-budget / loading.
12. Mobile-web (web app at < 1024px width but ≥ 375px) renders the same side-by-side variant as native mobile.

---

## 9. Open questions (≤3)

1. **Does mobile already animate macro tile bar width on log?** Web does (`duration-700`); mobile RN currently uses static `View` with `width: pct%` (no animation). Phase 3b doesn't fix this — but the spec inherits whatever is there. Engineering should confirm the inconsistency exists before Phase 3b ships and flag a follow-up ticket if so. (This is *not* a blocker for Phase 3b — call it out so it's tracked.)

2. **Do we need a `compact` variant for `TodayHero.tsx` (the variant-picker wrapper that switches between ring/bar/number)?** This spec assumes Today renders `TodayHeroCondensed` directly when on ≥375pt phones, bypassing `TodayHero`. If users on bar/number variants should also get the side-by-side macro composition, scope expands by ~2 days. **Recommendation: ring-variant only for Phase 3b.** Bar and number variants stay legacy stacked. If retention data shows the variant-picker is used by < 5% of testers, retire bar/number entirely in a separate ticket — but don't conflate that with Phase 3b. Engineering to confirm acceptable.

3. **Does the `expanded` (concentric macro rings) state still make sense in compact mode?** At ring SIZE=132 with macro radii 48/38/28, the inner clear zone is 56pt — tight for the 22pt expanded centre value. If visual QA shows clipping, fix per §7 (`MACRO_R = [R-14, R-25, R-36]`). Alternative: disable `expanded` state in compact mode (concentric rings only render at SIZE ≥ 140). **Recommendation: keep expanded available; adjust radii if it clips.** Worth one round of visual QA before locking.

---

## Cross-references — prototype frames consulted

- `docs/ux/claude-design-bundles/prototype/` — Today screen prototype frames. **The prototype does NOT directly cover this side-by-side condensed hero layout.** The prototype's Today screen stacks ring above macro tiles (the same shape as today's legacy mobile). I adapted the prototype's typography, iconography, and tile chrome (verbatim — uppercase label, lucide icon, big tabular-nums value, thin progress bar, caption) into a new compositional arrangement that the prototype itself does not show. This is consistent with the project memory rule "prototype is a reference, not a mandate — mix and match".
- The prototype's right-rail desktop layout (web `lg:` variant, already shipped) is the closest precedent for what side-by-side ring+macros should feel like on a phone — a calmer, less ceremonious presentation of the same data. Phase 3b is essentially backporting the desktop's spatial logic to portrait phones ≥ 375pt.
- Mobile prototype reference path for tile internals (typography, iconography): `docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx → MacroTile`. Verified as the source the existing `TodayDashboardMacroTiles` already implements.

---

## Files referenced

- `docs/specs/2026-04-27-b4-today-screen-phase3.md` (parent PRD)
- `apps/mobile/app/(tabs)/index.tsx` (mobile composition root)
- `apps/mobile/components/today/TodayHeroRing.tsx` (mobile hero wrapper)
- `apps/mobile/components/today/TodayDashboardMacroTiles.tsx` (mobile tiles)
- `apps/mobile/components/charts/CalorieRing.tsx` (ring renderer — needs `size` prop + amber swap)
- `apps/mobile/constants/theme.ts` (Spacing, Radius, MacroColors, Accent tokens)
- `src/app/components/suppr/today-hero-ring.tsx` (web hero wrapper)
- `src/app/components/suppr/today-dashboard-macro-tiles.tsx` (web tiles)
- `src/app/components/NutritionTracker.tsx` (web composition root)
