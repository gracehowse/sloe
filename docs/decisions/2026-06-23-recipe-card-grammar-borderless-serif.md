# Sloe v3 — recipe-card grammar: borderless + serif, system-wide (2026-06-23)

**Status:** Resolved (Grace ratified the direction via AskUserQuestion: "Adopt system-wide").
**Area:** Redesign / design foundations — recipe-card grammar.
**Issue:** ENG-1225 (Sloe v3 reskin). Surfaces the Block 5 fidelity-review finding
(design-system-enforcer: the borderless+serif divergence was "the single biggest
perceived-quality miss").
**Grounded by:** the v3 prototype (`docs/ux/redesign/v3/Sloe-App.html`, `.rcard`
L2087-2102 + `.cook-feat`/`.cf-*` L1332-1335) read against the live components on
both platforms, plus an on-device iOS render + a web Storybook render of the result.

## The decision

Recipe cards use a **two-tier grammar**, matching the prototype:

1. **Repeating recipe cards** (Library grid, Discover, Cookbook editorial shelves)
   are **borderless** — no card border or fill; only the **photo is a rounded 24px
   tile** (`--radius-card-lg` / mobile `CARD_RADIUS`); the **name is Newsreader
   serif** (web `var(--font-headline)`, mobile `FontFamily.serif*`); meta is sans.
2. **The featured hero** (one per surface, e.g. Cookbook "Tonight's pick") stays a
   **framed** card — border + card fill + 24px radius + serif title. This is the
   prototype's own `.cook-feat` shape and aligns with the one-card elevation rule
   (page-ground hero = framed; repeating tiles = flat/borderless).

## What the audit actually found (premise correction)

The original framing ("all recipe cards are bordered/sans") was **stale**. The grid
and Discover cards had **already adopted** the borderless+serif grammar in an earlier
v3 block:

- **Library grid** — mobile `cardTitle: FontFamily.serifSemibold` 16/600, borderless
  via `useCardElevation` (`useBorder:false`), 24px (`CARD_RADIUS`); web
  `SupprCard border={false}` radius `lg` (24px) + `font-headline` name.
- **Discover** — mobile serif `Type.headline` + borderless; web `SupprCard
  border={false}` + `font-headline`.

The **only** genuine divergence was the two Cookbook **shelf** components, built in
Block 5 with a bordered/sans stopgap to match the grid *as it was assumed to be*:

- `RecipeCardWide` (mobile + web) — bordered + **sans** name + **12px** radius.
- `FeaturedHero` (mobile + web) — already framed + serif (correct), but pinned at
  **12px** instead of 24px.

So "system-wide adoption" was, in practice, bringing the two holdout shelf
components into line with the grid that already did it — the only thing creating
**two grammars on one Library screen**. Two consequences vs. the original plan:

- **No new 16px mobile radius token needed.** Our recipe tiles already standardised
  on the **24px** warm-slab corner (`CARD_RADIUS`/`TILE_RADIUS`), overriding the
  prototype's 16px `--radius-card`. The shelf cards match the grid's existing 24px;
  the mobile radius scale was **not** extended.
- It was a **4-file change**, not a system-wide sweep.

## Changes

- `apps/mobile/components/library/RecipeCardWide.tsx` — borderless card; photo is a
  24px (`CARD_RADIUS`) rounded tile; name → `FontFamily.serifMedium` 15/500 (prototype
  `.rcard-name`); name/meta flush below on the page ground.
- `src/app/components/library/RecipeCardWide.tsx` — same; photo tile
  `rounded-[var(--radius-card-lg)]`; name → `font-headline` 15/medium; dropped border +
  card fill + card hover-bg; added photo hover-scale + rounded focus ring.
- `apps/mobile/components/library/FeaturedHero.tsx` — radius `Radius.xl` (12) →
  `CARD_RADIUS` (24); stays framed.
- `src/app/components/library/FeaturedHero.tsx` — `rounded-xl` →
  `rounded-[var(--radius-card-lg)]`; stays framed.

No-photo state: mobile shelf cards fall back to the painterly `FoodFallbackThumb`
inside the rounded tile (so borderless cards never look bare); web shows the utensil
glyph on `--background-secondary`.

## Verification

- **iOS (primary)** — rendered the real `FeaturedHero` + `EditorialShelf`/
  `RecipeCardWide` on the Sloe-Verify sim via a throwaway mock-data preview route
  (the Discover seed recipes can't be saved — `toggleSave` rejects their non-UUID
  ids — so the live Library couldn't be populated). Forensic crops confirm: no
  border/hairline, 24px rounded photo tile, Newsreader serif names, flush-left,
  painterly fallback. Scaffold deleted after capture.
- **Web** — Storybook `CookbookShelves` story at mobile (390px) + desktop (1280px):
  framed serif featured + borderless serif shelf cards. (Storybook needed
  `--font-headline` pinned manually since it's a `next/font` var; live `/discover`
  renders Newsreader natively.)
- Tests: `libraryShelvesV3.test.tsx` (mobile, +1 grammar assertion → 6) and
  `libraryShelvesV3Web.test.tsx` (web, +1 → 8) green. Mobile + web typecheck, web
  type-scale, both lints clean.

## Flag posture

Editorial shelves remain behind `sloe_v3_editorial_shelves` (default-on; PostHog
kill-switch). The grammar change rides that gate — no new flag. Per the v3 COLLAPSE
model, the flag can be collapsed once the reskin's shelves hold at 100%.

## Pressure-test (why not keep the bordered tile)

- The bordered/sans tile was a documented mid-flight stopgap, not a defended choice —
  the mix-and-match rule (`feedback_prototype_mix_and_match`) doesn't protect it.
- Piecemeal is strictly worse: bordered shelf cards beside borderless grid cards on
  one screen = two grammars. All-or-none, and "none" leaves the reskin looking like
  the old app.
- Serif-on-controls "reads dated" (theme.ts L594) is about CTA *labels*, not content
  titles; the on-device render confirms 15px serif names read crisp/editorial.
