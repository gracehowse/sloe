# Build 12 (1.0.0 #12) — 2026-05-01

## New

- **Discover — 50-recipe seed across 5 cuisine clusters (Wave 4).**
  Discover now ships with a curated set of 50 recipes spanning five
  cuisine clusters: Mediterranean (10), Asian (10), Latin (8),
  Comfort (10) and Healthy bowls (12). Each cluster renders as a
  horizontal carousel with a header above (Mediterranean → Asian →
  Latin → Comfort → Healthy bowls) so the tab feels alive at the
  solo-tester stage. Carousels show on the unfiltered default view;
  any active search / filter falls back to the legacy flat layout
  so cluster grouping never fights an active query. Tap any seed
  card to open the same Recipe Detail flow as a community upload —
  ingredients and steps render verbatim from the seed, while logging
  still funnels through the standard ingredient-matching pipeline so
  per-meal nutrition is never invented. Mobile + web
  (`src/lib/recipes/seedRecipesV2.ts`,
  `src/app/components/DiscoverFeed.tsx`,
  `apps/mobile/app/(tabs)/discover.tsx`). Closes the Recime parity
  caveat from the competitor audit.
