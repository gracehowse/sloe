# Spec: B5 Phase 2b — Discover FilterSheet (drawer + bottom sheet) — design

**Date:** 2026-04-27
**Owner:** Design → Engineering hand-off
**Status:** Implementation-ready
**Parent PRD:** `docs/specs/2026-04-27-b5-discover-phase2.md`
**Backend dep (shipped):** `src/lib/discover/filterRecipes.ts` — `DiscoverFilters`, `applyDiscoverFilters`, `passesDiscoverFilters`, `EMPTY_FILTERS`, `countAppliedFilters`, plus `CUISINE_OPTIONS`, `COOK_TIME_BUCKETS`, `DIETARY_PRESETS` constants. UI consumes these directly — no parallel option list.

---

## 1. Design intent

Discover today is a feed with 5 quick-pills sized for "I want a fast slice." The new filter density (8 cuisines × 5 cook-times × 8 dietary) is too heavy for the pill row — stuffing 21 pills there would shred the calm of the surface and force horizontal scroll. The FilterSheet is therefore a **summoned, stratified surface** that stays out of the user's way until they reach for it, and once dismissed leaves visible breadcrumbs (chip strip) above the feed so they know the feed is constrained.

It must feel like the same product as the rest of Suppr — quiet, premium, fast. Not an "advanced filters" panel. The chips are big enough to hit on a phone, the close affordances are obvious, the URL on web is shareable, and the empty state when filters return zero recipes is honest and recoverable in one tap.

---

## 2. Structure (ASCII wireframes)

### (a) Closed Discover — pill row + Filters trigger

The 5 quick-pills stay untouched. The trigger sits on the **same horizontal scroll row**, at the **left** of the row (sticky-left on overflow), with a vertical hairline divider after it so it reads as a different class of control. Right-aligned was considered and rejected: on mobile the pill row already overflows horizontally, and a right-aligned trigger would be hidden by default. Left-pinned is always visible.

When ≥1 filter is active, the trigger reads `Filters · 3` and inherits the selected-pill treatment so the user can see at-a-glance that filters are constraining the feed.

```
┌─────────────────────────────────────────────────────────────┐
│ BROWSE                                                       │
│ Discover                                          (search ⌕) │  header
├─────────────────────────────────────────────────────────────┤
│ ⌕  Search 48,000+ recipes & foods                       [×] │  search
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ │ ┌──────┐┌────────┐┌─────┐┌─────────┐┌──...    │  pill row
│ │⌕̈ Filters│ │ │For   ││Following││Pop. ││Quick    ││Hi...   │  (hscroll)
│ └──────────┘ │ │ You  │└────────┘└─────┘└─────────┘└──       │
│   ↑          ↑                                                │
│   trigger    1px border-r/divider                             │
├─────────────────────────────────────────────────────────────┤
│  Matches your day                                            │
│  ┌────────────────────────┐  ┌────────────────────────┐      │
│  │       (recipe)         │  │       (recipe)         │      │
│  └────────────────────────┘  └────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

Tokens (mobile):
- Trigger height = pill height (28pt). Internal padding `paddingHorizontal: 12, paddingVertical: 6`.
- Gap between trigger and divider = 6pt; divider 1px × 16pt high, colour `colors.cardBorder`; gap between divider and first pill = 6pt.
- Trigger label uses lucide `SlidersHorizontal` (16pt) before the text. Active-count badge appended as `· N`, never as a pill-on-pill nested chip.

Tokens (web):
- Identical layout. Trigger uses `Icons.filter` (or `lucide-react`'s `SlidersHorizontal` — add to `Icons` registry if missing). On `lg:` (≥1024px) the trigger and pill row stay in the same row inside the same horizontal-overflow container — no breakpoint-specific reorder.

### (b) Open bottom sheet — mobile (375pt width)

Vaul-style bottom sheet, slides up from the bottom, drag-handle at top, scrim 50% black. **Max height 80vh**, **min height auto** (will collapse if all sections empty, which never happens with current option lists). Body scrolls; header + footer pinned.

```
                        (scrim 50% black)
┌─────────────────────────────────────────────────────────────┐
│                          ── (drag handle, 100×4)             │  16pt top
│                                                              │
│  Filters                                  Reset       [×]    │  header
│  ─────────────────────────────────────────────────────────   │  hairline
│                                                              │
│  Cuisine                                                     │  section h
│  ┌────────┐ ┌──────┐ ┌─────────────┐ ┌──────┐                │
│  │Italian │ │Asian │ │Mediterranean│ │Mexican│  …            │  chip wrap
│  └────────┘ └──────┘ └─────────────┘ └──────┘                │
│  ┌──────┐ ┌─────────┐ ┌───────────────┐ ┌──────┐             │
│  │Indian│ │American │ │Middle Eastern │ │Other │             │
│  └──────┘ └─────────┘ └───────────────┘ └──────┘             │
│                                                              │
│  Cook time                                                   │  section h
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │≤ 15 min│ │≤ 30 min│ │≤ 45 min│ │≤ 60 min│ │60+ min │      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                              │
│  Dietary preset                                              │  section h
│  ┌──────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐          │
│  │Vegan │ │Vegetarian  │ │Gluten-free│ │Dairy-free│          │
│  └──────┘ └────────────┘ └───────────┘ └──────────┘          │
│  ┌────────────┐ ┌─────┐ ┌──────┐ ┌───────────┐               │
│  │High-protein│ │Keto │ │Paleo │ │Low-FODMAP │               │
│  └────────────┘ └─────┘ └──────┘ └───────────┘               │
│                                                              │
│  ─────────────────────────────────────────────────────────   │  hairline
│  ┌────────────┐         ┌─────────────────────────────────┐  │  footer
│  │  Clear all │         │      Show 24 recipes            │  │  (sticky)
│  └────────────┘         └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- Sheet width: 100% of screen.
- Padding: 20pt horizontal, 18pt top (after handle), 18pt bottom (before safe-area).
- Section spacing: 22pt between sections; section header → first chip = 10pt.
- Chip wrap: `flexDirection: 'row'`, `flexWrap: 'wrap'`, gap 8pt × 8pt.
- Drag-handle uses the existing `<Drawer>` `data-vaul-drawer-direction=bottom` indicator on web (`bg-muted mx-auto mt-4 h-2 w-[100px]`), and a hand-drawn equivalent on RN (`@gorhom/bottom-sheet` ships one — keep default).

### (c) Open drawer — web `lg:` desktop

`lg:` breakpoint = ≥1024px. **Above the breakpoint:** right-side drawer, 400px wide (matches `sm:max-w-sm` upper bound — design override to 400px so the chip wrap fits 4 across without orphaning). **Below the breakpoint** (tablet + mobile-web): same bottom-sheet behaviour as native mobile (vaul `direction="bottom"`).

Reuse `<Drawer>` from `src/app/components/ui/drawer.tsx` (vaul) for both directions — vaul supports `direction="right"` and `direction="bottom"` on the same primitive.

```
                                            ┌───────────────────────────────┐
                                            │ Filters         Reset    [×]  │  header
                                            │ ────────────────────────────  │
                                            │                               │
        (Discover content                   │ Cuisine                       │
         continues left,                    │ ┌────────┐┌──────┐┌─────...   │
         scrim 30% on web)                  │ │Italian ││Asian ││Med...     │
                                            │ └────────┘└──────┘└─────...   │
                                            │ ┌──────┐┌─────────┐...        │
                                            │ │Indian││American │           │
                                            │ └──────┘└─────────┘           │
                                            │                               │
                                            │ Cook time                     │
                                            │ ┌────────┐┌────────┐┌────... │
                                            │ │≤ 15 min││≤ 30 min││≤ 45... │
                                            │ └────────┘└────────┘└────... │
                                            │                               │
                                            │ Dietary preset                │
                                            │ ┌──────┐┌────────────┐...    │
                                            │ │Vegan ││Vegetarian  │       │
                                            │ └──────┘└────────────┘       │
                                            │                               │
                                            │ ────────────────────────────  │
                                            │ ┌──────────┐ ┌──────────────┐ │  footer
                                            │ │Clear all │ │Show 24 recipes│ │  (sticky)
                                            │ └──────────┘ └──────────────┘ │
                                            └───────────────────────────────┘
                                            ↑ slides in from right (200ms)
                                            ↑ scrim opacity 30% (lighter than mobile
                                              so the feed stays legible behind)
```

- Drawer width: **400px** at `lg:`; full-width bottom sheet below `lg:`.
- Slide direction: right→in at `lg:`; up→in below `lg:`.
- Scrim: `bg-black/30` desktop, `bg-black/50` mobile-web + native (matches the existing scrim tokens in `<DrawerOverlay>` and `<SheetOverlay>`).
- Body scroll only — header + footer pinned with `mt-auto` footer pattern already in `DrawerFooter`.

### (d) Discover with 2-3 active filter chips above the feed

The applied-filter chip strip lives **between the pill row and the first content section** ("Matches your day" / desktop grid). It doesn't replace the pill row — pills are the lens, applied-filter chips are the constraints.

```
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ │ ┌──────┐┌────────┐┌─────┐...                 │  pill row
│ │⌕̈ Filters·3│ │ │For Y.││Following│└─...                    │
│ └──────────┘ │ └──────┘└────────┘                           │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌────────────┐ ┌──────────────────┐            │
│ │Italian ×│ │≤ 30 min   ×│ │High-protein     ×│  Clear all │  applied
│ └──────────┘ └────────────┘ └──────────────────┘            │  chips
├─────────────────────────────────────────────────────────────┤
│  Matches your day                                           │
│  ...                                                        │
```

- Strip is an **unstyled horizontal scroll container** below `lg:`, **flex-wrap** at `lg:` (no horizontal scroll on desktop — wraps to 2 lines if needed).
- Each chip is the `selected` chip variant (see §5) but compacted: `paddingHorizontal: 10, paddingVertical: 4`, with a 14pt `×` glyph (lucide `X`) trailing. Tapping the `×` removes that single dimension+value pair; tapping the chip body **opens the FilterSheet** and scrolls to that section (nice-to-have, not blocking).
- "Clear all" right-aligned (mobile: at the end of the scroll list; desktop: right-justified after the wrapped chips). Style: ghost text-button, `text-primary text-[13px] font-semibold`.
- Strip vertical padding: 8pt top, 12pt bottom. Hidden when `countAppliedFilters(filters) === 0`.

---

## 3. "Filters" trigger placement

| Property | Mobile | Web `<lg:` | Web `lg:` |
|---|---|---|---|
| Position | Same row as 5 quick-pills, leftmost | Same | Same |
| Sticky | No (scrolls horizontally with row, but it's the first item) | No | No (row doesn't overflow at `lg:` since pills fit) |
| Divider | 1px × 16pt vertical hairline, `colors.cardBorder`, 6pt before/after | Same | Same |
| Icon | `SlidersHorizontal` 16pt | `SlidersHorizontal` 16pt | Same |
| Label | "Filters" + `· N` when active | Same | Same |
| Active state | Border + bg use `Accent.primary + "10"` (matches selected-pill treatment) | Same — `border-2 border-primary bg-primary/15 text-primary` | Same |
| Inactive state | Border `colors.cardBorder`, bg transparent | `border border-border bg-card text-foreground hover:bg-muted` | Same |

Rationale: same row keeps it a single visual unit; left-pinned makes it always visible despite hscroll; the divider signals "different class" without inventing a new component (no segmented control, no separate strip).

---

## 4. Sheet/drawer structure

### Header

| Slot | Treatment | Copy |
|---|---|---|
| Left | Sheet title, `text-[16px] font-semibold` | `Filters` |
| Right cluster | Two affordances: text-button + icon-button | `Reset` (text, `text-primary text-[13px] font-medium`) and `×` (lucide `X`, 18pt) |

- Header height ~52pt; bottom hairline `border-b border-border`.
- "Reset" is **disabled** (50% opacity, non-interactive) when `filtersAreEmpty(filters) === true`.
- Close `×` always enabled; closes the sheet without applying changes if commit-on-tap is OFF (see §8 — final decision is commit-on-tap, so close just dismisses).

### Body — 3 sections, vertically stacked

Section header style:
- Mobile: `fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textSecondary`. Matches existing "EATING OUT" header treatment in Discover.
- Web: `text-xs font-bold uppercase tracking-wide text-muted-foreground`.

Section order (top-to-bottom):
1. **Cuisine** — 8 chips, wrap.
2. **Cook time** — 5 chips, wrap (often fits 1 line on web at 400px, 2 lines on mobile 375pt).
3. **Dietary preset** — 8 chips, wrap.

This ordering matches user mental model (what kind of food → how long → constraints), and it puts the most-discriminating dimension (Cuisine) at the top where the eye lands.

### Footer (sticky)

Two elements, sticky at the bottom of the sheet/drawer with `mt-auto p-4 border-t border-border bg-background` (matches `DrawerFooter` defaults):

| Element | Treatment | Copy | Behaviour |
|---|---|---|---|
| Secondary | Ghost text-button | `Clear all` | Calls `setFilters(EMPTY_FILTERS)`; sheet stays open; URL updates. |
| Primary | Filled, full remaining width | `Show {N} recipes` | Closes the sheet. `N` is the live count of recipes that pass the current `filters` (from the same `applyDiscoverFilters` the feed uses). |

When `N === 0`, the primary CTA reads `No matches — adjust filters` and is **non-destructive but enabled** (it dismisses the sheet so the user lands on the empty-feed state in §6.2). Doing it the other way (disabling the CTA) would trap the user inside the sheet with no way to see the consequences of their choices.

### Commit model — DECISION: instant-commit per chip tap

I considered two models:
- **Commit-on-Apply**: chip taps stage a draft; URL + feed only update when user taps `Apply`. Predictable, undoable via `Cancel`. But it requires a draft state, an Apply button, and a Cancel button — more chrome, slower feedback.
- **Instant-commit on each tap**: chip taps mutate `filters` immediately; URL + feed re-render under the (still-open) sheet; the footer CTA becomes a "Done / Show N" close-only.

**Decision: instant-commit.** Reasoning:
1. **Speed feels.** The user sees the recipe count tick down as they select; that's the trust signal that the filter is real.
2. **Footer CTA stays meaningful** (`Show N recipes`) without needing to encode "you have unapplied changes" — the count is the feedback loop.
3. **No Cancel/Apply chrome**, lower visual density.
4. **`Reset` already covers the undo case** (one tap returns to empty state).
5. Mobile bottom sheets that gate behind Apply feel slow on cold opens; instant-commit is the iOS-native pattern (Maps filters, Photos search facets).

The footer primary therefore reads `Show {N} recipes` and is **always a close-action**; there is no "Apply" semantically — every chip tap is the apply.

---

## 5. Chip selection state

Reuse the existing pill button pattern from the 5-pill row — there is **no separate `<Chip>` primitive** in either codebase, so we extend the same Tailwind class set / RN Pressable style rather than inventing one. New file: `src/app/components/discover/FilterChip.tsx` + `apps/mobile/components/discover/FilterChip.tsx` — narrow wrapper around the same tokens, no new colours.

| State | Mobile RN tokens | Web Tailwind | Notes |
|---|---|---|---|
| **Unselected** | `borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: 'transparent', color: colors.textSecondary, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20` | `border border-border bg-card text-foreground hover:bg-muted px-3.5 py-1.5 rounded-full text-xs font-medium` | Identical to inactive 5-pill. |
| **Selected** | `borderColor: Accent.primary, backgroundColor: Accent.primary + "10", color: Accent.primary, fontWeight: '600'` | `border-2 border-primary bg-primary/15 text-primary` | Identical to active 5-pill. Border-width jump (1→2) is intentional and matches the existing pattern; do not "fix" by collapsing. |
| **Disabled** (zero-result combination) | Same as unselected, but `opacity: 0.4`, `pointerEvents: 'none'` | `opacity-40 pointer-events-none` | See §5.1. |
| **Hover** (web only) | n/a | `hover:bg-muted` (unselected) / no change (selected) | Already in the 5-pill class. |
| **Focus** (kbd) | n/a | `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none` | Required for a11y — the existing pill-row buttons have implicit focus via `<button>`; FilterChip should inherit. |

### 5.1 Disabled — when does it fire?

A chip is disabled when **selecting it would zero the feed given the current other selections**. We can compute this cheaply: for each unselected chip, run `applyDiscoverFilters(recipes, withChipAdded)` and check if the count is 0. **Cap this check at 50 candidate recipes** (the live page set) — we don't need to be exact across the full corpus, only honest about the current view.

If feature parity / perf becomes an issue: ship without the disabled state in v1 and add it as a follow-up (open question §10.2). The chip selection still works fine without it.

---

## 6. States

### 6.1 Loading (sheet just opened, recipes still fetching)

The sheet itself never blocks on data — option lists are static constants from `filterRecipes.ts`, so the chips render instantly. The footer count (`Show N recipes`) shows a 3-dot loading state while `recipes` is loading: `Show … recipes`. No spinner — the dots match the existing loading-text pattern in the eating-out row.

### 6.2 Empty feed (filters return zero results)

Use `<EmptyState>` from `src/app/components/suppr/empty-state.tsx` (web) and `apps/mobile/components/EmptyState.tsx` (mobile). Renders **in place of the recipe sections** (replaces "Matches your day" / desktop grid), below the applied-filter chip strip.

| Slot | Content |
|---|---|
| `icon` | lucide `SearchX` (24pt, muted) |
| `title` | `No recipes match these filters` |
| `description` | `Try removing a filter — or clear all to start over.` |
| `action` | Ghost button: `Clear all filters` (calls `setFilters(EMPTY_FILTERS)`) |

The applied-filter chip strip stays visible above this state — the user can see exactly which constraints are biting and dismiss them one-by-one rather than the all-or-nothing "Clear all". This is the design difference from the current "Nothing to show" empty (which doesn't show the constraint breadcrumbs).

### 6.3 Empty feed (no filters, base feed empty)

Unchanged from today — existing "Nothing to show" copy in `DiscoverFeed.tsx` lines 851–878 / mobile lines 619–632. The applied-filter chip strip is hidden because `countAppliedFilters === 0`.

### 6.4 Error (filter library throws)

`applyDiscoverFilters` is a pure function over already-fetched data; it cannot fail at runtime. **No error state is required for the filter operation itself.** If the feed fetch fails upstream, the existing fetch-failed state in `useDiscoverRecipes` / `useAppData` handles it.

### 6.5 Partial (some recipes lack `dietary_flags` / `cuisine`)

Handled at the filter library level — see `passesDiscoverFilters` lines 94–96, 100–101: NULL `cuisine` rows are excluded once any cuisine is selected, and 60+ matches null cookTimeMin. **No UI treatment needed**; the feed simply hides the rows that don't have enough data to match. We do not surface "X recipes hidden because data is incomplete" — that's a nutrition-engine question, not a Discover one.

### 6.6 Stale (URL has old filters that no longer correspond to options)

If the URL parses a value that's no longer in `CUISINE_OPTIONS` / `COOK_TIME_BUCKETS` / `DIETARY_PRESETS` (e.g. we retire `low-fodmap` later), drop the unknown value silently and update the URL on next render to reflect the cleaned set. Do not toast — the user did not type the URL. Spec'd in §8.

### 6.7 Offline

Filtering is local; works offline. The Discover feed itself has its own offline behaviour (cached recipes from `useDiscoverRecipes`) — no FilterSheet-specific copy.

---

## 7. Nutrition treatment

The dietary presets (Vegan, Vegetarian, Gluten-free, …) are **derived from `recipes.dietary_flags` JSONB**, populated either at import time or by a backfill (see B5 spec "Risks"). The FilterSheet does not annotate confidence in v1 because:

1. Dietary flags are **declarative tags** not inferred nutrients — there is no "85% sure this is vegan" semantic.
2. Surfacing source ("derived from tags") inside the FilterSheet would clutter a control surface that's about narrowing the feed, not auditing.
3. If the user wants to know **why** a recipe is tagged vegan, that belongs on the Recipe Detail page, not the filter sheet.

If the dietary backfill is incomplete at ship, partial-data recipes simply don't match those filters (see §6.5). That's the honest behaviour.

**Open question:** should "High-protein" be a chip here, given it's also a quick-pill? See §10.

---

## 8. URL ↔ UI sync (web)

URL shape:
```
/discover?cuisine=italian,asian&time=≤30,≤60&diet=high-protein,vegan
```

- Comma-separated values per dimension. Unknown dimensions / values dropped silently on parse (§6.6).
- Encoding: `encodeURIComponent` per value; bucket ids `≤15` etc. are URL-safe-ish but `≤` will encode to `%E2%89%A4`. Acceptable. Alternative: rename bucket ids to `lte15` / `lte30` / etc. internally — **recommended** to avoid percent-encoded URLs in shares (open question §10.3).

### Sync timing — DECISION

**The URL updates on every chip tap (instant-commit).** Same model as the feed re-render. Reasoning:

1. **Instant-commit is the chosen apply model (§4).** URL parity with the visible feed is non-negotiable — if the feed shows 12 recipes but the URL says something else, share-link semantics break.
2. **URL is a state mirror, not a confirmation.** The user doesn't ratify the URL with an "apply" — the URL just is the state.
3. Use `router.replace` (not `push`) on toggle so the back button doesn't accumulate one history entry per chip tap. The user expects "back" to leave Discover, not to undo their last filter selection.

Implementation note: debounce the URL write at 100ms so a rapid multi-chip tap doesn't fire 5 `replace` calls. Behavioural difference is imperceptible; perf wins are real.

### Deep-link rendering

On initial render, parse `URLSearchParams` → `DiscoverFilters`. If the URL carries any filter values, the FilterSheet does **not** auto-open — applied-filter chips render above the feed and the user can tap "Filters · 3" to see / edit. (Auto-opening on deep-link would feel hostile.)

### Mobile

Mobile has no URL. The filter state lives in component state and **is not persisted** between sessions in v1. If we want session persistence later, persist via AsyncStorage keyed by user id. Out of scope for Phase 2b.

---

## 9. Component delta

### Create

| Path | Purpose |
|---|---|
| `src/app/components/discover/FilterSheet.tsx` | Web filter sheet. Reuses `<Drawer>` (`vaul`) with `direction="right"` at `lg:` and `direction="bottom"` below. Manages drawer open state internally; exposes `<FilterSheetTrigger>` for the pill row. |
| `src/app/components/discover/FilterChip.tsx` | Web chip primitive — selected / unselected / disabled. Wraps `<button>`. |
| `src/app/components/discover/AppliedFilterStrip.tsx` | Web applied-filter chip strip rendered above the feed sections. |
| `apps/mobile/components/discover/FilterSheet.tsx` | Mobile bottom sheet via `@gorhom/bottom-sheet` (already in deps). Snap points `['80%']`. Imports the same `DiscoverFilters` shape. |
| `apps/mobile/components/discover/FilterChip.tsx` | Mobile chip — selected / unselected / disabled. Wraps `<Pressable>`. |
| `apps/mobile/components/discover/AppliedFilterStrip.tsx` | Mobile applied-filter chip strip. |
| `src/lib/discover/filterUrlState.ts` | URL ↔ `DiscoverFilters` codec: `parseDiscoverFiltersFromSearchParams(usp)` + `serializeDiscoverFiltersToSearchParams(filters)`. Pure, web-side only but shared so tests can pin both directions. |

### Modify

| Path | Change |
|---|---|
| `src/app/components/DiscoverFeed.tsx` | Add `<FilterSheetTrigger>` to the pill row (lines ~488–505), `<AppliedFilterStrip>` between the pill row and content (after line ~505), wire `filters` state through `applyDiscoverFilters` into the existing `recipes` `useMemo` (around line 350), and add the URL sync `useEffect`. |
| `apps/mobile/app/(tabs)/discover.tsx` | Add `<FilterSheetTrigger>` to the pill `<ScrollView>` (lines ~521–538), `<AppliedFilterStrip>` after the pill row, wire `filters` state through `applyDiscoverFilters` into the `filtered` filter (lines 203–242). |
| `src/lib/analytics/events.ts` | Confirm `discover_filter_applied` is registered. If absent, add: `discover_filter_applied: "discover_filter_applied"`. (Backend spec implies it's already wired — verify.) |
| `apps/mobile/lib/analytics/events.ts` (or shared) | Same. |

### Retire

| Path | Reason |
|---|---|
| The legacy `filters` state in `DiscoverFeed.tsx` lines 153–157 (`{ verified, maxCalories, minProtein }`) and the related modal opened by `showFilters` (line 115) | Superseded by the new FilterSheet. The three legacy fields don't map onto the new dimensions and their UI is invisible to most users today. Verify via grep that no other surface reads them before deletion. |

### Analytics fire site

`discover_filter_applied { dimension, value }` fires inside `FilterChip.onToggle` **at the point the chip is added** (not on remove, not on bulk reset). `dimension` ∈ `'cuisine' | 'cookTime' | 'dietary'`, `value` is the literal id (`'italian'`, `'≤30'`, `'high-protein'`). One event per chip add, instant-commit.

---

## 10. Open questions

1. **High-protein duplication.** "High Protein" is already a quick-pill (`r.protein >= 25` mobile / web). The dietary preset chip "high-protein" is sourced from `recipes.dietary_flags` (server-tagged). They will not always agree. Options: (a) keep both, accept the divergence; (b) drop the quick-pill, only surface in FilterSheet; (c) drop the dietary chip, keep the quick-pill. **Recommend (a)** for v1 to avoid scope creep, but flag for `product-lead` to resolve before v1.1.
2. **Disabled-chip computation cost.** The §5.1 disabled state requires N×M filter passes per re-render. For 21 chips × 50 recipes = 1,050 ops, fine. If the feed grows to 500+ recipes and we want this state, memoize aggressively or drop the disabled state for v1 entirely. **Recommend ship-without** disabled state, add in v1.1.
3. **Cook-time bucket id encoding.** `≤15` produces `%E2%89%A4` in URLs and looks ugly in shares. Renaming the ids to `lte15` etc. is a 5-line change in `filterRecipes.ts` but needs a migration path for any URLs already in the wild (none today — Phase 2b is greenfield). **Recommend renaming** before ship.

---

## Acceptance criteria

1. Tapping the "Filters" trigger in the pill row opens a bottom sheet on mobile + web `<lg:`, and a right drawer on web `lg:` (≥1024px).
2. The sheet contains 3 sections (Cuisine, Cook time, Dietary preset) with the exact 8 / 5 / 8 chip set defined in `src/lib/discover/filterRecipes.ts`. No options are hardcoded in the sheet — all imported from the library.
3. Tapping any chip toggles its selection **and immediately** updates the feed below the sheet/scrim, the applied-filter chip strip, and on web the URL (debounced 100ms, `router.replace`).
4. The footer primary CTA reads `Show {N} recipes` where `N` is `applyDiscoverFilters(allRecipes, filters).length`. Tapping it dismisses the sheet. When `N === 0`, copy reads `No matches — adjust filters` and the button still dismisses.
5. The footer secondary `Clear all` resets `filters` to `EMPTY_FILTERS`, keeps the sheet open, and updates the URL.
6. The header `Reset` is disabled when `filtersAreEmpty(filters) === true`.
7. The applied-filter chip strip renders above the feed (below the pill row) when `countAppliedFilters > 0`. Each chip has a tappable `×` that removes that single value. A right-aligned `Clear all` resets all dimensions.
8. When filters return zero recipes, the feed area renders the shared `<EmptyState>` with the copy in §6.2 and a `Clear all filters` action.
9. On web, deep-linking `/discover?cuisine=italian&time=lte30&diet=high-protein` renders the filtered view directly; the sheet does **not** auto-open; the applied-filter chip strip reflects the URL.
10. Unknown URL values (typos, retired options) are dropped silently and the URL is rewritten on next render.
11. `discover_filter_applied { dimension, value }` fires once per chip-add (not on remove, not on bulk reset).
12. `npm run ci` green: web typecheck + vitest, mobile typecheck + vitest, including new tests:
    - `tests/unit/filterUrlState.test.ts` — URL ↔ filters codec round-trips.
    - `tests/unit/discoverFilterSheet.test.tsx` — sheet open/close, chip toggle, instant-commit fires URL replace, footer count tracks recipe count.
    - `apps/mobile/tests/unit/discoverFilterSheet.test.tsx` — RN parity test (open, toggle, dismiss).
13. The 5 quick-pills retain their existing behaviour and visual treatment. No regression on `For You / Following / Popular / Quick / High Protein / Low Carb`.
14. Mobile-web (below `lg:`) gets the bottom-sheet behaviour, not the right-drawer behaviour. Single breakpoint check.

---

## Executive summary

- **Apply model: instant-commit on each chip tap** — no Apply button. Footer reads `Show {N} recipes` and is always a dismiss-action; the recipe count is the feedback loop. Reset / Clear all cover the undo case. This is the iOS-native filter pattern and matches how the rest of Discover (5 pills) already behaves.
- **One primitive across breakpoints.** Reuse `<Drawer>` (vaul) on web — `direction="right"` at `lg:` (≥1024px, 400px wide), `direction="bottom"` below — and `@gorhom/bottom-sheet` on native mobile. No new sheet primitive invented; no new colour tokens; chip selected / unselected styles inherit the existing 5-pill treatment.
- **Filters trigger sits in the pill row, leftmost, with a vertical hairline divider** before the 5 quick-pills. Always visible despite hscroll, signals "different class of control" without a separate strip. Active count surfaces as `Filters · 3` in the existing selected-pill style.
- **URL is a live mirror on web** (`?cuisine=italian&time=lte30&diet=high-protein`, comma-separated, debounced 100ms `router.replace` so back-button doesn't accumulate). Deep-link renders the filtered feed directly without auto-opening the sheet — the applied-filter chip strip above the feed is the breadcrumb.
- **Empty state when filters zero the feed reuses the shared `<EmptyState>`** with copy "No recipes match these filters" + a "Clear all filters" action. The applied-filter chip strip stays visible above the empty state so users can dismiss constraints surgically rather than all-or-nothing.

---

## Relevant files

- Backend filter library (shipped, do not modify): `src/lib/discover/filterRecipes.ts`
- Phase 2 PRD: `docs/specs/2026-04-27-b5-discover-phase2.md`
- Web Discover surface to extend: `src/app/components/DiscoverFeed.tsx`
- Mobile Discover surface to extend: `apps/mobile/app/(tabs)/discover.tsx`
- Existing web sheet primitive: `src/app/components/ui/sheet.tsx`
- Existing web drawer primitive (vaul, used here): `src/app/components/ui/drawer.tsx`
- Web EmptyState (used in §6.2): `src/app/components/suppr/empty-state.tsx`
- Mobile EmptyState (used in §6.2): `apps/mobile/components/EmptyState.tsx`
- Mobile bottom-sheet reference impl: `apps/mobile/components/MoveMealSheet.tsx`
- Theme tokens: `apps/mobile/constants/theme.ts`
- Analytics events registry: `src/lib/analytics/events.ts`
