# Color direction — Noom / Lifesum / organic reference (2026-05)

**Status:** Applied to canonical tokens (`theme.css`, `apps/mobile/constants/theme.ts`, `docs/ux/brand-tokens.md`) on 2026-05-19.

**Goal:** Bright, natural greens and golden-oranges that feel editorial and premium — not neon “fitness app” or tacky primary-saturated UI. Primary brand **stays blue** (`#4c6ce0`); only semantic wellness hues and the page backdrop shift.

## Reference mapping

| Inspiration | What we borrow | What we do *not* copy |
|-------------|----------------|------------------------|
| **Noom** | Soft leaf green for “good” food lanes; muted terracotta/coral for accents; serif headings on editorial surfaces | Full rebrand to Noom green primary; traffic-light copy |
| **Lifesum** | Warm cream page background; airy cards; lifted success green on gauges | Lifesum wordmark green as `--primary` |
| **Abstract triptych** | Sage-adjacent green, golden-orange arcs, off-white/cream ground | Decorative line art in product chrome |

## Canonical hex (light / dark)

| Role | Light | Dark | Notes |
|------|-------|------|-------|
| **Success** | `#62b35a` | `#82d878` | Leaf green — calories, lunch slot, USDA dot, confidence-high |
| **Warning** | `#e0a838` | `#f0c058` | Golden amber — over-budget, breakfast slot, activity bonus |
| **Carbs macro** | `#df7a4e` | `#f0956e` | Soft terracotta — distinct from warning amber |
| **Background** | `#f6f3ee` | `#101014` | Warm cream (light); dark unchanged |
| **Primary** | `#4c6ce0` | `#7a90f5` | Brand blue unchanged (light); lifted periwinkle in dark |

### Previous → new (light)

| Token | Was | Now |
|-------|-----|-----|
| `--success` | `#22a860` | `#62b35a` |
| `--warning` | `#e8a020` | `#e0a838` |
| `--macro-carbs` | `#ed6b2a` | `#df7a4e` |
| `--background` | `#f4f5f7` | `#f6f3ee` |

## Application rules

1. **Over-budget = warning amber only** — never destructive red on calorie ring or macro tiles.
2. **Carbs macro ≠ warning** — warm orange track for carbs; amber reserved for “over” semantics.
3. **Surfaces:** cream `--background` + white `--card` separation (Lifesum-style depth without heavy shadow).
4. **Typography (future):** editorial serif for section titles on recipe/detail flows only; Today stays sans for scan speed.
5. **Do not** raise saturation on `--primary` (light) or slot dinner blue to “match” the warmer palette — elevation is via warm greys, blue-tinted surfaces, and `#7a90f5` dark tint only.

## Grey + blue elevation (2026-05-19)

Warm **stone greys** replace cool slate on cream (`#ddd5c8` borders, `#5e574e` secondary text, `#8c8378` tertiary). **Blue** elevation: `#d8dff2` ring track, stronger `--macro-protein-soft` / north-star tints, `#7a90f5` dark primary light. Canonical source: `theme.css` + `apps/mobile/constants/theme.ts`.

## Verification

- `tests/unit/settingsMacroTokens.test.ts` — web macro hex ↔ `theme.css`
- `apps/mobile/tests/unit/slotColorTokensParity.test.ts` — slot ↔ semantic tokens
- `apps/mobile/tests/unit/designTokensPhase1.test.ts` — mobile `Colors.*` source/over-budget pins
- Side-by-side: Today light mode on sim vs `docs/audits/.../today-first-render.html` prototype

## Out of scope (this pass)

- Email templates (`supabase/templates/*`) still use legacy `#f4f5f7` — update in a dedicated email parity PR.
- Claude design bundle CSS (`docs/ux/claude-design-bundles/`) — reference only unless syncing bundles.
- Global serif heading rollout — product decision, not token-only.
