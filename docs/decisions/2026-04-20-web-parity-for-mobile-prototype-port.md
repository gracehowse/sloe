# Web parity for 2026-04-19 whole-app-experience prototype port

**Status:** Resolved (shipped 2026-04-20)
**Area:** UI / parity
**Owner:** product-engineer

## Context

Mobile landed the `2026-04-19-whole-app-experience` prototype in two commits on 2026-04-20:

- `5958ae4` — feat(discover): prototype treatment for header, search, cards, detail buttons.
- `26a63bf` — feat(mobile): Plan + More port + ui-critic polish pass.

Both commits only updated `apps/mobile/**`. Grace's repo rule
(`feedback_mobile_decisions_apply_to_web.md`) says every visible design
decision on mobile must land on web in the same commit. This change
closes that parity gap across four surfaces.

## Scope (web)

1. **MealPlanner** (`src/app/components/MealPlanner.tsx`):
   - Header restyled: `WEEK OF {Month Day}` overline + big "Meal plan"
     title + round `sliders-horizontal` pill on the right. Removed the
     4-button action row; Regenerate + Shopping list moved into the
     summary card, Templates opens via the round pill, `handleSavePlan`
     was deleted (it was informational-only).
   - New "This week" summary card: gradient-tinted card with "Hits your
     targets N of M days" title, worst-short-day diagnostic, and
     Shopping list / Regenerate buttons. Rendered only when a plan + a
     positive calorie target both exist. Hit band = ±10% of target,
     identical rule to mobile.
   - Day cards: day total now renders with thousands separator and
     explicit `kcal` unit (e.g. `1,820 kcal / 2,000`).
   - Today's-plan meal rows: empty / placeholder slots render an
     "Empty slot" title + em-dash macro line (`— kcal · P —g · C —g ·
     F —g`) instead of being filtered to nothing. Real rows got a
     matching kcal · P · C · F line for visual weight parity.

2. **Profile / web "More" surface** (`src/app/components/Profile.tsx`):
   - Phone-top header replaced with `ACCOUNT` overline + large "More"
     title + round avatar-initial button top-right. `DesktopSidebar`
     was already renamed Profile → More in the 2026-04-20 earlier work.
   - New profile card: 52×52 gradient avatar + display-name +
     tier·joined subline + tier pill.
   - Rows: icon-box bumped `w-7 h-7` → `w-9 h-9` (size-md IconBox), row
     labels moved from `text-sm font-medium` → `text-[13px]
     font-semibold`, subs `text-xs` → `text-[11px]` with `mt-0.5`.
   - Section headings switched from uppercase micro-overlines
     (`Settings` / `Creator Tools` / `Legal`) to sentence-case
     `text-[14px] font-bold` headings.

3. **Today polish** (`src/app/components/suppr/*`):
   - `today-hero-ring.tsx` mode toggle: subtle tint background instead
     of the heavy primary fill, rounded container, smaller active-chip
     style so it no longer competes with the ring.
   - `today-hero-stats.tsx` desktop toggle: moved to `top-2.5 right-2.5`
     with the same subtle `bg-muted/50` treatment (no border).
   - `daily-ring.tsx`: "of X kcal" budget line renders in BOTH expanded
     and collapsed states (was gated on `!expanded`).
   - `today-dashboard-macro-tiles.tsx`: value size 18pt → 22pt; target
     label truncates so long imperial targets don't wrap.

4. **DiscoverFeed** (`src/app/components/DiscoverFeed.tsx`): recipe card
   hero switched from fixed 80px to 16:10 aspect ratio; title bolder
   (13px); P/C/F micro-dot row + saves/made footer removed; replaced
   with clean kcal / protein / time metadata strip (lucide icons
   `Flame` / `Beef` / `Clock`). No `|| true` on the Popular pill on web
   — the pill doesn't gate results there, so nothing to undo.

5. **RecipeDetail** (`src/app/components/RecipeDetail.tsx`): save + share
   header buttons now carry a 1pt border, small shadow, and foreground
   icon colour so they remain legible on mobile-web (`<md`) when
   rendered near the hero photo. Order was already bookmark-left /
   share-right.

## Shared helper

Added `src/lib/planning/planWeekSummary.ts` — `computePlanWeekSummaryScore`
and `buildPlanWeekSummarySubtitle`. Web consumes these from
`MealPlanner.tsx`; mobile keeps its inline memo for now (behaviour is
identical — mobile can refactor to the shared helper in a follow-up
without affecting user-visible output). Rule: a day "hits" when its
calorie total is within ±10% of the daily calorie target. Same rule on
both platforms.

## Tests

- New: `tests/unit/planWeekSummary.test.ts` (14 tests, all pass) pinning:
  - empty / missing plan returns null
  - non-positive / non-finite target returns null
  - ±10% inclusive band (3 hits in a 5-day fixture)
  - band boundary is a hit
  - worst-short day = largest negative gap
  - no-short-day returns `worstShort: null`
  - NaN day totals coerce to 0 (so the day still counts as "short")
  - subtitle copy: all-three branches (all-hit, short-day, fallback)
  - singular / plural day form
  - `shortBy` rounds to whole kcal
- Web vitest: `175 files, 2103 tests` — all pass.
- Web typecheck: clean.
- Mobile typecheck: clean (no mobile file touched; shared helper is
  additive).

## Parity

| Surface | Web | Mobile | Intentional diff |
| --- | --- | --- | --- |
| Meal plan header | overline + title + round pill | overline + title + round pill | — |
| "This week" card | present when plan + target | present when plan + target | — |
| Day-total display | `1,820 kcal / 2,000` | `1,820 kcal` | web retains denominator because narrow day cards can fit both; mobile dropped the denominator because space was too tight |
| Empty slot | "Empty slot" + em-dash macros | "Empty slot" + em-dash macros | — |
| Today hero-variant picker (ring / bar / number) | N/A | 28×28 subtle tint | web never had a hero-variant picker — deferred feature, not parity debt |
| Today REMAINING / CONSUMED toggle | subtle tint, no border | N/A on mobile | web-only affordance; mobile uses ring-tap cycle |
| Ring centre `of X kcal` | renders in expanded + collapsed | renders in expanded + collapsed | — |
| Macro tile value size | 22px | 22pt | — |
| More tab header | overline + "More" + avatar-pill | overline + "More" + avatar-pill | — |
| Profile card | 52×52 + tier pill | 52×52 + tier pill | — |
| Section headings | sentence case (bold 14px) | sentence case | — |
| Row icon-box | 36×36 md IconBox | 36×36 IconBox | — |
| Discover recipe card | 16:10 hero + kcal/protein/time strip | 16:10 hero + kcal/protein/time strip | — |
| Recipe detail save / share | 1pt border + shadow + foreground | 1pt border + shadow + foreground | — |

## Non-goals / follow-ups

- Household-mode "This week" card variant (per-member targets): deferred.
  The MealPlanner on web has no household-persona mode wired today;
  when it lands, the summary card should split by member (mirroring the
  mobile `HouseholdCard`).
- Mobile-side: refactor its inline `summaryScore` memo to consume the
  shared `computePlanWeekSummaryScore` helper so both platforms pull
  from one source of truth.
- Today hero-variant picker (ring / bar / number): the prototype shows
  this on mobile; web has never had it. Feature-parity decision is
  pending — not a drift to close in this batch.
