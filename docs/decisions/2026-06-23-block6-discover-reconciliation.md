# Sloe v3 Block 6 — Discover editorial reconciliation (2026-06-23)

**Status:** Resolved (decisions made under autonomous-execution authority; the one
north-star-touching call — the editorial hero — is logged for Grace below).
**Area:** Redesign / Discover surface.
**Issue:** ENG-1225 (Sloe v3 reskin), Block 6.
**Grounded by:** a 3-mapper + product-lead-synthesis workflow (run `wf_163d1789-db7`)
reading the prototype (`docs/ux/redesign/v3/Sloe-App.html`) against the live
`apps/mobile/app/(tabs)/discover.tsx` (1160) and `src/app/components/DiscoverFeed.tsx` (1152).

## The core finding

The prototype's Discover is **divergent across platforms, not a parity mirror**:
- **Mobile** (`Cook()` scope=discover, L4197-4280): creator rail · cuisine selector + carousel · "What to cook tonight" disc-cards · Following feed · Eating out. **No editorial hero, no quick-weeknight** (those are Cookbook shelves on mobile).
- **Web** (`WebDiscover()`, L7527+): page head · search · filters · creator rail · **editorial hero** (`.w-feat`, a **2-col panel** — NOT a 16:10 overlay) · fresh-from-creators grid · **collections** (a **4-col grid** — NOT a carousel) · **quick weeknight**.

So the execution plan's 5-component list is a web↔mobile *synthesis*; three components have a prototype source on only one platform. Two execution-plan framings were wrong against the prototype and are corrected here (hero = 2-col panel; collections = grid).

## Decisions (per component)

| Component | Decision | Why |
|---|---|---|
| **DiscoverQuickWeeknight** | **BUILD** (mobile → web) behind `sloe_v3_discover_editorial` | Genuinely additive, fully unblocked: deterministic filter (quick ≤30 min, has kcal, not imported), clear no-photo tint-card shape. Web 3-col→2-col ≤1080px; mobile 2-col. |
| **DiscoverCollections** | **BUILD partial** (web grid → mobile scroll) behind the flag | Additive. Data source = **deep-link into existing category pills** (recommendation (c)) — no new table, no empty-at-launch, reuses taxonomy users know. Build the tiles that map cleanly: **High-protein dinners → `high-protein`**, **Under 20 minutes → `quick` (Quick 30)**; counts = live filtered length. "Batch & freeze" / "Bright & fresh" have no existing predicate → **cut for v1** (revisit if Grace wants new predicates). New module `src/lib/discover/curatedCollections.ts` — do **NOT** edit `collections.ts` (that's localStorage user-created lists, a different concept). |
| **DiscoverEditorialHero** | **KEEP LIVE — do not build** | The live "Matches your day" hero is **personalised to remaining macros** (the north-star "what to eat next" surface, `project_keep_today_centre_premium_frame`). The prototype's "Trending this week" editorial hero is generic + **has no data pre-launch** (`creators` empty, `top_creators_by_saves` = []). Replacing the personalised hero with a hollow editorial one is a north-star downgrade. Per `feedback_prototype_mix_and_match`: keep live where stronger. **(Logged for Grace — see below.)** |
| **DiscoverCuisineSelector** | **NO BUILD — keep live** | The live cuisine **cluster carousels** (`DiscoverClusterCarousels`, real `SEED_CLUSTERS` data) beat the prototype's **UI-only** chip row (the brief literally says "UI-only — does NOT filter"). Building a non-functional selector is the UI-without-logic anti-pattern. |
| **DiscoverFollowingSection** | **DEFER** to the creator-platform window | Zero data pre-launch (empty follow graph). The live Following **filter** (a feed-scope pill) degrades gracefully; an empty social-feed *section* would ship a dead surface. The MFP-refugee thesis is tracking + import, not a social graph. Tracked as a follow-up (creator platform / Surface polish), not a launch-blocker. If ever built: conditional on `followSet.size > 0` (self-hiding, like CreatorRail). |

Net: of the 5 specced components, **2 build** (QuickWeeknight, Collections-partial), **2 keep-live** (Hero, Cuisine), **1 defers** (Following). Block 6 collapses from ~7 days to a focused ~2-component build.

## Build plan (mobile-first)

1. **Pre-work — shrink `discover.tsx` (1160, pinned) before adding sections.** Extract `renderHeroCard` (L422-558), `renderMoreIdeaRow` (L573-637), and the eating-out block (L818-878) into `apps/mobile/components/discover/` so the host net-shrinks; re-pin lower. (Or, like Block 5, use self-gating wrapper components + comment-offset to avoid the delicate `renderHeroCard` extraction — chosen at build time by which is lower-risk.)
2. **DiscoverQuickWeeknight** — shared filter helper + mobile component + tests → sim SEE → web parity → Storybook SEE.
3. **DiscoverCollections** — `curatedCollections.ts` (2 tiles → category-pill deep-links) + web grid + mobile scroll + tests → SEE both.
4. Flag: `sloe_v3_discover_editorial` gates QuickWeeknight + Collections (the editorial hero `else`-branch is moot since we keep live). Cuisine + Following: no flag.

## For Grace (the one north-star call)

I **kept the live personalised "Matches your day" hero** rather than replacing it with the prototype's "Trending this week" editorial hero, because the latter is generic and has no data pre-launch, and the personalised hero is the north-star "what to eat next" moment. If you want the editorial hero, the right version sources its featured pick from `displayFiltered[0]` (day-fit-ranked, so it stays personalised AND populated) rather than a hardcoded/empty "trending" query — flag it and I'll build that variant.

## Refs
Prototype: `Sloe-App.html` L4213-4261 (mobile) + L7546-7576 (web), CSS L2442-2460 + L2534-2538. Live: `discover.tsx`, `DiscoverFeed.tsx`. Shared: `src/lib/recipes/recipeCategoryFilters.ts` (category pills), new `src/lib/discover/curatedCollections.ts`.
