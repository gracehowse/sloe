# Functional accent = Clay, not Damson — `brand_frost_secondary` retired

**Date:** 2026-06-08
**Status:** ⚠️ SUPERSEDED 2026-06-08 by [`2026-06-08-aubergine-accent-system.md`](./2026-06-08-aubergine-accent-system.md) — clay was reversed the same day to a single aubergine-violet `#5B3B6E` accent (Julienne-restraint review: clay sat in the crowded warm-orange recipe lane; aubergine is on-name and unowned). Clay now survives only as the carbs macro. The frost-retirement parts of this doc still hold; only the "clay = the accent" conclusion is reversed.
**Area:** Brand / design system
**Decider:** Grace (routed to `brand-manager` for the formal call)
**Supersedes:** the `brand_frost_secondary` frost-accent migration exploration (`docs/brand/2026-06-07-secondary-colour-exploration.md`, `docs/planning/frost-accent-ship-plan-2026-06-08.md`)

## Decision

**Clay `#C8794E` is the functional accent** across the in-app product chrome (web + mobile): primary CTAs, active tab indicator, the centre ＋ FAB, selected/segmented pills, fit chips, and text links.

**Plum / Damson / Frost stay the brand-identity layer only:**
- Plum `#3B2A4D` — wordmark / mark / ink tint.
- Damson `#6A4B7A` — scarce identity moments + its *named* data roles (win/streak/milestone, Pro identity, info family, dinner slot). Never promoted to "the accent."
- Frost `#C9C2D6` — the ownable "bloom" accent for identity flourishes; marketing/paywall hero + empty calorie-ring gradient.

The `brand_frost_secondary` flag — which dragged the brand-identity purple *into* the functional CTA layer app-wide — is **retired** (made clay-unconditional in code, not left flag-gated), per the "no migration feature flags / no temp solutions" governance rule.

## Why (condensed from the brand-manager review)

1. **Appetite axis.** This is a food app. Terracotta/clay is food-native (earthenware, crust, spice); purple has essentially no appetite association (skews beauty/wellness/wine). In the captures the damson FAB fought the food photography it was meant to frame.
2. **Positioning.** "Love food AND have goals" → permission, warm-coaching. Clay carries that warmth; damson at CTA scale reads clinical and pulls toward the diet-app pole the positioning escapes.
3. **Scarcity = ownability.** Purple (Frost/plum) is uncopied in the nutrition category *because it's scarce* — as wordmark + bloom. Spreading damson across every button spends the very scarcity that makes it ownable. Keep it scarce → keep it a signature.
4. **Contrast.** Clay already ships a worked AA ladder (`Accent.primary` / `primarySolid #A0552E` / `primarySoft`). Damson-as-functional-accent would need that rebuilt app-wide for a colour that loses on the above.

**Trade-off accepted:** the in-app look stays warm-and-familiar rather than visibly "rebranded" — but keeps appetite, positioning, the AA work, and the scarcity that makes plum/frost ownable.

## Token rule (encode, don't re-invent — this is `_design-system.md` §0.1)

| Element | Colour | Token |
|---|---|---|
| Primary CTA fill / active tab / ＋ FAB / selected pills / text links | **Clay** | `Accent.primary` `#C8794E` (text-on-clay: white on fill; clay-as-text: `primarySolid` `#A0552E`) |
| Fit chip ("Fits your day") | **Sage** (success semantic, not CTA) | `Accent.success` |
| Wordmark / mark | **Plum** | `#3B2A4D` |
| Marketing / paywall hero / empty calorie ring | **Damson→Sloe→Frost gradient** | brand gradient |
| Win / streak / milestone / Pro / info / dinner slot | **Damson** (named roles only) | `Accent.purple` `#6A4B7A` |
| Calorie ring under / over / empty | **sage / red / gradient** (locked ring rule — unchanged; NOT damson) | — |

> The Today calorie ring's plum state treatment (2026-06-03 Apple-Watch overage-wrap decision) is a **separate, deliberate** ring decision and is **not** affected by this — only the frost-*flag* wiring is removed.

## Implementation

Retired in code (clay unconditional) across web + mobile in the 2026-06-08 redesign build: `apps/mobile/context/theme.tsx` (accent always clay), `apps/mobile/constants/theme.ts` (`AccentFrost` removed), the three direct flag readers (`TrustChip`, `SearchResultConfidenceChip`, `WinMomentPlayer`), `DevFlagOverrides` (flag dropped), and web (`theme.css` `.flag-frost` cascade, `FrostFlagToggle`, `suppr/daily-ring.tsx`). Tests updated to assert clay.

## Follow-ups

- **Notion Decisions-log mirror** — pending (batched per the 2026-06-08 velocity decision; MCP mirror to add a row with this file's blob URL).
- **Linear** — close any open frost-migration issues; reference this decision.
- **PostHog** — set `brand_frost_secondary` rollout to 0% / archive (code already ignores it; this is housekeeping).
- Evidence: brand-manager review (session 2026-06-08), sweep captures `apps/mobile/screenshots/agent/sweep-2026-06-08/`.
