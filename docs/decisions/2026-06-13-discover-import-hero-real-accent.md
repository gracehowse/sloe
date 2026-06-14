# Discover import hero → confident lavender-plum accent (ENG-1094)

**Date:** 2026-06-13
**Area:** Discover / Recipes tab — import-from-Reel hero (web + mobile)
**Status:** Resolved
**Flag:** `discover_import_hero_v1` (unchanged — gates hero vs legacy nav row; this refines the hero's fill within the on-path, kill switch = legacy nav row).

## Context

Grace's 2026-06-13 review flagged the Discover import-from-Reel card (the ENG-1087 hero) as "the lone tinted slab" that "reads as grey." Its fill was `primarySoftStrong` — a flat ~20% **dark**-plum (#5B3B6E) over the cream ground, which desaturates to a muddy grey-lavender. After the flat-white card sweep (ENG-1081), it was the only tinted card on Discover and read as a weak wash rather than a deliberate accent.

Grace's call (the ENG-1094 A/B): **"keep it a hero but a real accent, since it's a permanent conversion surface."** (Option B.) The import card is the viral-hook conversion wedge on the discovery surface, so it *earns* a confident accent — but it must read as an intentional accent, not grey.

## Decision

Replace the muddy `primarySoftStrong` fill with a **confident lavender-plum accent** — the *lighter* brand plum (#7E5C92, the AccentWinGradient "lift" stop) at a higher opacity (0.30). The lighter hue at higher opacity reads clearly as a deliberate lavender-plum accent (more chroma, less grey) while staying text-safe (the plum `navPrimary` headline + grey subcopy remain legible). The hero's solid-plum icon circle + "Paste link" pill + serif headline are unchanged.

New token `importHeroBg` (mobile `colors.importHeroBg`) / `--import-hero-bg` (web), light + dark.

### Why flat, not a gradient

A brand gradient was the first instinct (more premium), but: the project deliberately has **no `expo-linear-gradient`** dep (NorthStarBlock uses `react-native-svg` for gradients), so a mobile gradient card bg needs an SVG-layer wrapper — overkill for one card, and an array-valued color token broke the all-strings `Colors` type (cascaded into themed-text/view). The Sloe **win-gradient is reserved for celebrations**, and North Star's gradient is far subtler (0.08). A confident flat accent is the clean, parity-safe (mobile flat == web flat), text-safe answer that delivers "a real accent."

## Files

- `apps/mobile/app/(tabs)/discover.tsx` — hero `backgroundColor: colors.importHeroBg`
- `apps/mobile/constants/theme.ts` — `importHeroBg` (light + dark)
- `src/app/components/DiscoverFeed.tsx` — hero `background: var(--import-hero-bg)`
- `src/styles/theme.css` — `--import-hero-bg` (light + dark)
- Tests: `tests/unit/discoverThreeSectionLayout.test.ts` (hero-treatment assertions updated)

## Verified (SEE)

- **Web** (`/discover --auth`): the hero renders as a clear lavender-plum card (computed `rgba(126,92,146,0.3)`), distinct from the white recipe cards + chip row — reads as a deliberate accent, not grey.
- **iOS sim** (Recipes → Discover): pixel-parity — same confident lavender-plum hero with the solid plum icon + "Paste link" pill.
- Both typechecks + lints clean; discover layout suite (28) green.

## Surface-treatment family (the lens, for future import surfaces)
- **Discover import card** = permanent conversion affordance → confident accent (this).
- **Today import nudge** (ENG-1097) = transient dismissible nudge → quiet flat-white.
Treatment follows the surface's permanence/role.

## Related
- ENG-1087 — the import hero affordance (this refines its fill).
- ENG-1097 — the Today import nudge (the contrasting transient surface).
- ENG-1081 — flat-white card sweep (what made the muddy tint the lone outlier).
