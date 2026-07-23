# ENG-1667 — Deterministic placeholder identity (ENG-1374 layer 2)

**Date:** 2026-07-22  
**Status:** Shipping behind `recipe_placeholder_identity_v1` (default OFF)

## Decision

Layer 2 of the imagery epic freezes **per-recipe-ID** placeholder identity:

- Tint + pattern + category glyph come from shared `getRecipeFallback` /
  `resolveRecipePlaceholderIdentity` (`src/lib/recipe/recipeHeroFallback.ts`)
- Web and mobile renderers must both call that resolver (parity ratchet in
  `tests/unit/recipePlaceholderIdentity.test.ts`)
- Flag ON raises the category illustration scale on large no-image heroes
  (144px / 38cqmin vs ENG-1552's 112 / 30cqmin) when callers pass
  `variant="hero"`; thumbs stay at the ENG-1552 caps.

Layer 1 (never-white underlays) already shipped. **Layer 3** (AI-generated
heroes) stays on the AI image project — out of this ticket.

## Why not rebuild the resolver

The id→pattern hash (`djb2`) and cuisine→glyph mapping already existed.
Layer 2's job is to **lock product behaviour** (larger mark + parity
ratchet + named flag), not invent a second identity system.
