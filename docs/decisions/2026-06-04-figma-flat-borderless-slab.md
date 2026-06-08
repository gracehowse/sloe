# Figma Today — flat borderless slab (not cardSoft lift)

- **Date:** 2026-06-04
- **Area:** Figma Sloe · Screens / 01 · Core app
- **Status:** Resolved (product choice)

## Decision

Grace chose the **middle** frame in the Today 3-way compare (staging @ x≈11200):

- **Not** the left “current” bordered cards (`308:2`).
- **Not** the right “10/10 · lift + air” variant (`659:2`) with `cardSoft` drop shadow.
- **Yes** the middle **flat borderless** slab: fill **`#F6F5F2`**, **no** grey `#E8E2EC` hairline on content cards, **no** resting-card drop shadow in Figma.

Separation from the white page is **tonal only** (fill vs `#FFFFFF`), not elevation.

## Figma canonical

| Role | Node | Treatment |
|------|------|-----------|
| **Ship in Core app** | `654:2` → `01 · Today` @ x=60 in `01 · Core app` | Flat `#F6F5F2`, borderless |
| Deprecated bordered | `308:2` | Compare only |
| Reference with lift | `659:2` | **Not** canonical — exploration only |

## Agent rules

1. Do **not** apply `cardSoft` / `DROP_SHADOW` (blur 14, 10% plum) to resting content cards in Figma for this direction.
2. Do **not** treat `659:2` as the SSOT for Today chrome.
3. Recipe nutrition strip = **one** flat slab with inset dividers, not four raised boxes.
4. FAB / modals may keep elevation; resting hero, macro tiles, meal rows, grid cards = **flat**.

## Rollout (2026-06-04)

Applied flat borderless pass to **all 77** frames on **Sloe · Screens** (every section) + **Sloe · Design System** components (Card, Macro Tile, Meal Row, Button, Tab Bar, Chip).

## Code / simulator

**Today only (2026-06-04):** mobile `lift="flat"` / `useTodayCardElevation()` and web `elevation="slab-flat"` / `.card-slab-flat` on Today surfaces. Other tabs keep soft lift (`cardSoft` / `.card-slab`). See `apps/mobile/tests/unit/todayFlatCardFigma.test.ts`.

### Below-hero holdouts brought onto the slab (2026-06-08)

Two below-hero Today cards had drifted off the flat slab and read inconsistent next to their siblings (Grace flagged):

- **`WeeklyCheckinBanner`** — the lone bordered card (hand-rolled `<View>` with a peach `${Accent.primary}08` fill + a clay `${Accent.primary}30` hairline + `Radius.lg`). Now a flat `<SupprCard lift="flat">` cream slab; the nudge accent rides the CONTENT (clay "WEEKLY CHECK-IN" eyebrow + clay "OPEN" button), not the card surface. Wired open/dismiss + `testID`s preserved. Mobile-only (web check-in is a dialog, not an in-feed card — confirmed).
- **`WeeklyInsightCard`** (and web `today-weekly-insight-mobile-card.tsx`) — the production Figma branch was a bordered card with an **ad-hoc cooler lilac** (mobile `rgba(237,234,241,0.4)` / web `--frost-mist`) that did **not** match the cross-screen insight wash. Now a flat `SupprCard` carrying the **canonical insight lilac** (mobile `tone="magenta"` ≈ Sloe damson 0.10; web `PROGRESS_INSIGHT_LILAC_STYLE` = `var(--slot-dinner-soft)`) — the same wash the Progress THIS WEEK card uses, so "insight = lilac" reads consistently across Today and Progress.

**Open founder choice (insight only):** Today's insight is now the cross-screen **lilac** (preserves the Today↔Progress insight rhyme). The alternative is **cream-neutral** like the rest of Today (one-line flip: `tone="magenta"` → `tone="neutral"` on mobile both branches; drop the `style` lilac on web both branches). Both options keep the borderless flat slab — only the fill differs. The structural invariant (flat `SupprCard`, no rogue border/rgba) is pinned by `todayFlatCardFigma.test.ts`; the tone is intentionally left flexible so the flip needs no test edit.
