# Figma ↔ iOS Simulator visual diff (agents)

Compare **Figma** Sloe Today frames against the **booted simulator** without manual screenshot drag-and-drop.

**Figma file:** https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/  
**Page:** Sloe · Screens → section **01 · Core app**

## Design pipeline (Stitch → Figma → sim)

Grace designs in **Google Stitch**, exports HTML to `docs/prototypes/stitch-sloe/` (built via `_gen.mjs`, `_buildtoday.mjs`, `_buildtoday-sections.mjs`), promotes frames into the Figma file above, and ships on iOS. Agents should treat **Figma as the documentation house** after Grace syncs; **the simulator as ground truth** for what users see; **committed Stitch HTML** as the export snapshot (may lag Figma — see audit doc).

Full map, workflow, and conflict rules: **`docs/ux/redesign/design-sources-stitch-figma.md`**. Known Stitch ↔ Figma drift (clay week pill, Fibre/Fiber, superseded chip notes): **`docs/testing/figma-today-consistency-audit.md`**.

## Figma frame map (Today)

| Frame | Node ID | Stitch HTML | App surface |
|-------|---------|-------------|-------------|
| **01 · Today (canonical)** | [`654:2`](https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/?node-id=654-2) — **01 · Core app** row **x=60, y=140** | `docs/prototypes/stitch-sloe/today.html` | **Flat** borderless `#F6F5F2` (no hairline, **no** resting shadow). **`659:2`** = lift exploration only, not canonical. **`308:2`** = bordered compare. See `docs/decisions/2026-06-04-figma-flat-borderless-slab.md`. |
| **TD1 · Activity & energy** | `459:2` | `today-activity.html` | `TodayActivityCard`, `TodayActivityBonusCard` (below fold) |
| **TD2 · Hydration & stimulants** | `463:2` | `today-hydration.html` | `HydrationStimulantsCard` |
| **TD3 · Weekly insight & planned** | `480:2` | `today-insight.html` | `WeeklyInsightCard` + planned block — **structural spec** for insight card |
| **TD4 · Meal log** | `481:2` | `today-meallog.html` | `TodayMealsSection` per-slot cards |

Sibling TD frames sit on the **same row** in Figma as `308:2`; together they describe the full Today scroll. Activity and hydration are **not** missing from design — they live in TD1/TD2, not inside `308:2`.

## App scroll order (simulator)

Top → bottom on `apps/mobile/app/(tabs)/index.tsx` (day view):

1. Sloe wordmark + avatar  
2. Centred greeting (Newsreader) + date subline  
3. Week strip (`TodayDateHeader` stripOnly)  
4. Hero ring + macro tiles  
5. Meals (`TodayMealsSection`)  
6. Weekly insight (`WeeklyInsightCard`)  
7. Below-meals prompts (check-in, **north star**, snap, nudge — max 2)  
8. Planned meals  
9. Activity TD1 cards  
10. Hydration TD2 card  

**Compare TD1/TD2** by scrolling the sim to the bottom and opening Figma `459:2` / `463:2` — not by expecting those blocks inside `308:2`.

## Prerequisites

| Tool | Check |
|------|--------|
| **ios-simulator MCP** | Green in Cursor MCP; `npm run agent:verify-tools` |
| **Figma MCP** | **Figma plugin** enabled + signed in — server `plugin-figma-figma` after auth |
| Metro | `npm run mobile:dev` when testing live data |
| Dev client | `npm run mobile:ios:simulator` after native changes |

## Enable Figma MCP in Cursor

1. **Cursor → Settings → MCP**
2. Enable **Figma** (official plugin). Complete sign-in when prompted.
3. **Restart Cursor**
4. Agent may need `mcp_auth` on `plugin-figma-figma` once — approve in browser if asked

Until Figma MCP is connected, fall back to Stitch HTML with **lower confidence** on spacing/tokens.

## Agent workflow (full Today)

1. **Figma** — Capture `308:2` for hero; capture `459:2`, `463:2`, `480:2`, `481:2` for lower sections (or Stitch HTML equivalents).
2. **Simulator** — `get_booted_sim_id` → `launch_app` `com.supprclub.supprapp` (`terminate_running: true` after layout/font changes) → `openurl` `suppr:///(tabs)` → screenshot hero → **scroll** and screenshot meals, weekly insight, activity, hydration.
3. **Read both** — Table: *Element | Figma frame | Sim | P0/P1/P2*.
4. Cross-check `docs/ux/redesign/today-ios-dossier.md` and plan `today_figma_diff_assessment_38fa03a5.plan.md`.

## Resting card chrome (2026-06-04)

**Figma (canonical Today):** flat borderless slab — fill **`#F6F5F2`**, no `#E8E2EC` hairline on content cards, **no** resting drop shadow (`654:2`). Middle compare variant in staging, not `659:2` lift.

**Shipped Today (aligned 2026-06-04):** `lift="flat"` / `useTodayCardElevation()` (mobile), `elevation="slab-flat"` / `.card-slab-flat` (web). Other tabs still use soft lift (`cardSoft` / `.card-slab`).

| Layer | Figma `654:2` | Web / mobile (today) |
|-------|---------------|----------------------|
| Fill | `#F6F5F2` | `--card` / `colors.card` |
| Border on content cards | none | none (light) |
| Shadow on resting cards | **none** | **none** (flat slab) |

When diffing non-Today surfaces, do not “fix” Figma toward sim lift without an explicit product call.

## Conformed to canonical `654:2` (2026-06-08)

These four Today gaps were closed to match the canonical frame `654:2` (web + mobile). They are NO LONGER drift — the app matches the frame:

| Topic | Figma `654:2` | Shipped (web + mobile) | Record |
|-------|---------------|------------------------|--------|
| Wordmark | "Sloe" (capital S, Newsreader semibold, plum, `text-xl` ≈ 20px) | "Sloe" semibold plum | `suppr-mark.tsx`, `SloeHeaderWordmark.tsx`, `SupprMark.tsx`; `supprMark`/`brandMark` tests |
| Week strip labels | Single letters `S M T W T F S` (no 3-letter abbrevs) | Single letters via shared `weekdayInitials` | `src/lib/today/weekdayLabels.ts`; `weekdayLabels.test.ts` |
| Week strip dot | Conditional pip — sage (logged), clay (current/selected), transparent (none) | Same (shared `dayStripIndicator`) | `dayStripIndicator.ts`; daystrip indicator tests |
| Adaptive-TDEE line | Not present (nothing between Goal/Eaten/Bonus and the "Room for dinner" coach line) | Removed from Today hero (learning state lives on Progress; logic preserved) | `today-hero-stats.tsx`, `TodayHero.tsx`; `todayStatusPills` tests |

## Intentional vs Figma frame drift (do not file as bugs)

| Topic | Figma `308:2` (or mock) | Shipped sim | Record |
|-------|-------------------------|-------------|--------|
| Week strip selected day | Filled **clay pill** (deprecated `308:2`) | **Minimal** clay number + conditional dot, no fill (matches `654:2`) | `docs/decisions/2026-06-03-today-week-strip-minimal-current-day.md` |
| Status chip | Under / Over budget | Same (`todayStatusChip`) | `docs/decisions/2026-06-04-today-status-chip-budget-labels.md` |
| Overage ring arc | Red / hash (older mock) | Plum second lap | `CalorieRing.tsx`, `calorieRingOverageArc.test.tsx` |
| FAB / active tab | Varies in old mocks | Plum FAB, clay active tab | `docs/decisions/2026-06-04-plum-nav-clay-content-cta-split.md` |
| TD3 weekly insight prose | One warm marketing sentence | Data-honest headline + stats + bar | Optional P3 copy tune only — **not** layout rebuild |
| Greeting on past days | Figma composite often “today” only | Date-forward headline + subline when Yesterday | `todayPastDayGreetingLines` |

When comparing, tap **days with sage dots** (logged), **scroll** the full stack. Avoid tapping macro tiles (opens macro detail).

**Agent captures:** `apps/mobile/screenshots/agent/` — e.g. `figma-01-today.png`, `today-mon-1-hero.png`, `today-mon-1-scrolled-meals.png`.

## S5 · Today empty — screenshot wall (ENG-889)

**Figma frame:** [`360:2`](https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/?node-id=360-2) (S5 · Today empty) · Stitch: `docs/prototypes/stitch-sloe/today-empty.html`

**Preconditions:** signed-in user; **today's journal empty** (`consumed === 0`); `today_tracker_tier_v1` ON (default-on).

| # | Capture | Pass criteria |
|---|---------|---------------|
| 1 | Hero — status chip | **Fresh start** label + sparkles; **no fill** behind chip (plum text only) |
| 2 | Hero — ring centre | **LEFT** (or 0 consumed) with full goal visible; gradient ring on empty day (ENG-1086) |
| 3 | Hero — stat row | **Goal / Eaten / Bonus** with honest zeros (not hidden) |
| 4 | Under-ring coach | Food-forward cold-open line (`Fresh start — what's for…`) via `todayRoomForMeal` |
| 5 | Macro tiles | Tertiary **0 / target** values; no progress bars when tier-v1 ON |
| 6 | Meal slots | Empty slots at full opacity with aim line (calm mode) |
| 7 | Web parity | Repeat 1–4 on `http://localhost:3000` tracker at ~390px + desktop |

**Intentional drift (do not file):** Stitch S5 still shows filled `bg-frost-mist` chip and "A blank canvas…" coach copy — product uses de-tinted chip + ENG-939 food-forward coach. Week-strip sage dots on past days alongside Fresh start is correct (today-only diary).

## Paywall + upgrade dialog — screenshot wall (ENG-901, #476)

**Figma frame:** [`284:2`](https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/?node-id=284-2) · Stitch: `docs/prototypes/stitch-sloe/paywall.html`

| # | Surface | Deep link / route | Pass criteria |
|---|---------|-------------------|---------------|
| 1 | Mobile paywall trust row | `suppr:///paywall` | Inline row: secure checkout + cancel anytime (`PaywallTrustStrip`, `paywall_trust_inline_v1` default-on) |
| 2 | Web pricing trust row | `/pricing` | Same inline strip; legacy post-tier row hidden when flag on (`PricingLegacyTrustSignals`) |
| 3 | Web upgrade dialog | Pro-gated Today action → dialog | Sloe photo hero + trust strip in footer (`paywall_upgrade_dialog_sloe_v1`, web-only) |

## Today coach-in-hero — screenshot wall (ENG-889, #476)

**Flag:** `today_coach_in_hero_v1` (default-on)

| # | Capture | Pass criteria |
|---|---------|---------------|
| 1 | Populated Today hero (~390px web + iOS) | Coach/deficit line renders **inside** hero card below Goal/Eaten/Bonus — not duplicated in below-meals context block |
| 2 | Empty Today (S5) | Fresh start chip + food-forward coach; coach-in-hero path still honest on zero consumed |

**Agent captures:** `apps/mobile/screenshots/agent/paywall-trust-*.png`, `screenshots/web-drive/pricing-trust-*.png`, `today-coach-in-hero-*.png`

## L5 · Today dark — screenshot wall (ENG-889)

**Figma frame:** [`314:2`](https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/?node-id=314-2) (L5 · Today dark) · Stitch: `docs/prototypes/stitch-sloe/today-dark.html`

**Preconditions:** sim system appearance **dark** (`xcrun simctl ui booted appearance dark`); AsyncStorage `suppr_theme` = `auto` or `dark` (not `light` — see `apps/mobile/scripts/run-dark-sweep.sh`); relaunch app after manifest change.

| # | Capture | Pass criteria |
|---|---------|---------------|
| 1 | Canvas | Page ground **`#19181C`** (plum-charcoal), not white/light import |
| 2 | Hero card | Elevated slab **`#2A2730`**, ring + Goal/Eaten/Bonus readable on dark |
| 3 | Macro tiles | Dark card fill (same family as hero), not light `#F6F5F2` import |
| 4 | TD3 / TD4 scroll | Weekly insight + meal slots on dark cards below fold |
| 5 | Week strip | Minimal clay number + dot (no filled pill) — same as light `654:2` |

**Verified 2026-06-18:** iOS sim populated Today (Grace) — pass on 1–5. Figma `314:2` shows under-budget demo data; sim over-budget state is content drift only.

**Agent captures:** `apps/mobile/screenshots/agent/eng889-l5-today-dark.png`, `eng889-l5-today-dark-scrolled.png`

## Prompt template

```
Compare Figma file B3UdOFup7ITersgNuoXh0l Today: frame 308:2 (hero) plus TD1 459:2, TD2 463:2, TD3 480:2, TD4 481:2
to the booted iOS simulator on Today (scroll full page).
Use Figma MCP + ios-simulator MCP. Return a discrepancy table with severity.
Respect intentional drift in docs/testing/figma-vs-simulator.md.
```

## HTML fallback

`docs/prototypes/stitch-sloe/today.html` (+ `today-activity.html`, etc.) — built by `_buildtoday-sections.mjs`.

## Related

- `sitemap.md`
- `docs/testing/agent-eyes-and-hands.md`
- `docs/ux/redesign/design-sources-stitch-figma.md`
- `docs/testing/figma-today-consistency-audit.md`
- `docs/ux/redesign/today-ios-dossier.md`
- `.cursor/plans/today_figma_diff_assessment_38fa03a5.plan.md`
