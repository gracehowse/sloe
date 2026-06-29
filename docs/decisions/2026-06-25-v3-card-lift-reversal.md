# Sloe v3 card-lift reversal — page-ground cards float again

- **Date:** 2026-06-25
- **Area:** Design system / elevation (web + mobile)
- **Status:** Resolved
- **Supersedes:** [`2026-06-12-flat-card-surfaces.md`](./2026-06-12-flat-card-surfaces.md)
- **Linear:** ENG-1222 (P2), ENG-1247 (v3 prototype conformance)

## Decision

Page-ground resting cards **lift** off the white in-product ground on a soft
ambient shadow, reversing the 2026-06-12 "flat-card surfaces" (Withings/Notion
flat-slab) decision. A flat white card on a white page is invisible — **the lift
is the separation**. This matches the canonical v3 prototype
(`docs/ux/redesign/v3/Sloe-App.html`), whose cards float on white via
`--shadow-card`.

Trigger (Grace, 2026-06-25, during the v3 tab-conformance pass):

> "visually all of the tabs dont look like the prototype … simple things like
> the cards not being raised as in the prototype too."

## What was actually wrong

The v3 surface tokens (white ground, `Elevation.cardSoft`, web `--elev-card-soft`
as the layered `--shadow-card`) had already landed (2026-06-21, P0). But the
**mobile** `useCardElevation` hook still returned `shadowStyle: undefined` for
`variant: "soft"` in light mode — a leftover no-op from the 2026-06-12 flat
decision, explicitly parked for "P2". So **~39 mobile surfaces that already opt
into `soft` rendered flat anyway**. Web's `.card-slab*` utilities had already
been reverted to apply the shadow, so web was lifted while **mobile (the primary
iOS surface) was the lone laggard** — which is exactly what Grace saw.

## Change

- **Mobile** (`apps/mobile/hooks/useCardElevation.ts`): `variant: "soft"` in
  LIGHT now returns `Elevation.cardSoft` (was `undefined`). Dark keeps the tonal
  `cardElevated` fill (RN renders dark drop shadows poorly — accepted platform
  deviation from web's dark `--elev-card-soft`).
- **Web** (`src/styles/theme.css`, already done 2026-06-21): `.card-slab` /
  `.card-slab-flat` apply `box-shadow: var(--elev-card-soft)` — the three-layer
  Sloe-Deep `--shadow-card`. RN cannot render layered shadows, so mobile keeps a
  single-shadow equivalent (`0.16 / 18px / y+6`, plum ink). Same intent,
  platform-appropriate form.

## Scope / exceptions (matches the prototype, not a blanket flip)

- **`size="card"` page-ground cards** → soft lift (the ~39 surfaces that already
  pass `lift="soft"` / `variant:"soft"`).
- **Macro tiles (`size="tile"`)** → stay flat; the prototype `.macro-tile` is a
  recessed `--bg-secondary` slab + border, not a floating card.
- **Inset / card-on-card (`size="inset"`)** → stay flat (no double-shadow).
- **Today tracker-half cards** (hero ring, meal slots, north-star) → remain
  flag-gated flat under `today_tracker_tier_v1` per ENG-1099 (Grace 2026-06-14
  "flatten all"); a deliberate, separately-tracked treatment — not reversed
  here.

## Ungated

Per Grace's standing elevation directive ("turn everything on; never flag-gate
again") and the v3 collapse-flag rollout model, the lift ships ungated — the old
flag could never be exercised in a bundled app (ENG-840) and only ever hid the
design from the founder.

## Verified

Relaunched the iOS sim and re-captured Plan + Progress: cards that were flat
slabs blending into the page now float with the soft shadow, matching the
prototype's grammar. Before/after/prototype 3-ups:
`apps/mobile/screenshots/agent/tabs-audit-2026-06-25/3up-{plan,progress}.png`.
