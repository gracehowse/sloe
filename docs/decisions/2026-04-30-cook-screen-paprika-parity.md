# Cook screen — Paprika parity (recipe scaling + per-cook history)

**Status:** Resolved
**Date:** 2026-04-30
**Area:** Cook mode (mobile + web)
**Trigger:** Extended competitor audit (2026-04-30) flagged Paprika as a
conversion-blocker for the recipe-collection persona. Two specific gaps:
real-time recipe scaling on the Cook screen, and per-cook notes + rating
that actually persist.

## What we changed

### 1. Cook screen recipe scaling (0.5x / 1x / 1.5x / 2x / 4x)

A 5-preset segmented control above the step text on both
`apps/mobile/app/cook.tsx` and `src/app/components/CookMode.tsx`. Tapping
a preset rewrites visible amounts in the step text via the shared
`scaleAmountText` helper in `src/lib/nutrition/recipeScale.ts`.

- The chosen scale persists per-(userId, recipeId) — AsyncStorage on
  mobile, localStorage on web.
- Scale flows through to "Add to my regulars" (saved-meal macros are
  multiplied) and "Log this meal" (appends `&portion=<scale>` to the
  recipe-page autoLog URL).
- Time / temperature / step-number tokens are NOT scaled (`bake 25
  minutes`, `350°F`, `Step 1:` all left untouched). The shared helper
  enforces this via an explicit time/temp guard list.
- Hyphen ranges scale both ends (`1-2 cloves` → `2-4 cloves` at 2x).
- Vulgar fractions and mixed fractions parse + render back as ASCII
  cookbook idioms (1/2, 1/4, 3/4, 1 1/2).
- Timer parser still indexes against the unscaled (raw) step text on
  mobile and `currentStepCleaned` on web — this guarantees offsets stay
  stable as scale changes. When `scale !== 1` on web, inline timer pills
  fall back to a separate row beneath the paragraph.

### 2. Per-cook history (notes + rating with persistence)

A new `public.recipe_cook_history` table (migration:
`supabase/migrations/20260504100000_recipe_cook_history.sql`) stores one
row per cook session: `cooked_at`, `duration_seconds`, `scale_factor`,
`rating`, `note`. Append-only, owner-only RLS.

- New shared client `src/lib/nutrition/recipeCookHistoryClient.ts`
  exposes `insertCookHistory`, `listRecentCookHistory`, plus four clamp
  helpers used on both platforms.
- The completion card on both web + mobile renders: the rating row, a
  `Notes for next time (optional)` textarea (capped at 500 chars), and a
  Save button that writes the row.
- A "Last time: 12 min, 4 stars, 'added garlic'" preview card surfaces
  the most recent history row above the step text on the next cook.
  Pulls via `listRecentCookHistory(supabase, userId, recipeId, 3)`.
- Mobile keeps a local AsyncStorage history cache for the existing
  median-duration surface; the cache is enriched (with scale / rating /
  note / `recipeCookHistoryId`) when a row writes successfully, and falls
  back to a local-only entry when the network write fails so the user's
  note is never lost.

## Why two tables

`user_recipe_notes` (existing, batch 3.8) holds rolling per-recipe
state: cumulative `cook_count`, single `personal_rating`, single `notes`
field. Paprika's per-cook delta ("added more garlic, cooked 5 min less")
needs a per-session log — collapsing it into the rolling notes would
lose history. The two tables coexist; the rolling notes UI on the
recipe-detail page stays as-is.

## Migration

Staged at `supabase/migrations/20260504100000_recipe_cook_history.sql`.
Apply via:

```bash
supabase db push --linked
```

Per CLAUDE.md, MCP `apply_migration` is forbidden for tracked files
(rewrites the version timestamp). Grace runs the push.

## Analytics

Two new event names (registered in `src/lib/analytics/events.ts`):

- `recipe_scale_changed` — `{ recipeId, scale }` on segmented-control
  commit. Measures scaling adoption.
- `cook_history_saved` — `{ recipeId, scale, rating, hasNote,
  durationSec }` on Save commit. Measures per-cook-history adoption,
  distinct from the rolling `recipe_note_saved`.

## Parity notes

- Web and mobile use the SAME `scaleAmountText` regex, the SAME
  `clampCookHistory*` validators, and the SAME `recipe_cook_history`
  table. No platform-specific divergence.
- Mobile's existing `parsedTimers` indexes against `rawStepText`
  (unchanged). Web's existing inline-pill renderer indexes against
  `currentStepCleaned` (unchanged at 1x). When `scale !== 1` on web,
  pills move below the paragraph because rewritten-text offsets aren't
  safe to index against.
- The completion card on web stays single-page; mobile wrapped its done
  state in a ScrollView so the new notes input + Save button remain
  reachable on iPhone SE.

## Files changed

- New: `src/lib/nutrition/recipeScale.ts`
- New: `src/lib/nutrition/recipeCookHistoryClient.ts`
- New: `supabase/migrations/20260504100000_recipe_cook_history.sql`
- Modified: `src/lib/analytics/events.ts` (two new events)
- Modified: `src/app/components/CookMode.tsx` (scale control + notes
  + rating persistence + Last time card)
- Modified: `apps/mobile/app/cook.tsx` (scale control + notes + rating
  persistence + Last time card)
- Modified: `apps/mobile/lib/cookSession.ts` (`CookHistoryEntry`
  extended with optional scale / rating / note / recipeCookHistoryId
  fields, plus a `clampCookNote` helper)
- New tests: `tests/unit/recipeScale.test.ts` (41), `tests/unit/recipeCookHistoryClient.test.ts` (25), `tests/unit/cookModePaprikaParity.test.ts` (12)
- Updated tests: `apps/mobile/tests/unit/cookCompletionPolish.test.ts`,
  `apps/mobile/tests/unit/journeyFixes20260427.test.ts`,
  `tests/unit/cookModeAutoLogFireOnce.test.ts`

## Pending Notion mirror actions

- Decisions log: add this row (Resolved, area = Cook mode, link to this
  file).
- Roadmap: Paprika-parity scaling + per-cook notes/rating now Shipped.

(Notion MCP not in this session — list logged for Grace to mirror.)
