# Seamless recipe card — kill the double-frame, full-bleed image, soft-lift slab

- **Date:** 2026-06-07
- **Area:** Design system / Recipes (Discover + Library), web + mobile
- **Status:** Resolved
- **Trigger:** Grace (founder): the recipe tiles in Discover ("Recipe ideas" /
  "What others are saving") and Library read as a **boxy double-frame** — a card,
  then a smaller framed image sitting inside it, then the meta. "Make the food
  image seamless — full-bleed within the card, like Julienne's clean cards."

## Problem

Two distinct renderings of the same root issue, confirmed by reading on-device
captures (iOS sim) + the Sloe Figma (`527:2` Cookbook, `528:2` Discover):

1. **Mobile Discover hero card** drew an explicit `borderWidth: 1` +
   `borderColor: cardBorder` at a tight 14px radius. The hairline border framed
   the whole card, and with the full-bleed photo flush to the top this read as
   "a box around the photo, then a card" — the literal double-frame.
2. **Mobile + web Library cards** used the **flat** card elevation (no shadow,
   no border) on a `#F6F5F2` cream fill that sits only ~10 luminance below the
   `#FFFFFF` page. The card barely separated from the page, so the only visible
   rectangle was the **photo** — it read as a floating photo-box, not a unified
   card. Tight 8px (mobile) / 16px (web `rounded-2xl`) corners reinforced the
   boxy feel.

The Figma "What others are saving" / "Recipes in action" cards are the opposite:
a single `#F6F5F2` slab, **20–24px** corners, image full-bleed to the top
corners, title + creator + meta on the cream body below — **one cohesive piece**,
separated from the page by a soft lift, not a border.

## Decision

Reskin the Discover + Library recipe cards to the seamless Sloe slab. **Structure
only — no functionality removed, photography style unchanged.**

1. **Image full-bleed within the card.** Already structurally true (image is the
   first child, no inner padding); preserved. The card clips it with
   `overflow: 'hidden'` so the top corners follow the card radius.
2. **24px corner** — the canonical Sloe warm-slab corner already shared by the
   Today tiles (`var(--radius-card-lg)` on web, `CARD_RADIUS`/`TILE_RADIUS = 24`
   on mobile). The Figma cards sit at 20–24; 24 keeps every cream slab in the app
   on one corner language rather than introducing a one-off 20. Local
   `RECIPE_CARD_RADIUS = 24` const on mobile (the DS `Radius` ladder tops out at
   `xl` = 12); `radius="lg"` on the web `SupprCard`.
3. **Soft lift, no border.** Switch these cards from the flat elevation to the
   **soft** variant — the tuned plum drop shadow (`Elevation.cardSoft` /
   `--elev-card-soft` = `0 6px 18px rgba(34,27,38,0.16)`) lifts the cream card off
   the white page and **carries the separation instead of a border**. The 1px
   border is dropped (it was the "double-frame" edge; Grace earlier rejected the
   1pt border as "too heavy" — see
   [2026-06-04 card soft-lift](./2026-06-04-card-soft-lift-default-and-ios-shadow-clip-fix.md)).
   Web `elevation="card"` and mobile `Elevation.cardSoft` are the **same** shadow
   token (web `--elev-card-soft` == mobile `cardSoft`), so the two platforms match.
4. **iOS shadow-clip guard.** The shadow rides an **outer wrapper** View on the
   mobile Discover hero card + "More ideas" slab (the inner Pressable clips its
   children with `overflow: 'hidden'`, and iOS clips a view's own shadow under
   that). Library already had the `cardShadowWrap` outer-wrapper pattern.

### Explicitly NOT done (defended)

- **No change to photography.** Sloe keeps its own moody, side-lit, prop-rich
  editorial register (Template A). This change adopts Julienne's *seamless card
  structure* only — **never** their overhead-round-plate-on-cream signature (see
  [Julienne image system §5.1](../research/2026-06-07-julienne-image-system.md)).
- **No functionality removed.** Bookmark/save toggle, kcal pill, fit% pill,
  entry-kind/draft badges, overflow menu, tap-to-open, creator attribution, macro
  row — all preserved; reskin only.

## Files

- `apps/mobile/app/(tabs)/library.tsx` — `RECIPE_CARD_RADIUS = 24`;
  `useCardElevation({ variant: "soft" })`; card + shadow-wrap radius → 24.
- `apps/mobile/app/(tabs)/discover.tsx` — `RECIPE_CARD_RADIUS = 24`; hero card
  border removed, wrapped in an outer soft-shadow View, radius → 24; "More ideas"
  list slab same treatment.
- `src/app/components/Library.tsx` — desktop + mobile-web `SupprCard` →
  `radius="lg" elevation="card"`.
- `src/app/components/DiscoverFeed.tsx` — the three recipe cards (cluster
  carousel, desktop grid, mobile feed) `rounded-2xl` → `rounded-3xl` (24px).

## Verification

- iOS sim (primary surface): Library + Discover captured before/after and read —
  cards now lift off the page as one cohesive cream slab, full-bleed image, 24px
  corners, no border / no double-frame. Corner+shadow crops confirm the soft plum
  lift renders un-clipped on-device.
- Web (mobile viewport): `/library` + `/discover` captured via `web-drive` —
  identical seamless treatment; same shadow token as mobile.
- Typecheck: web + mobile clean for the touched files (pre-existing unrelated
  `login.tsx` error is not in scope).
- Captures: `/tmp/cards/ios-{library,discover}-{before,after}.png`,
  `/tmp/cards/web-{library,discover}-after.png`.
