---
name: Full product & technical audit (Apr 2026)
description: Comprehensive audit of Suppr covering product strategy, code quality, UX, architecture, competitor benchmark, and prioritised roadmap
type: project
---

## Full Suppr Audit — 2026-04-10

### Rating: Promising prototype with strong product thinking, weak execution completeness

**Product thesis is sharp:** Macro trackers have bad food discovery; recipe apps don't close the loop to macro budgets. Suppr targets the gap: targets -> plan -> shop -> cook -> log in one place.

**Stage:** Late prototype / early MVP. Core loop is functional. Monetisation infrastructure exists. Social features are schema-ready but UI-thin. Roughly 60-70% toward a launchable beta.

---

### What's genuinely good
- Meal planner algorithm is non-trivial (combinatorial scoring, weighted macro deviations, seeded PRNG, repeat penalty)
- Multi-source nutrition data (USDA FDC, FatSecret, Open Food Facts, community barcode corrections)
- Stripe integration is end-to-end complete (checkout -> webhook -> tier update -> UI gating -> promo codes)
- Architecture mostly sound: JSONB for Phase 0, snapshot macros, local-first with debounced sync, RLS everywhere
- Documentation is unusually strong (product-roadmap.md, best-in-class-plan.md correctly sequenced)
- Real test coverage: 10 unit, 2 integration, E2E journeys with CI enforcement

### Critical weaknesses
1. **Content desert** — Only 4 hardcoded demo recipes. Existential risk — planner/discovery/suggestions are all starved
2. **No onboarding flow** — Hardcoded defaults (male/75kg/28yo), no goal capture, no guided first-run
3. **AppDataContext god object** — 1,543 lines managing all state, re-renders propagate everywhere
4. **No cook mode** — Loop breaks at "cook" (flagged in own docs as weakest hop)
5. **Premature platform sprawl** — Social, mobile, monetisation built before web loop is complete
6. **No image upload infrastructure** — Recipes default to Unsplash URLs

### Build drift from own roadmap
- Social features (notifications, follows, realtime) built before loop was complete
- Mobile (Expo) started before web was finished
- Stripe/monetisation built very early for a product with 4 recipes
- Content seeding, onboarding, and cook mode were skipped — the most critical foundations

### Top 5 highest-leverage improvements
1. Seed 200+ curated recipes (unblocks entire product thesis)
2. Build onboarding (3-5x activation impact)
3. Complete cook hop (closes the differentiating loop)
4. Split AppDataContext into domain contexts (unblocks velocity)
5. Server-render public recipe pages (SEO + social sharing = free distribution)

### Competitor positioning
- Wedge (plan-from-recipes-to-macros -> shop -> cook -> log) is genuinely underserved
- No current moat: 4 recipes, no network effect, no proprietary data, no distribution
- Must compete on workflow depth and content density — neither exists yet
- Direct competitors: MyFitnessPal, MacroFactor, Eat This Much, Mealime

### Recommended priority order
- **Next 2 weeks:** Seed 100+ recipes, build onboarding, add cook mode, fix shopping staleness
- **Next 30 days:** Split AppDataContext, image upload, server-rendered recipes, pricing page, PostHog dashboards
- **Next 90 days:** PWA/offline, mobile parity, smart suggestions v2, Apple Health, content pipeline
- **Do NOT yet:** Social features, AI explanations, creator analytics, advanced imports

**Why:** The gap between prototype and product-someone-pays-for is almost entirely about content density and first-run experience, not more features.
