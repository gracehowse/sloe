# Discover tab — three-section layout (prototype port)

**Status:** Resolved (shipped 2026-04-20)
**Area:** UI / parity
**Owner:** product-engineer

## Context

Grace's 2026-04-20 screenshot review flagged that the Discover tab on
both platforms had the right header / search / filter pills but the
surface below (the recipe cards) didn't match the 2026-04-19 Claude
Design prototype. The prototype
(`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
→ `DiscoverScreen`, lines 345–438) splits the recipe area into three
distinct sections, not one grid:

1. **Matches your day** — 2 hero cards (16:10 image, full width,
   stacked vertically).
2. **More ideas** — one card containing compact meal-row style list
   rows (40×40 icon + title/source·time + trailing kcal/P/C).
3. **From your sources** — Import + My Library CTAs, at the BOTTOM of
   the scroll (utility, not discovery — the reading order the
   prototype defends).

The previous shape (2-column grid with the CTAs pinned high) shipped
on 2026-04-20 as a first-pass prototype port and was partly right —
right header, right search, right pills, right card anatomy (16:10
image + kcal/protein/time metadata) — but wrong structure below the
pills.

## Decision

Restructure both platforms to the three-section layout. Key rules:

- "Matches your day" uses `filtered.slice(0, 2)`.
- "More ideas" uses `filtered.slice(2)`; only renders when a third
  recipe exists.
- "From your sources" always renders (even when the feed is empty)
  because that's how users bring content in.
- When `filtered.length === 0`, sections 1 + 2 are replaced with the
  existing "No recipes yet" / "Nothing to show" empty state; section
  3 still renders underneath.
- **NO fit-percent badge.** The prototype draws one; F-11 killed it
  (`AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19). The brief explicitly
  permitted skipping the badge ("don't block shipping");
  `tests/unit/recipeCardNoScore.test.ts` pins its absence and would
  fail if it came back.

## Scope

- **Mobile** (`apps/mobile/app/(tabs)/discover.tsx`):
  - Converted from `FlatList` (2-column grid) to `ScrollView` with
    three vertically-stacked sections. `FlatList` / `Dimensions` /
    `cardWidth` removed.
  - New local `renderHeroCard` + `renderMoreIdeaRow` helpers.
  - Section headings match the prototype's `.section-h h3` token
    (14px, fontWeight 700, letterSpacing -0.1, 22px top / 10px
    bottom) — same pattern as `more.tsx`.
  - Hero card: 16:10 image area, 32px restaurant icon (upgraded from
    28px because the card is larger), 15pt bold title, 12pt muted
    source, 11pt metadata row with flame / beef / clock icons.
  - More-idea row: 40×40 `inputBg`-tinted icon-box on the left,
    13pt title + 11pt source·time middle, trailing kcal / P / C
    (kcal bolded, rest muted).
  - Import + My Library CTAs moved to the bottom of the scroll,
    under the "From your sources" heading.
  - Preserved: search, debounce, Eating-out row, clipboard-import
    focus detector, filter pills, refresh control, deep-links.

- **Web** (`src/app/components/DiscoverFeed.tsx`):
  - Replaced the 2-column grid with three sections matching mobile.
  - Hero cards use `<button type="button">` so they're keyboard
    navigable.
  - Section headings use the same `<h3 className="text-[14px]
    font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5">`
    token already in use on Profile / More.
  - Import + My Library CTAs moved to the bottom, under "From your
    sources". Same `view=` URL pushState trick for navigation.
  - Preserved: search, filters (quickFilter + advanced), hearts,
    collections, follow graph / feedScope, new-from-follows banner,
    deep-link open (`initialOpenRecipeId`), Eating-out row, empty /
    reset branches.

## Tests

New: `tests/unit/discoverThreeSectionLayout.test.ts` (19 tests, all
pass) pins:

- all three section headings on both platforms
- hero slice = `slice(0, 2)` on both platforms
- more-ideas slice = `slice(2)` on both platforms
- heading order: "From your sources" appears AFTER "More ideas"
- Import + My Library CTAs appear AFTER the "From your sources"
  heading (i.e. at the bottom, not the top)
- empty-state branch preserved (both platforms)
- F-11 no-score guard (no `{recipe.confidence}` / `{item.fit}` etc.)
- preserved behaviour: search filtering, Eating-out row, clipboard
  import detector.

Unchanged and still passing:
- `tests/unit/recipeCardNoScore.test.ts` (8 tests) — F-11 badge
  still absent.
- Web vitest: 177 files, 2132 tests.
- Mobile vitest: 53 files, 429 tests.

## Parity

| Surface | Web | Mobile | Intentional diff |
| --- | --- | --- | --- |
| "Matches your day" heading | 14px bold h3 | 14px bold Text | — |
| Hero cards | 2 full-width 16:10 | 2 full-width 16:10 | — |
| "More ideas" heading | 14px bold h3 | 14px bold Text | — |
| More-ideas list | single card, divider rows | single card, divider rows | — |
| "From your sources" position | bottom, under recipes | bottom, under recipes | — |
| Import + My Library CTAs | bottom | bottom | — |
| Empty state | "Nothing to show" + Reset | "No recipes yet" / search-miss | copy differs because each surface has historical copy; behaviour (skip sections 1+2, keep section 3) is identical |
| Fit-percent badge (prototype) | NOT rendered (F-11) | NOT rendered (F-11) | deliberate — F-11 killed it |

## Non-goals / follow-ups

- Real recipe imagery in the hero card. Today the hero renders the
  restaurant icon when `recipe.image` is absent (common for catalog
  seeds). Once the import pipeline starts caching hero thumbnails,
  both platforms will render them automatically via the existing
  `recipe.image` branch.
- A "synthesised macro-fit" score on hero cards. The brief permitted
  it as a fallback if `confidence` didn't exist; F-11 overrides that
  permission (testers rejected the score entirely). If a future
  decision reintroduces a fit signal, it must land via its own
  decision doc and update `tests/unit/recipeCardNoScore.test.ts`.
